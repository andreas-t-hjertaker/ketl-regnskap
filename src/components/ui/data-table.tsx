"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";

export type ColumnDef<T> = {
  key: keyof T;
  header: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
};

type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  searchable?: boolean;
  searchKey?: keyof T;
  searchKeys?: (keyof T)[];
  searchPlaceholder?: string;
  pageSize?: number;
};

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchable = false,
  searchKey,
  searchKeys,
  searchPlaceholder = "Søk...",
  pageSize = 10,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  // Filtrering
  const filtered = useMemo(() => {
    if (!searchable || !search) return data;
    const term = search.toLowerCase();
    const keys = searchKeys ?? (searchKey ? [searchKey] : []);
    if (keys.length === 0) return data;
    return data.filter((row) =>
      keys.some((k) => String(row[k] ?? "").toLowerCase().includes(term))
    );
  }, [data, search, searchable, searchKey, searchKeys]);

  // Sortering
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), "nb-NO");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Paginering
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function handleSort(key: keyof T) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, sorted.length);

  return (
    <div className="space-y-4">
      {/* Søkefelt */}
      {searchable && (searchKey || (searchKeys && searchKeys.length > 0)) && (
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-8"
          />
        </div>
      )}

      {/* Tabell */}
      <div className="rounded-lg border border-border/50 overflow-x-auto -mx-4 sm:mx-0">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={String(col.key)}>
                  {col.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.header}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Ingen resultater.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={String(col.key)}>
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginering */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-2 sm:flex-row items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Viser {start}–{end} av {sorted.length}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              Forrige
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Neste
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
