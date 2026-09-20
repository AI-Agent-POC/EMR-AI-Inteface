"use client";
import { useRouter } from "next/navigation";
import { ArrowRight, Star } from "lucide-react";
import { INSIGHTS } from "@/lib/insights";
import { PERSONAS } from "@/lib/personas";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function InsightsPage() {
  const router = useRouter();
  const persona = useStore((s) => s.persona);
  const setPersona = useStore((s) => s.setPersona);
  const queue = useStore((s) => s.queueQuestion);

  const run = (question: string, subject: string) => {
    const p = PERSONAS.find((x) => x.subject === subject);
    if (p && p.subject !== persona.subject) setPersona(p);
    queue(question);
    router.push("/ask");
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-7">
        <div className="mb-6">
          <div className="text-[12px] font-medium uppercase tracking-wider text-tier-restricted">Things worth asking about</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Insights hidden in the data</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground leading-relaxed">
            Twenty-four operational patterns a good analyst would find given a week. Each one is a question the agent answers in under thirty seconds — with the query it used, so the number can be checked.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INSIGHTS.map((i) => {
            const p = PERSONAS.find((x) => x.subject === i.persona);
            return (
              <div key={i.id} className={cn("group flex flex-col rounded-xl border bg-card p-4 transition-colors hover:border-primary/40", i.star && "ring-1 ring-tier-restricted/30")}>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="h-5 text-[10.5px]">{i.module}</Badge>
                  {i.star && <Star className="size-3.5 fill-tier-restricted text-tier-restricted" />}
                  <span className="ml-auto text-[10.5px] text-muted-foreground">#{i.id}</span>
                </div>
                <div className="mt-2.5 text-[15px] font-medium leading-snug">{i.title}</div>
                <div className="mt-1 flex-1 text-[13px] leading-relaxed text-muted-foreground">{i.headline}</div>
                <Button variant="ghost" size="sm" onClick={() => run(i.question, i.persona)}
                        className="mt-3 -mx-1.5 h-8 justify-start gap-1.5 px-1.5 text-xs text-primary hover:text-primary">
                  Ask as {p?.label.split(" ·")[0]} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
