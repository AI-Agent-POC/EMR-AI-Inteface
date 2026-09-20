"use client";
import { useEffect, useState } from "react";
import { Check, ChevronDown, Loader2, Wrench, X } from "lucide-react";
import type { AssistantMessage, Stage, TraceStep } from "@/lib/types";
import { fmtMs } from "@/lib/format";
import { cn } from "@/lib/utils";

const ORDER: Stage[] = ["understanding", "retrieving", "generating", "validating", "executing", "answering"];

/** A single sentence per stage, past or present tense depending on whether it finished. */
function describe(stage: Stage, step: TraceStep | undefined, m: AssistantMessage, live: boolean): { title: string; sub?: string } {
  const attempt = step?.detail?.match(/attempt (\d+)/)?.[1];
  switch (stage) {
    case "understanding": return { title: live ? "Reading the question" : "Read the question", sub: step?.detail?.replace("reading the schema as ", "as ") };
    case "retrieving": {
      const n = step?.tables?.length ?? 0;
      return { title: live ? "Finding the right tables" : n ? `Found ${n} relevant tables` : "Looked for relevant tables" };
    }
    case "generating": return { title: live ? "Writing SQL" : "Wrote the SQL", sub: "DeepSeek V4 Flash" + (attempt && attempt !== "1" ? ` · attempt ${attempt}` : "") };
    case "validating": {
      const repairs = m.repairs.length;
      if (live) return { title: attempt && attempt !== "1" ? `Checking the rewrite (attempt ${attempt})` : "Checking the query is safe" };
      return { title: repairs ? `Validated after ${repairs} rewrite${repairs > 1 ? "s" : ""}` : "Validated the query", sub: repairs ? undefined : "read-only · known tables · no PHI in bulk" };
    }
    case "executing": {
      const role = (step?.detail ?? "").replace("running as ", "");
      if (live) return { title: "Running it against the database", sub: role };
      return m.result ? { title: `Ran the query — ${m.result.row_count.toLocaleString()} row${m.result.row_count === 1 ? "" : "s"} in ${fmtMs(m.result.elapsed_ms)}`, sub: role } : { title: "Ran the query", sub: role };
    }
    case "answering": return { title: live ? "Writing the answer" : "Wrote the answer" };
  }
}

/**
 * The agent's working as a vertical stepper. Live: every stage with a spinner on the
 * current one and a running clock. Done: collapsed to one line, expandable to the same
 * list with how long each stage took. History and live render identically.
 */
export function AgentTrace({ m }: { m: AssistantMessage }) {
  const live = m.streaming;
  // Open while running; afterwards whatever the user last chose (default: collapsed).
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = live ? true : (choice ?? false);
  const setOpen = (fn: (o: boolean) => boolean) => setChoice(fn(open));
  // A wall clock that only ticks while the agent is working. Never read in render
  // directly; `now` falls back to the start time before the first tick.
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(id);
  }, [live]);
  const now = clock || m.startedAt;

  const reached = new Map<Stage, TraceStep>();
  for (const t of m.trace) reached.set(t.stage, t);
  const current = m.trace.at(-1);
  const failed = !!m.refusal && !live;
  const total = m.done?.latency_ms ?? now - m.startedAt;
  const stagesShown = failed ? ORDER.slice(0, ORDER.indexOf(current?.stage ?? "understanding") + 1) : ORDER;

  return (
    <div className={cn("rounded-2xl border text-[13px] transition-colors", live ? "border-primary/25 bg-primary/[0.03]" : "border-border/70 bg-card/40")}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left">
        {live ? <Loader2 className="spinner size-4 text-primary" />
          : failed ? <X className="size-4 rounded-full bg-tier-never/15 p-0.5 text-tier-never" />
          : <Check className="size-4 rounded-full bg-tier-open/15 p-0.5 text-tier-open" />}
        <span className="font-medium">
          {live ? (current ? describe(current.stage, current, m, true).title : "Starting") + "…"
            : failed ? "Stopped" : "Done"}
        </span>
        <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">{fmtMs(total)}</span>
        {!live && m.trace.length > 0 && <span className="text-muted-foreground">· {m.trace.length} steps</span>}
        {!live && m.repairs.length > 0 && <span className="inline-flex items-center gap-1 text-tier-restricted"><Wrench className="size-3" />{m.repairs.length} rewrite{m.repairs.length > 1 ? "s" : ""}</span>}
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ol className="border-t border-border/60 px-3.5 py-2">
          {stagesShown.map((stage, i) => {
            const step = reached.get(stage);
            const isLive = live && current?.stage === stage && !current.done;
            const done = !!step && !isLive;
            const todo = !step;
            const d = describe(stage, step, m, isLive);
            const dur = step ? (step.durationMs ?? (isLive ? now - step.at : undefined)) : undefined;
            const isLast = i === stagesShown.length - 1;
            return (
              <li key={stage} className="relative flex gap-3 py-1.5">
                {!isLast && <span className={cn("absolute left-[7px] top-6 h-[calc(100%-12px)] w-px", done ? "bg-tier-open/40" : "bg-border")} />}
                <span className={cn("mt-[3px] grid size-[15px] shrink-0 place-items-center rounded-full border",
                  isLive && "border-primary bg-primary text-primary-foreground",
                  done && !(failed && isLast) && "border-tier-open bg-tier-open text-white",
                  done && failed && isLast && "border-tier-never bg-tier-never text-white",
                  todo && "border-border bg-background")}>
                  {isLive ? <Loader2 className="spinner size-2.5" /> : done ? (failed && isLast ? <X className="size-2.5" /> : <Check className="size-2.5" />) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={cn(isLive ? "font-medium text-foreground" : done ? "text-foreground/85" : "text-muted-foreground/60")}>{d.title}</span>
                    {dur !== undefined && <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/70">{fmtMs(dur)}</span>}
                  </div>
                  {d.sub && (done || isLive) && <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{d.sub}</div>}
                  {stage === "retrieving" && step?.tables && step.tables.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {step.tables.slice(0, 8).map((t) => <code key={t} className="rounded bg-muted px-1.5 py-px text-[10.5px] text-muted-foreground">{t}</code>)}
                      {step.tables.length > 8 && <span className="text-[10.5px] text-muted-foreground">+{step.tables.length - 8}</span>}
                    </div>
                  )}
                  {stage === "validating" && m.repairs.length > 0 && !isLive && (
                    <ul className="mt-1 space-y-0.5">
                      {m.repairs.map((r) => (
                        <li key={r.attempt} className="flex gap-1.5 text-[12px] text-muted-foreground"><Wrench className="mt-[3px] size-3 shrink-0 text-tier-restricted" /><span>Attempt {r.attempt}: {r.reason}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
