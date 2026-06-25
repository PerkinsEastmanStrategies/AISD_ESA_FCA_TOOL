import type { RoomCondition, School } from "@/lib/dashboard-data"
import { teachingDistrictSchools, type DistrictSchool } from "@/lib/district-data"

export type FlowGroup = "flow1" | "flow2" | "flow3" | "flow4"
export type NodeKind = "start" | "decision" | "outcome"

/** A node in the static decision graph. */
export interface PlanningNode {
  id: string
  kind: NodeKind
  label: string
  flow: FlowGroup
  position: { x: number; y: number }
  /** Threshold key whose live value is shown inside the node chip. */
  thresholdKey?: keyof PlanningThresholds
  /** Unit/suffix for the chip value (e.g. "%", " mi", ""). */
  unit?: string
}

/** A directed edge; `branch` indicates which answer it represents. */
export interface PlanningEdge {
  id: string
  source: string
  target: string
  branch: "yes" | "no" | null
}

/** Tunable thresholds controlled by the Strategic Sorting sliders. */
export interface PlanningThresholds {
  // Flow 1 — Decision routing
  currentUtilThreshold: number // "current enrollment or utilization below?" (%)
  highUtilThreshold: number // "current utilization rate above?" (%)
  growthThreshold: number // "projected enrollment growth above?" (%)
  includePK: boolean
  // Flow 2 — Expansion / Overcrowding
  attendanceAreaEnrollment: number // (%)
  expansionComposite: number // composite building score (0-10)
  expansionEA: number // educational adequacy (%)
  // Flow 3 — Maintenance / Investment
  compositeAbove: number // (0-10)
  compositeBelow: number // (0-10)
  flow3EA: number // (%)
  // Flow 4 — Closure / Consolidation
  closureComposite: number // (0-10)
  welcomingDistance: number // (mi)
}

export const DEFAULT_THRESHOLDS: PlanningThresholds = {
  currentUtilThreshold: 60,
  highUtilThreshold: 90,
  growthThreshold: 5,
  includePK: false,
  attendanceAreaEnrollment: 80,
  expansionComposite: 5,
  expansionEA: 80,
  compositeAbove: 5,
  compositeBelow: 7,
  flow3EA: 80,
  closureComposite: 5,
  welcomingDistance: 4.0,
}

// ---------- Derived school metrics ----------

/** Stable 0-1 hash from a string for deterministic per-school variance. */
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

/** Composite building score on a 0-10 scale (higher = better), derived from FCI. */
export function compositeBuildingScore(school: School): number {
  const fci = schoolFciScore(school)
  const score = (1 - fci) * 10
  return Math.round(Math.min(10, Math.max(0, score)) * 10) / 10
}

/** Facility Condition Index (0–1 scale; lower is better). */
export function schoolFciScore(school: School): number {
  const fciMetric = school.portfolio.find((m) => /facility condition score/i.test(m.label))
  const fci = fciMetric ? Number.parseFloat(fciMetric.value) : NaN
  return Number.isFinite(fci) ? fci : 0.2
}

/** Average space sufficiency across categories (%). */
export function spaceSufficiencyAvg(school: School): number {
  if (!school.spaceSufficiency.length) return 0
  const sum = school.spaceSufficiency.reduce((a, c) => a + c.score, 0)
  return Math.round(sum / school.spaceSufficiency.length)
}

/** Current utilization (%) — the higher of original/PE utilization. */
export function currentUtilization(school: School): number {
  return Math.max(school.utilOriginal, school.utilPe)
}

/** Projected enrollment growth (%), derived deterministically (-2% … +12%). */
export function projectedGrowth(school: School): number {
  return Math.round((hash(`${school.id}-growth`) * 14 - 2) * 10) / 10
}

/** Attendance-area enrollment (%), derived deterministically (62% … 96%). */
export function attendanceAreaEnrollment(school: School): number {
  return Math.round(62 + hash(`${school.id}-area`) * 34)
}

