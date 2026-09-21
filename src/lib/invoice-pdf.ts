/**
 * A tax invoice as a PDF, laid out the way one is read: who issued it, to whom, for
 * what, and what is still owed. Every figure comes from the invoice record; the page
 * adds nothing but arrangement.
 */
import type { Invoice } from "./types";

const aed = (v: number) => "AED " + v.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export async function invoicePdf(inv: Invoice, generatedBy: string): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 44;
  const ink: [number, number, number] = [15, 19, 32];
  const muted: [number, number, number] = [110, 118, 145];
  const line: [number, number, number] = [223, 226, 237];

  // ---- issuer
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...ink);
  doc.text(inv.branch.name, M, 50);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...muted);
  const issuer = [
    [inv.branch.address, inv.branch.po_box ? `P.O. Box ${inv.branch.po_box}` : null, inv.branch.emirate].filter(Boolean).join(", "),
    [inv.branch.phone, inv.branch.email].filter(Boolean).join("  ·  "),
    [inv.branch.trn ? `TRN ${inv.branch.trn}` : null, inv.branch.license ? `Facility licence ${inv.branch.license}` : null].filter(Boolean).join("  ·  "),
  ].filter(Boolean) as string[];
  issuer.forEach((t, i) => doc.text(t, M, 65 + i * 12));

  // ---- title block, right
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...ink);
  doc.text("TAX INVOICE", W - M, 52, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...muted);
  const paid = inv.payment_status === "paid";
  const statusWord = paid ? "PAID" : inv.payment_status === "partly_paid" ? "PARTLY PAID" : inv.payment_status.replace("_", " ").toUpperCase();
  const meta = [`No. ${inv.invoice_no}`, `Date ${day(inv.date)}`, `Status ${statusWord}`,
                `Payer ${inv.payer_mode === "insurance" && inv.insurer ? `Insurance — ${inv.insurer}` : inv.payer_mode[0].toUpperCase() + inv.payer_mode.slice(1)}`];
  meta.forEach((t, i) => doc.text(t, W - M, 70 + i * 12, { align: "right" }));

  doc.setDrawColor(...line).setLineWidth(0.8);
  doc.line(M, 122, W - M, 122);

  // ---- bill to / attended by
  let y = 142;
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...muted);
  doc.text("BILL TO", M, y); doc.text("ATTENDED BY", W / 2 + 10, y);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...ink);
  doc.text(inv.patient.name ?? `Patient ${inv.patient.mrn}`, M, y + 15);
  doc.setFontSize(8.5).setTextColor(...muted);
  doc.text(`Hospital number ${inv.patient.mrn}${inv.visit_id ? `  ·  Visit ${inv.visit_id}` : ""}`, M, y + 28);
  doc.setFontSize(10).setTextColor(...ink);
  doc.text(inv.doctor ? `Dr ${inv.doctor}` : "—", W / 2 + 10, y + 15);
  doc.setFontSize(8.5).setTextColor(...muted);
  if (inv.department) doc.text(inv.department, W / 2 + 10, y + 28);
  if (inv.authorization_no) doc.text(`Prior authorisation ${inv.authorization_no}`, W / 2 + 10, y + 40);
  y += 58;

  // ---- lines
  const ins = inv.payer_mode !== "cash";
  const head = ["#", "Description", "Qty", "Unit", "Net", "VAT", ...(ins ? ["Patient", "Insurer"] : [])];
  const body = inv.lines.map((l) => [
    String(l.no), l.code ? `${l.description}\n${l.code}` : l.description, l.qty.toString(),
    l.unit_price.toFixed(2), l.net.toFixed(2), l.vat.toFixed(2),
    ...(ins ? [l.patient_share.toFixed(2), l.insurance_share.toFixed(2)] : []),
  ]);
  autoTable(doc, {
    startY: y, head: [head], body, margin: { left: M, right: M },
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5, textColor: ink, lineColor: line, lineWidth: 0.5 },
    headStyles: { fillColor: [237, 239, 246], textColor: ink, fontStyle: "bold", fontSize: 7.5 },
    columnStyles: { 1: { cellWidth: 200 }, ...Object.fromEntries(head.slice(2).map((_, i) => [i + 2, { halign: "right" as const }])) },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  // ---- totals, right column
  const t = inv.totals;
  const rows: [string, number, boolean?][] = [
    ["Gross", t.gross], ...(t.discount ? [["Discount", -t.discount] as [string, number]] : []),
    ["Net", t.net], ["VAT", t.vat],
    ...(ins ? [["Patient share", t.patient_share] as [string, number], ["Insurance share", t.insurance_share] as [string, number]] : []),
    ["Paid by patient", -t.patient_paid],
    ...(ins && t.insurance_received ? [["Received from insurer", -t.insurance_received] as [string, number]] : []),
    ["Balance due from patient", t.patient_balance, true],
  ];
  const x0 = W - M - 220, x1 = W - M;
  rows.forEach(([label, v, strong]) => {
    if (strong) { doc.setDrawColor(...line); doc.line(x0, y - 4, x1, y - 4); y += 6; }
    doc.setFont("helvetica", strong ? "bold" : "normal").setFontSize(strong ? 10.5 : 9)
       .setTextColor(...(strong ? ink : muted));
    doc.text(label, x0, y);
    doc.setTextColor(...ink);
    doc.text(aed(v), x1, y, { align: "right" });
    y += strong ? 18 : 14;
  });

  // ---- payments
  if (inv.payments.length) {
    y += 6;
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...muted);
    doc.text("PAYMENTS RECEIVED", M, y); y += 6;
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [["Receipt", "Date", "Method", "Amount"]],
      body: inv.payments.map((p) => [p.receipt_no, day(p.date),
        [p.method, p.card_last4 ? `•••• ${p.card_last4}` : null, p.cheque_no ? `Cheque ${p.cheque_no}` : null].filter(Boolean).join(" "),
        p.amount.toFixed(2)]),
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, textColor: ink, lineColor: line, lineWidth: 0.5 },
      headStyles: { fillColor: [237, 239, 246], textColor: ink, fontStyle: "bold", fontSize: 7.5 },
      columnStyles: { 3: { halign: "right" } },
    });
  }

  // ---- footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...line).line(M, H - 56, W - M, H - 56);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...muted);
    doc.text(`Tax invoice issued under UAE VAT law${inv.branch.trn ? ` · TRN ${inv.branch.trn}` : ""}. Amounts in UAE dirhams.`, M, H - 42);
    doc.text(`Prepared by ${generatedBy} via ClinicSoft Agent, ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`, M, H - 30);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 30, { align: "right" });
  }

  doc.save(`${inv.invoice_no}.pdf`);
}
