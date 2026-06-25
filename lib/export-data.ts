import type { School } from "@/lib/dashboard-data"
import { SYSTEM_SUBCOMPONENTS } from "@/lib/dashboard-data"
import {
  esaProjects,
  fcaProjects,
  genericFcaProjectKey,
  capitalProjectType,
} from "@/lib/capital-projects"

export type ExportScope = "school" | "portfolio"

export function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function rowsToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ]
  return lines.join("\r\n")
}

import { districtSchoolForDashboardId } from "@/lib/district-data"
import { livelyAssets } from "@/lib/lively-facility-data"
import { livelyCapitalFcaRecommendations } from "@/lib/lively-capital-planning"
import type { SchoolCapitalPlanState } from "@/lib/capital-plan-store"

interface SchoolLocationFeatureCollection {
  type: "FeatureCollection"
  features: {
    type: "Feature"
    geometry: { type: "Point"; coordinates: [number, number] }
    properties: Record<string, string | number | null>
  }[]
}

/** GeoJSON of school locations with key assessment fields. */
export function buildSchoolLocationsGeoJSON(schools: School[]): SchoolLocationFeatureCollection {
  return {
    type: "FeatureCollection",
    features: schools.map((school) => {
      const district = districtSchoolForDashboardId(school.id)
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [school.lng, school.lat],
        },
        properties: {
          school_id: school.id,
          school_name: school.name,
          address: school.address,
          grades_served: school.gradesServed,
          school_type: district?.type ?? null,
          fca_rating: district?.fca ?? null,
          esa_rating: district?.esa ?? null,
          enrollment: school.enrollment,
          square_footage: school.squareFootage,
          building_age_years: school.age,
          ea_overall_pct: school.eaOverall,
          assessment_year: school.needsYear,
        },
      }
    }),
  }
}

export function downloadSchoolLocationsGeoJSON(schools: School[], scope: ExportScope, schoolId?: string) {
  const subset = scope === "school" && schoolId ? schools.filter((s) => s.id === schoolId) : schools
  const geo = buildSchoolLocationsGeoJSON(subset)
  const slug = scope === "school" && schoolId ? schoolId : "portfolio"
  downloadTextFile(JSON.stringify(geo, null, 2), `aisd-school-locations-${slug}.geojson`, "application/geo+json")
}

/** FCA recommendation rows for CSV export. */
export function buildFcaRecommendationsCsv(schools: School[], scope: ExportScope, schoolId?: string): string {
  const subset = scope === "school" && schoolId ? schools.filter((s) => s.id === schoolId) : schools
  const headers = [
    "school_id",
    "school_name",
    "recommendation_id",
    "system",
    "subsystem_or_component",
    "priority_or_condition",
    "timing_or_rul_years",
    "description",
    "estimated_cost_usd",
  ]
  const rows: (string | number)[][] = []

  for (const school of subset) {
    if (school.id === "lively") {
      for (const r of livelyCapitalFcaRecommendations()) {
        rows.push([
          school.id,
          school.name,
          r.id,
          r.system,
          r.subsystem,
          r.priority,
          r.timing,
          r.recommendation,
          r.totalCost,
        ])
      }
    } else {
      for (const p of fcaProjects(school)) {
        rows.push([
          school.id,
          school.name,
          genericFcaProjectKey(p.system, p.subcomponent),
          p.system,
          p.subcomponent,
          p.condition,
          p.rul,
          `EOL component — installed ${p.installYear}`,
          p.cost,
        ])
      }
    }
  }

  return rowsToCsv(headers, rows)
}

/** FCA asset inventory rows (Lively has full inventory; others use system subcomponents). */
export function buildFcaAssetsCsv(schools: School[], scope: ExportScope, schoolId?: string): string {
  const subset = scope === "school" && schoolId ? schools.filter((s) => s.id === schoolId) : schools
  const headers = [
    "school_id",
    "school_name",
    "asset_id",
    "system",
    "subsystem",
    "asset_name",
    "location",
    "year_installed",
    "quantity",
    "status",
  ]
  const rows: (string | number | null)[][] = []

  for (const school of subset) {
    if (school.id === "lively") {
      for (const a of livelyAssets) {
        rows.push([
          school.id,
          school.name,
          a.id,
          a.systemCode,
          a.subsystem,
          a.assetName,
          a.location,
          a.yearInstalled,
          a.quantity,
          a.status,
        ])
      }
    } else {
      let idx = 0
      for (const [systemName, components] of Object.entries(SYSTEM_SUBCOMPONENTS)) {
        for (const c of components) {
          rows.push([
            school.id,
            school.name,
            `${school.id}-asset-${idx++}`,
            systemName,
            c.name,
            c.name,
            school.name,
            c.installYear,
            1,
            c.condition,
          ])
        }
      }
    }
  }

  return rowsToCsv(headers, rows)
}

/** ESA improvement projects as CSV. */
export function buildEsaProjectsCsv(schools: School[], scope: ExportScope, schoolId?: string): string {
  const subset = scope === "school" && schoolId ? schools.filter((s) => s.id === schoolId) : schools
  const headers = ["school_id", "school_name", "project_name", "scope", "estimated_cost_usd"]
  const rows: (string | number)[][] = []

  for (const school of subset) {
    for (const p of esaProjects(school)) {
      rows.push([school.id, school.name, p.name, p.scope, p.cost])
    }
  }

  return rowsToCsv(headers, rows)
}

export interface CapitalPlanReportRow {
  kind: "area" | "fca"
  label: string
  detail: string
  cost: number
}

export function buildCapitalPlanReportRows(
  school: School,
  plan: SchoolCapitalPlanState,
): CapitalPlanReportRow[] {
  const rows: CapitalPlanReportRow[] = []

  if (plan.roomIds.length > 0) {
    const project = capitalProjectType(plan.projectType)
    rows.push({
      kind: "area",
      label:
        plan.scopeMode === "critical-only"
          ? "Critical FCA items — selected floor area"
          : `${project.label} — selected floor area`,
      detail: `${plan.sqft.toLocaleString()} sf across ${plan.roomIds.length} space${plan.roomIds.length === 1 ? "" : "s"} (${plan.roomIds.join(", ")})`,
      cost: plan.appliedCost,
    })
  }

  if (school.id === "lively") {
    const recs = livelyCapitalFcaRecommendations()
    for (const id of plan.selectedFcaIds) {
      const r = recs.find((x) => x.id === id)
      if (!r) continue
      rows.push({
        kind: "fca",
        label: r.recommendation,
        detail: `${r.system} · ${r.building} · ${r.priority} priority`,
        cost: r.totalCost,
      })
    }
  } else {
    for (const p of fcaProjects(school)) {
      const key = genericFcaProjectKey(p.system, p.subcomponent)
      if (!plan.selectedFcaIds.includes(key)) continue
      rows.push({
        kind: "fca",
        label: `${p.system} — ${p.subcomponent}`,
        detail: `Condition: ${p.condition} · RUL ${p.rul} yrs`,
        cost: p.cost,
      })
    }
  }

  return rows
}

export function capitalPlanReportTotal(rows: CapitalPlanReportRow[]): number {
  return rows.reduce((s, r) => s + r.cost, 0)
}

/** Teaching campus count for export UI hints. */
export function exportSchoolCount(scope: ExportScope, allSchools: School[], schoolId?: string): number {
  return scope === "school" && schoolId ? 1 : allSchools.length
}
