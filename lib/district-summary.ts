import type { RoomCondition } from "@/lib/dashboard-data"
import { buildSchoolComparisonPoints, median } from "@/lib/school-comparison"
import {
  teachingDistrictSchools,
  FCA_YEAR_MAX,
  FCA_YEAR_MIN,
  schoolEsaProjects,
  schoolFcaBaseCost,
  totalEsaProjects,
  totalFcaDeficiencyCost,
  escalateFcaCost,
  type DistrictSchool,
} from "@/lib/district-data"

const RATINGS: RoomCondition[] = ["good", "fair", "poor"]

export function formatDistrictCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value)}`
}

export function countByRating(
  list: DistrictSchool[],
  field: "fca" | "esa",
): Record<RoomCondition, number> {
  const counts: Record<RoomCondition, number> = { good: 0, fair: 0, poor: 0 }
  for (const s of list) counts[s[field]]++
  return counts
}

export function ratingDistributionChart(list: DistrictSchool[] = teachingDistrictSchools) {
  const fca = countByRating(list, "fca")
  const esa = countByRating(list, "esa")
  return RATINGS.map((rating) => ({
    rating,
    label: rating.charAt(0).toUpperCase() + rating.slice(1),
    fca: fca[rating],
    esa: esa[rating],
  }))
}

export function projectedFcaSeries(list: DistrictSchool[] = teachingDistrictSchools) {
  const baseline = totalFcaDeficiencyCost(list, FCA_YEAR_MIN)
  const years: number[] = []
  for (let y = FCA_YEAR_MIN; y <= FCA_YEAR_MAX; y++) years.push(y)
  return years.map((year) => ({
    year,
    total: totalFcaDeficiencyCost(list, year),
    increase: totalFcaDeficiencyCost(list, year) - baseline,
  }))
}

export function fcaCostBySchoolType(list: DistrictSchool[] = teachingDistrictSchools, year = FCA_YEAR_MAX) {
  const buckets = { ES: 0, MS: 0, HS: 0 } as Record<"ES" | "MS" | "HS", number>
  for (const s of list) {
    if (s.type === "OT") continue
    buckets[s.type] += escalateFcaCost(schoolFcaBaseCost(s), year)
  }
  return (["ES", "MS", "HS"] as const).map((type) => ({
    type,
    label: type === "ES" ? "Elementary" : type === "MS" ? "Middle" : "High",
    total: buckets[type],
  }))
}

export function esaProjectsByRating(list: DistrictSchool[] = teachingDistrictSchools) {
  const totals: Record<RoomCondition, number> = { good: 0, fair: 0, poor: 0 }
  for (const s of list) totals[s.esa] += schoolEsaProjects(s)
  return RATINGS.map((rating) => ({
    rating,
    label: rating.charAt(0).toUpperCase() + rating.slice(1),
    projects: totals[rating],
  }))
}

export function fcaEsaMatrix(list: DistrictSchool[] = teachingDistrictSchools) {
  const grid: Record<RoomCondition, Record<RoomCondition, number>> = {
    good: { good: 0, fair: 0, poor: 0 },
    fair: { good: 0, fair: 0, poor: 0 },
    poor: { good: 0, fair: 0, poor: 0 },
  }
  for (const s of list) grid[s.fca][s.esa]++
  return grid
}

export function districtScoreSummary(list: DistrictSchool[] = teachingDistrictSchools) {
  const points = buildSchoolComparisonPoints()
  const esaScores = points.map((p) => p.esa)
  const fciScores = points.map((p) => p.fci)
  const avgEsa = Math.round(esaScores.reduce((a, b) => a + b, 0) / esaScores.length)
  const avgFci = Math.round((fciScores.reduce((a, b) => a + b, 0) / fciScores.length) * 100) / 100
  const poorFca = countByRating(list, "fca").poor
  const poorEsa = countByRating(list, "esa").poor
  const fcaBaseline = totalFcaDeficiencyCost(list, FCA_YEAR_MIN)
  const fcaProjected = totalFcaDeficiencyCost(list, FCA_YEAR_MAX)
  const esaOpen = totalEsaProjects(list)

  return {
    schoolCount: list.length,
    avgEsa,
    medianEsa: Math.round(median(esaScores)),
    avgFci,
    medianFci: Math.round(median(fciScores) * 100) / 100,
    poorFca,
    poorEsa,
    fcaBaseline,
    fcaProjected,
    fcaIncreasePct: Math.round(((fcaProjected - fcaBaseline) / fcaBaseline) * 100),
    esaOpen,
    scatterPoints: points,
  }
}
