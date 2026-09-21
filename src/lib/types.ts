// Shapes shared with the FastAPI backend. Keep in step with backend/app/models.py.

export type Tier = "open" | "restricted" | "never";

export interface WhoAmI {
  tenant: string;
  tenant_name: string;
  subject: string;
  display_name: string | null;
  role: string;
  branch_scope: string | null;
  max_tier: Tier;
  database_role: string;
  currency: string;
  timezone: string;
}

export interface Persona {
  subject: string;
  label: string;
  role: string;
  branch?: string;
  blurb: string;
  initials: string;
}

export type Stage =
  | "understanding" | "retrieving" | "generating" | "validating"
  | "executing" | "answering";

export type AgentEvent =
  | { type: "status"; stage: Stage; detail?: string; tables?: string[]; model?: string }
  | { type: "sql"; sql: string; rationale?: string; assumptions?: string[]; tables: string[];
      tier: Tier; patient_scoped: boolean; limit?: number; attempts: number; confidence?: number }
  | { type: "repair"; attempt: number; reason: string; sql: string }
  | { type: "rejected"; reason: string; attempts: number }
  | { type: "clarify"; question: string; action?: AgentAction }
  | { type: "not_answerable"; reason: string }
  | { type: "rows"; columns: string[]; rows: Record<string, unknown>[]; row_count: number;
      truncated: boolean; elapsed_ms: number; ran_as: string }
  | { type: "token"; text: string }
  | { type: "error"; code: string; message: string; detail?: string }
  | { type: "action"; kind: ActionKind; status: ActionStatus; public_id: string | null;
      params: Record<string, unknown>; summary: string; expires_at?: string }
  | { type: "done"; row_count: number; attempts: number; latency_ms: number; model: string | null;
      tokens_in: number; tokens_out: number; cost_usd: number; sql_valid: boolean;
      tier_max: Tier; conversation_id?: string; seq?: number };

export type ActionKind = "book" | "reschedule" | "availability";
export type ActionStatus = "proposed" | "executed" | "failed" | "cancelled" | "expired" | "clarify";
export interface AgentAction {
  kind: ActionKind;
  status: ActionStatus;
  public_id: string | null;
  params: Record<string, unknown>;
  summary: string;
  expires_at?: string;
  result?: Record<string, unknown>;
  error?: string | null;
  outcome?: boolean;            // the sentence written after a confirm; the card lives on the proposal
  // for a clarify: what is settled, what is still needed
  known?: Record<string, unknown>;
  missing?: string[];
  hint?: string | null;
  new_patient?: boolean;
  options?: Record<string, string[]>;   // concrete choices for a missing field, e.g. free times
}

export interface TraceStep {
  stage: Stage;
  detail?: string;
  tables?: string[];
  at: number;
  done: boolean;
  durationMs?: number;
}

export interface SqlInfo {
  sql: string;
  rationale?: string;
  assumptions: string[];
  tables: string[];
  tier: Tier;
  patient_scoped: boolean;
  limit?: number;
  attempts: number;
  confidence?: number;
}

export interface ResultSet {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
  elapsed_ms: number;
  ran_as: string;
}

export interface Repair { attempt: number; reason: string; sql: string }

export interface AssistantMessage {
  id: string;
  role: "assistant";
  question: string;
  trace: TraceStep[];
  sql?: SqlInfo;
  repairs: Repair[];
  result?: ResultSet;
  answer: string;
  refusal?: { kind: "rejected" | "clarify" | "not_answerable" | "error"; reason: string; code?: string };
  done?: Extract<AgentEvent, { type: "done" }>;
  streaming: boolean;
  startedAt: number;
  seq?: number;                 // position in the stored conversation; needed for feedback
  feedback?: -1 | 0 | 1 | null;
  action?: AgentAction;         // a diary proposal or its outcome
}

export interface UserMessage { id: string; role: "user"; text: string; at: number; seq?: number }

// ------------------------------------------------------------- conversations
export interface ConversationSummary {
  public_id: string;
  title: string | null;
  pinned: boolean;
  created_at: string;
  last_message_at: string | null;
  questions: number;
  last_answer: string;
}

/** One stored message, as GET /v1/conversations/{id} returns it. */
export interface StoredMessage {
  seq: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  generated_sql: string | null;
  sql_valid: boolean | null;
  rejection_reason: string | null;
  rows_returned: number | null;
  tables_touched: string[] | null;
  tier_max: Tier | null;
  model: string | null;
  latency_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | string | null;
  attempts: number | null;
  refusal_kind: "rejected" | "clarify" | "not_answerable" | "error" | null;
  feedback: -1 | 0 | 1 | null;
  feedback_note: string | null;
  trace: { stage: Stage; detail?: string | null; tables?: string[] | null; start_ms: number; end_ms?: number }[] | null;
  plan: (Partial<Omit<SqlInfo, "sql">> & { repairs?: Repair[] }) | null;
  result: ResultSet | null;
  action: AgentAction | null;
  created_at: string;
}

export interface ConversationDetail {
  conversation_id: string;
  title: string | null;
  pinned: boolean;
  messages: StoredMessage[];
}
export type Message = UserMessage | AssistantMessage;

export interface CatalogSummary {
  tenant: string;
  schema_name: string;
  tables: number;
  views: number;
  columns: number;
  columns_never: number;
  columns_restricted: number;
  modules: { module: string; description?: string | null; tables: number }[];
  metrics: { code: string; name: string; unit?: string; module?: string }[];
}

export interface CatalogColumn { name: string; type: string; tier: Tier; label: string | null }
export interface CatalogTable {
  name: string; kind: "table" | "view"; module: string | null; menu_path: string | null;
  rows: number; columns: CatalogColumn[];
}

export interface PatientMatch {
  mrn: string;
  name: string | null;
  mobile_hint: string | null;
  born: number | null;
  branch: string;
}

export interface Suggestion { question: string; module?: string | null; why?: string | null }

export interface GuardrailReport {
  status: "ok" | "degraded";
  tenants: Record<string, {
    status: string; never_columns_readable?: number; write_grants?: number;
    column_grants?: number; tables_without_rls?: number; error?: string;
  }>;
}
