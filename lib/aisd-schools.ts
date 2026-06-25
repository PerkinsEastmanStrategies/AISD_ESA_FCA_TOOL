import geojson from "@/data/aisd-schools.json"
import type { RoomCondition } from "@/lib/dashboard-data"

export type GeoSchoolType = "ES" | "MS" | "HS" | "OT"

export interface GeoDistrictSchool {
  id: string
  name: string
  type: GeoSchoolType
  lat: number
  lng: number
  fca: RoomCondition
  esa: RoomCondition
  dashboardId?: string
  campusId?: string
  address?: string
}

interface AisdProps {
  OBJECTID: number
  CLASS: string
  NAME: string
  ISD: string
  ADDRESS: string | null
  CITY: string | null
  STATE: string | null
  ZIP: string | null
  CAMPUS_ID: string
}

type AisdFeature = GeoJSON.Feature<GeoJSON.Point, AisdProps>

const RATING_POOL: RoomCondition[] = ["good", "good", "fair", "fair", "fair", "poor"]

const DASHBOARD_BY_NAME: Record<string, string> = {
  MAPLEWOOD: "maplewood",
  CASIS: "casis",
  LIVELY: "lively",
}

/** Stable 32-bit hash of a string, for per-school variance. */
export function hashString(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

function mapClass(cls: string): GeoSchoolType {
  if (cls === "ELEM") return "ES"
  if (cls === "MID") return "MS"
  if (cls === "HIGH") return "HS"
  return "OT"
}

function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/[\s-/]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .replace("O Henry", "O. Henry")
}

function formatDisplayName(name: string, cls: string): string {
  const titled = titleCase(name.replace(/\//g, " / "))
  if (cls === "ELEM") {
    if (/elementary|k-\d|4-6/i.test(titled)) return titled
    return `${titled} Elementary`
  }
  if (cls === "MID") {
    if (/middle/i.test(titled)) return titled
    return `${titled} Middle School`
  }
  if (cls === "HIGH") {
    if (name === "AUSTIN") return "Austin High School"
    if (/high|echs|sywl|lasa/i.test(titled)) return titled
    return `${titled} High School`
  }
  return titled
}

function slugify(name: string, campusId: string, objectId: number): string {
  const dashboard = DASHBOARD_BY_NAME[name]
  if (dashboard) return dashboard

  let base = name
    .toLowerCase()
    .replace(/\//g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (name === "O HENRY") base = "o-henry"
  if (name === "AUSTIN" && campusId === "002") base = "austin-hs"
  if (name === "BLAZIER K-3") base = "blazier-k-3"
  if (name === "BLAZIER 4-6") base = "blazier-4-6"
  if (name === "NORTHEAST/INTERNATIONAL") base = "northeast-international"
  if (name === "RICHARDS SYWL") base = "richards-sywl"
  if (name === "EASTSIDE ECHS") base = "eastside-echs"
  if (name === "GUERRERO THOMPSON") base = "guerrero-thompson"
  if (name === "BRYKER WOODS") base = "bryker-woods"
  if (name === "BARTON HILLS") base = "barton-hills"
  if (name === "OAK HILL") base = "oak-hill"
  if (name === "OAK SPRINGS") base = "oak-springs"
  if (name === "PECAN SPRINGS") base = "pecan-springs"
  if (name === "PLEASANT HILL") base = "pleasant-hill"
  if (name === "SUNSET VALLEY") base = "sunset-valley"
  if (name === "TRAVIS HEIGHTS") base = "travis-heights"
  if (name === "WALNUT CREEK") base = "walnut-creek"
  if (name === "BEAR CREEK") base = "bear-creek"
  if (name === "HIGHLAND PARK") base = "highland-park"
  if (name === "ST ELMO") base = "st-elmo"
  if (name === "SADLER MEANS") base = "sadler-means"
  if (name === "NORMAN-SIMS") base = "norman-sims"
  if (campusId === "0" || !campusId) base = `${base}-${objectId}`

  return base
}

function formatAddress(p: AisdProps): string {
  const parts = [p.ADDRESS, p.CITY, p.STATE, p.ZIP].filter(Boolean)
  if (!parts.length) return "Austin, TX"
  const street = String(p.ADDRESS ?? "").replace(/\b\w/g, (c) => c.toUpperCase())
  const city = titleCase(String(p.CITY ?? "Austin"))
  const state = p.STATE ?? "TX"
  const zip = p.ZIP ?? ""
  return [street, `${city}, ${state} ${zip}`.trim()].filter(Boolean).join(", ")
}

function ratingsFor(id: string, type: GeoSchoolType): { fca: RoomCondition; esa: RoomCondition } {
  if (type === "OT") return { fca: "good", esa: "good" }
  const r1 = hashString(`${id}-fca`)
  const r2 = hashString(`${id}-esa`)
  return {
    fca: RATING_POOL[Math.floor(r1 * RATING_POOL.length)],
    esa: RATING_POOL[Math.floor(r2 * RATING_POOL.length)],
  }
}

function featureToSchool(f: AisdFeature, usedIds: Set<string>): GeoDistrictSchool {
  const p = f.properties!
  const [lng, lat] = f.geometry.coordinates
  const type = mapClass(p.CLASS)
  let id = slugify(p.NAME, String(p.CAMPUS_ID ?? ""), p.OBJECTID ?? 0)
  if (usedIds.has(id)) id = `${id}-${p.CAMPUS_ID || p.OBJECTID}`
  usedIds.add(id)

  const { fca, esa } = ratingsFor(id, type)
  const dashboardId = DASHBOARD_BY_NAME[p.NAME]

  return {
    id,
    name: formatDisplayName(p.NAME, p.CLASS),
    type,
    lat,
    lng,
    fca,
    esa,
    campusId: String(p.CAMPUS_ID ?? ""),
    address: formatAddress(p),
    ...(dashboardId ? { dashboardId } : {}),
  }
}

/** All AISD locations from the official GeoJSON (schools + support sites). */
export function buildDistrictSchoolsFromGeoJSON(): GeoDistrictSchool[] {
  const usedIds = new Set<string>()
  return (geojson.features as AisdFeature[]).map((f) => featureToSchool(f, usedIds))
}

/** Resolve campus coordinates from the official GeoJSON by dashboard or district id. */
export function findGeoSchoolLocation(
  id: string,
): Pick<GeoDistrictSchool, "lat" | "lng" | "name" | "campusId"> | null {
  const match = buildDistrictSchoolsFromGeoJSON().find((s) => s.id === id || s.dashboardId === id)
  if (!match) return null
  return { lat: match.lat, lng: match.lng, name: match.name, campusId: match.campusId }
}
