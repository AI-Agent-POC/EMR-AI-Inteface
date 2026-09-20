const aed = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 });
const aed2 = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });

export const fmtAED = (v: number) => (Math.abs(v) >= 1000 ? aed.format(v) : aed2.format(v));
export const fmtNum = (v: number) => (Number.isInteger(v) ? int.format(v) : num.format(v));
export const fmtInt = (v: number) => int.format(v);
export const fmtMs = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
export const fmtUsd = (v: number) => (v < 0.01 ? `$${v.toFixed(5)}` : `$${v.toFixed(3)}`);

export function fmtCell(v: unknown, col: string): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return looksLikeMoney(col) ? fmtAED(v) : fmtNum(v);
  if (typeof v === "string") {
    const n = Number(v);
    if (v.trim() !== "" && !Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(v.trim())) {
      return looksLikeMoney(col) ? fmtAED(n) : fmtNum(n);
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 16).replace("T", " ");
    return v;
  }
  return JSON.stringify(v);
}

export function looksLikeMoney(col: string): boolean {
  return /(amount|net|gross|value|revenue|balance|paid|share|vat|cost|spend|budget|actual|outstanding|denied|remitted|price|total|aed)/i.test(col)
    && !/(pct|percent|rate|count|days|hours|min|ratio|id$)/i.test(col);
}

export function isNumericColumn(rows: Record<string, unknown>[], col: string): boolean {
  let seen = 0;
  for (const r of rows.slice(0, 50)) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    seen++;
    if (typeof v === "number") continue;
    if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) continue;
    return false;
  }
  return seen > 0;
}

export const toNumber = (v: unknown): number =>
  typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;

export function humanise(col: string): string {
  return col.replace(/_/g, " ").replace(/\bpct\b/i, "%").replace(/\b\w/g, (c) => c.toUpperCase());
}
