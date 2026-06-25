import type { RoomCondition } from "@/lib/dashboard-data"
import {
  teachingDistrictSchools,
  schoolFcaBaseCost,
  type DistrictSchool,
} from "@/lib/district-data"

/** Plan years aligned with the school-level Facility Needs section. */
export const FACILITY_PLAN_YEARS = [2026, 2028, 2031, 2034, 2040] as const
export const FACILITY_NEEDS_BASE_YEAR = 2026
export const FACILITY_NEEDS_ESCALATION = 0.045

/** Standard FCA system mix (share of total facility needs). */
export const FACILITY_SYSTEM_TEMPLATE = [
  { name: "HVAC", pct: 24 },
  { name: "Electrical", pct: 16 },
  { name: "Plumbing", pct: 11 },
  { name: "Exterior Enclosure", pct: 10 },
  { name: "Roofing", pct: 9 },
  { name: "ADA Compliance", pct: 8 },
  { name: "Site Improvements", pct: 7 },
  { name: "Structure", pct: 6 },
  { name: "Fire Protection", pct: 4 },
  { name: "Conveying", pct: 3 },
  { name: "Exterior Stairs", pct: 2 },
] as const

export type FacilitySystemName = (typeof FACILITY_SYSTEM_TEMPLATE)[number]["name"]

export const FACILITY_SYSTEM_NAMES = FACILITY_SYSTEM_TEMPLATE.map((s) => s.name)

/** Chart colors aligned with facility-needs urgency bands. */
export const FACILITY_SYSTEM_COLORS: Record<FacilitySystemName, string> = {
  HVAC: "var(--color-status-critical)",
  Electrical: "#d63f2f",
  Plumbing: "var(--color-status-warning)",
  "Exterior Enclosure": "#e0a000",
  Roofing: "#c98a00",
  "ADA Compliance": "#b8860b",
  "Site Improvements": "#a67c00",
  Structure: "var(--color-status-info)",
  "Fire Protection": "#3b82c6",
  Conveying: "#2563eb",
  "Exterior Stairs": "#1d4ed8",
}

export function facilityNeedsEscalationFactor(year: number): number {
  const years = year - FACILITY_NEEDS_BASE_YEAR
  return Math.pow(1 + FACILITY_NEEDS_ESCALATION, Math.max(years, 0))
}

/** Per-system dollars for one school at a plan year (2026 baseline × escalation × mix). */
export function schoolSystemNeedsAtYear(
  school: DistrictSchool,
  year: number,
): Record<FacilitySystemName, number> {
  const total = schoolFcaBaseCost(school) * facilityNeedsEscalationFactor(year)
  const out = {} as Record<FacilitySystemName, number>
  for (const sys of FACILITY_SYSTEM_TEMPLATE) {
    out[sys.name] = total * (sys.pct / 100)
  }
  return out
}

type StackedRow = { label: string } & Record<FacilitySystemName, number>

function emptyRow(label: string): StackedRow {
  const row = { label } as StackedRow
  for (const name of FACILITY_SYSTEM_NAMES) row[name] = 0
  return row
}

function addSchoolToRow(row: StackedRow, school: DistrictSchool, year: number) {
  const needs = schoolSystemNeedsAtYear(school, year)
  for (const name of FACILITY_SYSTEM_NAMES) {
    row[name] += needs[name]
  }
}

/** District-wide stacked needs — one bar per plan year. */
export function stackedFacilityNeedsByYear(list: DistrictSchool[] = teachingDistrictSchools): StackedRow[] {
  return FACILITY_PLAN_YEARS.map((year) => {
    const row = emptyRow(String(year))
    for (const s of list) addSchoolToRow(row, s, year)
    return row
  })
}

/** Stacked needs for a single plan year, grouped by school level. */
export function stackedFacilityNeedsBySchoolType(
  year: number,
  list: DistrictSchool[] = teachingDistrictSchools,
): StackedRow[] {
  const labels: Record<"ES" | "MS" | "HS", string> = {
    ES: "Elementary",
    MS: "Middle",
    HS: "High",
  }
  const rows: Record<"ES" | "MS" | "HS", StackedRow> = {
    ES: emptyRow(labels.ES),
    MS: emptyRow(labels.MS),
    HS: emptyRow(labels.HS),
  }
  for (const s of list) {
    if (s.type === "OT") continue
    addSchoolToRow(rows[s.type], s, year)
  }
  return (["ES", "MS", "HS"] as const).map((t) => rows[t])
}

/** Stacked needs for a single plan year, grouped by FCA rating. */
export function stackedFacilityNeedsByFca(
  year: number,
  list: DistrictSchool[] = teachingDistrictSchools,
): StackedRow[] {
  const ratings: RoomCondition[] = ["poor", "fair", "good"]
  const labels: Record<RoomCondition, string> = { poor: "Poor FCA", fair: "Fair FCA", good: "Good FCA" }
  const rows = Object.fromEntries(ratings.map((r) => [r, emptyRow(labels[r])])) as Record<
    RoomCondition,
    StackedRow
  >
  for (const s of list) addSchoolToRow(rows[s.fca], s, year)
  return ratings.map((r) => rows[r])
}

/** Stacked needs for a single plan year, grouped by ESA rating. */
export function stackedFacilityNeedsByEsa(
  year: number,
  list: DistrictSchool[] = teachingDistrictSchools,
): StackedRow[] {
  const ratings: RoomCondition[] = ["poor", "fair", "good"]
  const labels: Record<RoomCondition, string> = { poor: "Poor ESA", fair: "Fair ESA", good: "Good ESA" }
  const rows = Object.fromEntries(ratings.map((r) => [r, emptyRow(labels[r])])) as Record<
    RoomCondition,
    StackedRow
  >
  for (const s of list) addSchoolToRow(rows[s.esa], s, year)
  return ratings.map((r) => rows[r])
}

/** Chart config entries for ChartContainer. */
export function facilitySystemChartConfig() {
  return Object.fromEntries(
    FACILITY_SYSTEM_NAMES.map((name) => [name, { label: name, color: FACILITY_SYSTEM_COLORS[name] }]),
  )
}

export function rowTotal(row: StackedRow): number {
  return FACILITY_SYSTEM_NAMES.reduce((sum, name) => sum + row[name], 0)
}
