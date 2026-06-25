export type StatusLevel = "critical" | "warning" | "info" | "good"

export interface NearbyBuilding {
  name: string
  type: string
  distance: number
}

export interface SystemNeed {
  name: string
  low: number
  high: number
  pctOfTotal: number
}

export interface SystemSubcomponent {
  name: string
  /** Relative share of the parent system's cost (weights are normalized). */
  weight: number
  condition: StatusLevel
  /** Year the component was installed or last replaced. */
  installYear: number
  /** Expected service life in years (industry-typical). */
  serviceLife: number
}

/**
 * Remaining useful life of a component for a given assessment year.
 * RUL = (installYear + serviceLife) - year. Negative means past end of life.
 */
export function remainingUsefulLife(c: SystemSubcomponent, year: number): number {
  return c.installYear + c.serviceLife - year
}

/**
 * Subcomponent breakdown for each capital system. The same engineering
 * breakdown applies across campuses; per-school dollar ranges are derived by
 * distributing the system's low/high range across these weights.
 */
export const SYSTEM_SUBCOMPONENTS: Record<string, SystemSubcomponent[]> = {
  HVAC: [
    { name: "Air Handling Units", weight: 32, condition: "critical", installYear: 2000, serviceLife: 25 },
    { name: "Boilers & Hot Water", weight: 24, condition: "warning", installYear: 2006, serviceLife: 25 },
    { name: "Chillers & Cooling", weight: 20, condition: "warning", installYear: 2008, serviceLife: 23 },
    { name: "Ductwork & Distribution", weight: 14, condition: "info", installYear: 2010, serviceLife: 30 },
    { name: "Controls & Thermostats", weight: 10, condition: "info", installYear: 2014, serviceLife: 18 },
  ],
  Electrical: [
    { name: "Main Switchgear & Panels", weight: 34, condition: "critical", installYear: 1998, serviceLife: 30 },
    { name: "Branch Wiring & Devices", weight: 26, condition: "warning", installYear: 2005, serviceLife: 28 },
    { name: "Interior Lighting", weight: 22, condition: "warning", installYear: 2008, serviceLife: 22 },
    { name: "Emergency / Egress Power", weight: 10, condition: "info", installYear: 2013, serviceLife: 20 },
    { name: "Fire Alarm Power", weight: 8, condition: "good", installYear: 2019, serviceLife: 20 },
  ],
  "ADA Compliance": [
    { name: "Accessible Restrooms", weight: 38, condition: "warning", installYear: 2003, serviceLife: 28 },
    { name: "Ramps & Entrances", weight: 30, condition: "warning", installYear: 2006, serviceLife: 25 },
    { name: "Door Hardware & Width", weight: 20, condition: "info", installYear: 2012, serviceLife: 22 },
    { name: "Signage & Wayfinding", weight: 12, condition: "good", installYear: 2020, serviceLife: 18 },
  ],
  Conveying: [
    { name: "Passenger Elevator", weight: 56, condition: "warning", installYear: 2002, serviceLife: 30 },
    { name: "Elevator Controls & Cab", weight: 28, condition: "info", installYear: 2010, serviceLife: 20 },
    { name: "Wheelchair / Platform Lift", weight: 16, condition: "info", installYear: 2013, serviceLife: 20 },
  ],
  "Exterior Enclosure": [
    { name: "Exterior Walls & Cladding", weight: 34, condition: "warning", installYear: 2002, serviceLife: 35 },
    { name: "Window Assemblies", weight: 30, condition: "warning", installYear: 2004, serviceLife: 30 },
    { name: "Exterior Doors", weight: 18, condition: "info", installYear: 2010, serviceLife: 25 },
    { name: "Sealants & Waterproofing", weight: 18, condition: "info", installYear: 2011, serviceLife: 18 },
  ],
  "Exterior Stairs": [
    { name: "Concrete Stairs & Landings", weight: 48, condition: "warning", installYear: 2004, serviceLife: 30 },
    { name: "Handrails & Guardrails", weight: 30, condition: "info", installYear: 2009, serviceLife: 25 },
    { name: "Treads, Nosings & Coatings", weight: 22, condition: "info", installYear: 2012, serviceLife: 18 },
  ],
  "Fire Protection": [
    { name: "Sprinkler System", weight: 40, condition: "warning", installYear: 2003, serviceLife: 30 },
    { name: "Fire Alarm & Detection", weight: 30, condition: "info", installYear: 2012, serviceLife: 20 },
    { name: "Standpipes & Extinguishers", weight: 16, condition: "good", installYear: 2016, serviceLife: 20 },
    { name: "Fire-Rated Assemblies", weight: 14, condition: "info", installYear: 2008, serviceLife: 30 },
  ],
  Plumbing: [
    { name: "Domestic Water Piping", weight: 36, condition: "warning", installYear: 2002, serviceLife: 32 },
    { name: "Sanitary / Waste Lines", weight: 28, condition: "warning", installYear: 2004, serviceLife: 32 },
    { name: "Fixtures & Faucets", weight: 22, condition: "info", installYear: 2012, serviceLife: 20 },
    { name: "Water Heaters", weight: 14, condition: "info", installYear: 2013, serviceLife: 15 },
  ],
  Roofing: [
    { name: "Membrane / Built-Up Roof", weight: 52, condition: "warning", installYear: 2008, serviceLife: 22 },
    { name: "Flashing & Edge Metal", weight: 26, condition: "info", installYear: 2010, serviceLife: 25 },
    { name: "Drains & Gutters", weight: 22, condition: "info", installYear: 2012, serviceLife: 25 },
  ],
  "Site Improvements": [
    { name: "Sidewalks & Paving", weight: 40, condition: "warning", installYear: 2005, serviceLife: 25 },
    { name: "Site Drainage", weight: 30, condition: "info", installYear: 2010, serviceLife: 30 },
    { name: "Curbs & Parking", weight: 18, condition: "info", installYear: 2012, serviceLife: 25 },
    { name: "Landscaping & Fencing", weight: 12, condition: "good", installYear: 2019, serviceLife: 20 },
  ],
  Structure: [
    { name: "Foundations", weight: 30, condition: "good", installYear: 1996, serviceLife: 50 },
    { name: "Floor & Roof Framing", weight: 30, condition: "info", installYear: 1996, serviceLife: 45 },
    { name: "Load-Bearing Walls", weight: 24, condition: "info", installYear: 1996, serviceLife: 45 },
    { name: "Structural Slabs", weight: 16, condition: "good", installYear: 1996, serviceLife: 50 },
  ],
}

