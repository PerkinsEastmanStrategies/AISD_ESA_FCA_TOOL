import type { RoomCondition } from "@/lib/dashboard-data"

export type LivelyFcaSystemKey = "Flooring" | "HVAC" | "Plumbing" | "Finishes" | "Lighting"

export interface LivelyBuildingFcaProfile {
  overall: RoomCondition
  systems: Record<LivelyFcaSystemKey, RoomCondition>
}

/**
 * Building-level FCA suitability used to shade every room polygon on the Lively L1 plan.
 * Whole-room mode uses `overall`; sub-category filter uses per-system scores.
 */
export const LIVELY_BUILDING_FCA_SCORES: Record<string, LivelyBuildingFcaProfile> = {
  A: {
    overall: "fair",
    systems: {
      Flooring: "fair",
      HVAC: "good",
      Plumbing: "fair",
      Finishes: "fair",
      Lighting: "fair",
    },
  },
  B: {
    overall: "fair",
    systems: {
      Flooring: "good",
      HVAC: "fair",
      Plumbing: "poor",
      Finishes: "fair",
      Lighting: "fair",
    },
  },
  C: {
    overall: "good",
    systems: {
      Flooring: "good",
      HVAC: "good",
      Plumbing: "fair",
      Finishes: "good",
      Lighting: "good",
    },
  },
  D: {
    overall: "fair",
    systems: {
      Flooring: "fair",
      HVAC: "fair",
      Plumbing: "fair",
      Finishes: "fair",
      Lighting: "poor",
    },
  },
}

export function livelyBuildingFcaOverall(building: string): RoomCondition | null {
  return LIVELY_BUILDING_FCA_SCORES[building]?.overall ?? null
}

export function livelyBuildingFcaSystem(
  building: string,
  system: string,
): RoomCondition | null {
  const profile = LIVELY_BUILDING_FCA_SCORES[building]
  if (!profile) return null
  return profile.systems[system as LivelyFcaSystemKey] ?? null
}

export function livelyBuildingFcaCondition(
  building: string | undefined,
  subCategory: string,
): RoomCondition | null {
  if (!building) return null
  if (subCategory) return livelyBuildingFcaSystem(building, subCategory)
  return livelyBuildingFcaOverall(building)
}
