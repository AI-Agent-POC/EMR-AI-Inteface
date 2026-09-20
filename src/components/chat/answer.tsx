"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Answer({ text, streaming }: { text: string; streaming: boolean }) {
  if (!text) {
    if (!streaming) return <div className="text-[13.5px] text-muted-foreground">No answer was written.</div>;
    return (
      <div className="flex items-center gap-2 text-[13.5px] text-muted-foreground">
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" />Writing the answer…
      </div>
    );
  }
  return (
    <div className={cn("prose-answer text-[15px] leading-[1.7]", streaming && "streaming")}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
