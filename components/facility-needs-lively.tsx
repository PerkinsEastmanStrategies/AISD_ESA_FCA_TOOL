"use client"

import { useMemo, useState, type ReactNode } from "react"
import { AlertTriangle, Building2, ChevronDown, ClipboardList, Wrench, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { School } from "@/lib/dashboard-data"
import { STATUS_BAR, STATUS_DOT, STATUS_TEXT } from "@/lib/dashboard-data"
import {
  LIVELY_PRIORITY_OPTIONS,
  assetStatusToLevel,
  formatDollars,
  livelyAssets,
  livelyAssetsForSystem,
  livelyRecommendations,
  livelySystemSummaries,
  livelyTotalCapitalCost,
  priorityToStatus,
  type LivelyAsset,
  type LivelyRecommendation,
} from "@/lib/lively-facility-data"
import { LivelyPriorityChart } from "@/components/lively-priority-chart"

interface FacilityNeedsLivelyProps {
  school: School
}

function pctToBarWidth(pct: number, max: number): number {
  return max > 0 ? (pct / max) * 100 : 0
}

function RecRow({ rec, expanded, onToggle }: { rec: LivelyRecommendation; expanded: boolean; onToggle: () => void }) {
  const status = priorityToStatus(rec.priority)
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{rec.estimateDescription || rec.subsystem}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_TEXT[status]}`}>
              {rec.priority}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {rec.subsystem} · {rec.building} · {rec.timing}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-primary">{formatDollars(rec.totalCost)}</span>
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-border px-3 pb-3 pt-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Deficiency</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground">{rec.deficiency}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recommendation</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground">{rec.recommendation}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Scope</p>
              <p className="font-medium text-foreground">{rec.estimateSow || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Campus impact</p>
              <p className="font-medium text-foreground">{rec.campusImpact || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Sequencing</p>
              <p className="font-medium text-foreground">{rec.sequencing || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Direct + markup</p>
              <p className="font-medium tabular-nums text-foreground">
                {formatDollars(rec.directCost)} + {formatDollars(rec.markups)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AssetRow({ asset }: { asset: LivelyAsset }) {
  const status = assetStatusToLevel(asset.status)
  const age = asset.yearInstalled ? new Date().getFullYear() - asset.yearInstalled : null
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-2">
        <p className="text-sm font-medium text-foreground">{asset.assetGroup || asset.assetName}</p>
        <p className="text-xs text-muted-foreground">{asset.subsystem}</p>
      </td>
      <td className="py-2 text-xs text-muted-foreground">{asset.location || "—"}</td>
      <td className="py-2 text-right tabular-nums text-xs text-muted-foreground">
        {asset.yearInstalled ?? "—"}
        {age != null && <span className="block text-[10px]">{age} yr old</span>}
      </td>
      <td className="py-2 text-right text-xs tabular-nums text-muted-foreground">
        {asset.quantity} {asset.quantityUom}
      </td>
      <td className="py-2 text-right">
        <span className="inline-flex items-center justify-end gap-1.5">
          <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
          <span className={`text-xs font-medium ${STATUS_TEXT[status]}`}>{asset.status}</span>
        </span>
      </td>
    </tr>
  )
}

export function FacilityNeedsLively({ school }: FacilityNeedsLivelyProps) {
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<string>("All")
  const [detailTab, setDetailTab] = useState<"recommendations" | "assets">("recommendations")
  const [expandedRec, setExpandedRec] = useState<string | null>(null)

  const systems = useMemo(() => livelySystemSummaries(), [])
  const totalCost = livelyTotalCapitalCost()
  const maxPct = Math.max(...systems.map((s) => s.pctOfTotal), 1)

  const criticalCount = livelyRecommendations.filter((r) => r.priority === "Critical").length
  const atRiskAssets = livelyAssets.filter((a) => a.status === "Degraded" || a.status === "Abandoned")

  const filteredRecs = useMemo(() => {
    return livelyRecommendations.filter((r) => {
      if (selectedSystem && r.system !== selectedSystem) return false
      if (priorityFilter !== "All" && r.priority !== priorityFilter) return false
      return true
    })
  }, [selectedSystem, priorityFilter])

  const filteredAssets = useMemo(() => {
    if (!selectedSystem) return livelyAssets
    return livelyAssetsForSystem(selectedSystem)
  }, [selectedSystem])

  const selectedSummary = systems.find((s) => s.system === selectedSystem)

  return (
    <Card className="gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Facility Needs &amp; Capital Recommendations</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {school.name} · FCA recommendations and Building B asset inventory
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total identified capital (recommendations)</p>
          <p className="text-xl font-bold tracking-tight text-primary">{formatDollars(totalCost)}</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat icon={ClipboardList} label="Recommendations" value={String(livelyRecommendations.length)} />
        <MiniStat icon={AlertTriangle} label="Critical priority" value={String(criticalCount)} accent="critical" />
        <MiniStat icon={Building2} label="Tracked assets" value={String(livelyAssets.length)} />
        <MiniStat icon={Wrench} label="Assets at risk" value={String(atRiskAssets.length)} accent="warning" />
      </div>

      <LivelyPriorityChart />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* System cost cards (from recommendations) */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Capital needs by affected system</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {systems.map((s) => {
              const status = s.criticalCount > 0 ? "critical" : s.pctOfTotal >= 15 ? "warning" : "info"
              const isActive = s.system === selectedSystem
              return (
                <button
                  key={s.system}
                  type="button"
                  onClick={() => {
                    setSelectedSystem(isActive ? null : s.system)
                    setExpandedRec(null)
                  }}
                  className={`flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/60 ${
                    isActive ? "border-primary ring-1 ring-primary" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{s.system}</span>
                    <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
                  </div>
                  <p className="text-sm font-bold text-primary">{formatDollars(s.totalCost)}</p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-status-track">
                    <div
                      className={`h-full rounded-full ${STATUS_BAR[status]}`}
                      style={{ width: `${pctToBarWidth(s.pctOfTotal, maxPct)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {s.count} rec{s.count === 1 ? "" : "s"} · {s.pctOfTotal.toFixed(1)}% of total
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex min-h-80 flex-col rounded-lg border border-border bg-muted/30">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {selectedSystem ? selectedSystem : "All systems"}
              </h3>
              {selectedSummary && (
                <p className="text-xs text-muted-foreground">
                  {formatDollars(selectedSummary.totalCost)} · {selectedSummary.count} recommendations
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedSystem && (
                <button
                  type="button"
                  onClick={() => setSelectedSystem(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear system filter"
                >
                  <X className="size-4" />
                </button>
              )}
              <div className="flex rounded-md border border-border bg-card p-0.5 text-xs">
                <TabButton active={detailTab === "recommendations"} onClick={() => setDetailTab("recommendations")}>
                  Recommendations
                </TabButton>
                <TabButton active={detailTab === "assets"} onClick={() => setDetailTab("assets")}>
                  Assets
                </TabButton>
              </div>
            </div>
          </div>

          {detailTab === "recommendations" ? (
            <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  {LIVELY_PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p === "All" ? "All priorities" : p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
                {filteredRecs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No recommendations match the current filters.</p>
                ) : (
                  filteredRecs.map((rec) => (
                    <RecRow
                      key={rec.id}
                      rec={rec}
                      expanded={expandedRec === rec.id}
                      onToggle={() => setExpandedRec(expandedRec === rec.id ? null : rec.id)}
                    />
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden p-3">
              {atRiskAssets.length > 0 && !selectedSystem && (
                <div className="mb-3 rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5">
                  <p className="text-xs font-semibold text-foreground">Assets requiring attention</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {atRiskAssets.map((a) => (
                      <li key={a.id}>
                        <span className={`font-medium ${STATUS_TEXT[assetStatusToLevel(a.status)]}`}>{a.status}</span>
                        {" — "}
                        {a.assetGroup} ({a.systemCode.replace(/^D\d+ /, "")}, {a.location || "—"})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="max-h-[26rem] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-medium">Asset</th>
                      <th className="pb-2 font-medium">Location</th>
                      <th className="pb-2 text-right font-medium">Installed</th>
                      <th className="pb-2 text-right font-medium">Qty</th>
                      <th className="pb-2 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map((a) => (
                      <AssetRow key={a.id} asset={a} />
                    ))}
                  </tbody>
                </table>
                {filteredAssets.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No asset records for this system in the Building B inventory.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs italic text-muted-foreground">
        Recommendation costs and deficiency narratives are from the AISD FCA recommendations export. Asset data reflects
        the NP Building B inventory ({livelyAssets.length} components). Select a system to cross-reference
        recommendations with installed assets.
      </p>
    </Card>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof ClipboardList
  label: string
  value: string
  accent?: "critical" | "warning"
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className={`size-3.5 ${accent === "critical" ? "text-status-critical" : accent === "warning" ? "text-status-warning" : ""}`} />
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className={`mt-1 text-lg font-bold tabular-nums ${accent === "critical" ? "text-status-critical" : accent === "warning" ? "text-status-warning" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2.5 py-1 font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}
