"use client"

import { useMemo, useState } from "react"
import { ChevronUp, ChevronDown, ArrowUp, ArrowDown, ChevronsUpDown, Search, Table2 } from "lucide-react"
import type { SchoolPlanningRow, FlowGroup } from "@/lib/capital-planning"
import { SCHOOL_TYPE_LABEL } from "@/lib/district-data"

interface CapitalPlanningTableProps {
  rows: SchoolPlanningRow[]
}

type SortKey =
  | "name"
  | "type"
  | "enrollment"
  | "utilization"
  | "growth"
  | "composite"
  | "ea"
  | "distance"
  | "outcomeLabel"

interface ColumnDef {
  key: SortKey
  label: string
  numeric: boolean
  align: "left" | "right"
  format?: (r: SchoolPlanningRow) => string
}

const COLUMNS: ColumnDef[] = [
  { key: "name", label: "School", numeric: false, align: "left" },
  { key: "type", label: "Level", numeric: false, align: "left", format: (r) => SCHOOL_TYPE_LABEL[r.type] },
  { key: "enrollment", label: "Enrollment", numeric: true, align: "right", format: (r) => r.enrollment.toLocaleString() },
  { key: "utilization", label: "Utilization", numeric: true, align: "right", format: (r) => `${r.utilization}%` },
  { key: "growth", label: "Growth", numeric: true, align: "right", format: (r) => `${r.growth > 0 ? "+" : ""}${r.growth}%` },
  { key: "composite", label: "Bldg Score", numeric: true, align: "right", format: (r) => r.composite.toFixed(1) },
  { key: "ea", label: "Ed. Adequacy", numeric: true, align: "right", format: (r) => `${r.ea}%` },
  { key: "distance", label: "Welcoming Dist.", numeric: true, align: "right", format: (r) => `${r.distance} mi` },
  { key: "outcomeLabel", label: "Recommendation", numeric: false, align: "left" },
]

// Category chip / recommendation badge colors keyed by flow group.
const FLOW_BADGE: Record<FlowGroup, string> = {
  flow1: "bg-muted text-foreground",
  flow2: "bg-status-good/15 text-status-good ring-status-good/30",
  flow3: "bg-status-warning/15 text-status-warning ring-status-warning/30",
  flow4: "bg-status-critical/15 text-status-critical ring-status-critical/30",
}

const TYPE_FILTERS: { value: "all" | "ES" | "MS" | "HS"; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "ES", label: "Elementary" },
  { value: "MS", label: "Middle" },
  { value: "HS", label: "High" },
]

export function CapitalPlanningTable({ rows }: CapitalPlanningTableProps) {
  const [open, setOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "ES" | "MS" | "HS">("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  // Category groupings with counts, ordered by size.
  const categories = useMemo(() => {
    const map = new Map<string, { label: string; flow: FlowGroup; count: number }>()
    for (const r of rows) {
      const entry = map.get(r.outcomeLabel) ?? { label: r.outcomeLabel, flow: r.flow, count: 0 }
      entry.count++
      map.set(r.outcomeLabel, entry)
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [rows])

  const filtered = useMemo(() => {
    let out = rows
    const q = query.trim().toLowerCase()
    if (q) out = out.filter((r) => r.name.toLowerCase().includes(q))
    if (typeFilter !== "all") out = out.filter((r) => r.type === typeFilter)
    if (categoryFilter !== "all") out = out.filter((r) => r.outcomeLabel === categoryFilter)

    const dir = sortDir === "asc" ? 1 : -1
    const col = COLUMNS.find((c) => c.key === sortKey)
    return [...out].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (col?.numeric && typeof av === "number" && typeof bv === "number") return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [rows, query, typeFilter, categoryFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  return (
    <div
      data-guide="capital-district-table"
      className={`absolute inset-x-0 bottom-0 z-10 flex h-[62%] flex-col rounded-t-xl border border-border bg-card shadow-2xl transition-transform duration-300 ease-out ${
        open ? "translate-y-0" : "translate-y-[calc(100%-2.75rem)]"
      }`}
    >
      {/* Drawer handle / toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-t-xl border-b border-border text-sm font-medium text-foreground transition-colors hover:bg-muted"
        aria-expanded={open}
      >
        <Table2 className="size-4 text-muted-foreground" aria-hidden="true" />
        School Classification
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {rows.length}
        </span>
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronUp className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {/* Controls: search, level filter, category chips */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search schools..."
              className="h-9 w-56 rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Search schools by name"
            />
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted p-1">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTypeFilter(t.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  typeFilter === t.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground tabular-nums">{filtered.length}</span> of {rows.length}
          </span>
        </div>

        {/* Category grouping chips (click to filter) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors ${
              categoryFilter === "all"
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-muted text-muted-foreground ring-transparent hover:text-foreground"
            }`}
          >
            All categories
          </button>
          {categories.map((c) => {
            const active = categoryFilter === c.label
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => setCategoryFilter(active ? "all" : c.label)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-all ${
                  active ? `${FLOW_BADGE[c.flow]} ring-2` : `${FLOW_BADGE[c.flow]} opacity-80 hover:opacity-100`
                }`}
              >
                {c.label}
                <span className="rounded-full bg-background/60 px-1.5 tabular-nums">{c.count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border">
              {COLUMNS.map((col) => {
                const isSorted = sortKey === col.key
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={isSorted ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    className={`whitespace-nowrap px-3 py-2.5 font-semibold text-muted-foreground ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
                        col.align === "right" ? "flex-row-reverse" : ""
                      } ${isSorted ? "text-foreground" : ""}`}
                    >
                      {col.label}
                      {isSorted ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden="true" />
                      )}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/60 transition-colors hover:bg-muted/50">
                {COLUMNS.map((col) => {
                  const value = col.format ? col.format(r) : String(r[col.key])
                  if (col.key === "outcomeLabel") {
                    return (
                      <td key={col.key} className="px-3 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${FLOW_BADGE[r.flow]}`}>
                          {value}
                        </span>
                      </td>
                    )
                  }
                  return (
                    <td
                      key={col.key}
                      className={`whitespace-nowrap px-3 py-2 ${
                        col.align === "right" ? "text-right tabular-nums" : "text-left"
                      } ${col.key === "name" ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    >
                      {value}
                    </td>
                  )
                })}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No schools match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
