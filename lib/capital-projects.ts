import {
  SYSTEM_SUBCOMPONENTS,
  remainingUsefulLife,
  type School,
  type SystemNeed,
  type StatusLevel,
} from "@/lib/dashboard-data"

/** Cost bases requested for the top-of-section estimates. */
export const RENOVATION_PSF = 690
export const NEW_CONSTRUCTION_PSF = 950

export type CapitalProjectTypeId = "major-renovation" | "flooring" | "furniture"

export interface CapitalProjectType {
  id: CapitalProjectTypeId
  label: string
  psf: number
  description: string
}

export const CAPITAL_PROJECT_TYPES: CapitalProjectType[] = [
  {
    id: "major-renovation",
    label: "Major Renovation",
    psf: RENOVATION_PSF,
    description: "Full modernization of selected spaces",
  },
  {
    id: "flooring",
    label: "Flooring Replacement",
    psf: 8,
    description: "Floor finish replacement in selected areas",
  },
  {
    id: "furniture",
    label: "Furniture",
    psf: 5,
    description: "Furniture package for selected spaces",
  },
]

export const DEFAULT_CAPITAL_PROJECT_TYPE: CapitalProjectTypeId = "major-renovation"

/** Whether the scoped project modernizes the full selection or only critical FCA items. */
export type ProjectScopeMode = "renovate" | "critical-only"

export interface RenovationAreaSelection {
  roomIds: string[]
  sqft: number
  projectType: CapitalProjectTypeId
  scopeMode: ProjectScopeMode
  estimatedCost: number
  criticalItemCount: number
  /** FCA line items explicitly chosen (critical-only scope). */
  selectedFcaIds: string[]
  /** FCA line items included in a renovation estimate — exclude from separate selection. */
  coveredFcaIds: string[]
}

/** Stable key for generic (non-Lively) FCA project rows. */
export function genericFcaProjectKey(system: string, subcomponent: string): string {
  return `${system}::${subcomponent}`
}

export function capitalProjectType(id: CapitalProjectTypeId): CapitalProjectType {
  return CAPITAL_PROJECT_TYPES.find((t) => t.id === id) ?? CAPITAL_PROJECT_TYPES[0]
}

/** Components at or within this many years of end of life are "identified". */
export const EOL_HORIZON_YEARS = 5

export function renovationCost(school: School): number {
  return school.squareFootage * RENOVATION_PSF
}

// ---------- Partial-renovation selection (floor-plan polygons + lasso) ----------

/** A point in the floor plan's SVG coordinate space. */
export interface Pt {
  x: number
  y: number
}

