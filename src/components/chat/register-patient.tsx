"use client";
import { useEffect, useState } from "react";
import { UserRoundPlus, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import type { PatientMatch } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Register a patient without leaving the booking. Six fields — what a front desk asks
 * for anyway. Pressing "Register" is the confirmation: the button says exactly what
 * it does, and a dedicated database role can write this one table and nothing else.
 */
export function RegisterPatient({ initialName, defaultBranch, onDone, onBack }: {
  initialName: string;
  defaultBranch?: string | null;
  onDone: (p: PatientMatch) => void;
  onBack: () => void;
}) {
  const persona = useStore((s) => s.persona);
  const [first = "", ...rest] = initialName.trim().split(/\s+/);
  const [f, setF] = useState({
    first_name: first, last_name: rest.join(" "), mobile: "", date_of_birth: "",
    gender: "", nationality_code: "AE", branch_code: defaultBranch ?? "", email: "",
  });
  const [ref, setRef] = useState<{ branches: { code: string; name: string }[]; nationalities: { code: string; name: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<PatientMatch | null>(null);

  useEffect(() => {
    let alive = true;
    api.registrationReference(persona.subject).then((r) => { if (alive) setRef(r); })
      .catch(() => alive && setRef({ branches: [], nationalities: [] }));
    return () => { alive = false; };
  }, [persona.subject]);

  // The branch is derived, not stored: the booking's branch, else the only one the
  // caller may register at, else whatever they pick. Nothing depends on effect timing.
  const branch = f.branch_code || defaultBranch || ref?.branches[0]?.code || "";

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((v) => ({ ...v, [k]: e.target.value }));
  const ready = f.first_name.trim().length >= 2 && f.last_name.trim().length >= 1 &&
    f.mobile.replace(/\D/g, "").length >= 7 && !!f.date_of_birth && !!f.gender && !!branch;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true); setError(null); setExisting(null);
    try {
      const r = await api.registerPatient(persona.subject, { ...f, branch_code: branch });
      onDone(r.patient);
    } catch (err) {
      const ex = err as Error & { detail?: unknown };
      if (ex.detail && typeof ex.detail === "object") setExisting(ex.detail as PatientMatch);
      setError(ex.message);
    } finally { setBusy(false); }
  };

  const sel = "h-10 rounded-lg border bg-background px-3 text-[14px] sm:h-9";

  // Not a <form>: this sits inside the clarify card's form, and HTML forbids nesting.
  // Enter within these fields registers; it must never submit the booking around it.
  return (
    <div role="group" aria-label="New patient" className="rounded-xl border bg-background p-3.5"
      onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "SELECT") { e.preventDefault(); e.stopPropagation(); void submit(); } }}>
      <div className="mb-3 flex items-center gap-2 text-[14px] font-medium">
        <UserRoundPlus className="size-4 text-primary" />New patient
        <button type="button" onClick={onBack} className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-normal text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />Back to search
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <L label="First name"><Input value={f.first_name} onChange={set("first_name")} autoFocus className="h-10 sm:h-9" /></L>
        <L label="Last name"><Input value={f.last_name} onChange={set("last_name")} className="h-10 sm:h-9" /></L>
        <L label="Mobile"><Input value={f.mobile} onChange={set("mobile")} inputMode="tel" placeholder="05x xxx xxxx" className="h-10 font-mono sm:h-9" /></L>
        <L label="Date of birth"><Input type="date" value={f.date_of_birth} onChange={set("date_of_birth")} max={new Date().toISOString().slice(0, 10)} className="h-10 sm:h-9" /></L>
        <L label="Gender">
          <select value={f.gender} onChange={set("gender")} className={sel}>
            <option value="">Choose…</option><option value="female">Female</option><option value="male">Male</option>
          </select>
        </L>
        <L label="Nationality">
          <select value={f.nationality_code} onChange={set("nationality_code")} className={sel}>
            {(ref?.nationalities ?? [{ code: "AE", name: "United Arab Emirates" }]).map((n) => <option key={n.code} value={n.code}>{n.name}</option>)}
          </select>
        </L>
        <L label="Branch">
          <select value={branch} onChange={set("branch_code")} className={sel} disabled={(ref?.branches.length ?? 0) <= 1}>
            {(ref?.branches ?? []).map((b) => <option key={b.code} value={b.code}>{b.code} · {b.name.replace(/^.*– /, "")}</option>)}
          </select>
        </L>
        <L label="Email (optional)"><Input type="email" value={f.email} onChange={set("email")} className="h-10 sm:h-9" /></L>
      </div>

      {error && (
        <div className={cn("mt-3 rounded-lg border px-3 py-2 text-[13px]", existing ? "border-tier-restricted/40 bg-tier-restricted/[0.06]" : "border-tier-never/40 bg-tier-never/[0.06] text-tier-never")}>
          {error}
          {existing && (
            <Button type="button" size="sm" variant="outline" className="ml-2 h-7" onClick={() => onDone(existing)}>
              Use {existing.name} · {existing.mrn}
            </Button>
          )}
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void submit()} disabled={!ready || busy} className="h-10 gap-1.5 sm:h-9">
          {busy ? <Loader2 className="size-3.5 spinner" /> : <UserRoundPlus className="size-3.5" />}
          Register &amp; continue
        </Button>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <ShieldCheck className="size-3.5" />Creates the patient record now, under your name, and returns to the booking.
        </span>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground [&>*:not(:first-child)]:normal-case [&>*:not(:first-child)]:tracking-normal">
      {label}
      {children}
    </label>
  );
}
