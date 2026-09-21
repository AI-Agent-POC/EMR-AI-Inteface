"use client";
import { useState } from "react";
import { AlertTriangle, ShieldX, HelpCircle, Ban, Copy, Check, ThumbsUp, ThumbsDown, RefreshCw, Pencil, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { AssistantMessage, UserMessage } from "@/lib/types";
import { useStore } from "@/lib/store";
import { fmtMs, fmtUsd } from "@/lib/format";
import { AgentTrace } from "./agent-trace";
import { Working } from "./working";
import { LogoMark } from "@/components/shell/logo";
import { SqlBlock } from "./sql-block";
import { ResultBlock } from "./result-block";
import { ActionCard } from "./action-card";
import { SlotPicker } from "./slot-picker";
import { ClarifyCard } from "./clarify-card";
import { Answer } from "./answer";
import { TierBadge } from "./tier-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function UserBubble({ m }: { m: UserMessage }) {
  const setDraft = useStore((s) => s.setDraft);
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(m.text); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  return (
    <div className="group flex flex-col items-end gap-1 py-4">
      <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-muted px-5 py-3 text-[15px] leading-relaxed text-foreground">{m.text}</div>
      <div className="hover-reveal flex items-center gap-0.5 pr-1 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="mr-1 text-[11px] text-muted-foreground">{time(m.at)}</span>
        <Button variant="ghost" size="icon-sm" className="size-9 text-muted-foreground sm:size-6" onClick={() => setDraft(m.text)} title="Edit and resend"><Pencil className="size-3.5" /></Button>
        <Button variant="ghost" size="icon-sm" className="size-9 text-muted-foreground sm:size-6" onClick={() => void copy()} title="Copy">{copied ? <Check className="size-3.5 text-tier-open" /> : <Copy className="size-3.5" />}</Button>
      </div>
    </div>
  );
}

export function AssistantBubble({ m, latest = true }: { m: AssistantMessage; latest?: boolean }) {
  const prefs = useStore((s) => s.prefs);
  const [details, setDetails] = useState<boolean | null>(null);
  const showDetails = details ?? prefs.showSql;
  // The working indicator lives until the first token of the answer, then gives way.
  const working = m.streaming && !m.answer && !m.refusal;
  const showAnswer = !m.refusal && (m.answer || (!m.streaming && m.result));

  return (
    <div className="group flex gap-3.5 py-3">
      <LogoMark className={cn("mt-1 size-7 rounded-lg", working && "breathe")} />
      <div className="min-w-0 flex-1 space-y-3">
        {working && <Working m={m} />}

        {m.refusal && (m.refusal.kind === "clarify"
          ? <ClarifyCard question={m.refusal.reason} action={m.action?.status === "clarify" ? m.action : undefined} interactive={latest} />
          : <RefusalCard refusal={m.refusal} />)}

        {showAnswer && (
          <div className="px-0.5">
            <Answer text={m.answer} streaming={m.streaming} />
          </div>
        )}

        {m.action && m.action.kind !== "availability" && !m.action.outcome && m.action.status !== "clarify" && <ActionCard messageId={m.id} action={m.action} />}
        {m.action?.kind === "availability" && m.result && m.result.row_count > 0 && <SlotPicker result={m.result} />}
        {m.result && m.result.row_count > 0 && m.action?.kind !== "availability" && <ResultBlock m={m} />}

        {m.done && <Actions m={m} details={showDetails} onToggleDetails={() => setDetails(!showDetails)} />}

        {/* For the analyst, the auditor, or the demo: how the answer was produced. Off by default. */}
        {m.done && showDetails && (
          <div className="rise space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-3">
            <AgentTrace m={m} />
            {m.sql && <SqlBlock sql={m.sql} repairs={m.repairs} defaultOpen />}
            <Receipts m={m} />
          </div>
        )}
      </div>
    </div>
  );
}

function Receipts({ m }: { m: AssistantMessage }) {
  const d = m.done!;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground">
      <span>{fmtMs(d.latency_ms)}</span>
      {d.sql_valid && <span>{d.row_count.toLocaleString()} rows</span>}
      <span>{fmtUsd(d.cost_usd)}</span>
      <span>{(d.model ?? "").replace("deepseek/", "")}</span>
      {d.attempts > 1 && <span>{d.attempts} attempts</span>}
      <span>{d.tokens_in.toLocaleString()} in · {d.tokens_out.toLocaleString()} out</span>
      <TierBadge tier={d.tier_max} className="ml-auto" />
    </div>
  );
}