/** Absolute polygon area (shoelace) in coordinate units²; 0 for < 3 points. */
export function polygonArea(pts: Pt[]): number {
  if (pts.length < 3) return 0
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

/** Average-of-vertices centroid of a polygon. */
export function polygonCentroid(pts: Pt[]): Pt {
  if (pts.length === 0) return { x: 0, y: 0 }
  const sx = pts.reduce((s, p) => s + p.x, 0)
  const sy = pts.reduce((s, p) => s + p.y, 0)
  return { x: sx / pts.length, y: sy / pts.length }
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    const intersect =
      yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Renovation cost for a given selected square footage and project type. */
export function selectedRenovationCost(
  sqft: number,
  projectType: CapitalProjectTypeId = DEFAULT_CAPITAL_PROJECT_TYPE,
): number {
  return sqft * capitalProjectType(projectType).psf
}

export function newConstructionCost(school: School): number {
  return school.squareFootage * NEW_CONSTRUCTION_PSF
}

/** A single FCA-identified subcomponent project (EOL or near-EOL). */
export interface FcaProject {
  system: string
  subcomponent: string
  condition: StatusLevel
  installYear: number
  serviceLife: number
  /** Remaining useful life in years at the assessment year (<= 0 means past EOL). */
  rul: number
  atEol: boolean
  cost: number
}

/**
 * Identify every FCA subcomponent that is at or within EOL_HORIZON_YEARS of the
 * end of its useful life for the given school's assessment year. Each component's
 * cost is its weighted share of the parent system's mid-range need (low/high in $M).
 */
export function fcaProjects(school: School): FcaProject[] {
  const systemByName = new Map<string, SystemNeed>(school.systems.map((s) => [s.name, s]))
  const projects: FcaProject[] = []

  for (const [systemName, components] of Object.entries(SYSTEM_SUBCOMPONENTS)) {
    const need = systemByName.get(systemName)
    if (!need) continue
    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0)
    // Mid-range dollar value of the whole system (low/high are in $M).
    const systemMid = ((need.low + need.high) / 2) * 1_000_000

    for (const c of components) {
      const rul = remainingUsefulLife(c, school.needsYear)
      if (rul > EOL_HORIZON_YEARS) continue
      const share = totalWeight > 0 ? c.weight / totalWeight : 0
      projects.push({
        system: systemName,
        subcomponent: c.name,
        condition: c.condition,
        installYear: c.installYear,
        serviceLife: c.serviceLife,
        rul,
        atEol: rul <= 0,
        cost: Math.round((systemMid * share) / 1000) * 1000,
      })
    }
  }

  // Most urgent first: past-EOL before near-EOL, then by cost.
  return projects.sort((a, b) => a.rul - b.rul || b.cost - a.cost)
}

export function fcaProjectsTotal(school: School): number {
  return fcaProjects(school).reduce((sum, p) => sum + p.cost, 0)
}

/** Prorate campus critical FCA backlog to a selected floor area (non-Lively schools). */
export function proratedCriticalFcaCost(school: School, selectedSqft: number): number {
  const criticalTotal = fcaProjects(school)
    .filter((p) => p.condition === "critical")
    .reduce((sum, p) => sum + p.cost, 0)
  if (school.squareFootage <= 0 || selectedSqft <= 0) return 0
  return Math.round(criticalTotal * (selectedSqft / school.squareFootage))
}

/** An Educational Suitability Assessment (ESA) project. */
export interface EsaProject {
  name: string
  scope: string
  cost: number
}

/**
 * Educational Suitability projects with derived cost estimates. Furniture and
 * special-education modernization scale with enrollment; the remaining
 * program-space projects use district-typical flat estimates.
 */
export function esaProjects(school: School): EsaProject[] {
  const enrollment = school.enrollment
  // ~4 special-ed classrooms per 1,000 students, $225k each (min 2 rooms).
  const specialEdRooms = Math.max(2, Math.round((enrollment / 1000) * 4))

  return [
    {
      name: "Furniture",
      scope: "Flexible, 21st-century classroom furniture refresh district-standard",
      cost: Math.round((enrollment * 675) / 1000) * 1000,
    },
    {
      name: "5-12 Playground",
      scope: "Age 5-12 inclusive play structure with poured-in-place safety surfacing",
      cost: 185_000,
    },
    {
      name: "Shade Structure",
      scope: "Engineered shade canopy over primary outdoor gathering / play area",
      cost: 95_000,
    },
    {
      name: "Modernization of Special Ed Classrooms",
      scope: `Reconfigure & equip ${specialEdRooms} special-education classrooms for compliance & accessibility`,
      cost: specialEdRooms * 225_000,
    },
    {
      name: "Construction of Maker Space",
      scope: "Convert existing space into a STEAM maker lab with utilities & casework",
      cost: 650_000,
    },
    {
      name: "Installation of Kiln",
      scope: "Electric kiln with dedicated circuit, ventilation & enclosure",
      cost: 45_000,
    },
  ]
}

export function esaProjectsTotal(school: School): number {
  return esaProjects(school).reduce((sum, p) => sum + p.cost, 0)
}

/** Compact USD formatter, e.g. $1.6M / $185K. */
export function formatCompactUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${value}`
}

/** Full USD formatter, e.g. $1,580,000. */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}
