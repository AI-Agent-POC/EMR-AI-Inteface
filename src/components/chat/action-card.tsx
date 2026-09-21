"use client";
import { useEffect, useState } from "react";
import { CalendarPlus, CalendarClock, Check, X, Loader2, ShieldCheck, Clock } from "lucide-react";
import type { AgentAction } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A proposed change to the diary, waiting for a person to say yes. Nothing happens
 * until Confirm is pressed; the button is the whole point of the design.
 */
export function ActionCard({ messageId, action }: { messageId: string; action: AgentAction }) {
  const confirm = useStore((s) => s.confirmAction);
  const cancel = useStore((s) => s.cancelAction);
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const [left, setLeft] = useState<number | null>(null);

  const proposed = action.status === "proposed";
  useEffect(() => {
    if (!proposed || !action.expires_at) return;
    const tick = () => setLeft(Math.max(0, Math.round((Date.parse(action.expires_at!) - Date.now()) / 1000)));
    tick(); const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [proposed, action.expires_at]);
  const expired = proposed && left !== null && left <= 0;

  const p = action.params ?? {};
  const r = action.result ?? {};
  const Icon = action.kind === "reschedule" ? CalendarClock : CalendarPlus;
  const title = action.kind === "reschedule" ? "Move this appointment?" : "Book this appointment?";

  const rows: [string, string | undefined][] = action.kind === "reschedule"
    ? [["Appointment", String(p.visit_id ?? "")], ["Patient", String(p.patient_mrn ?? "")],
       ["Doctor", `Dr ${p.doctor ?? ""}`], ["From", `${p.old_date ?? ""} ${p.old_time ?? ""}`],
       ["To", `${p.date ?? ""} ${p.time ?? ""}`], ["Branch", String(p.branch ?? "")]]
    : [["Patient", String(p.patient_mrn ?? "")], ["Doctor", `Dr ${p.doctor ?? ""}${p.department ? ` · ${p.department}` : ""}`],
       ["When", `${p.date ?? ""} at ${p.time ?? ""}${p.minutes ? ` · ${p.minutes} min` : ""}`],
       ["Branch", String(p.branch ?? "")], ["Reason", p.reason ? String(p.reason) : undefined]];

  const tone = action.status === "executed" ? "border-tier-open/40 bg-tier-open/[0.06]"
    : action.status === "failed" ? "border-tier-never/40 bg-tier-never/[0.06]"
    : action.status === "cancelled" || action.status === "expired" || expired ? "border-border bg-muted/40"
    : "border-primary/35 bg-primary/[0.05]";

  return (
    <div className={cn("rounded-2xl border p-4", tone)}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
          action.status === "executed" ? "bg-tier-open text-white" : "bg-primary/15 text-primary")}>
          {action.status === "executed" ? <Check className="size-4" /> : <Icon className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">
            {action.status === "executed" ? (action.kind === "reschedule" ? "Moved" : "Booked")
              : action.status === "failed" ? "Couldn't do that"
              : action.status === "cancelled" ? "Cancelled — nothing changed"
              : expired || action.status === "expired" ? "Proposal expired"
              : title}
          </div>

          <dl className="mt-2.5 grid grid-cols-[92px_1fr] gap-x-3 gap-y-1 text-[13.5px]">
            {rows.filter(([, v]) => v && v.trim()).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          {action.status === "executed" && r.visit_id ? (
            <p className="mt-2.5 text-[13.5px]">
              Reference <span className="font-mono font-medium">{String(r.visit_id)}</span>
              {r.visit_type ? <span className="text-muted-foreground"> · {String(r.visit_type).replace("_", " ")}</span> : null}
              {r.payer_mode ? <span className="text-muted-foreground"> · {String(r.payer_mode)}</span> : null}
            </p>
          ) : null}
          {action.status === "failed" && action.error && (
            <p className="mt-2.5 text-[13.5px] text-tier-never">{action.error}</p>
          )}

          {proposed && !expired && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <Button size="sm" className="h-9 gap-1.5 px-4 sm:h-8" disabled={busy !== null}
                onClick={async () => { setBusy("confirm"); try { await confirm(messageId); } finally { setBusy(null); } }}>
                {busy === "confirm" ? <Loader2 className="size-3.5 spinner" /> : <Check className="size-3.5" />}
                Confirm
              </Button>
              <Button size="sm" variant="outline" className="h-9 gap-1.5 sm:h-8" disabled={busy !== null}
                onClick={async () => { setBusy("cancel"); try { await cancel(messageId); } finally { setBusy(null); } }}>
                <X className="size-3.5" />Cancel
              </Button>
              <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                <Clock className="size-3" />{left !== null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : ""}
              </span>
            </div>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            {proposed ? "Nothing is written until you confirm. The slot is re-checked at that moment."
              : "Recorded in the audit trail under your name."}
          </p>
        </div>
      </div>
    </div>
  );
}
