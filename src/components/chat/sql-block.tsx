"use client";
import { useState } from "react";
import { Prism as Highlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import { ChevronDown, Copy, Check, Wrench, Table2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import type { Repair, SqlInfo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TierBadge } from "./tier-badge";
import { cn } from "@/lib/utils";

export function SqlBlock({ sql, repairs, defaultOpen = false }: { sql: SqlInfo; repairs: Repair[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const style = resolvedTheme === "dark" ? oneDark : oneLight;

  const copy = async () => {
    await navigator.clipboard.writeText(sql.sql);
    setCopied(true); toast.success("SQL copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card/60">
      <div className="flex items-center gap-2 px-3 py-2">
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-foreground text-foreground/90">
          <ChevronDown className={cn("size-4 transition-transform", open ? "" : "-rotate-90")} />
          The query it ran
        </CollapsibleTrigger>
        <div className="ml-1 flex flex-wrap items-center gap-1.5">
          {sql.tables.slice(0, 4).map((t) => (
            <Badge key={t} variant="secondary" className="h-5 gap-1 px-1.5 font-mono text-[10.5px] font-normal">
              <Table2 className="size-3" />{t}
            </Badge>
          ))}
          {sql.tables.length > 4 && <Badge variant="secondary" className="h-5 px-1.5 text-[10.5px]">+{sql.tables.length - 4}</Badge>}
          <TierBadge tier={sql.tier} />
          {sql.patient_scoped && <Badge variant="outline" className="h-5 px-1.5 text-[10.5px]">patient-scoped</Badge>}
          {repairs.length > 0 && (
            <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10.5px] border-tier-restricted/40 text-tier-restricted">
              <Wrench className="size-3" />{repairs.length} repair{repairs.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={copy} aria-label="Copy SQL">
          {copied ? <Check className="size-3.5 text-tier-open" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
      <CollapsibleContent>
        <div className="border-t">
          <Highlighter language="sql" style={style} customStyle={{ margin: 0, padding: "12px 14px", fontSize: 12.5, background: "transparent", lineHeight: 1.55 }}
                       codeTagProps={{ style: { fontFamily: "var(--font-mono)" } }}>
            {sql.sql}
          </Highlighter>
        </div>
        {(sql.rationale || sql.assumptions.length > 0) && (
          <div className="border-t px-3 py-2.5 text-xs text-muted-foreground space-y-1.5">
            {sql.rationale && <div className="flex gap-2"><Lightbulb className="size-3.5 mt-0.5 shrink-0 text-tier-restricted" /><span><span className="font-medium text-foreground/80">Approach.</span> {sql.rationale}</span></div>}
            {sql.assumptions.length > 0 && (
              <div className="flex gap-2"><span className="w-3.5 shrink-0" /><span><span className="font-medium text-foreground/80">Assumed.</span> {sql.assumptions.join(" · ")}</span></div>
            )}
          </div>
        )}
        {repairs.length > 0 && (
          <div className="border-t px-3 py-2.5 text-xs space-y-2">
            <div className="font-medium text-tier-restricted flex items-center gap-1.5"><Wrench className="size-3.5" />The validator rejected {repairs.length} earlier attempt{repairs.length > 1 ? "s" : ""} and the model rewrote the query</div>
            {repairs.map((r) => (
              <div key={r.attempt} className="rounded-md bg-muted/60 px-2.5 py-2">
                <div className="text-muted-foreground">Attempt {r.attempt} → <span className="text-foreground/80">{r.reason}</span></div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
