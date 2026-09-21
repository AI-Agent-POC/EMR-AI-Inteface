"use client";
import { useState } from "react";
import { ArrowRight, CalendarSearch, MessageCircleQuestion, ShieldAlert, Check } from "lucide-react";
import type { AgentAction, PatientMatch } from "@/lib/types";
import { PatientFinder } from "./patient-finder";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The agent needs one more thing before it can act. Rather than a bare sentence and a
 * blank box, this shows what is already settled, asks only for the gap, and sends a
 * complete request when the person fills it — so the follow-up never depends on the
 * agent guessing what a bare "100015" refers to.
 */
const FIELD: Record<string, { label: string; type: "text" | "date" | "time"; placeholder?: string; mono?: boolean }> = {
  patient_mrn: { label: "Patient", type: "text" },
  doctor:      { label: "Doctor", type: "text", placeholder: "e.g. Dr Fatima Khan" },
  date:        { label: "Date", type: "date" },
  time:        { label: "Time", type: "time" },
  new_date:    { label: "New date", type: "date" },
  new_time:    { label: "New time", type: "time" },
};

const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export function ClarifyCard({ question, action, interactive = true }: { question: string; action?: AgentAction; interactive?: boolean }) {
  const ask = useStore((s) => s.ask);
  const busy = useStore((s) => s.busy);
  const [values, setValues] = useState<Record<string, string>>({});
  const [patient, setPatient] = useState<PatientMatch | null>(null);
  const [sent, setSent] = useState(false);

  const known = (action?.known ?? {}) as Record<string, string | number | boolean | null>;
  const missing = (action?.missing ?? []).filter((m) => m in FIELD);
  const kind = action?.kind;
  const structured = !!action && action.status === "clarify" && missing.length > 0 && interactive;

  // What is already settled, shown as pills so the person can see the request forming.
  const pills: [string, string][] = [];
  if (kind === "reschedule") {
    if (known.visit_id) pills.push(["Appointment", String(known.visit_id)]);
    if (known.doctor) pills.push(["Doctor", `Dr ${known.doctor}`]);
    if (known.old_date) pills.push(["Currently", `${fmtDate(String(known.old_date))} ${known.old_time ?? ""}`.trim()]);
    if (known.new_date) pills.push(["Moving to", fmtDate(String(known.new_date))]);
  } else {
    if (known.doctor) pills.push(["Doctor", `Dr ${known.doctor}`]);
    else if (known.department) pills.push(["Department", String(known.department)]);
    if (known.date) pills.push(["Date", fmtDate(String(known.date))]);
    if (known.time) pills.push(["Time", String(known.time)]);
    if (known.patient_mrn) pills.push(["Patient", String(known.patient_mrn)]);
  }

  const complete = missing.every((m) => (values[m] ?? "").trim());
  const options = action?.options ?? {};

  const composeWith = (vals: Record<string, string>): string => {
    const v = (k: string) => (vals[k] ?? String(known[k] ?? "")).trim();
    if (kind === "reschedule") {
      const target = v("visit_id") || (known.patient_mrn ? `for patient ${known.patient_mrn}` : "");
      return `Move appointment ${target} to ${v("new_date")} at ${v("new_time")}`;
    }
    const doctor = v("doctor").replace(/^dr\.?\s*/i, "");
    return `Book Dr ${doctor} on ${v("date")} at ${v("time")} for patient ${v("patient_mrn")}`;
  };

  const submit = () => {
    if (!complete || busy) return;
    setSent(true);
    void ask(composeWith(values));
  };

  const showFree = () => {
    const doctor = String(known.doctor ?? "");
    const day = String(known.new_date ?? known.date ?? "");
    const who = doctor ? `Dr ${doctor}` : (known.department ? `a ${known.department} doctor` : "the doctors");
    void ask(day ? `When is ${who} free on ${day}?` : `When is ${who} next available?`);
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <MessageCircleQuestion className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">
            {action?.new_patient ? "Who is this appointment for?"
              : missing.length === 1 && missing[0] === "patient_mrn" ? "Who is this appointment for?"
              : "Almost there — one more detail"}
          </div>
          <p className="mt-1 text-[14px] leading-relaxed text-foreground/85">
            {action?.new_patient
              ? "If they're new to the practice, register them in ClinicSoft first (Registration → New patient), then find them here and I'll book this straight in."
              : missing.length === 1 && missing[0] === "patient_mrn"
                ? "Find the patient by name or mobile number and I'll put this in the diary."
                : question}
          </p>

          {pills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pills.map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[12px]">
                  <Check className="size-3 text-tier-open" />
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </span>
              ))}
            </div>
          )}

          {action?.hint && (
            <p className={cn("mt-3 flex items-start gap-1.5 text-[12.5px] leading-relaxed",
              action.new_patient ? "text-tier-restricted" : "text-muted-foreground")}>
              {action.new_patient && <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />}
              {action.new_patient ? "Please don't type their name, phone or date of birth into the chat — search for them below instead." : action.hint}
            </p>
          )}

          {structured && !sent && (
            <form className="mt-3.5 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              {missing.map((m) => options[m]?.length ? (
                // Concrete choices: one tap picks and sends.
                <div key={m} className="flex w-full flex-col gap-1.5">
                  <span className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">{FIELD[m].label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {options[m].map((opt) => (
                      <button key={opt} type="button" disabled={busy}
                        onClick={() => { const next = { ...values, [m]: opt }; setValues(next);
                          if (missing.every((x) => (next[x] ?? "").trim())) { setSent(true); void ask(composeWith(next)); } }}
                        className={cn("h-9 rounded-full border bg-background px-3.5 font-mono text-[13px] tabular-nums transition-colors",
                          "hover:border-primary/50 hover:bg-primary/10 hover:text-primary",
                          values[m] === opt && "border-primary bg-primary/10 text-primary")}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : m === "patient_mrn" ? (
                // The label is uppercase; the patient's name must not be.
                <div key={m} className="flex w-full flex-col gap-1">
                  <span className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">Patient</span>
                  <PatientFinder value={patient} autoFocus={missing[0] === m}
                    onChange={(pt) => { setPatient(pt); setValues((v) => ({ ...v, patient_mrn: pt?.mrn ?? "" })); }} />
                </div>
              ) : (() => {
                const f = FIELD[m];
                return (
                  <label key={m} className="flex min-w-[150px] flex-1 flex-col gap-1 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground sm:max-w-[220px]">
                    {f.label}
                    <Input id={`clarify-${m}`} type={f.type} placeholder={f.placeholder} autoFocus={missing[0] === m}
                      value={values[m] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [m]: e.target.value }))}
                      className={cn("h-10 text-[14px] normal-case tracking-normal sm:h-9", f.mono && "font-mono")} />
                  </label>
                );
              })())}
              {!missing.every((m) => options[m]?.length) && (
                <Button type="submit" disabled={!complete || busy} className="h-10 gap-1.5 sm:h-9">
                  Continue<ArrowRight className="size-3.5" />
                </Button>
              )}
              {(missing.includes("time") || missing.includes("new_time")) && (known.doctor || known.department) && (
                <Button type="button" variant="outline" className="h-10 gap-1.5 sm:h-9" disabled={busy} onClick={showFree}>
                  <CalendarSearch className="size-3.5" />Show what&apos;s free
                </Button>
              )}
            </form>
          )}
          {sent && <p className="mt-3 text-[12.5px] text-muted-foreground">Sent — carrying on below.</p>}
          {!structured && interactive && (
            <p className="mt-3 text-[12.5px] text-muted-foreground">Reply below and I&apos;ll carry on.</p>
          )}
        </div>
      </div>
    </div>
  );
}
