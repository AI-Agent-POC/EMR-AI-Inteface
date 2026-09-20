"use client";
import { useEffect, useState } from "react";
import { ChevronsUpDown, Check, MapPin, ShieldAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { PERSONAS, ROLE_LABEL } from "@/lib/personas";
import { api } from "@/lib/api";
import type { WhoAmI } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { TierBadge } from "@/components/chat/tier-badge";

export function PersonaSwitcher() {
  const persona = useStore((s) => s.persona);
  const setPersona = useStore((s) => s.setPersona);
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<WhoAmI | null>(null);

  useEffect(() => {
    let alive = true;
    api.me(persona.subject).then((m) => alive && setMe(m)).catch(() => alive && setMe(null));
    return () => { alive = false; };
  }, [persona.subject]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="h-9 gap-2 pl-1.5 pr-2.5" />}>
        <Avatar className="size-6"><AvatarFallback className="text-[10px] bg-primary/15 text-primary font-semibold">{persona.initials}</AvatarFallback></Avatar>
        <span className="hidden sm:inline text-sm font-medium">{persona.label}</span>
        {me && <span className="hidden sm:inline-flex"><TierBadge tier={me.max_tier} /></span>}
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-1.5rem))] p-0">
        <div className="px-3 py-2.5 border-b">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Viewing as</div>
          {me ? (
            <div className="mt-1 text-sm">
              <div className="font-medium">{me.display_name}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-1 items-center">
                <span>{ROLE_LABEL[me.role] ?? me.role}</span>
                <span>·</span>
                <code className="text-[11px]">{me.database_role}</code>
                {me.branch_scope && <Badge variant="secondary" className="gap-1 h-5"><MapPin className="size-3" />{me.branch_scope} only</Badge>}
              </div>
            </div>
          ) : <div className="mt-1 text-xs text-muted-foreground">Loading…</div>}
        </div>
        <Command>
          <CommandList className="max-h-[420px]">
            <CommandGroup heading="Switch persona — the database decides what each one can see">
              {PERSONAS.map((p) => (
                <CommandItem key={p.subject} value={p.subject} onSelect={() => { setPersona(p); setOpen(false); }}
                  className="items-start gap-3 py-2.5">
                  <Avatar className="size-7 mt-0.5"><AvatarFallback className="text-[10px] font-semibold">{p.initials}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.label}</span>
                      {p.branch && <Badge variant="outline" className="h-4 px-1 text-[10px]">{p.branch}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground leading-snug">{p.blurb}</div>
                  </div>
                  <Check className={cn("size-4 mt-1", persona.subject === p.subject ? "opacity-100 text-primary" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="px-3 py-2 border-t text-[11px] text-muted-foreground flex items-start gap-1.5">
          <ShieldAlert className="size-3.5 mt-0.5 shrink-0" />
          Switching persona starts a new conversation. A persona is a security context; nothing carries across.
        </div>
      </PopoverContent>
    </Popover>
  );
}
