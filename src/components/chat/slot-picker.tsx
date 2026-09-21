"use client";
import { useMemo } from "react";
import type { ResultSet } from "@/lib/types";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Free slots as something you can tap. Each chip drops a ready-made booking sentence
 * into the composer — the person adds the hospital number and sends. The agent then
 * proposes, and they confirm. Three taps from "who's free" to "booked".
 */
export function SlotPicker({ result }: { result: ResultSet }) {
  const setDraft = useStore((s) => s.setDraft);
  const groups = useMemo(() => {
    const g = new Map<string, { doctor: string; department: string; branch: string; days: Map<string, string[]> }>();
    for (const r of result.rows) {
      const key = String(r.doctor);
      const e = g.get(key) ?? { doctor: key, department: String(r.department ?? ""), branch: String(r.branch ?? ""), days: new Map() };
      const day = String(r.date);
      e.days.set(day, [...(e.days.get(day) ?? []), String(r.time)]);
      g.set(key, e);
    }
    return [...g.values()];
  }, [result.rows]);

  if (!groups.length) return null;
  const fmtDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.doctor} className="rounded-xl border bg-card/60 p-3">
          <div className="flex flex-wrap items-baseline gap-x-2 text-[13.5px]">
            <span className="font-medium">Dr {g.doctor}</span>
            <span className="text-muted-foreground">{g.department} · {g.branch}</span>
          </div>
          {[...g.days.entries()].map(([day, times]) => (
            <div key={day} className="mt-2.5">
              <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-muted-foreground">{fmtDay(day)}</div>
              <div className="flex flex-wrap gap-1.5">
                {times.map((t) => (
                  <button key={t} type="button"
                    onClick={() => setDraft(`Book Dr ${g.doctor} on ${day} at ${t} for patient `)}
                    className={cn("h-9 rounded-full border bg-background px-3 font-mono text-[12.5px] tabular-nums transition-colors",
                      "hover:border-primary/50 hover:bg-primary/10 hover:text-primary sm:h-8")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
      <p className="text-[12px] text-muted-foreground">Tap a time to start a booking; add the patient&apos;s hospital number and send.</p>
    </div>
  );
}
