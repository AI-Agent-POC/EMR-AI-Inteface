const aed = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 });
const aed2 = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });

export const fmtAED = (v: number) => (Math.abs(v) >= 1000 ? aed.format(v) : aed2.format(v));
export const fmtNum = (v: number) => (Number.isInteger(v) ? int.format(v) : num.format(v));
export const fmtInt = (v: number) => int.format(v);
export const fmtMs = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
export const fmtUsd = (v: number) => (v < 0.01 ? `$${v.toFixed(5)}` : `$${v.toFixed(3)}`);

/**
 * A patient number, an invoice number or a phone number is a label that happens to be
 * written in digits. Formatting one as a quantity turns 108002 into "108,002", which is
 * not the number anybody can look the patient up by.
 */
export function isIdentifier(col: string): boolean {
  return /^(mrn|hospital_number|.*_no|.*_id|.*_code|.*_ref|.*_number|mobile|telephone|phone)$/i
    .test(col.trim());
}

export function fmtCell(v: unknown, col: string): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (isIdentifier(col)) return String(v);
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
  if (isIdentifier(col)) return false;     // digits, but not a quantity: never right-align
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

/**
 * Column names as the practice says them out loud. A header is the only explanation a
 * figure gets, so "mrn" — which means nothing to anyone outside a records office — reads
 * as the patient number it is. Anything not listed falls back to title case.
 */
const LABELS: Record<string, string> = {
  mrn: "Patient No.",
  patient_no: "Patient No.",
  patient_mrn: "Patient No.",
  patient_number: "Patient No.",
  hospital_number: "Patient No.",
  patient_name: "Patient",
  patient_category: "Category",
  visit_id: "Visit ID",
  invoice_no: "Invoice No.",
  receipt_no: "Receipt No.",
  claim_no: "Claim No.",
  policy_no: "Policy No.",
  member_id: "Member ID",
  dob: "Date of Birth",
  date_of_birth: "Date of Birth",
  no_shows: "No-shows",
  vat: "VAT",
  vat_amount: "VAT",
  trn: "TRN",
  mobile: "Mobile",
  branch: "Branch",
  branch_code: "Branch",
  doctor: "Doctor",
  active_policies: "Insurance",
  open_treatment_plans: "Open Treatment Plans",
  lifetime_net: "Lifetime Value",
  patient_balance: "Balance Due",
};

export function humanise(col: string): string {
  const known = LABELS[col.trim().toLowerCase()];
  if (known) return known;
  return col.replace(/_/g, " ").replace(/\bpct\b/i, "%").replace(/\b\w/g, (c) => c.toUpperCase());
}
