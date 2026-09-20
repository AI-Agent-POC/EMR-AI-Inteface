"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AgentEvent, AssistantMessage, ConversationSummary, Message, Persona, Stage, StoredMessage,
  TraceStep, UserMessage,
} from "./types";
import { DEFAULT_PERSONA, PERSONAS } from "./personas";
import { api, askStream } from "./api";

interface Conversation { id: string | null; title: string | null; pinned: boolean; messages: Message[] }
interface Prefs { showSql: boolean; autoChart: boolean }

interface State {
  persona: Persona;
  conversation: Conversation;
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  historyLoading: boolean;
  busy: boolean;
  draft: string;                       // composer text; edit-and-resend writes here
  prefs: Prefs;
  pendingQuestion: string | null;      // set by other pages ("Ask this"), consumed by /ask

  setPersona: (p: Persona) => void;
  setDraft: (t: string) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  newConversation: () => void;
  ask: (question: string) => Promise<void>;
  regenerate: (assistantId: string) => Promise<void>;
  stop: () => void;
  queueQuestion: (q: string) => void;
  consumeQueued: () => string | null;

  loadConversations: (q?: string) => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  pinConversation: (id: string, pinned: boolean) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  feedback: (assistantId: string, score: -1 | 0 | 1) => Promise<void>;
}