/** Distance to nearest welcoming school (mi), derived deterministically (1.4 … 6.0). */
export function welcomingDistance(school: School): number {
  return Math.round((1.4 + hash(`${school.id}-welcome`) * 4.6) * 10) / 10
}

/** Whether the property has room to expand, derived deterministically. */
export function hasSpaceToExpand(school: School): boolean {
  return hash(`${school.id}-expand`) > 0.45
}

/** Flags below-50th-percentile EA or safety/security issues. */
export function belowEAPercentileOrSafety(school: School): boolean {
  return school.eaOverall < 60 || hash(`${school.id}-safety`) > 0.6
}

// ---------- Evaluation ----------

export interface EvaluationResult {
  /** Ordered ids of decision/outcome nodes on the active path. */
  activeNodes: string[]
  /** Edge ids (source->target) on the active path. */
  activeEdges: string[]
  /** "yes" (green) or "no" (red) result keyed by decision node id. */
  branchResults: Record<string, "yes" | "no">
  /** Id of the final recommended outcome node. */
  outcome: string
  /** Human-readable label of the recommendation. */
  outcomeLabel: string
}

/**
 * Walk the strategic-sorting decision tree for a school under the given
 * thresholds, returning the highlighted path and final recommendation.
 */
/** Minimal metric inputs the decision tree operates on. */
export interface PlanningInputs {
  util: number
  growth: number
  composite: number
  ea: number
  area: number
  dist: number
  canExpand: boolean
  flagged: boolean
}

/** Derive planning inputs from a full dashboard School. */
export function schoolInputs(school: School): PlanningInputs {
  return {
    util: currentUtilization(school),
    growth: projectedGrowth(school),
    composite: compositeBuildingScore(school),
    ea: school.eaOverall,
    area: attendanceAreaEnrollment(school),
    dist: welcomingDistance(school),
    canExpand: hasSpaceToExpand(school),
    flagged: belowEAPercentileOrSafety(school),
  }
}

export function evaluate(school: School, t: PlanningThresholds): EvaluationResult {
  return evaluateInputs(schoolInputs(school), t)
}

/**
 * Walk the strategic-sorting decision tree for the given metric inputs under
 * the supplied thresholds, returning the highlighted path and recommendation.
 */
