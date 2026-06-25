import { districtSchoolScores } from "@/lib/capital-planning"
import type {
  EAItem,
  EACategory,
  NearbyBuilding,
  School,
  SpaceSufficiencyCategory,
  StatusLevel,
  SystemNeed,
} from "@/lib/dashboard-data"
import type { DistrictSchool } from "@/lib/district-data"
import { hashString } from "@/lib/aisd-schools"

const standardCommunity: EAItem[] = [
  { name: "Entry community", score: 67 },
  { name: "Community access", score: 0 },
  { name: "Heart of the school", score: 50 },
  { name: "Displays in public spaces", score: 50 },
  { name: "Educational signage", score: 50 },
  { name: "Access to water", score: 75 },
  { name: "Restroom location", score: 67 },
  { name: "Restrooms", score: 100 },
  { name: "Entrance accessibility", score: 62 },
]

const standardOrganization: EAItem[] = [
  { name: "Main office", score: 60 },
  { name: "Faculty collaboration", score: 75 },
  { name: "Staff lounge", score: 96 },
  { name: "Student support spaces", score: 96 },
  { name: "Instructional support spaces", score: 0 },
  { name: "Library location", score: 0 },
  { name: "Library adjacency", score: 50 },
  { name: "Academic neighborhoods", score: 0 },
  { name: "Storage", score: 0 },
]

const SYSTEM_TEMPLATE: Omit<SystemNeed, "low" | "high">[] = [
  { name: "HVAC", pctOfTotal: 24 },
  { name: "Electrical", pctOfTotal: 16 },
  { name: "Plumbing", pctOfTotal: 11 },
  { name: "Exterior Enclosure", pctOfTotal: 10 },
  { name: "Roofing", pctOfTotal: 9 },
  { name: "ADA Compliance", pctOfTotal: 8 },
  { name: "Site Improvements", pctOfTotal: 7 },
  { name: "Structure", pctOfTotal: 6 },
  { name: "Fire Protection", pctOfTotal: 4 },
  { name: "Conveying", pctOfTotal: 3 },
  { name: "Exterior Stairs", pctOfTotal: 2 },
]

const GRADES: Record<DistrictSchool["type"], string> = {
  ES: "PK-5",
  MS: "6-8",
  HS: "9-12",
  OT: "—",
}

const SQFT_RANGE: Record<DistrictSchool["type"], [number, number]> = {
  ES: [48_000, 95_000],
  MS: [110_000, 165_000],
  HS: [280_000, 480_000],
  OT: [20_000, 80_000],
}

const ENROLL_RANGE: Record<DistrictSchool["type"], [number, number]> = {
  ES: [280, 720],
  MS: [520, 1_100],
  HS: [1_200, 2_600],
  OT: [0, 0],
}

