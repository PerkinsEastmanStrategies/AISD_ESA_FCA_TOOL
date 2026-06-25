import {
  formatDollars,
  livelyAssets,
  livelyRecommendations,
  livelySystemSummaries,
  LIVELY_SYSTEM_COLORS,
  priorityToStatus,
  type LivelyRecommendation,
} from "@/lib/lively-facility-data"
import type { StatusLevel } from "@/lib/dashboard-data"

const BUILDING_B = "Building B"

/** Systems and keywords used to surface room-relevant FCA items. */
const ROOM_FCA_CONTEXT: Record<
  string,
  { label: string; systems: string[]; keywords: string[] }
> = {
  BAND: {
    label: "Band / Music",
    systems: ["HVAC", "Interior Finishes", "Electrical", "Interior Construction"],
    keywords: ["band", "music", "acoustic", "sound", "rehearsal", "storage"],
  },
  CHOIR: {
    label: "Choir",
    systems: ["HVAC", "Interior Finishes", "Electrical"],
    keywords: ["choir", "music", "choral", "rehearsal", "acoustic"],
  },
  ORCH: {
    label: "Orchestra",
    systems: ["HVAC", "Interior Finishes", "Electrical"],
    keywords: ["orchestra", "music", "string", "rehearsal", "practice"],
  },
  CAFE: {
    label: "Cafeteria",
    systems: ["Plumbing", "HVAC", "Electrical", "Interior Finishes", "Fire Protection"],
    keywords: [
      "kitchen",
      "food",
      "dining",
      "cafeteria",
      "cooler",
      "freezer",
      "servery",
      "grease",
      "exhaust",
      "lobby",
    ],
  },
}

export interface BuildingBSystemSlice {
  system: string
  totalCost: number
  count: number
  criticalCount: number
  pct: number
  color: string
}

export interface BuildingBRoomFcaContext {
  roomLabel: string
  buildingTotalCost: number
  recCount: number
  criticalCount: number
  systemSlices: BuildingBSystemSlice[]
  roomRelevantRecs: LivelyRecommendation[]
  assetSnapshot: {
    total: number
    degraded: number
    abandoned: number
    operational: number
  }
  headline: string
  insight: string
}

function buildingBRecs(): LivelyRecommendation[] {
  return livelyRecommendations.filter((r) => r.building === BUILDING_B)
}

function matchesRoomContext(rec: LivelyRecommendation, roomId: string): boolean {
  const ctx = ROOM_FCA_CONTEXT[roomId]
  if (!ctx) return false
  const hay = `${rec.subsystem} ${rec.deficiency} ${rec.recommendation} ${rec.estimateDescription}`.toLowerCase()
  if (ctx.systems.includes(rec.system)) return true
  return ctx.keywords.some((kw) => hay.includes(kw))
}

