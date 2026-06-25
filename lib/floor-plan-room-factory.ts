import type { FloorPlanRoom, PlanRoomLocation, RoomCondition } from "@/lib/dashboard-data"
import { polygonArea, type Pt } from "@/lib/capital-projects"
import { mergeLivelySpecialtyRooms } from "@/lib/lively-building-b-rooms"

function hashId(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0
  return Math.abs(h)
}

function scoreInRange(seed: number, min: number, max: number): number {
  return min + (seed % (max - min + 1))
}

function conditionFromScore(score: number): RoomCondition {
  if (score >= 70) return "good"
  if (score >= 45) return "fair"
  return "poor"
}

function roomDisplayName(id: string): string {
  const upper = id.toUpperCase()
  if (upper === "GYM") return "Gymnasium"
  if (upper.startsWith("KIT")) return "Kitchen"
  if (upper.startsWith("CAFE")) return "Cafeteria"
  if (upper.startsWith("COR")) return `Corridor ${id}`
  if (/^[A-E]-\d/.test(upper)) return `Classroom ${id}`
  if (upper.includes("RR")) return `Restroom ${id}`
  if (upper.includes("STO")) return `Storage ${id}`
  return id.replace(/_/g, " ")
}

function defaultMetrics(seed: number, name: string) {
  const classroom = /classroom/i.test(name)
  const names = classroom
    ? ["Size & dimensions", "Daylighting", "Ventilation", "Furniture", "ADA accessibility", "Acoustics"]
    : ["Size & dimensions", "Functionality", "Daylighting", "Ventilation", "Finishes", "ADA accessibility"]
  return names.map((metric, i) => ({
    name: metric,
    score: scoreInRange(seed + i * 17, 38, 88),
  }))
}

function defaultSystems(seed: number) {
  const names = ["HVAC", "Flooring", "Lighting", "Finishes", "Plumbing"]
  return names.map((name, i) => ({
    name,
    condition: conditionFromScore(scoreInRange(seed + i * 13, 35, 90)),
  }))
}

/** Build assessable room hotspots from polygon.proom shapes in a floor-plan SVG. */
export function roomsFromPlanSvg(svgText: string, buildingSqft: number): FloorPlanRoom[] {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
  const nodes = Array.from(doc.querySelectorAll("polygon.proom, #planRooms polygon.proom"))

  const parsed: { id: string; x: number; y: number; area: number; building?: string }[] = []
  nodes.forEach((node, i) => {
    const raw = node.getAttribute("points")
    if (!raw) return
    const nums = raw.trim().split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n))
    const points: Pt[] = []
    for (let k = 0; k + 1 < nums.length; k += 2) points.push({ x: nums[k], y: nums[k + 1] })
    const area = polygonArea(points)
    if (points.length < 3 || area <= 0) return
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length
    parsed.push({
      id: node.getAttribute("data-i") ?? String(i),
      x: cx,
      y: cy,
      area,
      building: node.getAttribute("data-building") ?? undefined,
    })
  })

  const totalArea = parsed.reduce((s, p) => s + p.area, 0)

  return mergeLivelySpecialtyRooms(
    parsed.map((room) => {
    const seed = hashId(room.id)
    const name = roomDisplayName(room.id)
    const eaScore = scoreInRange(seed, 42, 86)
    const condition = conditionFromScore(eaScore)
    const fcaScore = scoreInRange(seed + 7, 40, 88)
    const sqft = totalArea > 0 ? Math.max(80, Math.round((room.area / totalArea) * buildingSqft)) : 400
    const capacity = Math.max(1, Math.round(sqft / (name.includes("Classroom") ? 45 : 80)))

    return {
      id: room.id,
      name,
      x: room.x,
      y: room.y,
      building: room.building,
      condition,
      eaScore,
      sqft,
      capacity,
      metrics: defaultMetrics(seed, name),
      note: `Sample assessment for ${name}; scores are illustrative pending a full ESA walkthrough.`,
      fci: Number((1 - fcaScore / 100).toFixed(2)),
      fcaCondition: conditionFromScore(fcaScore),
      systems: defaultSystems(seed),
      fcaNote: `Sample FCA data for ${name}; verify during field assessment.`,
    }
  }),
  )
}

export function planLocationsFromRooms(rooms: FloorPlanRoom[]): PlanRoomLocation[] {
  return rooms.map((r) => ({ id: r.id, x: r.x, y: r.y }))
}
