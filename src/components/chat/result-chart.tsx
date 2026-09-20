"use client";
import { useMemo, useState } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, XAxis, YAxis,
} from "recharts";
import { BarChart3, LineChart as LineIcon } from "lucide-react";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ResultSet } from "@/lib/types";
import type { Forecast, Series } from "@/lib/series";
import { fmtAED, fmtNum, humanise, isNumericColumn, looksLikeMoney, toNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/**
 * Decide whether a result is chartable, and how. The rule is conservative: one
 * categorical or temporal column plus one to four numeric ones, and between 2 and 60
 * rows. Anything else is a table, and a table is never wrong.
 */
export function chartPlan(r: ResultSet) {
  if (r.rows.length < 2 || r.rows.length > 60) return null;
  const numeric = r.columns.filter((c) => isNumericColumn(r.rows, c) && !/(_id|^id)$/i.test(c));
  const cats = r.columns.filter((c) => !numeric.includes(c));
  if (!numeric.length || !cats.length) return null;
  const x = cats.find((c) => /(month|date|day|week|quarter|year|period)/i.test(c)) ?? cats[0];
  const temporal = /(month|date|week|quarter|year|period)/i.test(x) && !/weekday|day_of_week|dow/i.test(x);
  const ys = numeric.filter((c) => !/(count|rows|scheduled|total_)$/i.test(c) || numeric.length === 1).slice(0, 4);
  return { x, ys: ys.length ? ys : numeric.slice(0, 4), temporal };
}

export function ResultChart({ result, series, forecast }: {
  result: ResultSet;
  series?: Series | null;
  forecast?: Forecast | null;
}) {
  const plan = useMemo(() => chartPlan(result), [result]);
  const [kind, setKind] = useState<"bar" | "line">(plan?.temporal ? "line" : "bar");

  // A projection is a line continuing a line. Forcing it onto bars reads as data.
  const projecting = !!(forecast && series && plan && kind === "line");

  const data = useMemo(() => {
    if (!plan) return [];
    // When the result is a recognised series, label the axis at the grain the series
    // actually has, so measured and projected periods read the same way: "Jan 2025",
    // not a date_trunc timestamp beside a formatted projection.
    const seriesLabel = series && plan.x === series.periodColumn
      ? new Map(series.points.map((pt) => [String(pt.raw[series.periodColumn]), pt.period.label]))
      : null;

    const rows = result.rows.map((row) => {
      const o: Record<string, unknown> = {};
      const raw = String(row[plan.x] ?? "");
      o[plan.x] = seriesLabel?.get(raw)
        ?? (plan.temporal || /^\d/.test(raw) ? raw : humanise(raw)).slice(0, 28);
      for (const y of plan.ys) o[y] = toNumber(row[y]);
      return o;
    });
    if (!projecting || !series || !forecast) return rows;

    const key = series.primary;
    const last = rows[rows.length - 1];
    if (last) {
      // Anchor the dashed line to the final measured point so it continues rather
      // than floating, and give the band zero width there.
      const v = Number(last[key]);
      last.projected = v;
      last.band = [v, v];
    }
    return [
      ...rows,
      ...forecast.points.map((p) => ({
        [plan.x]: p.period.label,
        projected: p.values[key],
        band: p.band,
      })),
    ];
  }, [plan, result.rows, projecting, series, forecast]);

  if (!plan) return null;

  const config = {
    ...Object.fromEntries(plan.ys.map((y, i) => [y, { label: humanise(y), color: PALETTE[i % PALETTE.length] }])),
    projected: { label: "Projected", color: "var(--chart-1)" },
    band: { label: "Range", color: "var(--chart-1)" },
  } as ChartConfig;

  const money = plan.ys.some(looksLikeMoney);
  const fmt = (v: number) => (money ? fmtAED(v) : fmtNum(v));
  const Chart = projecting ? ComposedChart : kind === "line" ? LineChart : BarChart;

  return (
    <div className="rounded-lg border bg-card/60">
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{plan.ys.map(humanise).join(", ")}</span>
        <span>by {humanise(plan.x)}</span>
        <div className="ml-auto flex gap-0.5">
          <Button variant={kind === "bar" ? "secondary" : "ghost"} size="icon-sm" className="size-9 sm:size-7" onClick={() => setKind("bar")} aria-label="Bar"><BarChart3 className="size-3.5" /></Button>
          <Button variant={kind === "line" ? "secondary" : "ghost"} size="icon-sm" className="size-9 sm:size-7" onClick={() => setKind("line")} aria-label="Line"><LineIcon className="size-3.5" /></Button>
        </div>
      </div>
      <ChartContainer config={config} className={cn("h-[260px] w-full border-t px-2 pt-3 pb-1")}>
        <Chart data={data} margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey={plan.x} tickLine={false} axisLine={false} tickMargin={8} fontSize={11}
                 interval={data.length > 14 ? Math.ceil(data.length / 10) : 0} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={56}
                 tickFormatter={(v) => (money ? compactAED(v) : fmtNum(v))} />
          <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => [fmt(Number(v)), " " + humanise(String(name))]} />} />

          {projecting && (
            <Area dataKey="band" stroke="none" fill="var(--color-projected)" fillOpacity={0.12}
                  isAnimationActive={false} connectNulls />
          )}
          {plan.ys.map((y) =>
            projecting || kind === "line"
              ? <Line key={y} dataKey={y} type="monotone" stroke={`var(--color-${y})`} strokeWidth={2}
                      dot={data.length <= 24} isAnimationActive={false} connectNulls={false} />
              : <Bar key={y} dataKey={y} fill={`var(--color-${y})`} radius={[4, 4, 0, 0]}
                     isAnimationActive={false} maxBarSize={44} />,
          )}
          {projecting && (
            <Line dataKey="projected" type="monotone" stroke="var(--color-projected)" strokeWidth={2}
                  strokeDasharray="5 4" dot={{ r: 2.5 }} isAnimationActive={false} connectNulls />
          )}
        </Chart>
      </ChartContainer>
    </div>
  );
}

const compactAED = (v: number) =>
  Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v);