export interface EAItem {
  name: string
  score: number
}

export interface EACategory {
  name: string
  score: number
  items?: EAItem[]
}

export interface PortfolioMetric {
  label: string
  value: string
  /** fill ratio of the bar, 0-1 */
  ratio: number
  comparison: string
  badge?: string
  color: StatusLevel
  scaleNote?: string
}

export type RoomCondition = "good" | "fair" | "poor"

export interface RoomEAMetric {
  name: string
  score: number
  /** Optional sub-criteria for drill-down (e.g. Lively Building B specialty rooms). */
  subCriteria?: { name: string; met: boolean; note?: string }[]
}

/** Condition of an individual building system within a room. */
export interface RoomSystemCondition {
  name: string
  condition: RoomCondition
}

export interface FloorPlanRoom {
  /** Room number as labeled on the plan */
  id: string
  name: string
  /** Centroid in the SVG's own coordinate space */
  x: number
  y: number
  condition: RoomCondition
  eaScore: number
  sqft: number
  capacity: number
  metrics: RoomEAMetric[]
  note: string
  /** Room-level Facility Condition Assessment */
  fci: number
  fcaCondition: RoomCondition
  systems: RoomSystemCondition[]
  fcaNote: string
  /** CAFM building letter when the floor plan tags rooms by building (e.g. Lively A–D). */
  building?: string
}