export function buildingBSystemSlices(): BuildingBSystemSlice[] {
  const recs = buildingBRecs()
  const total = recs.reduce((s, r) => s + r.totalCost, 0)
  const bySystem = new Map<string, { cost: number; count: number; critical: number }>()
  for (const r of recs) {
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
      criticalCount: v.critical,
      pct: total > 0 ? (v.cost / total) * 100 : 0,
      color: LIVELY_SYSTEM_COLORS[system] ?? "oklch(0.55 0.15 263)",
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
}

export function buildingBRecommendations(): LivelyRecommendation[] {
  return buildingBRecs()
}

export function buildingBAssets(): typeof livelyAssets {
  return livelyAssets
}

/** All FCA recommendations relevant to a room (specialty context or full Building B list). */
export function buildingBRecommendationsForRoom(roomId: string): LivelyRecommendation[] {
  const allB = buildingBRecs()
  const roomSpecific = allB.filter((r) => matchesRoomContext(r, roomId))
  if (roomSpecific.length > 0) return roomSpecific
  return allB
}

export function buildingBFcaContextForBuilding(roomId?: string): BuildingBRoomFcaContext {
  if (roomId && ROOM_FCA_CONTEXT[roomId]) {
    return buildingBFcaContextForRoom(roomId)!
  }
  const allB = buildingBRecs()
  const buildingTotalCost = allB.reduce((s, r) => s + r.totalCost, 0)
  const criticalCount = allB.filter((r) => r.priority === "Critical").length
  const systemSlices = buildingBSystemSlices()
  const assets = livelyAssets
  return {
    roomLabel: "Building B",
    buildingTotalCost,
    recCount: allB.length,
    criticalCount,
    systemSlices: systemSlices.slice(0, 6),
    roomRelevantRecs: [...allB]
      .sort((a, b) => {
        const pri = (p: string) => (p === "Critical" ? 0 : p === "High" ? 1 : p === "Moderate" ? 2 : 3)
        return pri(a.priority) - pri(b.priority) || b.totalCost - a.totalCost
      })
      .slice(0, 8),
    assetSnapshot: {
      total: assets.length,
      degraded: assets.filter((a) => a.status === "Degraded").length,
      abandoned: assets.filter((a) => a.status === "Abandoned").length,
      operational: assets.filter((a) => a.status === "Fully Operational").length,
    },
    headline: `Building B facility backlog: ${formatDollars(buildingTotalCost)} across ${allB.length} FCA recommendations`,
    insight:
      "Fine arts, dining, and kitchen stacks share HVAC, electrical, and interior-finish systems documented in the Lively FCA and NP asset inventory.",
  }
}

export function buildingBFcaContextForRoom(roomId: string): BuildingBRoomFcaContext | null {
  const ctx = ROOM_FCA_CONTEXT[roomId]
  if (!ctx) return null

  const allB = buildingBRecs()
  const buildingTotalCost = allB.reduce((s, r) => s + r.totalCost, 0)
  const criticalCount = allB.filter((r) => r.priority === "Critical").length
  const systemSlices = buildingBSystemSlices()
  const roomRelevantRecs = allB
    .filter((r) => matchesRoomContext(r, roomId))
    .sort((a, b) => {
      const pri = (p: string) => (p === "Critical" ? 0 : p === "High" ? 1 : p === "Moderate" ? 2 : 3)
      return pri(a.priority) - pri(b.priority) || b.totalCost - a.totalCost
    })
    .slice(0, 4)

  const assets = livelyAssets
  const assetSnapshot = {
    total: assets.length,
    degraded: assets.filter((a) => a.status === "Degraded").length,
    abandoned: assets.filter((a) => a.status === "Abandoned").length,
    operational: assets.filter((a) => a.status === "Fully Operational").length,
  }

  const topSystem = systemSlices[0]
  const roomRelevantCost = roomRelevantRecs.reduce((s, r) => s + r.totalCost, 0)

  const headlines: Record<string, string> = {
    BAND: `Fine-arts wing capital backlog: ${formatDollars(buildingTotalCost)} across ${allB.length} Building B items`,
    CHOIR: `Choir sits in Building B's ${formatDollars(topSystem?.totalCost ?? 0)} ${topSystem?.system ?? "HVAC"} backlog`,
    ORCH: `Orchestra stack shares Building B systems with ${criticalCount} critical campus-wide deficiencies`,
    CAFE: `Dining + kitchen zone: ${formatDollars(roomRelevantCost)} in directly related FCA work identified`,
  }

  const insights: Record<string, string> = {
    BAND: "HVAC duct corrosion and aging electrical panels affect the entire music suite — band storage and rehearsal air quality are tied to wing-wide RTU replacements.",
    CHOIR: "Interior finishes and HVAC distribution dominate Building B needs; choral spaces benefit from prioritized ductwork remediation before cosmetic upgrades.",
    ORCH: "Practice rooms and main rehearsal volume share AHU zones flagged in FCA. Orchestra-specific needs cluster under interior finishes and power distribution.",
    CAFE: "Kitchen exhaust, refrigeration, and servery plumbing drive the highest near-term costs adjacent to the cafeteria. Fire protection and egress lighting also span the dining lobby.",
  }

  return {
    roomLabel: ctx.label,
    buildingTotalCost,
    recCount: allB.length,
    criticalCount,
    systemSlices: systemSlices.slice(0, 6),
    roomRelevantRecs,
    assetSnapshot,
    headline: headlines[roomId] ?? headlines.BAND,
    insight: insights[roomId] ?? insights.BAND,
  }
}

export function buildingBCampusFciEstimate(): number {
  const summaries = livelySystemSummaries()
  const total = summaries.reduce((s, x) => s + x.totalCost, 0)
  const critical = summaries.reduce((s, x) => s + x.criticalCount, 0)
  return Math.min(0.95, 0.28 + critical * 0.02 + total / 5_000_000)
}

export function priorityStatus(priority: string): StatusLevel {
  return priorityToStatus(priority)
}
