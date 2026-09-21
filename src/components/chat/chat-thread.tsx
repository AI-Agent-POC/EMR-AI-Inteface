"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown } from "lucide-react";
import { useStore } from "@/lib/store";
import { AssistantBubble, UserBubble } from "./message";
import { Composer } from "./composer";
import { Hero } from "./hero";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function ChatThread() {
  const messages = useStore((s) => s.conversation.messages);
  const historyLoading = useStore((s) => s.historyLoading);
  const consumeQueued = useStore((s) => s.consumeQueued);
  const ask = useStore((s) => s.ask);
  const openConversation = useStore((s) => s.openConversation);
  const params = useSearchParams();
  const scroller = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);     // is the view at the bottom?
  const last = messages.at(-1);
  const lastLen = last?.role === "assistant" ? last.answer.length + (last.result?.row_count ?? 0) + last.trace.length : 0;

  useEffect(() => { if (pinned) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, lastLen, pinned]);
  useEffect(() => { const q = consumeQueued(); if (q) void ask(q); }, [consumeQueued, ask]);
  useEffect(() => { const c = params.get("c"); if (c) void openConversation(c); }, [params, openConversation]);

  const onScroll = () => {
    const el = scroller.current; if (!el) return;
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  if (messages.length === 0 && !historyLoading) return <Hero />;

  return (
    <div className="relative flex h-full flex-col">
      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-2 sm:px-6">
          {historyLoading && messages.length === 0 && (
            <div className="space-y-6 pt-6">
              <Skeleton className="ml-auto h-10 w-2/3 rounded-3xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-16 w-5/6 rounded-2xl" />
            </div>
          )}
          {messages.map((m, i) => m.role === "user" ? <UserBubble key={m.id} m={m} /> : <AssistantBubble key={m.id} m={m} latest={i === messages.length - 1} />)}
          <div ref={bottom} className="h-px" />
        </div>
      </div>

      {/* Anchored to the top of the composer, not a fixed offset, so it never lands in
          the middle of a result card on a short screen. */}
      <div className="relative shrink-0 px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        {!pinned && (
          <Button size="icon-sm" variant="outline" aria-label="Scroll to bottom"
            className="absolute -top-11 left-1/2 size-9 -translate-x-1/2 rounded-full bg-background shadow-md sm:-top-10 sm:size-8"
            onClick={() => { setPinned(true); bottom.current?.scrollIntoView({ behavior: "smooth" }); }}>
            <ArrowDown className="size-4" />
          </Button>
        )}
        <Composer variant="docked" />
        <p className="mt-2 hidden text-center text-[11px] text-muted-foreground/70 sm:block">
          Figures come straight from the practice database. Anything you are not cleared to see is never fetched.
        </p>
      </div>
    </div>
  );
}
