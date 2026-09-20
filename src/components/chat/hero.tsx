"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Suggestion } from "@/lib/types";
import { Composer } from "./composer";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The landing screen. One line of context, one display headline, the composer in the
 * middle of the page, and a row of questions worth asking. Nothing else competes.
 */
export function Hero() {
  const persona = useStore((s) => s.persona);
  const ask = useStore((s) => s.ask);
  const [loaded, setLoaded] = useState<{ subject: string; items: Suggestion[] }>({ subject: "", items: [] });
  const items = loaded.subject === persona.subject ? loaded.items : null;   // null = still loading

  useEffect(() => {
    let alive = true;
    const subject = persona.subject;
    api.suggestions(subject).then((s) => alive && setLoaded({ subject, items: s }))
      .catch(() => alive && setLoaded({ subject, items: [] }));
    return () => { alive = false; };
  }, [persona.subject]);

  return (
    <div className="hero-bg flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-16">
        <div className="rise mb-5 flex items-center justify-center gap-2 text-center text-[12.5px] text-muted-foreground sm:mb-7 sm:text-[13.5px]">
          <Sparkles className="hidden size-3.5 shrink-0 text-primary sm:inline" />
          <span>Al Waha Medical &amp; Dental · 3 branches · 977k records · viewing as <span className="font-medium text-foreground/85">{persona.label}</span></span>
        </div>

        <h1 className="rise font-display text-center text-[40px] font-light leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[60px]" style={{ animationDelay: "40ms" }}>
          Ask the practice anything
        </h1>
        <p className="rise mt-4 max-w-xl text-center text-[15px] leading-relaxed text-muted-foreground" style={{ animationDelay: "80ms" }}>
          Revenue, claims, no-shows, stock, compliance — answered in plain English from the practice&apos;s own records, and only what your role may see.
        </p>

        <div className="rise mt-9 w-full" style={{ animationDelay: "120ms" }}>
          <Composer variant="hero" />
        </div>

        <div className="rise mt-6 flex w-full max-w-3xl flex-col gap-2 sm:mt-7 sm:flex-row sm:flex-wrap sm:justify-center" style={{ animationDelay: "180ms" }}>
          {items === null && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-56 rounded-full" />)}
          {items?.slice(0, 5).map((s) => (
            <button key={s.question} onClick={() => void ask(s.question)} title={s.why ?? undefined}
              className="glass max-w-full rounded-2xl border border-border/70 px-4 py-2.5 text-left text-[13.5px] leading-snug text-foreground/85 transition-colors hover:border-primary/40 hover:text-foreground sm:truncate sm:rounded-full sm:py-2 sm:text-center sm:text-[13px]">
              {s.question}
            </button>
          ))}
        </div>

        <div className="rise mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] text-muted-foreground sm:mt-10" style={{ animationDelay: "240ms" }}>
          <Link href="/insights" className="inline-flex items-center gap-1 hover:text-foreground">24 insights hidden in the data <ArrowRight className="size-3" /></Link>
          <Link href="/explore" className="inline-flex items-center gap-1 hover:text-foreground">Every table, explained <ArrowRight className="size-3" /></Link>
          <Link href="/guardrails" className="inline-flex items-center gap-1 hover:text-foreground">What it will refuse <ArrowRight className="size-3" /></Link>
        </div>
      </div>
    </div>
  );
}
