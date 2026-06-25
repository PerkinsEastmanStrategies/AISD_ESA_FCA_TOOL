import type { RoomCondition } from "@/lib/dashboard-data"
import { buildDistrictSchoolsFromGeoJSON, hashString } from "@/lib/aisd-schools"

export type DistrictMetric = "fca" | "esa"

export interface DistrictSchool {
  id: string
  name: string
  /** ES = Elementary, MS = Middle, HS = High, OT = district / athletic / alt-ed sites */
  type: "ES" | "MS" | "HS" | "OT"
  lat: number
  lng: number
  /** Facility Condition Assessment rating (made-up sample). */
  fca: RoomCondition
  /** Educational Suitability / Adequacy rating (made-up sample). */
  esa: RoomCondition
  /** Links to a detailed dashboard when one exists for this school. */
  dashboardId?: string
  campusId?: string
  address?: string
}

/** All AISD locations from the official GeoJSON feed. */
export const districtSchools: DistrictSchool[] = buildDistrictSchoolsFromGeoJSON() as DistrictSchool[]

/** Teaching campuses only (elementary, middle, high) — used for FCA/ESA analytics. */
export const teachingDistrictSchools: DistrictSchool[] = districtSchools.filter((s) => s.type !== "OT")

/** Map / district record for a dashboard school id (e.g. lively, maplewood). */
export function districtSchoolForDashboardId(dashboardId: string): DistrictSchool | undefined {
  return districtSchools.find((s) => s.dashboardId === dashboardId || s.id === dashboardId)
}

/** Map-friendly hex colors for the three ratings (Mapbox-safe, not oklch). */
export const DISTRICT_RATING_HEX: Record<RoomCondition, string> = {
  good: "#1f9d57",
  fair: "#e0a000",
  poor: "#d63f2f",
}

export const DISTRICT_METRIC_LABEL: Record<DistrictMetric, string> = {
  fca: "Facility Condition (FCA)",
  esa: "Educational Suitability (ESA)",
}

export const SCHOOL_TYPE_LABEL: Record<DistrictSchool["type"], string> = {
  ES: "Elementary",
  MS: "Middle",
  HS: "High",
  OT: "Support / Other",
}

// ----- Capital planning figures (made-up but deterministic) -----

export const FCA_YEAR_MIN = 2026
export const FCA_YEAR_MAX = 2040
/** Annual escalation applied to deferred FCA deficiencies (cost-of-deferral). */
const FCA_ESCALATION = 0.06

/** Stable 32-bit hash of a string, for per-school variance. */
export { hashString }

// Base 2026 FCA deficiency backlog per school by condition and building size.
const FCA_BASE_BY_RATING: Record<RoomCondition, number> = {
  good: 1_600_000,
  fair: 6_400_000,
  poor: 18_000_000,
}
const SIZE_MULTIPLIER: Record<Exclude<DistrictSchool["type"], "OT">, number> = {
  ES: 1,
  MS: 1.6,
  HS: 2.8,
}

/** A school's identified FCA deficiency cost in 2026 dollars. */
export function schoolFcaBaseCost(s: DistrictSchool): number {
  if (s.type === "OT") return 0
  const variance = 0.7 + hashString(s.id) * 0.6 // 0.7x – 1.3x
  return FCA_BASE_BY_RATING[s.fca] * SIZE_MULTIPLIER[s.type] * variance
}

/** Escalate a 2026 base cost to the given plan year. */
export function escalateFcaCost(base: number, year: number): number {
  const years = Math.max(0, year - FCA_YEAR_MIN)
  return base * Math.pow(1 + FCA_ESCALATION, years)
}

/** Total identified FCA deficiency dollars across schools for a plan year. */
export function totalFcaDeficiencyCost(list: DistrictSchool[], year: number): number {
  return list.reduce((sum, s) => sum + escalateFcaCost(schoolFcaBaseCost(s), year), 0)
}

// Open ESA (educational suitability) capital projects per school by rating.
const ESA_PROJECTS_BY_RATING: Record<RoomCondition, number> = { good: 0, fair: 2, poor: 4 }

/** Number of open ESA improvement projects for a school. */
export function schoolEsaProjects(s: DistrictSchool): number {
  if (s.type === "OT") return 0
  const bump = s.esa === "good" ? 0 : hashString(`${s.id}-esa`) < 0.35 ? 1 : 0
  return ESA_PROJECTS_BY_RATING[s.esa] + bump
}

/** Total open ESA projects across schools. */
export function totalEsaProjects(list: DistrictSchool[]): number {
  return list.reduce((sum, s) => sum + schoolEsaProjects(s), 0)
}

/** Build a GeoJSON FeatureCollection of the district schools for a Mapbox source. */
export function districtSchoolsGeoJSON(
  list: DistrictSchool[] = districtSchools,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: list.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id,
        name: s.name,
        type: s.type,
        fca: s.fca,
        esa: s.esa,
        hasDashboard: s.dashboardId ? 1 : 0,
      },
    })),
  }
}
