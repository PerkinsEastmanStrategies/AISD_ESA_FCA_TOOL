import type { RoomCondition, School } from "@/lib/dashboard-data"
import {
  districtSpaceSufficiency,
  spaceSufficiencyAverage,
} from "@/lib/dashboard-data"
import { schools } from "@/lib/schools-list"
import { districtSchoolScores } from "@/lib/capital-planning"
import { teachingDistrictSchools, type DistrictSchool } from "@/lib/district-data"

const EA_CATEGORY_NAMES = [
  "Presence",
  "Safety & Security",
  "Community",
  "Organization",
  "Classroom",
  "Environmental Quality",
  "Assembly",
  "Extended Learning",
] as const

const SPACE_CATEGORIES = districtSpaceSufficiency.map((c) => c.category)

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

const SPACE_BY_ESA: Record<RoomCondition, [number, number]> = {
  good: [74, 92],
  fair: [54, 73],
  poor: [34, 53],
}

function lerp(range: [number, number], r: number) {
  return range[0] + (range[1] - range[0]) * r
}

function dashboardSchool(ds: DistrictSchool): School | undefined {
  if (!ds.dashboardId) return undefined
  return schools.find((s) => s.id === ds.dashboardId)
}

/** Per-school EA category scores (dashboard schools use real data). */
export function schoolEaCategories(ds: DistrictSchool): { name: string; score: number }[] {
  const full = dashboardSchool(ds)
  if (full) return full.eaCategories.map((c) => ({ name: c.name, score: c.score }))
  const base = districtSchoolScores(ds).esa
  return EA_CATEGORY_NAMES.map((name, i) => ({
    name,
    score: Math.round(Math.max(0, Math.min(100, base + (hash(`${ds.id}-ea-${i}`) - 0.5) * 28))),
  }))
}

/** Per-school space sufficiency profile. */
export function schoolSpaceProfile(ds: DistrictSchool): { category: string; score: number }[] {
  const full = dashboardSchool(ds)
  if (full) return full.spaceSufficiency.map((c) => ({ category: c.category, score: c.score }))
  const base = Math.round(lerp(SPACE_BY_ESA[ds.esa], hash(`${ds.id}-space`)))
  return SPACE_CATEGORIES.map((category, i) => ({
    category,
    score: Math.round(Math.max(0, Math.min(100, base + (hash(`${ds.id}-sp-${i}`) - 0.5) * 24))),
  }))
}

/** District-wide average EA score per category. */
export function districtEaCategoryAverages(list: DistrictSchool[] = teachingDistrictSchools) {
  const sums = new Map<string, { total: number; count: number }>()
  for (const s of list) {
    for (const c of schoolEaCategories(s)) {
      const cur = sums.get(c.name) ?? { total: 0, count: 0 }
      cur.total += c.score
      cur.count += 1
      sums.set(c.name, cur)
    }
  }
  return EA_CATEGORY_NAMES.map((name) => {
    const cur = sums.get(name)!
    return { name, score: Math.round(cur.total / cur.count) }
  })
}

/** District-wide average space score per category. */
export function districtSpaceCategoryAverages(list: DistrictSchool[] = teachingDistrictSchools) {
  const sums = new Map<string, { total: number; count: number }>()
  for (const s of list) {
    for (const c of schoolSpaceProfile(s)) {
      const cur = sums.get(c.category) ?? { total: 0, count: 0 }
      cur.total += c.score
      cur.count += 1
      sums.set(c.category, cur)
    }
  }
  return SPACE_CATEGORIES.map((category) => {
    const cur = sums.get(category)!
    return { category, score: Math.round(cur.total / cur.count) }
  })
}

export type EsaScoreBand = "critical" | "warning" | "info" | "good"

export function esaScoreBand(score: number): EsaScoreBand {
  if (score < 40) return "critical"
  if (score < 60) return "warning"
  if (score < 80) return "info"
  return "good"
}

const BAND_LABELS: Record<EsaScoreBand, string> = {
  critical: "<40%",
  warning: "40–59%",
  info: "60–79%",
  good: "≥80%",
}

/** Histogram of district schools by ESA score band. */
export function esaScoreDistribution(list: DistrictSchool[] = teachingDistrictSchools) {
  const counts: Record<EsaScoreBand, number> = { critical: 0, warning: 0, info: 0, good: 0 }
  for (const s of list) {
    counts[esaScoreBand(districtSchoolScores(s).esa)]++
  }
  return (["critical", "warning", "info", "good"] as const).map((band) => ({
    band,
    label: BAND_LABELS[band],
    schools: counts[band],
  }))
}

/** Schools below 60% per space category. */
export function schoolsBelowSpaceThreshold(
  threshold = 60,
  list: DistrictSchool[] = teachingDistrictSchools,
) {
  const counts = new Map<string, number>()
  for (const cat of SPACE_CATEGORIES) counts.set(cat, 0)
  for (const s of list) {
    for (const c of schoolSpaceProfile(s)) {
      if (c.score < threshold) counts.set(c.category, (counts.get(c.category) ?? 0) + 1)
    }
  }
  return SPACE_CATEGORIES.map((category) => ({
    category,
    below: counts.get(category) ?? 0,
    total: list.length,
  }))
}

export function districtSpaceSufficiencyAvg(list: DistrictSchool[] = teachingDistrictSchools) {
  const scores = list.map((s) => spaceSufficiencyAverage(schoolSpaceProfile(s).map((c) => ({ category: c.category, score: c.score }))))
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

export function districtEsaAvg(list: DistrictSchool[] = teachingDistrictSchools) {
  const scores = list.map((s) => districtSchoolScores(s).esa)
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}
