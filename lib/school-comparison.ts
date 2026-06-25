import { districtSchoolScores, schoolFciScore } from "@/lib/capital-planning"
import type { School } from "@/lib/dashboard-data"
import { schools } from "@/lib/schools-list"
import { districtSchools, teachingDistrictSchools, type DistrictSchool } from "@/lib/district-data"

export interface SchoolComparisonPoint {
  id: string
  name: string
  type: DistrictSchool["type"]
  fci: number
  esa: number
}

const dashboardById = new Map(schools.map((s) => [s.id, s]))

/** One comparison point per district school, using dashboard data when available. */
export function buildSchoolComparisonPoints(): SchoolComparisonPoint[] {
  return teachingDistrictSchools.map((ds) => {
    const full = ds.dashboardId ? dashboardById.get(ds.dashboardId) : undefined
    if (full) {
      return {
        id: ds.id,
        name: ds.name,
        type: ds.type,
        fci: schoolFciScore(full),
        esa: full.eaOverall,
      }
    }
    const scores = districtSchoolScores(ds)
    return { id: ds.id, name: ds.name, type: ds.type, ...scores }
  })
}

/** Match a dashboard school to its district comparison id. */
export function comparisonSchoolId(school: School): string {
  const match = districtSchools.find((ds) => ds.dashboardId === school.id || ds.id === school.id)
  return match?.id ?? school.id
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** 1-based rank among peers (1 = best). */
export function rankAmong(values: number[], value: number, higherIsBetter: boolean): number {
  if (higherIsBetter) return values.filter((v) => v > value).length + 1
  return values.filter((v) => v < value).length + 1
}
