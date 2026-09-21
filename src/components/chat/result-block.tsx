"use client";
import { useMemo, useState } from "react";
import {
  BarChart3, Table2, GitCommitVertical, Download, FileText, Sheet, TrendingUp, Loader2, Info,
} from "lucide-react";
import { toast } from "sonner";
import type { AssistantMessage } from "@/lib/types";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { asSeries, project } from "@/lib/series";
import { exportCsv, exportPdf } from "@/lib/export";
import { fmtAED, fmtNum, looksLikeMoney, humanise } from "@/lib/format";
import { ResultTable } from "./result-table";
import { ResultChart, chartPlan } from "./result-chart";
import { ResultTimeline } from "./result-timeline";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type View = "chart" | "table" | "timeline";

/**
 * Everything you can do with a set of figures, in one place: see them as a chart, a
 * table or a timeline, project the trend forward, and take them away as CSV or PDF.
 *
 * Which views exist depends on the data, not on a preference — a timeline needs ordered
 * periods, a chart needs something worth plotting. Offering a view that cannot say
 * anything is worse than not offering it.
 */
export function ResultBlock({ m }: { m: AssistantMessage }) {
  const result = m.result!;
  const prefs = useStore((s) => s.prefs);
  const persona = useStore((s) => s.persona);

  const series = useMemo(() => asSeries(result), [result]);
  const plan = useMemo(() => chartPlan(result), [result]);
  const [horizon, setHorizon] = useState(0);
  const forecast = useMemo(
    () => (series && horizon ? project(series, horizon) : null),
    [series, horizon],
  );
  const canProject = !!(series && project(series, 3));

  const views = useMemo(() => {
    const v: View[] = [];
    if (plan && prefs.autoChart) v.push("chart");
    if (series) v.push("timeline");
    v.push("table");
    return v;
  }, [plan, series, prefs.autoChart]);

  const [view, setView] = useState<View | null>(null);
  const active: View = view && views.includes(view) ? view : views[0];

  const [busy, setBusy] = useState(false);
  const download = async (fmt: "csv" | "pdf") => {
    if (fmt === "csv") { exportCsv(result, m.question); toast.success("CSV downloaded"); return; }
    setBusy(true);
    try {
      // Named properly in the footer, so a printed page can be traced back.
      const me = await api.me(persona.subject).catch(() => null);
      await exportPdf({
        question: m.question,
        message: m,
        personaLabel: me?.display_name ?? persona.label,
        tenantName: me?.tenant_name ?? "",
      });
      toast.success("PDF downloaded");
    } catch {
      toast.error("Could not build the PDF");
    } finally {
      setBusy(false);
    }
  };

  const money = series ? looksLikeMoney(series.primary) : false;
  const fmtV = (v: number) => (money ? fmtAED(v) : fmtNum(v));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {views.length > 1 && (
          <div className="flex items-center gap-0.5 rounded-lg border bg-card p-0.5">
            {views.map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 py-2 text-[13px] transition-colors sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-[12.5px]",
                  v === active ? "bg-accent font-medium text-foreground"
                               : "text-muted-foreground hover:text-foreground")}>
                {v === "chart" ? <BarChart3 className="size-3.5" />
                  : v === "timeline" ? <GitCommitVertical className="size-3.5" />
                  : <Table2 className="size-3.5" />}
                {v === "chart" ? "Chart" : v === "timeline" ? "Timeline" : "Table"}
              </button>
            ))}
          </div>
        )}

        {canProject && (
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant={horizon ? "secondary" : "outline"} size="sm"
                      className="h-9 gap-1.5 text-[13px] sm:h-8 sm:text-[12.5px]" />
            }>
              <TrendingUp className="size-3.5" />
              {horizon ? `Projecting ${horizon}` : "Project"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              {/* Base UI requires a Group around a label; without it the menu will not mount. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[11px] font-normal leading-snug text-muted-foreground">
                  Continues the trend of {humanise(series!.primary).toLowerCase()} from the{" "}
                  {series!.points.length} {series!.grain}s above. An estimate, not a figure from
                  the database.
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[3, 6, 12].map((h) => (
                  <DropdownMenuItem key={h} onClick={() => setHorizon(h)}>
                    Next {h} {series!.grain}s{horizon === h && " ✓"}
                  </DropdownMenuItem>
                ))}
                {horizon > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setHorizon(0)}>Turn off</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="ml-auto h-9 gap-1.5 text-[13px] sm:h-8 sm:text-[12.5px]" disabled={busy} />}>
            {busy ? <Loader2 className="size-3.5 spinner" /> : <Download className="size-3.5" />}Download
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => void download("csv")}>
              <Sheet className="size-3.5" />CSV for a spreadsheet
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void download("pdf")}>
              <FileText className="size-3.5" />PDF with the answer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {active === "chart" && <ResultChart result={result} series={series} forecast={forecast} />}
      {active === "timeline" && series && <ResultTimeline series={series} forecast={forecast} />}
      {active === "table" && <ResultTable result={result} question={m.question} />}

      {forecast && (
        <div className="flex gap-2 rounded-lg border border-dashed border-muted-foreground/35 bg-muted/30 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            The dashed periods are an estimate, not clinic data.{" "}
            {forecast.method}, {forecast.slopePerPeriod >= 0 ? "rising" : "falling"} about{" "}
            <span className="font-mono text-foreground/80">{fmtV(Math.abs(forecast.slopePerPeriod))}</span> per{" "}
            {series!.grain}.{" "}
            {forecast.rSquared >= 0.7
              ? "The trend fits the history closely."
              : forecast.rSquared >= 0.35
                ? "The history is uneven, so treat the range as the answer rather than the line."
                : "The history moves too irregularly for a trend to mean much — read this as a rough direction only."}
          </span>
        </div>
      )}
    </div>
  );
}
