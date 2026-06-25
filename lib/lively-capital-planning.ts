import {
  livelyRecommendations,
  priorityToStatus,
  type LivelyRecommendation,
} from "@/lib/lively-facility-data"
import { buildingBRecommendationsForRoom } from "@/lib/lively-building-b-fca"
import { isLivelyBuildingBSpecialtyRoom } from "@/lib/lively-building-b-rooms"
import type { CapitalProjectTypeId } from "@/lib/capital-projects"
import type { StatusLevel } from "@/lib/dashboard-data"

const PRIORITY_ORDER: Record<string, number> = {
  Critical: 0,
  High: 1,
  Moderate: 2,
  Low: 3,
}

function sortRecs(recs: LivelyRecommendation[]): LivelyRecommendation[] {
  return [...recs].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) ||
      b.totalCost - a.totalCost,
  )
}

function buildingKeyFromRec(rec: LivelyRecommendation): string | null {
  if (rec.building === "Site") return "Site"
  const m = rec.building.match(/^Building\s+([A-D])$/i)
  return m ? m[1].toUpperCase() : null
}

/** CAFM building ids (A–D, Site) that have at least one Critical FCA recommendation. */
export function livelyCriticalBuildingIds(): Set<string> {
  const ids = new Set<string>()
  for (const r of livelyRecommendations) {
    if (r.priority !== "Critical") continue
    const key = buildingKeyFromRec(r)
    if (key) ids.add(key)
  }
  return ids
}

/** All Lively FCA recommendations for the capital planning portal (sorted by urgency). */
export function livelyCapitalFcaRecommendations(): LivelyRecommendation[] {
  return sortRecs(livelyRecommendations)
}

export function livelyCapitalFcaTotal(): number {
  return livelyRecommendations.reduce((s, r) => s + r.totalCost, 0)
}

/** FCA recommendations tied to a floor-plan selection (buildings + specialty room ids). */
export function livelyRecommendationsForSelection(
  roomIds: string[],
  buildingIds: Iterable<string>,
): LivelyRecommendation[] {
  const buildings = new Set(buildingIds)
  const byId = new Map<string, LivelyRecommendation>()

  for (const id of roomIds) {
    if (isLivelyBuildingBSpecialtyRoom(id)) {
      for (const r of buildingBRecommendationsForRoom(id)) {
        byId.set(r.id, r)
      }
    }
  }

  for (const r of livelyRecommendations) {
    const key = buildingKeyFromRec(r)
    if (!key) continue
    if (key === "Site") {
      if (buildings.size > 0) byId.set(r.id, r)
      continue
    }
    if (buildings.has(key)) byId.set(r.id, r)
  }

  return sortRecs([...byId.values()])
}

const MAJOR_RENO_SYSTEMS = new Set(["Interior Finishes", "Interior Construction", "Stairs"])

/** Whether an FCA line item is typically included in a scoped renovation estimate. */
export function livelyRecCoveredByRenovation(
  rec: LivelyRecommendation,
  projectType: CapitalProjectTypeId,
): boolean {
  const hay = `${rec.subsystem} ${rec.estimateDescription} ${rec.estimateSow}`.toLowerCase()

  if (projectType === "furniture") return false

  if (projectType === "flooring") {
    if (rec.system === "Interior Finishes") return true
    return /floor|tile|carpet|finish|vct|resilient|base/.test(hay)
  }

  if (MAJOR_RENO_SYSTEMS.has(rec.system)) return true
  if (rec.system === "Electrical" && /light/.test(hay)) return true
  if (/floor|ceiling|paint|finish|tile|wall cover|casework|cabinet|door hardware|interior door/.test(hay)) {
    return true
  }

  return false
}

export function livelyRecommendationsCoveredByRenovation(
  recs: LivelyRecommendation[],
  projectType: CapitalProjectTypeId,
): LivelyRecommendation[] {
  return recs.filter((r) => livelyRecCoveredByRenovation(r, projectType))
}

export function sumLivelyRecommendationCost(recs: LivelyRecommendation[]): number {
  return recs.reduce((sum, r) => sum + r.totalCost, 0)
}

export function livelyPriorityStatus(priority: string): StatusLevel {
  return priorityToStatus(priority)
}

export function livelyPriorityLabel(priority: string): string {
  return priority
}