let controller: AbortController | null = null;
const uid = () => Math.random().toString(36).slice(2, 10);
const EMPTY: Conversation = { id: null, title: null, pinned: false, messages: [] };

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      persona: DEFAULT_PERSONA,
      conversation: EMPTY,
      conversations: [],
      conversationsLoading: false,
      historyLoading: false,
      busy: false,
      draft: "",
      prefs: { showSql: false, autoChart: true },
      pendingQuestion: null,

      setPersona: (p) => {
        if (get().busy) get().stop();
        // A new persona is a new security context. Never carry a conversation across;
        // the history list is per principal too, so it reloads.
        set({ persona: p, conversation: EMPTY, conversations: [] });
        void get().loadConversations();
      },
      setDraft: (t) => set({ draft: t }),
      setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),

      newConversation: () => {
        if (get().busy) get().stop();
        set({ conversation: EMPTY, draft: "" });
      },

      queueQuestion: (q) => set({ pendingQuestion: q }),
      consumeQueued: () => { const q = get().pendingQuestion; set({ pendingQuestion: null }); return q; },

      stop: () => { controller?.abort(); controller = null; set({ busy: false }); },

      regenerate: async (assistantId) => {
        const m = get().conversation.messages.find((x) => x.id === assistantId);
        if (m && m.role === "assistant") await get().ask(m.question);
      },

      ask: async (question) => {
        const q = question.trim();
        if (!q || get().busy) return;
        const user: UserMessage = { id: uid(), role: "user", text: q, at: Date.now() };
        const asst: AssistantMessage = {
          id: uid(), role: "assistant", question: q, trace: [], repairs: [], answer: "",
          streaming: true, startedAt: Date.now(),
        };
        set((s) => ({
          busy: true, draft: "",
          conversation: { ...s.conversation, title: s.conversation.title ?? q.slice(0, 120),
                          messages: [...s.conversation.messages, user, asst] },
        }));

        const update = (fn: (m: AssistantMessage) => AssistantMessage) =>
          set((s) => ({
            conversation: {
              ...s.conversation,
              messages: s.conversation.messages.map((m) =>
                m.id === asst.id && m.role === "assistant" ? fn(m) : m),
            },
          }));

        controller = new AbortController();
        const subject = get().persona.subject;
        try {
          await askStream(subject, q, get().conversation.id, (ev: AgentEvent) => {
            switch (ev.type) {
              case "status":
                update((m) => {
                  const now = Date.now();
                  const trace: TraceStep[] = m.trace.map((t) => ({ ...t, done: true, durationMs: t.durationMs ?? now - t.at }));
                  trace.push({ stage: ev.stage, detail: ev.detail, tables: ev.tables, at: now, done: false });
                  return { ...m, trace };
                });
                break;
              case "sql":
                update((m) => ({ ...m, sql: { sql: ev.sql, rationale: ev.rationale,
                  assumptions: ev.assumptions ?? [], tables: ev.tables, tier: ev.tier,
                  patient_scoped: ev.patient_scoped, limit: ev.limit, attempts: ev.attempts,
                  confidence: ev.confidence } }));
                break;
              case "repair":
                update((m) => ({ ...m, repairs: [...m.repairs, { attempt: ev.attempt, reason: ev.reason, sql: ev.sql }] }));
                break;
              case "rows":
                update((m) => ({ ...m, result: { columns: ev.columns, rows: ev.rows, row_count: ev.row_count,
                  truncated: ev.truncated, elapsed_ms: ev.elapsed_ms, ran_as: ev.ran_as } }));
                break;
              case "token":
                update((m) => ({ ...m, answer: m.answer + ev.text }));
                break;
              case "rejected":
                update((m) => ({ ...m, refusal: { kind: "rejected", reason: ev.reason } }));
                break;
              case "clarify":
                update((m) => ({ ...m, refusal: { kind: "clarify", reason: ev.question } }));
                break;
              case "not_answerable":
                update((m) => ({ ...m, refusal: { kind: "not_answerable", reason: ev.reason } }));
                break;
              case "error":
                update((m) => ({ ...m, refusal: { kind: "error", reason: ev.message, code: ev.code },
                  answer: m.answer || ev.message }));
                break;
              case "done": {
                const now = Date.now();
                update((m) => ({ ...m, done: ev, streaming: false, seq: ev.seq,
                  trace: m.trace.map((t) => ({ ...t, done: true, durationMs: t.durationMs ?? now - t.at })) }));
                if (ev.conversation_id) set((s) => ({ conversation: { ...s.conversation, id: ev.conversation_id! } }));
                break;
              }
            }
          }, controller.signal);
        } catch (e) {
          if ((e as Error).name !== "AbortError") {
            update((m) => ({ ...m, streaming: false,
              refusal: { kind: "error", reason: (e as Error).message, code: "network" } }));
          }
        } finally {
          update((m) => ({ ...m, streaming: false }));
          set({ busy: false });
          controller = null;
          // The list shows the new title / bumped timestamp. Cheap, and it keeps the
          // sidebar honest without the client guessing at server-side ordering.
          void get().loadConversations();
        }
      },

      loadConversations: async (q) => {
        set({ conversationsLoading: true });
        try {
          const list = await api.conversations(get().persona.subject, q);
          set({ conversations: list });
        } catch { /* the sidebar shows what it had */ }
        finally { set({ conversationsLoading: false }); }
      },

      openConversation: async (id) => {
        if (get().conversation.id === id) return;
        if (get().busy) get().stop();
        set({ historyLoading: true, conversation: { ...EMPTY, id } });
        try {
          const d = await api.conversation(get().persona.subject, id);
          set({ conversation: { id: d.conversation_id, title: d.title, pinned: d.pinned,
                                messages: fromStored(d.messages) } });
        } catch {
          set({ conversation: EMPTY });
        } finally { set({ historyLoading: false }); }
      },

      renameConversation: async (id, title) => {
        const t = title.trim(); if (!t) return;
        set((s) => ({
          conversations: s.conversations.map((c) => (c.public_id === id ? { ...c, title: t } : c)),
          conversation: s.conversation.id === id ? { ...s.conversation, title: t } : s.conversation,
        }));
        await api.updateConversation(get().persona.subject, id, { title: t });
      },

      pinConversation: async (id, pinned) => {
        set((s) => ({
          conversations: s.conversations.map((c) => (c.public_id === id ? { ...c, pinned } : c)),
          conversation: s.conversation.id === id ? { ...s.conversation, pinned } : s.conversation,
        }));
        await api.updateConversation(get().persona.subject, id, { pinned });
        void get().loadConversations();
      },

      deleteConversation: async (id) => {
        set((s) => ({
          conversations: s.conversations.filter((c) => c.public_id !== id),
          conversation: s.conversation.id === id ? EMPTY : s.conversation,
        }));
        await api.deleteConversation(get().persona.subject, id);
      },

      feedback: async (assistantId, score) => {
        const { conversation, persona } = get();
        const m = conversation.messages.find((x) => x.id === assistantId);
        if (!m || m.role !== "assistant" || !conversation.id || !m.seq) return;
        set((s) => ({ conversation: { ...s.conversation, messages: s.conversation.messages.map((x) =>
          x.id === assistantId && x.role === "assistant" ? { ...x, feedback: score } : x) } }));
        await api.feedback(persona.subject, conversation.id, m.seq, score);
      },
    }),
    {
      name: "clinicsoft-agent",
      skipHydration: true,               // rehydrated once, client-side, in AppShell
      partialize: (s) => ({ persona: s.persona, prefs: s.prefs }),
      merge: (persisted, current) => {
        const p = (persisted as Partial<State>)?.persona;
        const persona = PERSONAS.find((x) => x.subject === p?.subject) ?? DEFAULT_PERSONA;
        const prefs = { ...current.prefs, ...((persisted as Partial<State>)?.prefs ?? {}) };
        return { ...current, persona, prefs };
      },
    },
  ),
);

