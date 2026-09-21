"use client";
import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Table2 } from "lucide-react";
import {
  type ColumnDef, type SortingState, flexRender, getCoreRowModel, getSortedRowModel, useReactTable,
} from "@tanstack/react-table";
import type { ResultSet } from "@/lib/types";
import { fmtCell, humanise, isNumericColumn } from "@/lib/format";
import { exportCsv } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;

export function ResultTable({ result, question = "result", maxRows = 200 }:
                            { result: ResultSet; question?: string; maxRows?: number }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const numeric = useMemo(() => new Set(result.columns.filter((c) => isNumericColumn(result.rows, c))), [result]);

  const columns = useMemo<ColumnDef<Row>[]>(() => result.columns.map((c) => ({
    accessorKey: c,
    header: ({ column }) => {
      const s = column.getIsSorted();
      return (
        <button onClick={() => column.toggleSorting(s === "asc")}
                className={cn("group inline-flex items-center gap-1 whitespace-nowrap", numeric.has(c) && "ml-auto")}>
          {humanise(c)}
          {s === "asc" ? <ArrowUp className="size-3" /> : s === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-0 group-hover:opacity-60" />}
        </button>
      );
    },
    cell: ({ getValue }) => fmtCell(getValue(), c),
    sortingFn: numeric.has(c) ? "alphanumeric" : "auto",
  })), [result.columns, numeric]);

  const data = useMemo(() => result.rows.slice(0, maxRows), [result.rows, maxRows]);
  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  return (
    <div className="rounded-lg border bg-card/60">
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <Table2 className="size-3.5" />
        <span><span className="font-medium text-foreground/80">{result.row_count.toLocaleString()}</span> row{result.row_count === 1 ? "" : "s"}{result.truncated && " (showing the first 200)"}</span>
        {result.rows.length > maxRows && <span>· showing first {maxRows}</span>}
        <Button variant="ghost" size="sm" className="ml-auto h-8 gap-1.5 text-xs sm:h-7" onClick={() => exportCsv(result, question)}><Download className="size-3.5" />CSV</Button>
      </div>
      <div className="max-h-[55vh] overflow-auto border-t sm:max-h-[420px]">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className={cn("h-9 text-xs", numeric.has(h.column.id) && "text-right")}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/40">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cn("py-1.5 text-[13px]", numeric.has(cell.column.id) && "text-right font-mono tabular-nums")}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow><TableCell colSpan={result.columns.length || 1} className="py-6 text-center text-muted-foreground">No rows</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