export interface School {
  id: string
  name: string
  address: string
  age: number
  squareFootage: number
  gradesServed: string
  lat: number
  lng: number
  enrollment: number
  enrollmentDate: string
  originalCapacity: number
  peCapacity: number
  utilOriginal: number
  utilPe: number
  nearby: NearbyBuilding[]
  portfolio: PortfolioMetric[]
  totalNeedsLow: number
  totalNeedsHigh: number
  needsYear: number
  systems: SystemNeed[]
  eaOverall: number
  eaCategories: EACategory[]
  spaceSufficiency: SpaceSufficiencyCategory[]
}

/** A single space-sufficiency category scored 0-100 (vs. Education Specification sq ft). */
export interface SpaceSufficiencyCategory {
  category: string
  score: number
}

/**
 * District-wide average space-sufficiency profile, used as the comparison
 * baseline on the radar/spider plot.
 */
export const districtSpaceSufficiency: SpaceSufficiencyCategory[] = [
  { category: "Overall Campus", score: 72 },
  { category: "Administrative", score: 70 },
  { category: "Avg. Classroom", score: 88 },
  { category: "Gymnasium", score: 62 },
  { category: "Specialty Space", score: 64 },
  { category: "Student Support", score: 74 },
]

/** Scoring rubric: how far below Education Specification sq ft maps to a score. */
export const SPACE_SUFFICIENCY_SCORING: { range: string; score: string }[] = [
  { range: "<10% below Ed Spec sq ft", score: "100%" },
  { range: "10-20% below Ed Spec sq ft", score: "80%" },
  { range: "20-30% below Ed Spec sq ft", score: "75%" },
  { range: "30-40% below Ed Spec sq ft", score: "50%" },
  { range: "40-50% below Ed Spec sq ft", score: "20%" },
  { range: ">50% below Ed Spec sq ft", score: "0%" },
]

/** Average of a space-sufficiency profile, rounded to the nearest whole percent. */
export function spaceSufficiencyAverage(cats: SpaceSufficiencyCategory[]): number {
  if (!cats.length) return 0
  return Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length)
}

/** Returns a status level from a 0-100 educational-adequacy style score. */
export function scoreToStatus(score: number): StatusLevel {
  if (score < 40) return "critical"
  if (score < 60) return "warning"
  if (score < 80) return "info"
  return "good"
}

export const STATUS_BAR: Record<StatusLevel, string> = {
  critical: "bg-status-critical",
  warning: "bg-status-warning",
  info: "bg-status-info",
  good: "bg-status-good",
}

export const STATUS_TEXT: Record<StatusLevel, string> = {
  critical: "text-status-critical",
  warning: "text-status-warning",
  info: "text-status-info",
  good: "text-status-good",
}

export const STATUS_DOT: Record<StatusLevel, string> = {
  critical: "bg-status-critical",
  warning: "bg-status-warning",
  info: "bg-status-info",
  good: "bg-status-good",
}

export const ROOM_CONDITION_BAR: Record<RoomCondition, string> = {
  good: "bg-status-good",
  fair: "bg-status-warning",
  poor: "bg-status-critical",
}

export const ROOM_CONDITION_TEXT: Record<RoomCondition, string> = {
  good: "text-status-good",
  fair: "text-status-warning",
  poor: "text-status-critical",
}

export const ROOM_CONDITION_LABEL: Record<RoomCondition, string> = {
  good: "Good",
  fair: "Fair",
  poor: "Poor",
}

/** Fill colors (oklch tokens) used to tint the room hotspots on the plan. */
export const ROOM_CONDITION_FILL: Record<RoomCondition, string> = {
  good: "oklch(0.68 0.16 158)",
  fair: "oklch(0.75 0.16 70)",
  poor: "oklch(0.62 0.22 27)",
}

/** The plan SVG's own viewBox — overlay hotspots share this coordinate space. */
export const FLOOR_PLAN_VIEWBOX = { x: 7262.2, y: 2.7, w: 3485.6, h: 3746.7 }
export const FLOOR_PLAN_SRC = "/AdamsES_plan.svg"