export function evaluateInputs(inp: PlanningInputs, t: PlanningThresholds): EvaluationResult {
  const { util, growth, composite, ea, area, dist, canExpand, flagged } = inp

  const nodes: string[] = ["start"]
  const edges: string[] = []
  const branches: Record<string, "yes" | "no"> = {}

  const step = (from: string, to: string, decision?: { node: string; result: "yes" | "no" }) => {
    edges.push(`${from}->${to}`)
    nodes.push(to)
    if (decision) branches[decision.node] = decision.result
  }

  let outcome = ""
  let outcomeLabel = ""
  const finish = (node: string, label: string) => {
    outcome = node
    outcomeLabel = label
  }

  // FLOW 1 — Decision routing
  step("start", "f1_below")
  const isBelow = util < t.currentUtilThreshold
  branches.f1_below = isBelow ? "yes" : "no"

  if (isBelow) {
    // Underutilized -> Flow 4 (Closure / Consolidation)
    step("f1_below", "f4_composite", { node: "f1_below", result: "yes" })
    const compAbove = composite >= t.closureComposite
    branches.f4_composite = compAbove ? "yes" : "no"
    if (compAbove) {
      step("f4_composite", "f4_distance", { node: "f4_composite", result: "yes" })
      const within = dist <= t.welcomingDistance
      branches.f4_distance = within ? "yes" : "no"
      if (within) {
        step("f4_distance", "out_welcoming_capital", { node: "f4_distance", result: "yes" })
        finish("out_welcoming_capital", "Welcoming School with Capital Investment")
      } else {
        step("f4_distance", "out_welcoming_replacement", { node: "f4_distance", result: "no" })
        finish("out_welcoming_replacement", "Welcoming School with Building Replacement")
      }
    } else {
      step("f4_composite", "out_closure", { node: "f4_composite", result: "no" })
      finish("out_closure", "Closure (Goes to Welcoming School)")
    }
  } else {
    // FLOW 1 -> high utilization check
    step("f1_below", "f1_highutil", { node: "f1_below", result: "no" })
    const overcrowded = util > t.highUtilThreshold
    branches.f1_highutil = overcrowded ? "yes" : "no"

    if (overcrowded) {
      // FLOW 2 — Expansion / Overcrowding
      step("f1_highutil", "f2_space", { node: "f1_highutil", result: "yes" })
      branches.f2_space = canExpand ? "yes" : "no"
      if (canExpand) {
        step("f2_space", "f2_ea", { node: "f2_space", result: "yes" })
        const eaOk = ea >= t.expansionEA
        branches.f2_ea = eaOk ? "yes" : "no"
        if (eaOk) {
          step("f2_ea", "out_addition", { node: "f2_ea", result: "yes" })
          finish("out_addition", "Building Addition")
        } else {
          step("f2_ea", "out_addition_capital", { node: "f2_ea", result: "no" })
          finish("out_addition_capital", "Building Addition with Capital Investment")
        }
      } else {
        step("f2_space", "f2_area", { node: "f2_space", result: "no" })
        const areaHigh = area >= t.attendanceAreaEnrollment
        branches.f2_area = areaHigh ? "yes" : "no"
        if (areaHigh) {
          step("f2_area", "f2_composite", { node: "f2_area", result: "yes" })
          const compOk = composite >= t.expansionComposite
          branches.f2_composite = compOk ? "yes" : "no"
          if (compOk) {
            step("f2_composite", "out_building_replacement", { node: "f2_composite", result: "yes" })
            finish("out_building_replacement", "Building Replacement")
          } else {
            step("f2_composite", "out_policy", { node: "f2_composite", result: "no" })
            finish("out_policy", "Policy Solution for Overcrowding")
          }
        } else {
          step("f2_area", "out_policy", { node: "f2_area", result: "no" })
          finish("out_policy", "Policy Solution for Overcrowding")
        }
      }
    } else {
      // Stable utilization -> growth check
      step("f1_highutil", "f1_growth", { node: "f1_highutil", result: "no" })
      const growing = growth > t.growthThreshold
      branches.f1_growth = growing ? "yes" : "no"

      if (growing) {
        // Growth -> treat as expansion candidate
        step("f1_growth", "f2_space", { node: "f1_growth", result: "yes" })
        branches.f2_space = canExpand ? "yes" : "no"
        if (canExpand) {
          step("f2_space", "f2_ea", { node: "f2_space", result: "yes" })
          const eaOk = ea >= t.expansionEA
          branches.f2_ea = eaOk ? "yes" : "no"
          if (eaOk) {
            step("f2_ea", "out_addition", { node: "f2_ea", result: "yes" })
            finish("out_addition", "Building Addition")
          } else {
            step("f2_ea", "out_addition_capital", { node: "f2_ea", result: "no" })
            finish("out_addition_capital", "Building Addition with Capital Investment")
          }
        } else {
          step("f2_space", "out_policy", { node: "f2_space", result: "no" })
          finish("out_policy", "Policy Solution for Overcrowding")
        }
      } else {
        // FLOW 3 — Maintenance / Investment
        step("f1_growth", "f3_composite_above", { node: "f1_growth", result: "no" })
        const compHealthy = composite >= t.compositeAbove
        branches.f3_composite_above = compHealthy ? "yes" : "no"
        if (compHealthy) {
          step("f3_composite_above", "f3_ea", { node: "f3_composite_above", result: "yes" })
          const eaOk = ea >= t.flow3EA
          branches.f3_ea = eaOk ? "yes" : "no"
          if (eaOk) {
            step("f3_ea", "out_standard", { node: "f3_ea", result: "yes" })
            finish("out_standard", "Standard Maintenance")
          } else {
            step("f3_ea", "out_targeted", { node: "f3_ea", result: "no" })
            finish("out_targeted", "Targeted Capital Investment")
          }
        } else {
          step("f3_composite_above", "f3_composite_below", { node: "f3_composite_above", result: "no" })
          const veryLow = composite < t.compositeBelow
          branches.f3_composite_below = veryLow ? "yes" : "no"
          if (veryLow) {
            step("f3_composite_below", "f3_safety", { node: "f3_composite_below", result: "yes" })
            branches.f3_safety = flagged ? "yes" : "no"
            if (flagged) {
              step("f3_safety", "out_major_capital", { node: "f3_safety", result: "yes" })
              finish("out_major_capital", "Major Capital Investment")
            } else {
              step("f3_safety", "out_building_replacement", { node: "f3_safety", result: "no" })
              finish("out_building_replacement", "Building Replacement")
            }
          } else {
            step("f3_composite_below", "out_standard", { node: "f3_composite_below", result: "no" })
            finish("out_standard", "Standard Maintenance")
          }
        }
      }
    }
  }

  return { activeNodes: nodes, activeEdges: edges, branchResults: branches, outcome, outcomeLabel }
}

