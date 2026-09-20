"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MoreHorizontal, Pin, PinOff, Pencil, Trash2, Search, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ConversationSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** ChatGPT-style history: pinned first, then grouped by day. Rename, pin and delete inline. */
export function ConversationList({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const path = usePathname();
  const list = useStore((s) => s.conversations);
  const loading = useStore((s) => s.conversationsLoading);
  const load = useStore((s) => s.loadConversations);
  const current = useStore((s) => s.conversation.id);
  const persona = useStore((s) => s.persona);
  const open = useStore((s) => s.openConversation);
  const [q, setQ] = useState("");
  const [rename, setRename] = useState<ConversationSummary | null>(null);
  const [del, setDel] = useState<ConversationSummary | null>(null);

  useEffect(() => { void load(); }, [load, persona.subject]);
  useEffect(() => {
    const id = setTimeout(() => void load(q.trim() || undefined), q ? 250 : 0);
    return () => clearTimeout(id);
  }, [q, load]);

  const groups = useMemo(() => groupByDay(list), [list]);

  const go = (id: string) => {
    void open(id);
    if (path !== "/ask") router.push("/ask");
    onNavigate?.();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats"
                 className="h-8 rounded-lg border-transparent bg-sidebar-accent/60 pl-8 pr-7 text-[13px] shadow-none focus-visible:bg-background" />
          {q && <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear"><X className="size-3.5" /></button>}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading && list.length === 0 && (
          <div className="space-y-1.5 px-1 pt-1">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 rounded-md" />)}</div>
        )}
        {!loading && list.length === 0 && (
          <div className="px-2 pt-6 text-center text-[12.5px] leading-relaxed text-muted-foreground">
            {q ? "No chats match that." : <>No chats yet as <span className="text-foreground/80">{persona.label}</span>. Ask something and it lands here.</>}
          </div>
        )}
        {groups.map(({ label, items }) => (
          <div key={label} className="pt-3 first:pt-1">
            <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground/80">{label}</div>
            {items.map((c) => (
              <ConversationRow key={c.public_id} c={c} active={c.public_id === current}
                onOpen={() => go(c.public_id)} onRename={() => setRename(c)} onDelete={() => setDel(c)} />
            ))}
          </div>
        ))}
      </div>

      <RenameDialog key={rename?.public_id ?? "none"} c={rename} onClose={() => setRename(null)} />
      <DeleteDialog c={del} onClose={() => setDel(null)} />
    </div>
  );
}

function ConversationRow({ c, active, onOpen, onRename, onDelete }: {
  c: ConversationSummary; active: boolean; onOpen: () => void; onRename: () => void; onDelete: () => void;
}) {
  const pin = useStore((s) => s.pinConversation);
  const [menu, setMenu] = useState(false);
  return (
    <div className={cn("group relative flex items-center rounded-md pr-1 text-[13px] transition-colors",
      active ? "bg-sidebar-accent text-foreground" : "text-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground")}>
      <button onClick={onOpen} className="min-w-0 flex-1 truncate py-2.5 pl-2 pr-1 text-left sm:py-1.5" title={c.title ?? ""}>
        {c.pinned && <Pin className="mr-1.5 inline size-3 -translate-y-px text-primary" />}
        {c.title || "Untitled"}
      </button>
      <DropdownMenu open={menu} onOpenChange={setMenu}>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-xs" aria-label="Chat options"
            className={cn("hover-reveal size-8 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100 sm:size-6", (menu || active) && "opacity-100")} />}>
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onClick={() => void pin(c.public_id, !c.pinned)}>
            {c.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}{c.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}><Pencil className="size-3.5" />Rename</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}><Trash2 className="size-3.5" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function RenameDialog({ c, onClose }: { c: ConversationSummary | null; onClose: () => void }) {
  const rename = useStore((s) => s.renameConversation);
  const [title, setTitle] = useState(c?.title ?? "");
  const save = async () => { if (c) await rename(c.public_id, title); onClose(); };
  return (
    <Dialog open={!!c} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Rename chat</DialogTitle><DialogDescription>A short name you will recognise in the list.</DialogDescription></DialogHeader>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={120}
               onKeyDown={(e) => { if (e.key === "Enter") void save(); }} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={!title.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ c, onClose }: { c: ConversationSummary | null; onClose: () => void }) {
  const remove = useStore((s) => s.deleteConversation);
  return (
    <Dialog open={!!c} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this chat?</DialogTitle>
          <DialogDescription>
            “{c?.title}” disappears from your list. The audit record of every query it ran is kept — that is a compliance requirement, not a choice.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => { if (c) void remove(c.public_id); onClose(); }}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function groupByDay(list: ConversationSummary[]): { label: string; items: ConversationSummary[] }[] {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const day = 86_400_000;
  const buckets: Record<string, ConversationSummary[]> = { Pinned: [], Today: [], Yesterday: [], "Previous 7 days": [], "Previous 30 days": [], Older: [] };
  for (const c of list) {
    if (c.pinned) { buckets.Pinned.push(c); continue; }
    const t = Date.parse(c.last_message_at ?? c.created_at);
    const key = t >= today ? "Today" : t >= today - day ? "Yesterday" : t >= today - 7 * day ? "Previous 7 days" : t >= today - 30 * day ? "Previous 30 days" : "Older";
    buckets[key].push(c);
  }
  return Object.entries(buckets).filter(([, items]) => items.length).map(([label, items]) => ({ label, items }));
}
