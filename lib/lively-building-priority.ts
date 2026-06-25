import type { RoomCondition } from "@/lib/dashboard-data"
import { LIVELY_ESA_CATEGORIES } from "@/lib/lively-building-b-rooms"
import { LIVELY_BUILDING_FCA_SCORES, type LivelyFcaSystemKey } from "@/lib/lively-building-fca-scores"
import { LIVELY_BUILDING_ESA_SCORES } from "@/lib/lively-building-esa-scores"

const FCA_SYSTEM_KEYS: LivelyFcaSystemKey[] = ["Flooring", "HVAC", "Plumbing", "Finishes", "Lighting"]

export const LIVELY_CAMPUS_BUILDINGS = ["A", "B", "C", "D"] as const

export interface LivelyBuildingPriority {
  building: string
  esaOverall: RoomCondition
  fcaOverall: RoomCondition
  poorEsaCategories: string[]
  poorFcaSystems: string[]
  /** Poor on both ESA and FCA at Building/Area overall level. */
  isDualOverallPoor: boolean
  /** Any poor ESA category and any poor FCA system — compound wing-level risk. */
  isCompoundShortcoming: boolean
  /** Flagged for capital / suitability attention on the plan. */
  isPriority: boolean
  reasons: string[]
}

function poorEsaCategories(building: string): string[] {
  const profile = LIVELY_BUILDING_ESA_SCORES[building]
  if (!profile) return []
  return LIVELY_ESA_CATEGORIES.filter((c) => profile.categories[c] === "poor")
}

function poorFcaSystems(building: string): string[] {
  const profile = LIVELY_BUILDING_FCA_SCORES[building]
  if (!profile) return []
  return FCA_SYSTEM_KEYS.filter((s) => profile.systems[s] === "poor")
}

export function livelyBuildingPriority(building: string): LivelyBuildingPriority | null {
  const esa = LIVELY_BUILDING_ESA_SCORES[building]
  const fca = LIVELY_BUILDING_FCA_SCORES[building]
  if (!esa || !fca) return null

  const poorEsa = poorEsaCategories(building)
  const poorFca = poorFcaSystems(building)
  const isDualOverallPoor = esa.overall === "poor" && fca.overall === "poor"
  const isCompoundShortcoming = poorEsa.length > 0 && poorFca.length > 0
  const isPriority = isDualOverallPoor || isCompoundShortcoming

  const reasons: string[] = []
  if (isDualOverallPoor) {
    reasons.push("Poor ESA and Poor FCA at Building/Area level")
  }
  if (poorEsa.length > 0) {
    reasons.push(`Poor ESA: ${poorEsa.join(", ")}`)
  }
  if (poorFca.length > 0) {
    reasons.push(`Poor FCA: ${poorFca.join(", ")}`)
  }
  if (isCompoundShortcoming && !isDualOverallPoor) {
    reasons.push("Compound risk — shortcomings on both suitability and facility condition")
  }

  return {
    building,
    esaOverall: esa.overall,
    fcaOverall: fca.overall,
    poorEsaCategories: poorEsa,
    poorFcaSystems: poorFca,
    isDualOverallPoor,
    isCompoundShortcoming,
    isPriority,
    reasons,
  }
}

export function livelyAllBuildingPriorities(): LivelyBuildingPriority[] {
  return LIVELY_CAMPUS_BUILDINGS.map((id) => livelyBuildingPriority(id)).filter(
    (p): p is LivelyBuildingPriority => p !== null,
  )
}

/** FCA (rows) × ESA (columns) matrix of building ids by overall Building/Area scores. */
export function livelyEsaFcaMatrix(): Record<
  RoomCondition,
  Record<RoomCondition, string[]>
> {
  const grid: Record<RoomCondition, Record<RoomCondition, string[]>> = {
    good: { good: [], fair: [], poor: [] },
    fair: { good: [], fair: [], poor: [] },
    poor: { good: [], fair: [], poor: [] },
  }
  for (const p of livelyAllBuildingPriorities()) {
    grid[p.fcaOverall][p.esaOverall].push(p.building)
  }
  return grid
}

export function priorityCalloutText(): { title: string; body: string } {
  const priorities = livelyAllBuildingPriorities().filter((p) => p.isPriority)
  const names = priorities.map((p) => `Building ${p.building}`).join(", ")
  return {
    title: "Showing: Priority areas",
    body:
      priorities.length > 0
        ? `Red dashed borders mark wings with significant ESA and FCA shortcomings (poor scores on both dimensions). Priority: ${names}. Use the list below the matrix to focus a wing.`
        : "No wings currently meet the priority threshold (poor ESA and poor FCA shortcomings at Building/Area level).",
  }
}