export {
  DEFAULT_FLOOR_PLAN_SRC,
  DEFAULT_FLOOR_PLAN_VIEWBOX,
  floorPlanDisplaySrc,
  floorPlanSrc,
  floorPlanViewBox,
  floorPlanViewBoxString,
  floorPlanHasSelectableRooms,
  floorPlanHasRoomOverlays,
  floorPlanHasAssessmentTools,
  floorPlanBuildings,
  floorPlanBuildingColors,
  floorPlanShowHotspots,
  floorPlanDynamicLabels,
  floorPlanLevels,
  floorPlanDefaultLevelId,
  floorPlanLevel,
  floorPlanHotspotRoomIds,
  floorPlanHasHotspots,
} from "@/lib/floor-plan"
export type { FloorPlanViewBox, FloorPlanLevel } from "@/lib/floor-plan"

/**
 * Representative room-level Educational Suitability sample for the plan.
 * Centroids come directly from the plan's label coordinates so the hotspots
 * land on the correct rooms.
 */
/** A room location on the plan with no required assessment data. */
export interface PlanRoomLocation {
  id: string
  x: number
  y: number
}

/**
 * Every labeled room in the floor-plan SVG (parsed from public/AdamsES_plan.svg),
 * including rooms that have no assessment hotspot yet. Used for deficiency
 * room selection and nearest-room pin matching across the entire plan.
 */
export const allPlanRooms: PlanRoomLocation[] = [
  { id: "001", x: 8456, y: 2379 },
  { id: "002", x: 8128, y: 2360 },
  { id: "003", x: 8110, y: 2694 },
  { id: "004", x: 8089, y: 3020 },
  { id: "005", x: 8115, y: 3354 },
  { id: "006", x: 8445, y: 3375 },
  { id: "007", x: 8784, y: 3325 },
  { id: "008", x: 8885, y: 2836 },
  { id: "009", x: 9230, y: 2836 },
  { id: "010", x: 9562, y: 2838 },
  { id: "011", x: 9895, y: 2851 },
  { id: "012", x: 9879, y: 2517 },
  { id: "013", x: 9883, y: 2184 },
  { id: "014", x: 9881, y: 1838 },
  { id: "015", x: 10369, y: 1648 },
  { id: "016", x: 10419, y: 1401 },
  { id: "017", x: 10399, y: 1071 },
  { id: "018", x: 10065, y: 1045 },
  { id: "019", x: 9731, y: 1065 },
  { id: "020", x: 9370, y: 1108 },
  { id: "021", x: 9398, y: 1366 },
  { id: "103", x: 9865, y: 1250 },
  { id: "104", x: 10058, y: 1477 },
  { id: "105", x: 9469, y: 2331 },
  { id: "106", x: 8643, y: 2949 },
  { id: "107", x: 8371, y: 2754 },
  { id: "200", x: 7983, y: 1008 },
  { id: "200A", x: 7841, y: 617 },
  { id: "203", x: 8061, y: 449 },
  { id: "206", x: 8504, y: 1059 },
  { id: "207", x: 8465, y: 628 },
  { id: "210", x: 8876, y: 1520 },
  { id: "211", x: 8883, y: 988 },
  { id: "213", x: 8459, y: 2095 },
  { id: "219", x: 9338, y: 2309 },
  { id: "223", x: 7957, y: 1598 },
  { id: "226", x: 9162, y: 2007 },
  { id: "228", x: 8858, y: 2103 },
  { id: "231", x: 9521, y: 2477 },
  { id: "232", x: 9482, y: 2165 },
  { id: "233", x: 9035, y: 2506 },
  { id: "302", x: 8199, y: 1744 },
  { id: "K-1", x: 7619, y: 2137 },
  { id: "K-2", x: 7679, y: 2478 },
]

