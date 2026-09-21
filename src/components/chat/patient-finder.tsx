"use client";
import { useEffect, useRef, useState } from "react";
import { Search, Check, Loader2, UserRound, X } from "lucide-react";
import { api } from "@/lib/api";
import type { PatientMatch } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Pick a patient the way a receptionist does: by name or mobile number. The hospital
 * number is what the booking needs, but nobody should have to know it — it is chosen
 * here and carried along silently.
 */
export function PatientFinder({ value, onChange, autoFocus }: {
  value: PatientMatch | null;
  onChange: (p: PatientMatch | null) => void;
  autoFocus?: boolean;
}) {
  const persona = useStore((s) => s.persona);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientMatch[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error" | "denied">("idle");
  const [note, setNote] = useState<string | null>(null);
  const seq = useRef(0);

  // Results only count while the term that produced them is still long enough to
  // search on; a cleared box shows nothing without a state write inside the effect.
  const active = q.trim().length >= 2;
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const mine = ++seq.current;
    const id = setTimeout(async () => {
      setState("loading");
      try {
        const r = await api.searchPatients(persona.subject, term);
        if (mine !== seq.current) return;
        setResults(r.patients); setNote(r.note ?? null); setState("idle");
      } catch (e) {
        if (mine !== seq.current) return;
        const msg = (e as Error).message;
        setState(/role/i.test(msg) ? "denied" : "error");
        setNote(msg);
        setResults(null);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [q, persona.subject]);

  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-tier-open/40 bg-tier-open/10 py-1 pl-2.5 pr-1.5 text-[13px]">
          <Check className="size-3.5 text-tier-open" />
          <span className="font-medium">{value.name ?? `Patient ${value.mrn}`}</span>
          {value.mobile_hint && <span className="font-mono text-[11.5px] text-muted-foreground">{value.mobile_hint}</span>}
          {value.born && <span className="text-[11.5px] text-muted-foreground">b. {value.born}</span>}
          <button type="button" onClick={() => { onChange(null); setQ(""); }} aria-label="Change patient"
            className="ml-0.5 grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id="clarify-patient" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus}
          placeholder="Patient's name or mobile number" autoComplete="off"
          className="h-10 pl-9 text-[14px] normal-case tracking-normal sm:h-9" />
        {state === "loading" && <Loader2 className="spinner absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />}
      </div>

      {active && results && results.length > 0 && (
        <ul className="mt-1.5 overflow-hidden rounded-xl border bg-background">
          {results.map((r) => (
            <li key={r.mrn}>
              <button type="button" onClick={() => onChange(r)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-primary/[0.06]">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><UserRound className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{r.name ?? `Patient ${r.mrn}`}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {[r.mobile_hint, r.born ? `born ${r.born}` : null, r.branch].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground">{r.mrn}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {active && results && results.length === 0 && state === "idle" && (
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          {note ?? "No one by that name or number. Check the spelling — or if they're new, register them in ClinicSoft first and search again."}
        </p>
      )}
      {active && state === "denied" && <p className={cn("mt-2 text-[12.5px] text-tier-restricted")}>{note}</p>}
      {active && state === "error" && <p className="mt-2 text-[12.5px] text-tier-never">Couldn&apos;t search just now — try again.</p>}
    </div>
  );
}
