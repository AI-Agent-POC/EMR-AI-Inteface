/**
 * Time-series detection and projection.
 *
 * A result is a series when one column holds an ordered period and at least one other
 * holds a number. That is the only thing that makes a timeline or a forecast meaningful,
 * so it is decided here once and every view reads the answer.
 *
 * The projection is deliberately a plain least-squares trend, computed in the browser
 * from the rows the database returned. It is never asked of the model: the agent's whole
 * contract is that a figure it states came from the database, and a predicted figure did
 * not. Projected points are labelled as such everywhere they appear.
 */
import type { ResultSet } from "./types";
import { isNumericColumn, toNumber } from "./format";

export type Grain = "day" | "week" | "month" | "quarter" | "year";

export interface Period {
  date: Date;
  grain: Grain;
  label: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse the period forms this database actually produces. Returns null if it is not one. */
export function parsePeriod(raw: unknown): Period | null {
  if (raw == null) return null;
  const s = String(raw).trim();

  // 2026-Q1 / 2026Q1
  let m = /^(\d{4})[-\s]?Q([1-4])$/i.exec(s);
  if (m) {
    const y = +m[1], q = +m[2];
    return { date: new Date(Date.UTC(y, (q - 1) * 3, 1)), grain: "quarter", label: `Q${q} ${y}` };
  }
  // 2026-W07
  m = /^(\d{4})[-\s]?W(\d{1,2})$/i.exec(s);
  if (m) {
    const y = +m[1], w = +m[2];
    const d = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
    return { date: d, grain: "week", label: `Week ${w}, ${y}` };
  }
  // full timestamp or date
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const y = +m[1], mo = +m[2], da = +m[3];
    return { date: new Date(Date.UTC(y, mo - 1, da)), grain: "day",
             label: `${da} ${MONTHS[mo - 1]} ${y}` };
  }
  // 2026-01
  m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (m) {
    const y = +m[1], mo = +m[2];
    if (mo >= 1 && mo <= 12) {
      return { date: new Date(Date.UTC(y, mo - 1, 1)), grain: "month", label: `${MONTHS[mo - 1]} ${y}` };
    }
  }
  // bare year — only plausible ones, so a count of 2024 rows is not read as a date
  m = /^(\d{4})$/.exec(s);
  if (m) {
    const y = +m[1];
    if (y >= 1990 && y <= 2100) return { date: new Date(Date.UTC(y, 0, 1)), grain: "year", label: s };
  }
  return null;
}

/** Step a period forward by n. */
export function addPeriods(d: Date, grain: Grain, n: number): Date {
  const x = new Date(d.getTime());
  switch (grain) {
    case "day": x.setUTCDate(x.getUTCDate() + n); break;
    case "week": x.setUTCDate(x.getUTCDate() + n * 7); break;
    case "month": x.setUTCMonth(x.getUTCMonth() + n); break;
    case "quarter": x.setUTCMonth(x.getUTCMonth() + n * 3); break;
    case "year": x.setUTCFullYear(x.getUTCFullYear() + n); break;
  }
  return x;
}

export function labelFor(d: Date, grain: Grain): string {
  const y = d.getUTCFullYear(), mo = d.getUTCMonth();
  switch (grain) {
    case "day": return `${d.getUTCDate()} ${MONTHS[mo]} ${y}`;
    case "week": return `Week of ${d.getUTCDate()} ${MONTHS[mo]}`;
    case "month": return `${MONTHS[mo]} ${y}`;
    case "quarter": return `Q${Math.floor(mo / 3) + 1} ${y}`;
    case "year": return String(y);
  }
}

export interface SeriesPoint {
  period: Period;
  values: Record<string, number>;
  raw: Record<string, unknown>;
  projected?: boolean;
  /** 95% band for a projected point, on the primary measure. */
  band?: [number, number];
}

export interface Series {
  periodColumn: string;
  measures: string[];
  primary: string;
  grain: Grain;
  points: SeriesPoint[];
}

/**
 * A monthly series usually arrives as the first day of each month, because that is what
 * date_trunc returns — so the individual value looks like a day and the series is not.
 * The spacing between consecutive periods is the honest signal; trust it over the shape
 * of any single value.
 */
