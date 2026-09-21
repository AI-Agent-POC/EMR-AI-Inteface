/**
 * Taking a result out of the browser: CSV for a spreadsheet, PDF for a meeting.
 *
 * The PDF carries the question, the answer, the figures and the provenance — who asked,
 * as which role, when, and what sensitivity tier the query reached — because a page of
 * clinic numbers with no attribution is not something anyone should be circulating.
 */
import type { AssistantMessage, ResultSet } from "./types";
import { fmtCell, humanise, isNumericColumn } from "./format";
import { asSeries } from "./series";

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A filename from the question, so a folder of exports is readable. */
export function slugify(s: string, max = 48): string {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max)
    .replace(/-+$/, "");
  return base || "result";
}

export function exportCsv(result: ResultSet, question: string) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    result.columns.map((c) => esc(humanise(c))).join(","),
    ...result.rows.map((r) => result.columns.map((c) => esc(r[c])).join(",")),
  ].join("\r\n");
  // BOM so Excel reads UTF-8 rather than mangling accented names and the dirham sign.
  save(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${slugify(question)}.csv`);
}

/** Markdown is for the screen; a PDF wants the words. */
function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)\*([^*]+)\*/g, "$1$2")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface PdfContext {
  question: string;
  message: AssistantMessage;
  personaLabel: string;
  tenantName: string;
}

export async function exportPdf({ question, message, personaLabel, tenantName }: PdfContext) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 42;
  const indigo: [number, number, number] = [79, 93, 242];
  const ink: [number, number, number] = [15, 19, 32];
  const muted: [number, number, number] = [110, 118, 145];

  // ---------------------------------------------------------------- masthead
  doc.setFillColor(...indigo);
  doc.roundedRect(M, 38, 20, 20, 5, 5, "F");
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1.5);
  doc.setLineJoin("round");
  doc.setLineCap("round");
  // the ECG beat, scaled from the 32pt mark into the 20pt tile
  const s = 20 / 32, ox = M, oy = 38;
  const pts: [number, number][] = [
    [4.5, 18], [11, 18], [13.2, 9.6], [16.8, 22.4], [19.4, 18], [27.5, 18],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    doc.line(ox + pts[i][0] * s, oy + pts[i][1] * s, ox + pts[i + 1][0] * s, oy + pts[i + 1][1] * s);
  }

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text("ClinicSoft", M + 28, 52);
  const wm = doc.getTextWidth("ClinicSoft ");
  doc.setFont("helvetica", "normal").setTextColor(...muted);
  doc.text("Agent", M + 28 + wm, 52);

  doc.setFontSize(8.5);
  const when = new Date(message.startedAt).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  doc.text(when, W - M, 52, { align: "right" });

  doc.setDrawColor(223, 226, 237).setLineWidth(0.8);
  doc.line(M, 70, W - M, 70);

  let y = 96;

  // ---------------------------------------------------------------- question
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...muted);
  doc.text("QUESTION", M, y);
  y += 15;
  doc.setFont("helvetica", "normal").setFontSize(13).setTextColor(...ink);
  const qLines = doc.splitTextToSize(question, W - M * 2) as string[];
  doc.text(qLines, M, y);
  y += qLines.length * 16 + 16;

  // ---------------------------------------------------------------- answer
  const answer = plainText(message.answer || message.refusal?.reason || "");
  if (answer) {
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...muted);
    doc.text("ANSWER", M, y);
    y += 14;
    doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(...ink);
    const aLines = doc.splitTextToSize(answer, W - M * 2) as string[];
    doc.text(aLines, M, y, { lineHeightFactor: 1.45 });
    y += aLines.length * 15 + 16;
  }

  // ---------------------------------------------------------------- figures
  const r = message.result;
  if (r && r.rows.length) {
    const numeric = new Set(r.columns.filter((c) => isNumericColumn(r.rows, c)));
    // Periods read as periods on the page, the way they do on screen.
    const series = asSeries(r);
    const periodLabel = series
      ? new Map(series.points.map((pt) => [String(pt.raw[series.periodColumn]), pt.period.label]))
      : null;
    const cell = (row: Record<string, unknown>, c: string) =>
      (series && c === series.periodColumn ? periodLabel!.get(String(row[c])) : undefined)
        ?? fmtCell(row[c], c);
    autoTable(doc, {
      startY: y,
      head: [r.columns.map(humanise)],
      body: r.rows.slice(0, 500).map((row) => r.columns.map((c) => cell(row, c))),
      margin: { left: M, right: M },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: ink, lineColor: [223, 226, 237], lineWidth: 0.5 },
      headStyles: { fillColor: [237, 239, 246], textColor: ink, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [249, 250, 252] },
      columnStyles: Object.fromEntries(
        r.columns.map((c, i) => [i, numeric.has(c) ? { halign: "right" as const } : {}]),
      ),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
    if (r.rows.length > 500) {
      doc.setFontSize(8).setTextColor(...muted);
      doc.text(`Showing the first 500 of ${r.row_count.toLocaleString()} rows.`, M, y);
      y += 14;
    }
  }

  // ---------------------------------------------------------------- footer
  const d = message.done;
  const provenance = [
    `Asked by ${personaLabel}`,
    tenantName,
    d ? `${d.row_count.toLocaleString()} rows` : null,
    d ? `answered in ${(d.latency_ms / 1000).toFixed(1)}s` : null,
    d ? `sensitivity: ${d.tier_max}` : null,
  ].filter(Boolean).join("  ·  ");

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(223, 226, 237).setLineWidth(0.8);
    doc.line(M, H - 54, W - M, H - 54);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...muted);
    doc.text(provenance, M, H - 40);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 40, { align: "right" });
    doc.text(
      "Measured figures from the clinic database, excluding any on-screen projection. " +
      "Confidential — handle under your practice's data policy.",
      M, H - 28,
    );
  }

  doc.save(`${slugify(question)}.pdf`);
}
