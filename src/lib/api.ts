import type {
  AgentEvent, CatalogSummary, CatalogTable, ConversationDetail, ConversationSummary,
  GuardrailReport, Suggestion, WhoAmI,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8099";
/**
 * Which tenant this browser is talking to.
 *
 * NEXT_PUBLIC_TENANT always wins. Reading the slug from the first hostname label only
 * works on a domain you control per tenant (alwaha.agent.clinicsoft.example); on a
 * platform domain it reads the deployment's own name — emr-ai-umber.vercel.app asks
 * for a tenant called "emr-ai-umber" — so it is opt-in, never a default.
 *
 * Both variables are inlined at build time, so changing either needs a redeploy, not
 * just a restart.
 */
export function currentTenant(): string {
  const configured = process.env.NEXT_PUBLIC_TENANT?.trim();
  if (configured) return configured;

  if (process.env.NEXT_PUBLIC_TENANT_FROM_SUBDOMAIN === "true" && typeof window !== "undefined") {
    const [first, ...rest] = window.location.hostname.split(".");
    if (rest.length >= 2 && !["www", "app", "localhost"].includes(first)) return first;
  }
  return "alwaha";
}

function headers(subject: string, extra: Record<string, string> = {}): HeadersInit {
  // Dev header auth. In production this becomes `Authorization: Bearer <jwt>` and the
  // backend refuses these headers outright when ENV=prod.
  return { "X-Tenant": currentTenant(), "X-Subject": subject, ...extra };
}

async function get<T>(path: string, subject: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { headers: headers(subject), cache: "no-store" });
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`;
    try { const j = await r.json(); msg = j?.error?.message ?? msg; } catch { /* keep */ }
    throw new Error(msg);
  }
  return r.json();
}

async function send<T>(method: string, path: string, subject: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method, headers: headers(subject, { "Content-Type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`;
    try { const j = await r.json(); msg = j?.error?.message ?? msg; } catch { /* keep */ }
    throw new Error(msg);
  }
  return r.json();
}

export const api = {
  conversations: (subject: string, q?: string) => {
    const p = new URLSearchParams({ limit: "100" });
    if (q) p.set("q", q);
    return get<{ conversations: ConversationSummary[] }>(`/v1/conversations?${p}`, subject).then((r) => r.conversations);
  },
  conversation: (subject: string, id: string) => get<ConversationDetail>(`/v1/conversations/${id}`, subject),
  updateConversation: (subject: string, id: string, patch: { title?: string; pinned?: boolean }) =>
    send<{ ok: true }>("PATCH", `/v1/conversations/${id}`, subject, patch),
  deleteConversation: (subject: string, id: string) => send<{ ok: true }>("DELETE", `/v1/conversations/${id}`, subject),
  feedback: (subject: string, id: string, seq: number, score: -1 | 0 | 1, note?: string) =>
    send<{ ok: true }>("POST", `/v1/conversations/${id}/messages/${seq}/feedback`, subject, { score, note }),
  me: (subject: string) => get<WhoAmI>("/v1/me", subject),
  suggestions: (subject: string) => get<Suggestion[]>("/v1/suggestions", subject),
  catalog: (subject: string) => get<CatalogSummary>("/v1/catalog", subject),
  tables: (subject: string, q?: string, module?: string) => {
    const p = new URLSearchParams({ limit: "500" });
    if (q) p.set("q", q);
    if (module) p.set("module", module);
    return get<{ tables: CatalogTable[] }>(`/v1/catalog/tables?${p}`, subject);
  },
  guardrails: () => fetch(`${API_BASE}/health/guardrails`, { cache: "no-store" })
    .then((r) => r.json() as Promise<GuardrailReport>),
  health: () => fetch(`${API_BASE}/health`, { cache: "no-store" }).then((r) => r.json()),
};

/**
 * Ask a question and receive the agent's event stream.
 *
 * Uses fetch + ReadableStream rather than EventSource, because the question goes in a
 * POST body and EventSource only speaks GET. The parser is deliberately tolerant: a
 * proxy that re-chunks the stream must not break it.
 */
export async function askStream(
  subject: string,
  question: string,
  conversationId: string | null,
  onEvent: (ev: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const r = await fetch(`${API_BASE}/v1/ask`, {
    method: "POST",
    headers: headers(subject, { "Content-Type": "application/json", Accept: "text/event-stream" }),
    body: JSON.stringify({ question, conversation_id: conversationId, stream: true }),
    signal,
  });
  if (!r.ok || !r.body) {
    let msg = `${r.status} ${r.statusText}`;
    try { const j = await r.json(); msg = j?.error?.message ?? msg; } catch { /* keep */ }
    onEvent({ type: "error", code: "http", message: msg });
    return;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName: string | null = null;
  let dataLines: string[] = [];

  const flush = () => {
    if (!dataLines.length) { eventName = null; return; }
    const raw = dataLines.join("\n");
    dataLines = [];
    eventName = null;
    try { onEvent(JSON.parse(raw) as AgentEvent); } catch { /* keep-alive or malformed; ignore */ }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      if (line === "") { flush(); continue; }
      if (line.startsWith(":")) continue;                    // comment / ping
      if (line.startsWith("event:")) { eventName = line.slice(6).trim(); continue; }
      if (line.startsWith("data:")) { dataLines.push(line.slice(5).trimStart()); continue; }
    }
  }
  flush();
}