function inferGrain(dates: Date[], fallback: Grain): Grain {
  if (dates.length < 2) return fallback;
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push((dates[i].getTime() - dates[i - 1].getTime()) / 86_400_000);
  }
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median <= 1.5) return "day";
  if (median <= 10) return "week";
  if (median <= 45) return "month";
  if (median <= 130) return "quarter";
  return "year";
}

/**
 * Read a result as a time series, or return null. Requires ≥3 ordered periods so that a
 * timeline says something a table does not.
 */
export function asSeries(r: ResultSet): Series | null {
  if (r.rows.length < 3) return null;

  const periodColumn = r.columns.find((c) => {
    if (!/(month|date|day|week|quarter|year|period)/i.test(c)) return false;
    const parsed = r.rows.map((row) => parsePeriod(row[c]));
    return parsed.every(Boolean) && new Set(parsed.map((p) => p!.date.getTime())).size === r.rows.length;
  });
  if (!periodColumn) return null;

  const measures = r.columns.filter(
    (c) => c !== periodColumn && isNumericColumn(r.rows, c) && !/(_id|^id)$/i.test(c));
  if (!measures.length) return null;

  const points: SeriesPoint[] = r.rows
    .map((row) => {
      const period = parsePeriod(row[periodColumn])!;
      const values: Record<string, number> = {};
      for (const mcol of measures) values[mcol] = toNumber(row[mcol]);
      return { period, values, raw: row };
    })
    .sort((a, b) => a.period.date.getTime() - b.period.date.getTime());

  // Settle the grain across the whole series, then relabel so every node reads at that
  // grain: "Jan 2025", not "1 Jan 2025", for a monthly total.
  const grain = inferGrain(points.map((p) => p.period.date), points[0].period.grain);
  for (const p of points) {
    p.period = { date: p.period.date, grain, label: labelFor(p.period.date, grain) };
  }

  return { periodColumn, measures, primary: measures[0], grain, points };
}

export interface Forecast {
  points: SeriesPoint[];
  /** Change per period implied by the fitted line, on the primary measure. */
  slopePerPeriod: number;
  /** 0–1. How much of the movement the straight line explains. */
  rSquared: number;
  method: string;
}

/**
 * Least-squares trend on the primary measure, projected `horizon` periods forward with a
 * 95% band from the residual spread. Returns null when there is too little history for
 * the line to mean anything.
 */
export function project(series: Series, horizon = 3): Forecast | null {
  const ys = series.points.map((p) => p.values[series.primary]);
  if (ys.length < 4 || ys.some((v) => !Number.isFinite(v))) return null;

  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxy = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0);
  const sxx = xs.reduce((acc, x) => acc + (x - mx) ** 2, 0);
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const fit = (x: number) => intercept + slope * x;

  const ssRes = ys.reduce((acc, y, i) => acc + (y - fit(i)) ** 2, 0);
  const ssTot = ys.reduce((acc, y) => acc + (y - my) ** 2, 0);
  const rSquared = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  // Residual standard error; n-2 degrees of freedom for a fitted line.
  const se = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;

  const last = series.points[series.points.length - 1].period;
  const points: SeriesPoint[] = [];
  for (let k = 1; k <= horizon; k++) {
    const date = addPeriods(last.date, series.grain, k);
    const centre = fit(n - 1 + k);
    // The band widens with distance from the data, as a prediction interval should.
    const widen = Math.sqrt(1 + 1 / n + (n - 1 + k - mx) ** 2 / sxx);
    const half = 1.96 * se * widen;
    const values: Record<string, number> = { [series.primary]: centre };
    points.push({
      period: { date, grain: series.grain, label: labelFor(date, series.grain) },
      values, raw: {}, projected: true,
      band: [centre - half, centre + half],
    });
  }

  return {
    points,
    slopePerPeriod: slope,
    rSquared,
    method: `Least-squares trend over ${n} ${series.grain}s`,
  };
}

/** Period-on-period change on one measure, for the timeline. */
export function deltaPct(curr: number, prev: number): number | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}