// ---------- Static graph layout ----------

export const PLANNING_NODES: PlanningNode[] = [
  // Flow 1 — Decision routing (left column)
  { id: "start", kind: "start", label: "START HERE", flow: "flow1", position: { x: 0, y: 300 } },
  {
    id: "f1_below",
    kind: "decision",
    label: "Current enrollment or utilization below?",
    flow: "flow1",
    position: { x: 240, y: 300 },
    thresholdKey: "currentUtilThreshold",
    unit: "%",
  },
  {
    id: "f1_highutil",
    kind: "decision",
    label: "Current utilization rate above?",
    flow: "flow1",
    position: { x: 240, y: 160 },
    thresholdKey: "highUtilThreshold",
    unit: "%",
  },
  {
    id: "f1_growth",
    kind: "decision",
    label: "Projected enrollment growth above?",
    flow: "flow1",
    position: { x: 240, y: 460 },
    thresholdKey: "growthThreshold",
    unit: "%",
  },

  // Flow 2 — Expansion / Overcrowding (top right)
  {
    id: "f2_space",
    kind: "decision",
    label: "Property has space to expand?",
    flow: "flow2",
    position: { x: 560, y: 40 },
  },
  {
    id: "f2_ea",
    kind: "decision",
    label: "Educational Adequacy above?",
    flow: "flow2",
    position: { x: 820, y: -40 },
    thresholdKey: "expansionEA",
    unit: "%",
  },
  {
    id: "f2_area",
    kind: "decision",
    label: "Attendance area enrollment above?",
    flow: "flow2",
    position: { x: 820, y: 120 },
    thresholdKey: "attendanceAreaEnrollment",
    unit: "%",
  },
  {
    id: "f2_composite",
    kind: "decision",
    label: "Composite Building Score above?",
    flow: "flow2",
    position: { x: 1080, y: 120 },
    thresholdKey: "expansionComposite",
  },
  { id: "out_addition", kind: "outcome", label: "Building Addition", flow: "flow2", position: { x: 1080, y: -120 } },
  {
    id: "out_addition_capital",
    kind: "outcome",
    label: "Building Addition with Capital Investment",
    flow: "flow2",
    position: { x: 1080, y: -40 },
  },
  {
    id: "out_building_replacement",
    kind: "outcome",
    label: "Building Replacement",
    flow: "flow2",
    position: { x: 1340, y: 40 },
  },
  {
    id: "out_policy",
    kind: "outcome",
    label: "Policy Solution for Overcrowding",
    flow: "flow2",
    position: { x: 1340, y: 200 },
  },

  // Flow 3 — Maintenance / Investment (middle right)
  {
    id: "f3_composite_above",
    kind: "decision",
    label: "Composite Building Score above?",
    flow: "flow3",
    position: { x: 560, y: 460 },
    thresholdKey: "compositeAbove",
  },
  {
    id: "f3_composite_below",
    kind: "decision",
    label: "Composite Building Score below?",
    flow: "flow3",
    position: { x: 820, y: 540 },
    thresholdKey: "compositeBelow",
  },
  {
    id: "f3_ea",
    kind: "decision",
    label: "Educational Adequacy above?",
    flow: "flow3",
    position: { x: 820, y: 400 },
    thresholdKey: "flow3EA",
    unit: "%",
  },
  {
    id: "f3_safety",
    kind: "decision",
    label: "Below 50% percentile EA or safety/security issues?",
    flow: "flow3",
    position: { x: 1080, y: 540 },
  },
  {
    id: "out_targeted",
    kind: "outcome",
    label: "Targeted Capital Investment",
    flow: "flow3",
    position: { x: 1340, y: 380 },
  },
  { id: "out_standard", kind: "outcome", label: "Standard Maintenance", flow: "flow3", position: { x: 1340, y: 480 } },
  {
    id: "out_major_capital",
    kind: "outcome",
    label: "Major Capital Investment",
    flow: "flow3",
    position: { x: 1340, y: 600 },
  },

  // Flow 4 — Closure / Consolidation (bottom right)
  {
    id: "f4_composite",
    kind: "decision",
    label: "Composite Building Score above?",
    flow: "flow4",
    position: { x: 560, y: 720 },
    thresholdKey: "closureComposite",
  },
  {
    id: "f4_distance",
    kind: "decision",
    label: "Within distance threshold of Welcoming School?",
    flow: "flow4",
    position: { x: 820, y: 800 },
    thresholdKey: "welcomingDistance",
    unit: " mi",
  },
  {
    id: "out_closure",
    kind: "outcome",
    label: "Closure (Goes to Welcoming School)",
    flow: "flow4",
    position: { x: 560, y: 860 },
  },
  {
    id: "out_welcoming_capital",
    kind: "outcome",
    label: "Welcoming School with Capital Investment",
    flow: "flow4",
    position: { x: 1080, y: 720 },
  },
  {
    id: "out_welcoming_replacement",
    kind: "outcome",
    label: "Welcoming School with Building Replacement",
    flow: "flow4",
    position: { x: 1080, y: 840 },
  },
]

