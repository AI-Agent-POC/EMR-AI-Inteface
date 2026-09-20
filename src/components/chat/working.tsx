"use client";
import { useEffect, useState } from "react";
import type { AssistantMessage, Stage } from "@/lib/types";

/**
 * What the customer sees while the agent works, second design: no box. A sentence that
 * shimmers like ChatGPT's "Thinking", ghost lines where the answer will appear, and a
 * quiet explanation if a step runs long. Nothing technical.
 */
const PHASES: { stage: Stage; text: string; slow?: string }[] = [
  { stage: "understanding", text: "Understanding your question" },
  { stage: "retrieving",    text: "Finding the right records" },
  { stage: "generating",    text: "Thinking it through",
    slow: "Taking its time on purpose — it reasons through the question before it touches any data. Usually well under a minute." },
  { stage: "validating",    text: "Making sure it is safe and accurate" },
  { stage: "executing",     text: "Gathering the numbers",
    slow: "A big question — this is going through several years of activity." },
  { stage: "answering",     text: "Writing it up" },
];

export function Working({ m }: { m: AssistantMessage }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const clock = now || m.startedAt;
  const current = m.trace.at(-1);
  const phase = PHASES.find((p) => p.stage === current?.stage) ?? PHASES[0];
  const inPhaseMs = current ? clock - current.at : 0;
  const totalS = Math.max(0, Math.round((clock - m.startedAt) / 1000));
  const rewrites = m.repairs.length;

  return (
    <div className="pt-1.5">
      <div className="flex items-baseline gap-3">
        <span key={phase.stage} className="shimmer-text fade-swap text-[15px] font-medium">{phase.text}…</span>
        {totalS >= 3 && <span className="font-mono text-[11px] tabular-nums text-muted-foreground/60">{totalS}s</span>}
      </div>

      {(phase.slow && inPhaseMs > 6000) && (
        <p className="fade-swap mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{phase.slow}</p>
      )}
      {rewrites > 0 && (
        <p className="fade-swap mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          The first attempt was not quite right, so it is having another go.
        </p>
      )}

      {/* where the answer will land */}
      <div className="mt-4 space-y-2.5" aria-hidden>
        {[92, 76, 58].map((w, i) => (
          <div key={w} className="ghost-line h-3 rounded-full bg-foreground/[0.07]" style={{ width: `${w}%`, animationDelay: `${i * 220}ms` }} />
        ))}
      </div>
    </div>
  );
}
