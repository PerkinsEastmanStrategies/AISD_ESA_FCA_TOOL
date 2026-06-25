import type { School } from "@/lib/dashboard-data"

export interface FloorPlanViewBox {
  x: number
  y: number
  w: number
  h: number
}

export interface FloorPlanLevel {
  id: string
  label: string
  displaySrc: string
  dataSrc: string
  viewBox: FloorPlanViewBox
  /** When set, rooms are tagged by building and the plan uses per-building colors. */
  buildings?: readonly string[]
  /** Room ids that render as interactive EA/FCA hotspots (partial hotspot mode). */
  hotspotRoomIds?: readonly string[]
}

/** Building footprint colors — aligned with Lively DXF conversion palette. */
export const FLOOR_PLAN_BUILDING_COLORS: Record<string, string> = {
  A: "#3b6fd4",
  B: "#2a9d6f",
  C: "#d48a1f",
  D: "#8b5cf6",
}

interface SchoolFloorPlan {
  levels: FloorPlanLevel[]
  defaultLevelId?: string
  selectableRooms: boolean
  /** When false, assessment hotspot circles are hidden (room labels on the SVG still show). */
  showHotspots?: boolean
  /** Room labels rendered as a zoom-aware overlay (collision culled) instead of baked into the SVG image. */
  dynamicLabels?: boolean
}

/** Default plan used when a school has no dedicated floor plan. */
export const DEFAULT_FLOOR_PLAN_SRC = "/AdamsES_plan.svg"
export const DEFAULT_FLOOR_PLAN_VIEWBOX: FloorPlanViewBox = { x: 7262.2, y: 2.7, w: 3485.6, h: 3746.7 }

const SCHOOL_FLOOR_PLANS: Record<string, SchoolFloorPlan> = {
  maplewood: {
    levels: [
      {
        id: "l1",
        label: "Level 1",
        displaySrc: "/MaplewoodES_plan.svg",
        dataSrc: "/MaplewoodES_plan.svg",
        viewBox: { x: 742.06, y: 1211.55, w: 5296.25, h: 4117.0 },
      },
    ],
    selectableRooms: true,
  },
  lively: {
    levels: [
      {
        id: "lb",
        label: "Basement",
        displaySrc: "/LivelyMS_LB_plan.svg",
        dataSrc: "/LivelyMS_LB_plan.svg",
        viewBox: { x: -13070.2, y: -18202.2, w: 27865.2, h: 5247.3 },
        buildings: ["A"],
      },
      {
        id: "l1",
        label: "Level 1",
        displaySrc: "/LivelyMS_L1_plan.svg",
        dataSrc: "/LivelyMS_L1_plan.svg",
        viewBox: { x: -2186.02, y: -18129.5, w: 6089.0, h: 4937.38 },
        buildings: ["A", "B", "C", "D"],
        hotspotRoomIds: ["BAND", "CHOIR", "ORCH", "CAFE"],
      },
      {
        id: "l2",
        label: "Level 2",
        displaySrc: "/LivelyMS_L2_plan.svg",
        dataSrc: "/LivelyMS_L2_plan.svg",
        viewBox: { x: -2186.0, y: -18047.9, w: 6089.0, h: 4613.8 },
        buildings: ["A", "B", "C", "D"],
      },
      {
        id: "l3",
        label: "Level 3",
        displaySrc: "/LivelyMS_L3_plan.svg",
        dataSrc: "/LivelyMS_L3_plan.svg",
        viewBox: { x: -2181.4, y: -18111.5, w: 6089.0, h: 4703.4 },
        buildings: ["A"],
      },
    ],
    defaultLevelId: "l1",
    selectableRooms: true,
    showHotspots: false,
    dynamicLabels: true,
  },
}

function schoolPlan(school: School): SchoolFloorPlan | null {
  return SCHOOL_FLOOR_PLANS[school.id] ?? null
}

function resolveLevel(school: School, levelId?: string): FloorPlanLevel | null {
  const cfg = schoolPlan(school)
  if (!cfg?.levels.length) return null
  const id = levelId ?? cfg.defaultLevelId ?? cfg.levels[0].id
  return cfg.levels.find((l) => l.id === id) ?? cfg.levels[0]
}

/** All floors available for a school, or null when using the default Adams plan. */
export function floorPlanLevels(school: School): readonly FloorPlanLevel[] | null {
  const cfg = schoolPlan(school)
  if (!cfg?.levels.length) return null
  return cfg.levels
}

export function floorPlanDefaultLevelId(school: School): string | null {
  const cfg = schoolPlan(school)
  if (!cfg?.levels.length) return null
  return cfg.defaultLevelId ?? cfg.levels[0].id
}

export function floorPlanLevel(school: School, levelId?: string): FloorPlanLevel | null {
  return resolveLevel(school, levelId)
}

export function floorPlanDisplaySrc(school: School, levelId?: string): string {
  return resolveLevel(school, levelId)?.displaySrc ?? DEFAULT_FLOOR_PLAN_SRC
}

export function floorPlanSrc(school: School, levelId?: string): string {
  return resolveLevel(school, levelId)?.dataSrc ?? DEFAULT_FLOOR_PLAN_SRC
}

export function floorPlanViewBox(school: School, levelId?: string): FloorPlanViewBox {
  return resolveLevel(school, levelId)?.viewBox ?? DEFAULT_FLOOR_PLAN_VIEWBOX
}

export function floorPlanViewBoxString(school: School, levelId?: string): string {
  const vb = floorPlanViewBox(school, levelId)
  return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
}

/** CAFM building ids when the plan distinguishes multiple buildings (e.g. Lively A–D). */
export function floorPlanBuildings(school: School, levelId?: string): readonly string[] | null {
  const level = resolveLevel(school, levelId)
  return level?.buildings ?? null
}

export function floorPlanBuildingColors(): Record<string, string> {
  return FLOOR_PLAN_BUILDING_COLORS
}

/** Whether to draw interactive EA/FCA hotspot circles on the plan. */
export function floorPlanShowHotspots(school: School): boolean {
  const cfg = schoolPlan(school)
  if (cfg && cfg.showHotspots === false) return false
  return true
}

/** Room labels drawn in the client with zoom-based collision culling. */
export function floorPlanDynamicLabels(school: School): boolean {
  return schoolPlan(school)?.dynamicLabels === true
}

/** Room ids that show EA/FCA hotspot circles on an otherwise label-only plan. */
export function floorPlanHotspotRoomIds(school: School, levelId?: string): readonly string[] | null {
  return resolveLevel(school, levelId)?.hotspotRoomIds ?? null
}

/** Whether any hotspot circles should appear (full plan or partial room list). */
export function floorPlanHasHotspots(school: School, levelId?: string): boolean {
  if (floorPlanShowHotspots(school)) return true
  const ids = floorPlanHotspotRoomIds(school, levelId)
  return !!ids?.length
}

/** Plans with <polygon class="proom"> shapes support lasso / click room selection. */
export function floorPlanHasSelectableRooms(school: School): boolean {
  const cfg = schoolPlan(school)
  if (cfg) return cfg.selectableRooms
  return true // default Adams ES SVG includes room polygons
}

/** ESA/FCA hotspot coordinates ship with the default Adams plan only. */
export function floorPlanHasRoomOverlays(school: School): boolean {
  return !schoolPlan(school)
}

/** Assessment tools (edit scores, rename/recolor, deficiencies) for plans with hotspots or room polygons. */
export function floorPlanHasAssessmentTools(school: School): boolean {
  return floorPlanHasRoomOverlays(school) || floorPlanHasSelectableRooms(school)
}
