"use client";
import { useState } from "react";
import { ChevronDown, Pin, PinOff, Pencil, Trash2, Download, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtMs } from "@/lib/format";

/** Actions on the open conversation, from the header title. */
export function ConversationMenu() {
  const conv = useStore((s) => s.conversation);
  const rename = useStore((s) => s.renameConversation);
  const pin = useStore((s) => s.pinConversation);
  const remove = useStore((s) => s.deleteConversation);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState("");
  if (!conv.id) return null;
  const id = conv.id;

  const exportMd = () => {
    const lines: string[] = [`# ${conv.title ?? "Conversation"}`, ""];
    for (const m of conv.messages) {
      if (m.role === "user") { lines.push(`## You`, "", m.text, ""); continue; }
      lines.push(`## Agent`, "");
      if (m.refusal) lines.push(`> **${m.refusal.kind.replace("_", " ")}** — ${m.refusal.reason}`, "");
      if (m.answer) lines.push(m.answer, "");
      if (m.sql) lines.push("```sql", m.sql.sql, "```", "");
      if (m.result && m.result.rows.length) {
        const cols = m.result.columns;
        lines.push(`| ${cols.join(" | ")} |`, `| ${cols.map(() => "---").join(" | ")} |`);
        for (const r of m.result.rows.slice(0, 50)) lines.push(`| ${cols.map((c) => String(r[c] ?? "")).join(" | ")} |`);
        lines.push("");
      }
      if (m.done) lines.push(`_${fmtMs(m.done.latency_ms)} · ${m.done.row_count} rows · ${m.done.model ?? ""} · tier ${m.done.tier_max}_`, "");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${(conv.title ?? "conversation").slice(0, 60).replace(/[^\w\- ]+/g, "")}.md`; a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${location.origin}/ask?c=${id}`);
    toast.success("Link copied — opens for the same persona only");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" className="size-8 text-muted-foreground sm:size-6" aria-label="Conversation options" />}>
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => void pin(id, !conv.pinned)}>{conv.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}{conv.pinned ? "Unpin" : "Pin"}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setTitle(conv.title ?? ""); setRenaming(true); }}><Pencil className="size-3.5" />Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void copyLink()}><Link2 className="size-3.5" />Copy link</DropdownMenuItem>
          <DropdownMenuItem onClick={exportMd}><Download className="size-3.5" />Export as Markdown</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => void remove(id)}><Trash2 className="size-3.5" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Rename chat</DialogTitle></DialogHeader>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={120}
                 onKeyDown={(e) => { if (e.key === "Enter") { void rename(id, title); setRenaming(false); } }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(false)}>Cancel</Button>
            <Button onClick={() => { void rename(id, title); setRenaming(false); }} disabled={!title.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