/**
 * Rebuild the live message shapes from what the control plane stored, so a reopened
 * conversation carries the same stepper, query and rows the user saw at the time.
 */
function fromStored(msgs: StoredMessage[]): Message[] {
  const out: Message[] = [];
  let lastQuestion = "";
  for (const m of msgs) {
    const at = Date.parse(m.created_at);
    if (m.role === "user") {
      lastQuestion = m.content ?? "";
      out.push({ id: `s${m.seq}`, role: "user", text: lastQuestion, at, seq: m.seq });
      continue;
    }
    if (m.role !== "assistant") continue;
    const startedAt = at - (m.latency_ms ?? 0);
    const trace: TraceStep[] = (m.trace ?? []).map((t) => ({
      stage: t.stage, detail: t.detail ?? undefined, tables: t.tables ?? undefined,
      at: startedAt + t.start_ms, done: true,
      durationMs: t.end_ms !== undefined ? Math.max(0, t.end_ms - t.start_ms) : undefined,
    }));
    if (trace.length === 0) {
      // Stored before per-step timing existed: reconstruct which stages must have run
      // from what was kept. No durations, but the shape of the work is honest.
      const stages: Stage[] = ["understanding", "retrieving"];
      if (m.generated_sql) stages.push("generating", "validating");
      if (m.sql_valid && m.rows_returned !== null) stages.push("executing");
      if (m.content) stages.push("answering");
      for (const stage of stages) trace.push({ stage, at: startedAt, done: true,
        tables: stage === "retrieving" ? (m.tables_touched ?? undefined) : undefined });
    }
    const plan = m.plan ?? {};
    const refusal = m.refusal_kind
      ? { kind: m.refusal_kind, reason: m.content || m.rejection_reason || "" }
      : undefined;
    out.push({
      id: `s${m.seq}`, role: "assistant", question: lastQuestion, trace,
      sql: m.generated_sql ? {
        sql: m.generated_sql, rationale: plan.rationale ?? undefined,
        assumptions: plan.assumptions ?? [], tables: plan.tables ?? m.tables_touched ?? [],
        tier: plan.tier ?? m.tier_max ?? "open", patient_scoped: plan.patient_scoped ?? false,
        limit: plan.limit ?? undefined, attempts: plan.attempts ?? m.attempts ?? 1,
        confidence: plan.confidence ?? undefined,
      } : undefined,
      repairs: plan.repairs ?? [],
      result: m.result ?? undefined,
      answer: refusal ? "" : (m.content ?? ""),
      refusal,
      done: {
        type: "done", row_count: m.rows_returned ?? 0, attempts: m.attempts ?? 1,
        latency_ms: m.latency_ms ?? 0, model: m.model, tokens_in: m.tokens_in ?? 0,
        tokens_out: m.tokens_out ?? 0, cost_usd: Number(m.cost_usd ?? 0),
        sql_valid: !!m.sql_valid, tier_max: m.tier_max ?? "open", seq: m.seq,
      },
      streaming: false, startedAt, seq: m.seq, feedback: m.feedback,
    });
  }
  return out;
}
