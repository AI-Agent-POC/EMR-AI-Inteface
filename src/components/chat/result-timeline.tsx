"use client";
import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { Series, Forecast, SeriesPoint } from "@/lib/series";
import { deltaPct } from "@/lib/series";
import { fmtAED, fmtNum, humanise, looksLikeMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The history of a measure as a vertical timeline: one node per period, what it was,
 * and how it moved. A table shows the same numbers; this shows the shape of them, and
 * it is what people mean when they ask "what has been happening".
 *
 * Projected periods continue the rail as hollow nodes, never filled ones — the visual
 * difference between measured and estimated has to survive a screenshot.
 */
export function ResultTimeline({ series, forecast }: { series: Series; forecast?: Forecast | null }) {
  const [measure, setMeasure] = useState(series.primary);
  const money = looksLikeMoney(measure);
  const fmt = (v: number) => (money ? fmtAED(v) : fmtNum(v));

  const points = useMemo<SeriesPoint[]>(
    () => [...series.points, ...(forecast && measure === series.primary ? forecast.points : [])],
    [series.points, forecast, measure, series.primary],
  );

  const scale = useMemo(() => {
    const vals = points.flatMap((p) => {
      const v = p.values[measure];
      return Number.isFinite(v) ? [v, ...(p.band ?? [])] : [];
    });
    const max = Math.max(...vals, 0);
    const min = Math.min(...vals, 0);
    const span = max - min || 1;
    return (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));
  }, [points, measure]);

  return (
    <div className="rounded-lg border bg-card/60">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground/80">{series.points.length}</span>{" "}
          {series.grain}s{forecast && measure === series.primary && <> · {forecast.points.length} projected</>}
        </span>
        {series.measures.length > 1 && (
          <div className="ml-auto flex flex-wrap gap-1">
            {series.measures.map((mm) => (
              <button key={mm} onClick={() => setMeasure(mm)}
                className={cn("rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                  mm === measure ? "border-primary/40 bg-primary/10 text-primary"
                                 : "border-transparent hover:bg-accent hover:text-foreground")}>
                {humanise(mm)}
              </button>
            ))}
          </div>
        )}
      </div>

      <ol className="border-t px-3 py-2 sm:max-h-[440px] sm:overflow-y-auto">
        {points.map((p, i) => {
          const value = p.values[measure];
          const prev = i > 0 ? points[i - 1].values[measure] : undefined;
          const delta = prev !== undefined ? deltaPct(value, prev) : null;
          const last = i === points.length - 1;
          const width = Number.isFinite(value) ? scale(value) : 0;

          return (
            <li key={p.period.date.toISOString() + measure} className="relative flex gap-3 py-2">
              {!last && (
                <span aria-hidden
                  className={cn("absolute left-[5px] top-5 h-[calc(100%-8px)] w-px",
                    p.projected ? "bg-border" : "bg-primary/25")} />
              )}
              <span aria-hidden
                className={cn("mt-[5px] size-[11px] shrink-0 rounded-full border-2",
                  p.projected ? "border-dashed border-muted-foreground/50 bg-background"
                              : "border-primary bg-primary")} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className={cn("w-full text-[13px] font-medium sm:w-auto", p.projected && "text-muted-foreground")}>
                    {p.period.label}
                  </span>
                  {p.projected && (
                    <span className="rounded-full border border-dashed border-muted-foreground/40 px-1.5 text-[10px] text-muted-foreground">
                      projected
                    </span>
                  )}
                  <span className={cn("font-mono text-[13.5px] tabular-nums sm:ml-auto",
                    p.projected ? "text-muted-foreground" : "text-foreground")}>
                    {Number.isFinite(value) ? fmt(value) : "—"}
                  </span>
                  {delta !== null && <Delta pct={delta} dimmed={!!p.projected} />}
                </div>

                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", p.projected ? "bg-muted-foreground/35" : "bg-primary")}
                    style={{ width: `${width}%` }} />
                </div>

                {p.band && (
                  <div className="mt-1 font-mono text-[10.5px] text-muted-foreground">
                    range {fmt(p.band[0])} – {fmt(p.band[1])}
                  </div>
                )}

                {!p.projected && series.measures.length > 1 && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {series.measures.filter((mm) => mm !== measure).map((mm) => (
                      <span key={mm}>
                        {humanise(mm)}{" "}
                        <span className="font-mono text-foreground/70">
                          {looksLikeMoney(mm) ? fmtAED(p.values[mm]) : fmtNum(p.values[mm])}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Delta({ pct, dimmed }: { pct: number; dimmed: boolean }) {
  const flat = Math.abs(pct) < 0.5;
  const Icon = flat ? Minus : pct > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums",
      dimmed ? "text-muted-foreground/70"
             : flat ? "text-muted-foreground" : pct > 0 ? "text-tier-open" : "text-tier-never")}>
      <Icon className="size-3" />{Math.abs(pct).toFixed(1)}%
    </span>
  );
}