function RefusalCard({ refusal }: { refusal: NonNullable<AssistantMessage["refusal"]> }) {
  const meta = {
    rejected:       { Icon: ShieldX,       title: "I can't show that",                 tone: "border-tier-never/40 bg-tier-never/[0.06] text-foreground" },
    not_answerable: { Icon: Ban,           title: "I can't answer that from what I have", tone: "border-tier-restricted/40 bg-tier-restricted/[0.06]" },
    clarify:        { Icon: HelpCircle,    title: "One quick question",                tone: "border-primary/40 bg-primary/[0.06]" },
    error:          { Icon: AlertTriangle, title: "Something went wrong — try again",  tone: "border-tier-never/40 bg-tier-never/[0.06]" },
  }[refusal.kind];
  return (
    <Alert className={cn("[&>svg]:size-4", meta.tone)}>
      <meta.Icon />
      <AlertTitle className="text-sm">{meta.title}</AlertTitle>
      <AlertDescription className="text-[13.5px] leading-relaxed whitespace-pre-line">
        {refusal.reason}
        {refusal.kind === "rejected" && (
          <span className="mt-1.5 block text-xs text-muted-foreground">
            Patient-identifying details are never listed in bulk, for anyone. This is the protection working as intended.
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** ChatGPT-style action row: copy, thumbs, ask again. The technical receipts sit behind "How". */
function Actions({ m, details, onToggleDetails }: { m: AssistantMessage; details: boolean; onToggleDetails: () => void }) {
  const d = m.done!;
  const busy = useStore((s) => s.busy);
  const regenerate = useStore((s) => s.regenerate);
  const feedback = useStore((s) => s.feedback);
  const [copied, setCopied] = useState(false);
  const canRate = !!m.seq;

  const copy = async () => {
    await navigator.clipboard.writeText(m.answer || m.refusal?.reason || "");
    setCopied(true); setTimeout(() => setCopied(false), 1200);
  };
  const rate = async (score: 1 | -1) => {
    const next = m.feedback === score ? 0 : score;
    await feedback(m.id, next);
    if (next !== 0) toast.success(next === 1 ? "Thanks — marked as helpful" : "Noted — marked as not helpful");
  };

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 pt-0.5">
      <Button variant="ghost" size="icon-sm" className="size-9 text-muted-foreground sm:size-6" onClick={() => void copy()} title="Copy answer">
        {copied ? <Check className="size-3.5 text-tier-open" /> : <Copy className="size-3.5" />}
      </Button>
      <Button variant="ghost" size="icon-sm" disabled={!canRate} className={cn("text-muted-foreground sm:size-6", m.feedback === 1 && "text-tier-open")} onClick={() => void rate(1)} title="Helpful">
        <ThumbsUp className={cn("size-3.5", m.feedback === 1 && "fill-current")} />
      </Button>
      <Button variant="ghost" size="icon-sm" disabled={!canRate} className={cn("text-muted-foreground sm:size-6", m.feedback === -1 && "text-tier-never")} onClick={() => void rate(-1)} title="Not helpful">
        <ThumbsDown className={cn("size-3.5", m.feedback === -1 && "fill-current")} />
      </Button>
      <Button variant="ghost" size="icon-sm" className="size-9 text-muted-foreground sm:size-6" disabled={busy} onClick={() => void regenerate(m.id)} title="Ask again">
        <RefreshCw className="size-3.5" />
      </Button>
      <span className="ml-2 text-[11.5px] text-muted-foreground/80">
        {time(m.startedAt)}{!m.action?.outcome && <> · answered in {fmtMs(d.latency_ms)}</>}
      </span>
      <Button variant="ghost" size="sm" onClick={onToggleDetails}
        className={cn("ml-auto h-8 gap-1 px-2.5 text-[12px] text-muted-foreground sm:h-6 sm:px-2 sm:text-[11.5px]", details && "text-foreground")}>
        How it got this<ChevronDown className={cn("size-3 transition-transform", details && "rotate-180")} />
      </Button>
    </div>
  );
}
