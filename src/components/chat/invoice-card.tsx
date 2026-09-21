"use client";
import { useState } from "react";
import { FileText, Download, MessageCircle, MessageSquare, Mail, Check, Loader2, X, Send } from "lucide-react";
import type { AgentAction, Invoice } from "@/lib/types";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { invoicePdf } from "@/lib/invoice-pdf";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const aed = (v: number) => "AED " + v.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

type Channel = "whatsapp" | "sms" | "email";
const CHANNELS: { id: Channel; label: string; Icon: typeof Mail }[] = [
  { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
  { id: "sms", label: "SMS", Icon: MessageSquare },
  { id: "email", label: "Email", Icon: Mail },
];

/**
 * One invoice, as a person reads it, with the two things they can do with it: take the
 * PDF, or send it to the patient. Sending is one press per channel and puts a row in the
 * practice's own outbox — the same queue the gateway already drains for reminders.
 */
export function InvoiceCard({ action }: { action: AgentAction }) {
  const inv = action.invoice as Invoice | undefined;
  const persona = useStore((s) => s.persona);
  const preferred = (action.params?.channel as Channel | null | undefined) ?? null;
  const [arm, setArm] = useState<Channel | null>(preferred);
  const [busy, setBusy] = useState<"pdf" | Channel | null>(null);
  const [sent, setSent] = useState<Record<string, { ref: string; to: string }>>({});
  const [error, setError] = useState<string | null>(null);
  if (!inv) return null;

  const t = inv.totals;
  const paid = inv.payment_status === "paid";
  const ins = inv.payer_mode !== "cash";
  const status = paid ? { text: "Paid", cls: "bg-tier-open/12 text-tier-open border-tier-open/30" }
    : inv.payment_status === "partly_paid" ? { text: "Partly paid", cls: "bg-tier-restricted/12 text-tier-restricted border-tier-restricted/35" }
    : inv.payment_status === "written_off" ? { text: "Written off", cls: "bg-muted text-muted-foreground border-border" }
    : { text: "Unpaid", cls: "bg-tier-never/12 text-tier-never border-tier-never/35" };

  const download = async () => {
    setBusy("pdf"); setError(null);
    try { await invoicePdf(inv, persona.label); } catch { setError("Couldn't build the PDF — try again."); }
    finally { setBusy(null); }
  };
  const send = async (ch: Channel) => {
    setBusy(ch); setError(null);
    try {
      const r = await api.sendInvoice(persona.subject, inv.invoice_no, ch);
      setSent((s) => ({ ...s, [ch]: { ref: r.sent.message_ref, to: r.sent.to } }));
      setArm(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-card/60">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-3">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary"><FileText className="size-4" /></span>
        <div className="min-w-0">
          <div className="text-[14.5px] font-medium">Tax invoice <span className="font-mono">{inv.invoice_no}</span></div>
          <div className="text-[12px] text-muted-foreground">{day(inv.date)} · {inv.branch.code} · {ins && inv.insurer ? `Insurance — ${inv.insurer}` : "Cash"}</div>
        </div>
        <span className={cn("ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium", status.cls)}>{status.text}</span>
      </div>

      <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-1 px-4 py-3 text-[13.5px] sm:grid-cols-[92px_1fr_92px_1fr]">
        <dt className="text-muted-foreground">Patient</dt><dd className="font-medium">{inv.patient.name ?? `Patient ${inv.patient.mrn}`}<span className="ml-1.5 font-mono text-[11.5px] text-muted-foreground">{inv.patient.mrn}</span></dd>
        <dt className="text-muted-foreground">Doctor</dt><dd className="font-medium">{inv.doctor ? `Dr ${inv.doctor}` : "—"}{inv.department && <span className="text-muted-foreground"> · {inv.department}</span>}</dd>
      </dl>

      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-[520px] text-[13px]">
          <thead><tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 text-left font-medium">Item</th><th className="px-2 py-2 text-right font-medium">Qty</th>
            <th className="px-2 py-2 text-right font-medium">Net</th><th className="px-2 py-2 text-right font-medium">VAT</th>
            {ins && <><th className="px-2 py-2 text-right font-medium">Patient</th><th className="px-4 py-2 text-right font-medium">Insurer</th></>}
          </tr></thead>
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.no} className="border-t border-border/60">
                <td className="px-4 py-2"><div>{l.description}</div>{l.code && <div className="font-mono text-[11px] text-muted-foreground">{l.code}</div>}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">{l.qty}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">{l.net.toFixed(2)}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">{l.vat.toFixed(2)}</td>
                {ins && <><td className="px-2 py-2 text-right font-mono tabular-nums">{l.patient_share.toFixed(2)}</td><td className="px-4 py-2 text-right font-mono tabular-nums">{l.insurance_share.toFixed(2)}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 border-t px-4 py-3 sm:grid-cols-2">
        <div className="space-y-1 text-[13px]">
          {inv.payments.length ? (
            <>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Payments received</div>
              {inv.payments.map((p) => (
                <div key={p.receipt_no + p.date} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{day(p.date)} · {p.method ?? "—"}{p.card_last4 ? ` •••• ${p.card_last4}` : ""}</span>
                  <span className="font-mono tabular-nums">{p.amount.toFixed(2)}</span>
                </div>
              ))}
            </>
          ) : <div className="text-[12.5px] text-muted-foreground">No payments recorded against this invoice.</div>}
        </div>
        <div className="space-y-1 text-[13px] sm:justify-self-end sm:min-w-[240px]">
          <Row k="Net" v={t.net} /><Row k="VAT" v={t.vat} />
          {ins && <><Row k="Patient share" v={t.patient_share} /><Row k="Insurance share" v={t.insurance_share} /></>}
          <Row k="Paid by patient" v={t.patient_paid} />
          <div className="mt-1.5 flex justify-between border-t pt-1.5 text-[14px] font-semibold">
            <span>Balance due</span><span className={cn("font-mono tabular-nums", t.patient_balance > 0 ? "text-tier-never" : "text-tier-open")}>{aed(t.patient_balance)}</span>
          </div>
        </div>
      </div>

      <div className="border-t bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 sm:h-8" onClick={() => void download()} disabled={busy !== null}>
            {busy === "pdf" ? <Loader2 className="size-3.5 spinner" /> : <Download className="size-3.5" />}Download PDF
          </Button>
          <span className="mx-1 hidden text-[12px] text-muted-foreground sm:inline">Send to the patient by</span>
          {CHANNELS.map(({ id, label, Icon }) => sent[id] ? (
            <span key={id} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-tier-open/40 bg-tier-open/10 px-2.5 text-[12.5px] text-tier-open sm:h-8">
              <Check className="size-3.5" />{label} queued
            </span>
          ) : (
            <Button key={id} variant={arm === id ? "default" : "outline"} size="sm" className="h-9 gap-1.5 sm:h-8"
              onClick={() => setArm(arm === id ? null : id)} disabled={busy !== null}>
              <Icon className="size-3.5" />{label}
            </Button>
          ))}
        </div>

        {arm && !sent[arm] && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.05] px-3 py-2 text-[13px]">
            <Send className="size-3.5 text-primary" />
            <span>Send invoice <span className="font-mono">{inv.invoice_no}</span> to the patient&apos;s {arm === "email" ? "email address" : "mobile"} by <b>{CHANNELS.find((c) => c.id === arm)!.label}</b>?</span>
            <span className="text-[12px] text-muted-foreground">Goes into the practice&apos;s outbox; the gateway delivers it.</span>
            <span className="ml-auto flex gap-1.5">
              <Button size="sm" className="h-8" onClick={() => void send(arm)} disabled={busy !== null}>
                {busy === arm ? <Loader2 className="size-3.5 spinner" /> : <Send className="size-3.5" />}Send
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setArm(null)} disabled={busy !== null}><X className="size-3.5" /></Button>
            </span>
          </div>
        )}
        {Object.entries(sent).map(([ch, s]) => (
          <p key={ch} className="mt-2 text-[12.5px] text-muted-foreground">
            Queued by {ch} to <span className="font-mono">{s.to}</span> · reference <span className="font-mono">{s.ref}</span>. Recorded in the audit trail under your name.
          </p>
        ))}
        {error && <p className="mt-2 text-[12.5px] text-tier-never">{error}</p>}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="font-mono tabular-nums">{v.toFixed(2)}</span></div>;
}
