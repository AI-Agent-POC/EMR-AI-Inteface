"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Table2, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { CatalogSummary, CatalogTable, Tier } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TierBadge } from "@/components/chat/tier-badge";
import { cn } from "@/lib/utils";

const MODULE_LABEL: Record<string, string> = {
  masters: "Master's Management", registration_scheduling: "Registration & Scheduling",
  emr: "Electronic Medical Records", lab_radiology: "Laboratory & Radiology",
  material: "Material Management", billing_claims: "Billing & Claims", accounts: "Accounts",
  marketing: "Marketing", regulatory: "Regulatory & HIE", engagement: "ClinicConnect App",
  security: "Administration & Audit",
};
const MODULE_ORDER = ["registration_scheduling","emr","lab_radiology","billing_claims","material","accounts","marketing","regulatory","security","engagement","masters"];

export default function ExplorePage() {
  const persona = useStore((s) => s.persona);
  const [summary, setSummary] = useState<CatalogSummary | null>(null);
  const [tables, setTables] = useState<CatalogTable[] | null>(null);
  const [q, setQ] = useState("");
  const [mod, setMod] = useState<string>("all");

  useEffect(() => {
    let alive = true; setSummary(null); setTables(null);
    api.catalog(persona.subject).then((s) => alive && setSummary(s)).catch(() => {});
    api.tables(persona.subject).then((t) => alive && setTables(t.tables)).catch(() => alive && setTables([]));
    return () => { alive = false; };
  }, [persona.subject]);

  const filtered = useMemo(() => {
    if (!tables) return [];
    const needle = q.trim().toLowerCase();
    return tables.filter((t) => (mod === "all" || t.module === mod) &&
      (!needle || t.name.includes(needle) || t.columns.some((c) => c.name.includes(needle) || (c.label ?? "").toLowerCase().includes(needle))));
  }, [tables, q, mod]);

  const grouped = useMemo(() => {
    const g = new Map<string, CatalogTable[]>();
    for (const t of filtered) { const k = t.module ?? "masters"; (g.get(k) ?? g.set(k, []).get(k)!).push(t); }
    // views first inside each module: they are the vendor's reports and the agent's preferred surface
    for (const list of g.values()) list.sort((a, b) => (a.kind === b.kind ? b.rows - a.rows : a.kind === "view" ? -1 : 1));
    return [...g.entries()].sort((a, b) => MODULE_ORDER.indexOf(a[0]) - MODULE_ORDER.indexOf(b[0]));
  }, [filtered]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-5 py-7">
        <div className="text-[12px] font-medium uppercase tracking-wider text-agent">The data, explained</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Everything the agent can see — as {persona.label}</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground leading-relaxed">
          Laid out by ClinicSoft module. Columns you are not cleared for are simply absent from this list, exactly as they are absent from the agent's context.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {summary ? [
            { n: summary.tables, l: "base tables" }, { n: summary.views, l: "report views" },
            { n: summary.columns - summary.columns_never, l: "columns visible to you" },
            { n: summary.columns_never, l: "columns hidden from every role", tone: "text-tier-never" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border bg-card p-4">
              <div className={cn("text-2xl font-semibold tabular-nums", s.tone)}>{s.n.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{s.l}</div>
            </div>
          )) : [0,1,2,3].map((i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)}
        </div>

        <div className="sticky top-0 z-10 -mx-5 mt-6 border-b bg-background/85 px-5 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a table or column…" className="h-9 pl-8" />
            </div>
            <Tabs value={mod} onValueChange={setMod} className="overflow-x-auto">
              <TabsList className="h-9">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                {MODULE_ORDER.filter((m) => summary?.modules.some((x) => x.module === m)).map((m) => (
                  <TabsTrigger key={m} value={m} className="text-xs">{MODULE_LABEL[m] ?? m}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {tables?.length ?? "…"}</span>
          </div>
        </div>

        <div className="mt-5 space-y-8">
          {tables === null && <Skeleton className="h-40 rounded-xl" />}
          {grouped.map(([module, list]) => {
            const desc = summary?.modules.find((m) => m.module === module)?.description;
            return (
              <section key={module}>
                <div className="mb-3 flex items-baseline gap-3">
                  <h2 className="text-base font-semibold">{MODULE_LABEL[module] ?? module}</h2>
                  <span className="text-xs text-muted-foreground">{list.length} objects</span>
                </div>
                {desc && <p className="mb-3 -mt-1 text-[13px] text-muted-foreground">{desc}</p>}
                <div className="grid gap-2 md:grid-cols-2">
                  {list.map((t) => <TableCard key={t.name} t={t} />)}
                </div>
              </section>
            );
          })}
          {tables && filtered.length === 0 && <div className="py-16 text-center text-muted-foreground">Nothing matches.</div>}
        </div>
      </div>
    </div>
  );
}

function TableCard({ t }: { t: CatalogTable }) {
  const [open, setOpen] = useState(false);
  const tiers = t.columns.reduce((a, c) => ({ ...a, [c.tier]: (a[c.tier] ?? 0) + 1 }), {} as Record<Tier, number>);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("rounded-xl border bg-card transition-colors", open && "border-primary/30")}>
      <CollapsibleTrigger className="flex w-full items-start gap-3 p-3.5 text-left">
        <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-md", t.kind === "view" ? "bg-agent/12 text-agent" : "bg-muted text-muted-foreground")}>
          {t.kind === "view" ? <Eye className="size-3.5" /> : <Table2 className="size-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-[13px] font-medium">{t.name}</code>
            {t.kind === "view" && <Badge variant="outline" className="h-4 px-1 text-[10px] border-agent/40 text-agent">report view</Badge>}
            {t.rows >= 0 && <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">{t.rows.toLocaleString()} rows</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
{t.columns.length} columns
            {tiers.restricted ? <span className="inline-flex items-center gap-1">· <TierBadge tier="restricted" compact /> {tiers.restricted} restricted</span> : null}
            {t.menu_path && <span className="truncate">· {t.menu_path}</span>}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-x-4 gap-y-1 border-t px-3.5 py-3 text-[12px] sm:grid-cols-2">
          {t.columns.map((c) => (
            <div key={c.name} className="flex items-center gap-2 py-0.5">
              <code className="text-foreground/90">{c.name}</code>
              <span className="text-muted-foreground/70">{c.type}</span>
              {c.tier !== "open" && <TierBadge tier={c.tier} compact />}
              {c.label && <span className="ml-auto truncate text-muted-foreground">{c.label}</span>}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
