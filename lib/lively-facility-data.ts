import livelyData from "@/data/lively-facility.json"
import type { StatusLevel } from "@/lib/dashboard-data"

export interface LivelyRecommendation {
  id: string
  building: string
  system: string
  subsystem: string
  deficiency: string
  recommendation: string
  estimateDescription: string
  estimateSow: string
  quantity: number | string
  unit: string
  directCost: number
  markups: number
  totalCost: number
  impactSeverity: string
  campusImpact: string
  priority: string
  sequencing: string
  timing: string
}

export interface LivelyAsset {
  id: string
  facility: string
  systemCode: string
  subsystem: string
  assetGroup: string
  assetName: string
  attribute1: string
  attribute2: string
  yearInstalled: number | null
  quantity: string
  quantityUom: string
  status: string
  location: string
  capacity: string
  capacityUom: string
  manufacturer: string
  model: string
}

export const livelyRecommendations = livelyData.recommendations as LivelyRecommendation[]
export const livelyAssets = livelyData.assets as LivelyAsset[]

/** Map FCA recommendation system names to NP asset system codes (Building B inventory). */
const REC_SYSTEM_TO_ASSET_CODES: Record<string, string[]> = {
  HVAC: ["D30 HVAC"],
  Electrical: ["D50 Electrical"],
  Plumbing: ["D20 Plumbing"],
  "Fire Protection": ["D40 Fire Protection"],
  Roofing: ["B30 Roofing"],
  "Exterior Enclosure": ["B20 Exterior Architecture"],
  Structure: ["B10 Structure"],
  "Interior Finishes": ["C10/C30 Interior Architecture"],
  "Interior Construction": ["C10/C30 Interior Architecture"],
  Stairs: ["C10/C30 Interior Architecture"],
  Site: [],
}

const SUBSYSTEM_FILTER: Record<string, string | undefined> = {
  "Interior Finishes": "Interior Finishes",
  "Interior Construction": "Interior Construction",
  Stairs: "Interior Specialties",
}

export function livelyAssetsForSystem(recSystem: string): LivelyAsset[] {
  const codes = REC_SYSTEM_TO_ASSET_CODES[recSystem] ?? []
  const sub = SUBSYSTEM_FILTER[recSystem]
  return livelyAssets.filter(
    (a) => codes.includes(a.systemCode) && (!sub || a.subsystem === sub),
  )
}

export interface LivelySystemSummary {
  system: string
  totalCost: number
  count: number
  pctOfTotal: number
  criticalCount: number
}

export function livelySystemSummaries(): LivelySystemSummary[] {
  const total = livelyRecommendations.reduce((s, r) => s + r.totalCost, 0)
  const bySystem = new Map<string, { cost: number; count: number; critical: number }>()
  for (const r of livelyRecommendations) {
    const cur = bySystem.get(r.system) ?? { cost: 0, count: 0, critical: 0 }
    cur.cost += r.totalCost
    cur.count += 1
    if (r.priority === "Critical") cur.critical += 1
    bySystem.set(r.system, cur)
  }
  return [...bySystem.entries()]
    .map(([system, v]) => ({
      system,
      totalCost: v.cost,
      count: v.count,
      pctOfTotal: total > 0 ? (v.cost / total) * 100 : 0,
      criticalCount: v.critical,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
}

export function livelyTotalCapitalCost(): number {
  return livelyRecommendations.reduce((s, r) => s + r.totalCost, 0)
}

export function priorityToStatus(priority: string): StatusLevel {
  if (priority === "Critical") return "critical"
  if (priority === "High") return "warning"
  if (priority === "Moderate") return "info"
  return "good"
}

export function assetStatusToLevel(status: string): StatusLevel {
  if (status === "Abandoned") return "critical"
  if (status === "Degraded") return "warning"
  if (status === "Fully Operational") return "good"
  return "info"
}

export function formatDollars(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 10_000) return `$${Math.round(value / 1_000)}K`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${Math.round(value).toLocaleString("en-US")}`
}

export const LIVELY_PRIORITY_OPTIONS = ["All", "Critical", "High", "Moderate", "Low"] as const

export const LIVELY_PRIORITY_ORDER = ["Critical", "High", "Moderate", "Low"] as const

/** Distinct, theme-stable colors per FCA system (avoids undefined --chart-N fallbacks). */
export const LIVELY_SYSTEM_COLORS: Record<string, string> = {
  Site: "oklch(0.55 0.21 263)",
  Electrical: "oklch(0.58 0.22 27)",
  "Interior Finishes": "oklch(0.72 0.14 75)",
  HVAC: "oklch(0.52 0.2 15)",
  Roofing: "oklch(0.65 0.16 85)",
  "Exterior Enclosure": "oklch(0.68 0.14 95)",
  "Fire Protection": "oklch(0.55 0.18 240)",
  Plumbing: "oklch(0.58 0.14 200)",
  "Interior Construction": "oklch(0.55 0.2 305)",
  Structure: "oklch(0.5 0.12 263)",
  Stairs: "oklch(0.52 0.03 257)",
}

/** Affected systems sorted by total recommendation cost (used as stack segment order). */
export function livelyRecSystemNames(): string[] {
  return livelySystemSummaries().map((s) => s.system)
}

export function livelySystemChartColors(): Record<string, string> {
  const names = livelyRecSystemNames()
  const fallback = [
    "oklch(0.55 0.21 263)",
    "oklch(0.7 0.16 160)",
    "oklch(0.75 0.15 75)",
    "oklch(0.62 0.22 27)",
    "oklch(0.55 0.2 305)",
  ]
  return Object.fromEntries(
    names.map((name, i) => [name, LIVELY_SYSTEM_COLORS[name] ?? fallback[i % fallback.length]]),
  )
}

export function livelySystemChartConfig() {
  const colors = livelySystemChartColors()
  return Object.fromEntries(
    livelyRecSystemNames().map((name) => [name, { label: name, color: colors[name] }]),
  )
}

/** Stacked-bar rows: one per priority, columns keyed by affected system (cost in dollars). */
export function livelyStackedByPriority(): Record<string, string | number>[] {
  const systems = livelyRecSystemNames()
  const rows = new Map<string, Record<string, number>>(
    LIVELY_PRIORITY_ORDER.map((p) => [p, Object.fromEntries(systems.map((s) => [s, 0]))]),
  )
  for (const r of livelyRecommendations) {
    const priority = (LIVELY_PRIORITY_ORDER as readonly string[]).includes(r.priority) ? r.priority : "Low"
    const row = rows.get(priority)!
    row[r.system] = (row[r.system] ?? 0) + r.totalCost
  }
  return LIVELY_PRIORITY_ORDER.map((priority) => ({
    priority,
    ...rows.get(priority)!,
  }))
}

/** Compact axis labels for recommendation cost chart. */
export function formatLivelyChartAxis(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value)}`
}