export const floorPlanRooms: FloorPlanRoom[] = [
  {
    id: "200",
    name: "Gymnasium",
    x: 7983, y: 1008,
    condition: "fair",
    eaScore: 61,
    sqft: 3379,
    capacity: 120,
    metrics: [
      { name: "Size & dimensions", score: 66 },
      { name: "Acoustics", score: 56 },
      { name: "Daylighting", score: 62 },
      { name: "ADA accessibility", score: 60 },
      { name: "Ventilation", score: 60 },
      { name: "Furniture", score: 38 },
    ],
    note: "Part of the specialty wing; adequate but dated finishes and systems place it mid-range for suitability.",
    fci: 0.25,
    fcaCondition: "fair",
    systems: [
      { name: "HVAC", condition: "fair" },
      { name: "Flooring", condition: "fair" },
      { name: "Lighting", condition: "fair" },
      { name: "Roof / structure", condition: "fair" },
      { name: "Finishes", condition: "fair" },
    ],
    fcaNote: "Consistent with the specialty wing — moderate wear across systems with phased upgrades recommended.",
  },
  {
    id: "211",
    name: "Art Studio",
    x: 8883, y: 988,
    condition: "fair",
    eaScore: 62,
    sqft: 1020,
    capacity: 24,
    metrics: [
      { name: "Size & dimensions", score: 66 },
      { name: "Sink / wet area", score: 64 },
      { name: "Daylighting", score: 62 },
      { name: "Storage", score: 58 },
      { name: "Ventilation", score: 60 },
      { name: "Furniture", score: 40 },
    ],
    note: "Functional specialty studio with a wet area; finishes and storage place it mid-range within the wing.",
    fci: 0.25,
    fcaCondition: "fair",
    systems: [
      { name: "HVAC", condition: "fair" },
      { name: "Flooring", condition: "fair" },
      { name: "Lighting", condition: "fair" },
      { name: "Plumbing / sink", condition: "fair" },
      { name: "Finishes", condition: "fair" },
    ],
    fcaNote: "Consistent with the specialty wing — moderate wear across systems with phased upgrades recommended.",
  },
  {
    id: "210",
    name: "Music Room",
    x: 8876, y: 1520,
    condition: "fair",
    eaScore: 60,
    sqft: 980,
    capacity: 28,
    metrics: [
      { name: "Size & dimensions", score: 66 },
      { name: "Acoustic isolation", score: 56 },
      { name: "Daylighting", score: 26 },
      { name: "Ventilation", score: 60 },
      { name: "Furniture", score: 38 },
    ],
    note: "Mid-range specialty room; acoustics and storage are adequate but dated, in line with the wing.",
    fci: 0.25,
    fcaCondition: "fair",
    systems: [
      { name: "HVAC", condition: "fair" },
      { name: "Flooring", condition: "fair" },
      { name: "Lighting", condition: "fair" },
      { name: "Acoustic treatment", condition: "fair" },
      { name: "Finishes", condition: "fair" },
    ],
    fcaNote: "Consistent with the specialty wing — moderate wear across systems with phased upgrades recommended.",
  },
  {
    id: "223",
    name: "Main Office",
    x: 7957, y: 1598,
    condition: "fair",
    eaScore: 62,
    sqft: 640,
    capacity: 8,
    metrics: [
      { name: "Visibility of entry", score: 66 },
      { name: "Reception layout", score: 60 },
      { name: "Security control", score: 64 },
      { name: "Daylighting", score: 62 },
      { name: "ADA accessibility", score: 60 },
      { name: "Furniture", score: 40 },
    ],
    note: "Adequate administrative suite; sightlines are decent but finishes and systems sit mid-range for the wing.",
    fci: 0.24,
    fcaCondition: "fair",
    systems: [
      { name: "HVAC", condition: "fair" },
      { name: "Flooring", condition: "fair" },
      { name: "Lighting", condition: "fair" },
      { name: "Data / security", condition: "fair" },
      { name: "Finishes", condition: "fair" },
    ],
    fcaNote: "Consistent with the specialty wing — moderate wear across systems with phased upgrades recommended.",
  },
  {
    id: "021",
    name: "Classroom 021",
    x: 9398, y: 1366,
    condition: "good",
    eaScore: 82,
    sqft: 920,
    capacity: 22,
    metrics: [
      { name: "Size per student", score: 85 },
      { name: "Daylighting", score: 84 },
      { name: "Technology", score: 78 },
      { name: "Flexibility", score: 80 },
      { name: "Acoustics", score: 79 },
      { name: "Furniture", score: 33 },
    ],
    note: "Meets size and daylight targets with flexible furniture layout.",
    fci: 0.16,
    fcaCondition: "good",
    systems: [
      { name: "HVAC", condition: "good" },
      { name: "Flooring", condition: "poor" },
      { name: "Lighting", condition: "good" },
      { name: "Technology", condition: "fair" },
      { name: "Finishes", condition: "good" },
    ],
    fcaNote: "Strong overall, but deteriorated flooring is at end of life and needs replacement.",
  },
  {
    id: "015",
    name: "Classroom 015",
    x: 10369, y: 1648,
    condition: "good",
    eaScore: 81,
    sqft: 857,
    capacity: 22,
    metrics: [
      { name: "Size per student", score: 83 },
      { name: "Daylighting", score: 82 },
      { name: "Technology", score: 79 },
      { name: "Flexibility", score: 80 },
      { name: "Acoustics", score: 78 },
      { name: "Furniture", score: 32 },
    ],
    note: "Well-proportioned classroom with good daylight and technology; furniture is the lone weak point.",
    fci: 0.16,
    fcaCondition: "good",
    systems: [
      { name: "HVAC", condition: "good" },
      { name: "Flooring", condition: "poor" },
      { name: "Lighting", condition: "good" },
      { name: "Technology", condition: "fair" },
      { name: "Finishes", condition: "good" },
    ],
    fcaNote: "Strong overall, but deteriorated flooring is at end of life and needs replacement.",
  },
  {
    id: "005",
    name: "Classroom 005",
    x: 8115, y: 3354,
    condition: "poor",
    eaScore: 37,
    sqft: 790,
    capacity: 20,
    metrics: [
      { name: "Size per student", score: 76 },
      { name: "Daylighting", score: 78 },
      { name: "Technology", score: 30 },
      { name: "Flexibility", score: 32 },
      { name: "ADA accessibility", score: 44 },
      { name: "Furniture", score: 26 },
    ],
    note: "Below-standard area and accessibility constraints reduce instructional suitability.",
    fci: 0.38,
    fcaCondition: "poor",
    systems: [
      { name: "HVAC", condition: "fair" },
      { name: "Flooring", condition: "poor" },
      { name: "Lighting", condition: "poor" },
      { name: "Doors / hardware", condition: "poor" },
      { name: "Finishes", condition: "fair" },
    ],
    fcaNote: "Deteriorated flooring, lighting, and non-compliant door hardware need replacement.",
  },
  {
    id: "009",
    name: "Classroom 009",
    x: 9230, y: 2836,
    condition: "fair",
    eaScore: 63,
    sqft: 880,
    capacity: 22,
    metrics: [
      { name: "Size per student", score: 83 },
      { name: "Daylighting", score: 60 },
      { name: "Technology", score: 56 },
      { name: "Flexibility", score: 58 },
      { name: "Acoustics", score: 60 },
      { name: "Furniture", score: 38 },
    ],
    note: "Well-sized classroom, but dated technology and finishes place it mid-range for suitability.",
    fci: 0.24,
    fcaCondition: "fair",
    systems: [
      { name: "HVAC", condition: "good" },
      { name: "Flooring", condition: "fair" },
      { name: "Lighting", condition: "good" },
      { name: "Technology", condition: "fair" },
      { name: "Finishes", condition: "good" },
    ],
    fcaNote: "Good condition overall; carpet and technology approaching their replacement cycle.",
  },
  {
    id: "013",
    name: "Classroom 013",
    x: 9883, y: 2184,
    condition: "fair",
    eaScore: 62,
    sqft: 910,
    capacity: 22,
    metrics: [
      { name: "Size per student", score: 82 },
      { name: "Daylighting", score: 60 },
      { name: "Technology", score: 56 },
      { name: "Flexibility", score: 58 },
      { name: "Acoustics", score: 60 },
      { name: "Furniture", score: 41 },
    ],
    note: "Well-sized classroom, but dated technology and finishes place it mid-range for suitability.",
    fci: 0.24,
    fcaCondition: "fair",
    systems: [
      { name: "HVAC", condition: "fair" },
      { name: "Flooring", condition: "fair" },
      { name: "Lighting", condition: "fair" },
      { name: "Technology", condition: "fair" },
      { name: "Finishes", condition: "fair" },
    ],
    fcaNote: "Moderate wear across systems; phased upgrades recommended over the next cycle.",
  },
  {
    id: "302",
    name: "Special Education",
    x: 8199, y: 1744,
    condition: "fair",
    eaScore: 60,
    sqft: 720,
    capacity: 12,
    metrics: [
      { name: "Size & support space", score: 62 },
      { name: "Adjacency to services", score: 56 },
      { name: "ADA accessibility", score: 60 },
      { name: "Acoustics", score: 58 },
      { name: "Restroom proximity", score: 64 },
      { name: "Daylighting", score: 24 },
      { name: "Furniture", score: 38 },
    ],
    note: "Adequate support space with reasonable service adjacency; mid-range within the specialty wing.",
    fci: 0.25,
    fcaCondition: "fair",
    systems: [
      { name: "HVAC", condition: "fair" },
      { name: "Flooring", condition: "fair" },
      { name: "Plumbing / restroom", condition: "fair" },
      { name: "Doors / hardware", condition: "fair" },
      { name: "Finishes", condition: "fair" },
    ],
    fcaNote: "Consistent with the specialty wing — moderate wear across systems with phased upgrades recommended.",
  },
  {
    id: "226",
    name: "Library",
    x: 9162, y: 2007,
    condition: "good",
    eaScore: 81,
    sqft: 2221,
    capacity: 60,
    metrics: [
      { name: "Size & dimensions", score: 88 },
      { name: "Daylighting", score: 28 },
      { name: "Technology", score: 76 },
      { name: "Flexibility", score: 80 },
      { name: "Collection storage", score: 78 },
      { name: "Furniture", score: 39 },
    ],
    note: "Generously sized media center with strong daylight and flexible layout for varied use.",
    fci: 0.19,
    fcaCondition: "good",
    systems: [
      { name: "HVAC", condition: "good" },
      { name: "Flooring", condition: "fair" },
      { name: "Lighting", condition: "good" },
      { name: "Technology", condition: "fair" },
      { name: "Finishes", condition: "good" },
    ],
    fcaNote: "Sound condition overall; carpet and AV technology approaching replacement cycle.",
  },
  {
    id: "019",
    name: "Classroom 019",
    x: 9731, y: 1065,
    condition: "good",
    eaScore: 80,
    sqft: 905,
    capacity: 22,
    metrics: [
      { name: "Size per student", score: 84 },
      { name: "Daylighting", score: 82 },
      { name: "Technology", score: 78 },
      { name: "Flexibility", score: 81 },
      { name: "Acoustics", score: 77 },
      { name: "Furniture", score: 34 },
    ],
    note: "Bright, well-proportioned classroom; only the aging furniture holds back its suitability.",
    fci: 0.15,
    fcaCondition: "good",
    systems: [
      { name: "HVAC", condition: "good" },
      { name: "Flooring", condition: "poor" },
      { name: "Lighting", condition: "good" },
      { name: "Technology", condition: "fair" },
      { name: "Finishes", condition: "good" },
    ],
    fcaNote: "Strong overall, but worn flooring is at end of life and needs replacement.",
  },
  {
    id: "017",
    name: "Classroom 017",
    x: 10399, y: 1071,
    condition: "good",
    eaScore: 83,
    sqft: 915,
    capacity: 22,
    metrics: [
      { name: "Size per student", score: 86 },
      { name: "Daylighting", score: 83 },
      { name: "Technology", score: 80 },
      { name: "Flexibility", score: 82 },
      { name: "Acoustics", score: 79 },
      { name: "Furniture", score: 31 },
    ],
    note: "High-performing classroom across daylight, size, and technology; furniture is the lone weak point.",
    fci: 0.14,
    fcaCondition: "good",
    systems: [
      { name: "HVAC", condition: "good" },
      { name: "Flooring", condition: "poor" },
      { name: "Lighting", condition: "good" },
      { name: "Technology", condition: "fair" },
      { name: "Finishes", condition: "good" },
    ],
    fcaNote: "Strong overall, but deteriorated flooring is at end of life and needs replacement.",
  },
  {
    id: "002",
    name: "Classroom 002",
    x: 8128, y: 2360,
    condition: "poor",
    eaScore: 36,
    sqft: 805,
    capacity: 20,
    metrics: [
      { name: "Size per student", score: 77 },
      { name: "Daylighting", score: 0 },
      { name: "Technology", score: 29 },
      { name: "Flexibility", score: 31 },
      { name: "ADA accessibility", score: 42 },
      { name: "Furniture", score: 25 },
    ],
    note: "Part of the west classroom wing; an interior room with no daylight and dated systems.",
    fci: 0.39,
    fcaCondition: "poor",
    systems: [
      { name: "HVAC", condition: "fair" },
      { name: "Flooring", condition: "poor" },
      { name: "Lighting", condition: "poor" },
      { name: "Doors / hardware", condition: "poor" },
      { name: "Finishes", condition: "fair" },
    ],
    fcaNote: "Consistent with the west wing — deteriorated flooring, lighting, and hardware need replacement.",
  },
  {
    id: "007",
    name: "Classroom 007",
    x: 8784, y: 3325,
    condition: "poor",
    eaScore: 35,
    sqft: 785,
    capacity: 20,
    metrics: [
      { name: "Size per student", score: 75 },
      { name: "Daylighting", score: 76 },
      { name: "Technology", score: 28 },
      { name: "Flexibility", score: 30 },
      { name: "ADA accessibility", score: 43 },
      { name: "Furniture", score: 24 },
    ],
    note: "Part of the west classroom wing; below-standard area and accessibility constraints reduce suitability.",
    fci: 0.4,
    fcaCondition: "poor",
    systems: [
      { name: "HVAC", condition: "fair" },
      { name: "Flooring", condition: "poor" },
      { name: "Lighting", condition: "poor" },
      { name: "Doors / hardware", condition: "poor" },
      { name: "Finishes", condition: "fair" },
    ],
    fcaNote: "Consistent with the west wing — deteriorated flooring, lighting, and hardware need replacement.",
  },
  {
    id: "K-1",
    name: "Kindergarten K-1",
    x: 7619, y: 2137,
    condition: "good",
    eaScore: 83,
    sqft: 1180,
    capacity: 20,
    metrics: [
      { name: "Size & activity area", score: 86 },
      { name: "Daylighting", score: 84 },
      { name: "In-room restroom", score: 82 },
      { name: "Storage & cubbies", score: 80 },
      { name: "Flexibility", score: 81 },
      { name: "Furniture", score: 40 },
    ],
    note: "Spacious early-childhood room with in-room restroom, abundant daylight, and flexible activity zones.",
    fci: 0.13,
    fcaCondition: "good",
    systems: [
      { name: "HVAC", condition: "good" },
      { name: "Flooring", condition: "good" },
      { name: "Lighting", condition: "good" },
      { name: "Plumbing / restroom", condition: "good" },
      { name: "Finishes", condition: "good" },
    ],
    fcaNote: "Excellent condition with no significant near-term capital needs.",
  },
  {
    id: "011",
    name: "Classroom 011",
    x: 9895, y: 2851,
    condition: "fair",
    eaScore: 61,
    sqft: 870,
    capacity: 22,
    metrics: [
      { name: "Size per student", score: 75 },
      { name: "Daylighting", score: 62 },
      { name: "Technology", score: 58 },
      { name: "Flexibility", score: 60 },
      { name: "Acoustics", score: 64 },
      { name: "Furniture", score: 38 },
    ],
    note: "Functional classroom in the southeast wing; moderate technology and daylighting place it mid-range.",
    fci: 0.24,
    fcaCondition: "fair",
    systems: [
      { name: "HVAC", condition: "fair" },
      { name: "Flooring", condition: "fair" },
      { name: "Lighting", condition: "fair" },
      { name: "Technology", condition: "fair" },
      { name: "Finishes", condition: "fair" },
    ],
    fcaNote: "Moderate wear across systems; phased upgrades recommended over the next cycle.",
  },
]

export const MAPBOX_TOKEN =
  "pk.eyJ1IjoicGF0d2QwNSIsImEiOiJjbTZ2bGVhajIwMTlvMnFwc2owa3BxZHRoIn0.moDNfqMUolnHphdwsIF87w"
