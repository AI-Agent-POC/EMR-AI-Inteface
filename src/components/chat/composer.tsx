"use client";
import { useEffect, useRef } from "react";
import { ArrowUp, Square, ListTree, BarChart3, Mic, MicOff } from "lucide-react";
import { useSpeech } from "@/lib/use-speech";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/**
 * One composer, two placements. `hero` sits in the middle of the landing screen and is
 * tall; `docked` sits under the thread. Both share the draft, so an edited question
 * lands here from anywhere.
 */
export function Composer({ variant = "docked" }: { variant?: "hero" | "docked" }) {
  const text = useStore((s) => s.draft);
  const setText = useStore((s) => s.setDraft);
  const busy = useStore((s) => s.busy);
  const ask = useStore((s) => s.ask);
  const stop = useStore((s) => s.stop);
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const ref = useRef<HTMLTextAreaElement>(null);
  const hero = variant === "hero";

  // Dictation appends to whatever was typed; the typed part is frozen when the mic
  // starts so interim results can be replaced without eating it.
  const base = useRef("");
  const speech = useSpeech((spoken) => setText((base.current ? base.current + " " : "") + spoken));
  const toggleMic = () => {
    if (speech.listening) { speech.stop(); return; }
    base.current = text.trim();
    speech.start();
  };
  useEffect(() => { if (speech.error) toast.error(speech.error); }, [speech.error]);

  useEffect(() => { ref.current?.focus(); }, [variant]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.max(hero ? 56 : 24, Math.min(el.scrollHeight, 220)) + "px";
  }, [text, hero]);

  const submit = () => { if (!busy && text.trim()) void ask(text); };

  return (
    <div className={cn("mx-auto w-full", hero ? "max-w-3xl" : "max-w-3xl")}>
      <div className={cn(
        "relative rounded-[26px] border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_30px_-12px_rgba(30,40,90,0.18)] transition-shadow",
        "focus-within:border-primary/40 focus-within:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(77,107,254,0.35)]",
        hero && "glass")}>
        <textarea ref={ref} value={text} rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={speech.listening ? "Listening…" : hero ? "Ask anything about the practice" : "Ask a follow-up"}
          className={cn("w-full resize-none bg-transparent px-5 outline-none placeholder:text-muted-foreground/60",
            hero ? "pt-5 pb-14 text-[16px]" : "pt-4 pb-12 text-[15px]")} />
        <div className="absolute inset-x-3 bottom-2.5 flex items-center gap-1.5">
          <Chip active={prefs.showSql} onClick={() => setPrefs({ showSql: !prefs.showSql })} title="Show how each answer was produced — the steps, the query, the checks">
            <ListTree className="size-3.5" />Details
          </Chip>
          <Chip active={prefs.autoChart} onClick={() => setPrefs({ autoChart: !prefs.autoChart })} title="Draw a chart when the result suits one">
            <BarChart3 className="size-3.5" />Chart
          </Chip>
          <span className="ml-auto mr-2 hidden text-[11px] text-muted-foreground/70 sm:inline"><Kbd>⏎</Kbd> send · <Kbd>⇧⏎</Kbd> newline</span>
          {speech.supported && (
            <Button size="icon" variant={speech.listening ? "destructive" : "ghost"} onClick={toggleMic}
              className={cn("size-9 rounded-full", !speech.listening && "text-muted-foreground", speech.listening && "breathe")}
              aria-label={speech.listening ? "Stop dictating" : "Dictate a question"} title={speech.listening ? "Stop" : "Speak your question"}>
              {speech.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Button>
          )}
          {busy ? (
            <Button size="icon" className="size-9 rounded-full" variant="secondary" onClick={stop} aria-label="Stop"><Square className="size-3.5 fill-current" /></Button>
          ) : (
            <Button size="icon" className="size-9 rounded-full" onClick={submit} disabled={!text.trim()} aria-label="Send"><ArrowUp className="size-4" /></Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-pressed={active}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors",
        active ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground")}>
      {children}
    </button>
  );
}