const edge = (source: string, target: string, branch: "yes" | "no" | null): PlanningEdge => ({
  id: `${source}->${target}`,
  source,
  target,
  branch,
})

export const PLANNING_EDGES: PlanningEdge[] = [
  edge("start", "f1_below", null),
  // Flow 1 routing
  edge("f1_below", "f1_highutil", "no"),
  edge("f1_below", "f4_composite", "yes"),
  edge("f1_highutil", "f1_growth", "no"),
  edge("f1_highutil", "f2_space", "yes"),
  edge("f1_growth", "f2_space", "yes"),
  edge("f1_growth", "f3_composite_above", "no"),
  // Flow 2
  edge("f2_space", "f2_ea", "yes"),
  edge("f2_space", "f2_area", "no"),
  edge("f2_space", "out_policy", "no"),
  edge("f2_ea", "out_addition", "yes"),
  edge("f2_ea", "out_addition_capital", "no"),
  edge("f2_area", "f2_composite", "yes"),
  edge("f2_area", "out_policy", "no"),
  edge("f2_composite", "out_building_replacement", "yes"),
  edge("f2_composite", "out_policy", "no"),
  // Flow 3
  edge("f3_composite_above", "f3_ea", "yes"),
  edge("f3_composite_above", "f3_composite_below", "no"),
  edge("f3_ea", "out_standard", "yes"),
  edge("f3_ea", "out_targeted", "no"),
  edge("f3_composite_below", "f3_safety", "yes"),
  edge("f3_composite_below", "out_standard", "no"),
  edge("f3_safety", "out_major_capital", "yes"),
  edge("f3_safety", "out_building_replacement", "no"),
  // Flow 4
  edge("f4_composite", "f4_distance", "yes"),
  edge("f4_composite", "out_closure", "no"),
  edge("f4_distance", "out_welcoming_capital", "yes"),
  edge("f4_distance", "out_welcoming_replacement", "no"),
]

