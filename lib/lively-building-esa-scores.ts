import type { RoomCondition } from "@/lib/dashboard-data"
import { LIVELY_ESA_CATEGORIES } from "@/lib/lively-building-b-rooms"

export type LivelyEsaCategoryKey = (typeof LIVELY_ESA_CATEGORIES)[number]

export interface LivelyBuildingEsaProfile {
  overall: RoomCondition
  categories: Record<LivelyEsaCategoryKey, RoomCondition>
}

/**
 * Building-level ESA suitability used to shade every room polygon on the Lively L1 plan.
 * Whole-room mode uses `overall`; sub-category filter uses per-category scores.
 */
export const LIVELY_BUILDING_ESA_SCORES: Record<string, LivelyBuildingEsaProfile> = {
  A: {
    overall: "fair",
    categories: {
      Daylight: "fair",
      Size: "poor",
      "Layout & shape": "fair",
      Furniture: "fair",
      Safety: "good",
      Technology: "fair",
      Plumbing: "fair",
    },
  },
  B: {
    overall: "fair",
    categories: {
      Daylight: "poor",
      Size: "poor",
      "Layout & shape": "fair",
      Furniture: "fair",
      Safety: "good",
      Technology: "fair",
      Plumbing: "good",
    },
  },
  C: {
    overall: "good",
    categories: {
      Daylight: "good",
      Size: "good",
      "Layout & shape": "good",
      Furniture: "good",
      Safety: "good",
      Technology: "good",
      Plumbing: "fair",
    },
  },
  D: {
    overall: "fair",
    categories: {
      Daylight: "fair",
      Size: "fair",
      "Layout & shape": "fair",
      Furniture: "poor",
      Safety: "fair",
      Technology: "poor",
      Plumbing: "fair",
    },
  },
}

export function livelyBuildingEsaOverall(building: string): RoomCondition | null {
  return LIVELY_BUILDING_ESA_SCORES[building]?.overall ?? null
}

export function livelyBuildingEsaCategory(
  building: string,
  category: string,
): RoomCondition | null {
  const profile = LIVELY_BUILDING_ESA_SCORES[building]
  if (!profile) return null
  return profile.categories[category as LivelyEsaCategoryKey] ?? null
}

export function livelyBuildingEsaCondition(
  building: string | undefined,
  subCategory: string,
): RoomCondition | null {
  if (!building) return null
  if (subCategory) return livelyBuildingEsaCategory(building, subCategory)
  return livelyBuildingEsaOverall(building)
}