function lerp(range: [number, number], r: number) {
  return range[0] + (range[1] - range[0]) * r
}

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Five nearest teaching campuses for map context. */
export function computeNearby(ds: DistrictSchool, all: DistrictSchool[]): NearbyBuilding[] {
  return all
    .filter((s) => s.id !== ds.id && s.type !== "OT")
    .map((s) => ({
      name: s.name,
      type: s.type,
      distance: haversineMi(ds.lat, ds.lng, s.lat, s.lng),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map((n) => ({ ...n, distance: Math.round(n.distance * 100) / 100 }))
}

function buildSystems(totalMid: number): SystemNeed[] {
  return SYSTEM_TEMPLATE.map((s) => ({
    ...s,
    low: Math.round(((s.pctOfTotal / 100) * totalMid * 0.8) * 100) / 100,
    high: Math.round(((s.pctOfTotal / 100) * totalMid * 1.2) * 100) / 100,
  }))
}

function buildEaCategories(eaOverall: number): EACategory[] {
  const names = [
    "Presence",
    "Safety & Security",
    "Community",
    "Organization",
    "Classroom",
    "Environmental Quality",
    "Assembly",
    "Extended Learning",
  ]
  return names.map((name, i) => {
    const score = Math.round(
      Math.max(0, Math.min(100, eaOverall + (hashString(`ea-${name}`) - 0.5) * 24)),
    )
    if (name === "Community") return { name, score, items: standardCommunity }
    if (name === "Organization") return { name, score, items: standardOrganization }
    return { name, score }
  })
}

function buildSpaceSufficiency(base: number): SpaceSufficiencyCategory[] {
  const cats = [
    "Overall Campus",
    "Administrative",
    "Avg. Classroom",
    "Gymnasium",
    "Specialty Space",
    "Student Support",
  ]
  return cats.map((category, i) => ({
    category,
    score: Math.round(Math.max(0, Math.min(100, base + (hashString(`sp-${category}`) - 0.5) * 22))),
  }))
}

function portfolioColor(score: number): StatusLevel {
  if (score < 40) return "critical"
  if (score < 60) return "warning"
  if (score < 80) return "info"
  return "good"
}

function spaceAvg(cats: SpaceSufficiencyCategory[]): number {
  if (!cats.length) return 0
  return Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length)
}

/** Deterministic sample School profile from a district map record. */
export function generateSchoolProfile(ds: DistrictSchool, all: DistrictSchool[]): School {
  const r = (suffix: string) => hashString(`${ds.id}-${suffix}`)
  const { fci, esa } = districtSchoolScores(ds)
  const enrollment = Math.round(lerp(ENROLL_RANGE[ds.type], r("enroll")))
  const sqft = Math.round(lerp(SQFT_RANGE[ds.type], r("sqft")))
  const age = Math.round(35 + r("age") * 55)
  const originalCapacity = Math.round(enrollment / (0.75 + r("cap") * 0.28))
  const peCapacity = Math.round(originalCapacity * 1.06)
  const utilOriginal = Math.min(105, Math.round((enrollment / originalCapacity) * 100))
  const utilPe = Math.min(105, Math.round((enrollment / peCapacity) * 100))
  const spaceSufficiency = buildSpaceSufficiency(esa - 4)
  const spaceScore = spaceAvg(spaceSufficiency)
  const totalMid = lerp(
    ds.type === "HS" ? [14, 38] : ds.type === "MS" ? [9, 22] : [6, 14],
    r("needs"),
  )

  return {
    id: ds.dashboardId ?? ds.id,
    name: ds.name,
    address: ds.address ?? "Austin, TX",
    age,
    squareFootage: sqft,
    gradesServed: GRADES[ds.type],
    lat: ds.lat,
    lng: ds.lng,
    enrollment,
    enrollmentDate: "Oct 2025",
    originalCapacity,
    peCapacity,
    utilOriginal,
    utilPe,
    nearby: computeNearby(ds, all),
    portfolio: [
      {
        label: "Enrollment",
        value: enrollment.toLocaleString(),
        ratio: Math.min(1, enrollment / (ds.type === "HS" ? 1940 : ds.type === "MS" ? 1120 : 540)),
        comparison: `vs. ${ds.type === "HS" ? "1,940" : ds.type === "MS" ? "1,120" : "540"}`,
        badge: "Sample",
        color: portfolioColor(Math.round((enrollment / originalCapacity) * 100)),
      },
      {
        label: "Utilization",
        value: `${utilPe}%`,
        ratio: utilPe / 100,
        comparison: "vs. 84%",
        badge: "Sample",
        color: portfolioColor(utilPe),
      },
      {
        label: "Educational Adequacy",
        value: `${esa.toFixed(1)}%`,
        ratio: esa / 100,
        comparison: "vs. 71%",
        badge: "Sample",
        color: portfolioColor(esa),
      },
      {
        label: "Space Sufficiency Score",
        value: `${spaceScore}%`,
        ratio: spaceScore / 100,
        comparison: "Higher is better",
        color: portfolioColor(spaceScore),
        scaleNote: "Scale",
      },
      {
        label: "*Facility Condition Score",
        value: fci.toFixed(2),
        ratio: Math.min(1, fci / 0.5),
        comparison: "Lower is better",
        color: fci > 0.3 ? "critical" : fci > 0.2 ? "warning" : "good",
        scaleNote: "Scale",
      },
    ],
    totalNeedsLow: Math.round(totalMid * 0.8 * 10) / 10,
    totalNeedsHigh: Math.round(totalMid * 1.2 * 10) / 10,
    needsYear: 2031,
    systems: buildSystems(totalMid),
    eaOverall: esa,
    eaCategories: buildEaCategories(esa),
    spaceSufficiency,
  }
}

/** Patch lat/lng/address/nearby on a detailed school from district data. */
export function syncSchoolWithDistrict(school: School, ds: DistrictSchool, all: DistrictSchool[]): School {
  return {
    ...school,
    lat: ds.lat,
    lng: ds.lng,
    address: ds.address ?? school.address,
    nearby: computeNearby(ds, all),
  }
}