export const FLOW_META: Record<FlowGroup, { title: string; subtitle: string }> = {
  flow1: { title: "FLOW 1", subtitle: "Decision routing" },
  flow2: { title: "FLOW 2", subtitle: "Expansion / Overcrowding" },
  flow3: { title: "FLOW 3", subtitle: "Maintenance / Investment" },
  flow4: { title: "FLOW 4", subtitle: "Closure / Consolidation" },
}

// ---------- District-wide classification (made-up key data points) ----------

// Composite building score range (0-10) keyed by FCA rating.
const COMPOSITE_BY_FCA: Record<RoomCondition, [number, number]> = {
  good: [7, 9.2],
  fair: [4, 6.8],
  poor: [1.5, 3.8],
}
// Educational adequacy range (%) keyed by ESA rating.
const EA_BY_ESA: Record<RoomCondition, [number, number]> = {
  good: [82, 95],
  fair: [62, 81],
  poor: [36, 61],
}
// Enrollment range keyed by school level.
const ENROLLMENT_BY_TYPE: Record<DistrictSchool["type"], [number, number]> = {
  ES: [320, 760],
  MS: [560, 1150],
  HS: [1350, 2650],
  OT: [0, 0],
}

const lerp = (range: [number, number], r: number) => range[0] + (range[1] - range[0]) * r
const round1 = (n: number) => Math.round(n * 10) / 10

/** Derive deterministic (made-up) planning metrics for a district school. */
function districtInputs(s: DistrictSchool): PlanningInputs & { enrollment: number } {
  const composite = round1(lerp(COMPOSITE_BY_FCA[s.fca], hash(`${s.id}-comp`)))
  const ea = Math.round(lerp(EA_BY_ESA[s.esa], hash(`${s.id}-ea2`)))
  const util = Math.round(45 + hash(`${s.id}-util`) * 70)
  const growth = round1(hash(`${s.id}-growth`) * 16 - 3)
  const area = Math.round(60 + hash(`${s.id}-area`) * 36)
  const dist = round1(1.2 + hash(`${s.id}-welcome`) * 5.3)
  const canExpand = hash(`${s.id}-expand`) > 0.45
  const flagged = ea < 60 || hash(`${s.id}-safety`) > 0.6
  const enrollment = Math.round(lerp(ENROLLMENT_BY_TYPE[s.type], hash(`${s.id}-enroll`)))
  return { util, growth, composite, ea, area, dist, canExpand, flagged, enrollment }
}

/** Numeric FCI + ESA scores for district map schools (deterministic sample data). */
export function districtSchoolScores(s: DistrictSchool): { fci: number; esa: number } {
  const { composite, ea } = districtInputs(s)
  return { fci: round1(1 - composite / 10), esa: ea }
}

/** A single school's classification row for the table. */
export interface SchoolPlanningRow {
  id: string
  name: string
  type: DistrictSchool["type"]
  enrollment: number
  utilization: number
  growth: number
  composite: number
  ea: number
  distance: number
  outcome: string
  outcomeLabel: string
  flow: FlowGroup
}

const NODE_FLOW: Record<string, FlowGroup> = Object.fromEntries(
  PLANNING_NODES.map((n) => [n.id, n.flow]),
) as Record<string, FlowGroup>

/** Classify every district (GeoJSON) school under the given thresholds. */
export function classifyDistrictSchools(t: PlanningThresholds): SchoolPlanningRow[] {
  return teachingDistrictSchools.map((s) => {
    const inp = districtInputs(s)
    const res = evaluateInputs(inp, t)
    return {
      id: s.id,
      name: s.name,
      type: s.type,
      enrollment: inp.enrollment,
      utilization: inp.util,
      growth: inp.growth,
      composite: inp.composite,
      ea: inp.ea,
      distance: inp.dist,
      outcome: res.outcome,
      outcomeLabel: res.outcomeLabel,
      flow: NODE_FLOW[res.outcome] ?? "flow1",
    }
  })
}
