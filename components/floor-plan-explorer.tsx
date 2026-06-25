"use client"

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react"
import { ArrowLeft, X, Gauge, Building2, Users, Maximize2, Wrench, Layers, Pencil, Plus, Trash2, MapPin, AlertTriangle, Eye, EyeOff, Camera, Palette, Check, RotateCcw, ZoomIn, ZoomOut, Info, ChevronDown, Package, Map as MapIcon, LayoutGrid } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AddAssetDialog, AddDeficiencyDialog, EditScoreDialog, type Deficiency, type PlanAsset, type PickedLocation } from "@/components/scoring-editor"
import { PageGuide } from "@/components/page-guide"
import {
  floorPlanRooms,
  allPlanRooms,
  floorPlanSrc,
  floorPlanDisplaySrc,
  floorPlanViewBox,
  floorPlanHasRoomOverlays,
  floorPlanHasAssessmentTools,
  floorPlanHasSelectableRooms,
  floorPlanBuildings,
  floorPlanBuildingColors,
  floorPlanShowHotspots,
  floorPlanDynamicLabels,
  floorPlanLevels,
  floorPlanDefaultLevelId,
  floorPlanHotspotRoomIds,
  floorPlanHasHotspots,
  ROOM_CONDITION_BAR,
  ROOM_CONDITION_FILL,
  ROOM_CONDITION_LABEL,
  ROOM_CONDITION_TEXT,
  scoreToStatus,
  STATUS_BAR,
  type FloorPlanRoom,
  type PlanRoomLocation,
  type RoomCondition,
  type School,
} from "@/lib/dashboard-data"
import { roomsFromPlanSvg, planLocationsFromRooms } from "@/lib/floor-plan-room-factory"
import {
  parsePlanLabels,
  planLabelFontSizeSvg,
  roomAreasFromPolys,
  visiblePlanLabels,
  type PlanLabel,
} from "@/lib/floor-plan-labels"
import type { FloorPlanViewBox } from "@/lib/floor-plan"
import { pointInPolygon } from "@/lib/capital-projects"
import { isLivelyBuildingBSpecialtyRoom, LIVELY_ESA_CATEGORIES } from "@/lib/lively-building-b-rooms"
import {
  livelyBuildingFcaCondition,
  livelyBuildingFcaOverall,
  livelyBuildingFcaSystem,
} from "@/lib/lively-building-fca-scores"
import {
  livelyBuildingEsaCondition,
  livelyBuildingEsaOverall,
  livelyBuildingEsaCategory,
} from "@/lib/lively-building-esa-scores"
import {
  livelyAllBuildingPriorities,
  livelyEsaFcaMatrix,
  priorityCalloutText,
  type LivelyBuildingPriority,
} from "@/lib/lively-building-priority"
import { LivelyRoomDetailCard } from "@/components/lively-room-detail-card"
import { LivelyBuildingDetailPanel, ExploreBuildingDetailNote } from "@/components/lively-building-detail-panel"
import { CampusAerialMap } from "@/components/campus-aerial-map"

interface FloorPlanExplorerProps {
  school: School
  onBack: () => void
}

// 360° virtual tour embed for room 017
const ROOM_017_TOUR_URL =
  "https://kuula.co/share/NqKvG/collection/7qfvG?logo=-1&info=0&fs=1&vr=1&thumbs=-1"

const CONDITION_LEGEND: { condition: RoomCondition; label: string }[] = [
  { condition: "good", label: "Good" },
  { condition: "fair", label: "Fair" },
  { condition: "poor", label: "Poor" },
]

const CONDITION_ORDER: RoomCondition[] = ["good", "fair", "poor"]

/** Neutral fill for rooms that lack the selected sub-category. */
const ROOM_FILL_NA = "oklch(0.7 0 0)"

/** Map an EA sub-metric score (0-100) to a good/fair/poor condition. */
function eaScoreToCondition(score: number): RoomCondition {
  if (score >= 70) return "good"
  if (score >= 45) return "fair"
  return "poor"
}

type Pt = { x: number; y: number }

type SiteView = "floorplan" | "aerial"

/**
 * Group rooms whose centroids fall within `threshold` SVG units of one another
 * (single-linkage union-find), so spatially adjacent like-scored rooms cluster.
 */
function clusterByDistance(rooms: FloorPlanRoom[], threshold: number): FloorPlanRoom[][] {
  const parent = rooms.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const d = Math.hypot(rooms[i].x - rooms[j].x, rooms[i].y - rooms[j].y)
      if (d <= threshold) parent[find(i)] = find(j)
    }
  }
  const groups = new Map<number, FloorPlanRoom[]>()
  rooms.forEach((r, i) => {
    const root = find(i)
    const g = groups.get(root) ?? []
    g.push(r)
    groups.set(root, g)
  })
  return Array.from(groups.values())
}

/** Convex hull via Andrew's monotone chain. Returns ordered hull vertices. */
function convexHull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (p.length < 3) return p
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Pt[] = []
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop()
    lower.push(pt)
  }
  const upper: Pt[] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop()
    upper.push(pt)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

/** Expand a hull outward from its centroid so the polygon comfortably wraps the hotspots. */
function padHull(hull: Pt[], pad: number): Pt[] {
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length
  return hull.map((p) => {
    const dx = p.x - cx
    const dy = p.y - cy
    const len = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / len) * pad, y: p.y + (dy / len) * pad }
  })
}

function polygonCentroid(points: Pt[]): Pt {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length
  return { x: cx, y: cy }
}

/** Bottom-right corner of a room polygon (inset slightly for marker placement). */
function polygonBottomCorner(points: Pt[], inset = 55): Pt {
  let maxY = -Infinity
  let cornerX = points[0]?.x ?? 0
  for (const p of points) {
    if (p.y > maxY) {
      maxY = p.y
      cornerX = p.x
    } else if (p.y === maxY && p.x > cornerX) {
      cornerX = p.x
    }
  }
  return { x: cornerX - inset, y: maxY - inset }
}

const ESA_FCA_MATRIX_FCA_ROWS: RoomCondition[] = ["good", "fair", "poor"]
const ESA_FCA_MATRIX_ESA_COLS: RoomCondition[] = ["good", "fair", "poor"]

/** Convert an SVG-space coordinate to a 0-100 percentage within the plan box. */
function toPercent(x: number, y: number, vb: FloorPlanViewBox) {
  return {
    left: ((x - vb.x) / vb.w) * 100,
    top: ((y - vb.y) / vb.h) * 100,
  }
}

/** Short badge text on specialty hotspot circles. */
function hotspotBadgeText(room: FloorPlanRoom): string {
  const short: Record<string, string> = { BAND: "MUS", CHOIR: "CHR", ORCH: "ORC", CAFE: "CAF" }
  return short[room.id] ?? room.id.slice(0, 4)
}

/** Fixed FCA sub-category options shown in the floor-plan filter. */
const FCA_SUBCATEGORIES = ["Flooring", "HVAC", "Plumbing", "Finishes", "Lighting"]

type PlanColorMode = "building" | "ea" | "fca"

const COLOR_MODE_LABEL: Record<PlanColorMode, string> = {
  building: "Building",
  ea: "ESA",
  fca: "FCA",
}

const ESA_SUBCATEGORY_BLURBS: Record<string, string> = {
  Daylight: "natural light, glare control, and views to the outdoors",
  Size: "room area compared to Education Specification targets",
  "Layout & shape": "room proportions and whether the layout supports the program",
  Furniture: "furniture fit, flexibility, and storage for the intended use",
  Safety: "egress, supervision sightlines, and secure environments",
  Technology: "power, data, displays, and infrastructure for digital learning",
  Plumbing: "sinks, restrooms, and water access where the program requires them",
}

const FCA_SUBCATEGORY_BLURBS: Record<string, string> = {
  Flooring: "floor finishes, wear, and slip resistance",
  HVAC: "heating, ventilation, air conditioning, and indoor air quality",
  Plumbing: "piping, fixtures, and domestic water systems",
  Finishes: "walls, ceilings, casework, and interior surface condition",
  Lighting: "fixtures, illumination levels, and controls",
}

const SCORE_LEGEND =
  "Green = Good · Amber = Fair · Red = Poor. Every room in a building shares that building's score."

function planShadingCalloutText(
  colorMode: PlanColorMode,
  subCategory: string,
  esaSubCriterion: string,
  buildingLevel: boolean,
): { title: string; body: string } | null {
  if (colorMode === "building") {
    return {
      title: "Showing: Building footprints",
      body:
        "Rooms are colored by building wing — A (blue), B (green), C (amber), and D (purple). Use the Building filter to focus one or more wings.",
    }
  }

  if (colorMode === "ea") {
    if (esaSubCriterion && subCategory) {
      return {
        title: `Showing: ESA · ${subCategory} · ${esaSubCriterion}`,
        body: buildingLevel
          ? `The plan uses each building's ${subCategory} rating. Specialty hotspots on Level 1 also show whether "${esaSubCriterion}" is met (yes = Good, no = Poor). ${SCORE_LEGEND}`
          : `Hotspots are colored by whether "${esaSubCriterion}" is met for ${subCategory}. ${SCORE_LEGEND}`,
      }
    }
    if (subCategory) {
      const blurb = ESA_SUBCATEGORY_BLURBS[subCategory] ?? "this suitability category"
      return {
        title: `Showing: ESA · ${subCategory}`,
        body: buildingLevel
          ? `Shading reflects each building's ${subCategory} score (${blurb}). ${SCORE_LEGEND}`
          : `Each room is shaded by its ${subCategory} score (${blurb}). ${SCORE_LEGEND}`,
      }
    }
    return {
      title: "Showing: ESA · Building/Area",
      body: buildingLevel
        ? `Overall Educational Suitability Assessment (ESA) by building — how well spaces support teaching and learning. ${SCORE_LEGEND}`
        : `Overall room-level educational suitability. ${SCORE_LEGEND}`,
    }
  }

  if (colorMode === "fca") {
    if (subCategory) {
      const blurb = FCA_SUBCATEGORY_BLURBS[subCategory] ?? "this building system"
      return {
        title: `Showing: FCA · ${subCategory}`,
        body: buildingLevel
          ? `Facility Condition Assessment (FCA) for ${subCategory.toLowerCase()} (${blurb}) by building. ${SCORE_LEGEND}`
          : `Facility condition for ${subCategory.toLowerCase()} (${blurb}) by room. ${SCORE_LEGEND}`,
      }
    }
    return {
      title: "Showing: FCA · Building/Area",
      body: buildingLevel
        ? `Overall facility condition by building — deferred maintenance and system health. ${SCORE_LEGEND}`
        : `Overall facility condition by room. ${SCORE_LEGEND}`,
    }
  }

  return null
}

/** Layered polygon fill for Lively plan overlays (building colors or Good/Fair/Poor). */
function LivelyPlanShadedPolygon({
  id,
  points,
  fill,
  emphasized,
}: {
  id: string
  points: string
  fill: string
  emphasized: boolean
}) {
  return (
    <g key={id}>
      <polygon points={points} fill="#ffffff" fillOpacity={emphasized ? 0.35 : 0.12} stroke="none" />
      <polygon
        points={points}
        fill={fill}
        fillOpacity={emphasized ? 0.82 : 0.18}
        stroke="#ffffff"
        strokeOpacity={emphasized ? 0.9 : 0.35}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <polygon
        points={points}
        fill="none"
        stroke={fill}
        strokeOpacity={emphasized ? 0.95 : 0.3}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </g>
  )
}

function LivelyPrioritySidebar({
  matrix,
  priorities,
  buildingColors,
  onFocus,
}: {
  matrix: Record<RoomCondition, Record<RoomCondition, string[]>>
  priorities: LivelyBuildingPriority[]
  buildingColors: Record<string, string>
  onFocus: (buildingId: string) => void
}) {
  const flagged = priorities.filter((p) => p.isPriority)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/25 bg-destructive/[0.04] p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">Priority areas</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Wings flagged when poor ESA categories and poor FCA systems overlap, or both overall scores are poor.
        † marks priority buildings in the matrix.
      </p>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full min-w-[220px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">FCA \ ESA</th>
              {ESA_FCA_MATRIX_ESA_COLS.map((c) => (
                <th key={c} className="px-2 py-1.5 text-center font-medium text-muted-foreground">
                  {ROOM_CONDITION_LABEL[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ESA_FCA_MATRIX_FCA_ROWS.map((fcaRow) => (
              <tr key={fcaRow} className="border-b border-border last:border-b-0">
                <td className="px-2 py-1.5 font-medium text-muted-foreground">{ROOM_CONDITION_LABEL[fcaRow]}</td>
                {ESA_FCA_MATRIX_ESA_COLS.map((esaCol) => {
                  const cellBuildings = matrix[fcaRow][esaCol]
                  return (
                    <td key={esaCol} className="px-1.5 py-1.5 text-center align-middle">
                      {cellBuildings.length === 0 ? (
                        <span className="text-muted-foreground/50">—</span>
                      ) : (
                        <div className="flex flex-wrap justify-center gap-1">
                          {cellBuildings.map((id) => {
                            const pri = priorities.find((p) => p.building === id)
                            const isPri = pri?.isPriority
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => onFocus(id)}
                                title={
                                  pri
                                    ? `Building ${id}: ESA ${ROOM_CONDITION_LABEL[pri.esaOverall]}, FCA ${ROOM_CONDITION_LABEL[pri.fcaOverall]}${isPri ? " — priority" : ""}`
                                    : `Building ${id}`
                                }
                                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold transition-colors hover:bg-muted ${
                                  isPri
                                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                                    : "border-border bg-background text-foreground"
                                }`}
                              >
                                <span
                                  className="size-1.5 rounded-full"
                                  style={{ backgroundColor: buildingColors[id] ?? "#64748b" }}
                                  aria-hidden="true"
                                />
                                {id}
                                {isPri ? "†" : null}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {flagged.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {flagged.map((p) => (
            <li key={p.building}>
              <button
                type="button"
                onClick={() => onFocus(p.building)}
                className="flex w-full flex-col gap-0.5 rounded-lg border border-destructive/30 bg-card px-3 py-2.5 text-left transition-colors hover:bg-destructive/5"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: buildingColors[p.building] ?? "#64748b" }}
                    aria-hidden="true"
                  />
                  Building {p.building}
                </span>
                <span className="text-[11px] leading-relaxed text-muted-foreground">
                  {p.reasons.slice(0, 2).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No wings meet the priority threshold on this campus.</p>
      )}
    </div>
  )
}

/** A single editable room polygon parsed from the floor-plan SVG. */
interface PlanPoly {
  id: string
  points: Pt[]
  centroid: Pt
  defaultFill: string
  building?: string
}

/** User edits applied to a polygon — a custom name and/or fill color. */
interface PolyOverride {
  name?: string
  color?: string
}

/** CAFM building footprint parsed from the floor-plan SVG. */
interface BuildingPoly {
  id: string
  points: Pt[]
  color: string
}

/** Curated swatches for recoloring a room (plus a free-form custom picker). */
const ROOM_COLOR_SWATCHES: { label: string; value: string }[] = [
  { label: "Blue", value: "#2563eb" },
  { label: "Teal", value: "#0d9488" },
  { label: "Green", value: "#16a34a" },
  { label: "Amber", value: "#d97706" },
  { label: "Red", value: "#dc2626" },
  { label: "Slate", value: "#475569" },
]

/** Infer CAFM building id from room fill when SVG lacks data-building (e.g. L2 export). */
function buildingFromRoomFill(fill: string): string | undefined {
  const f = fill.toLowerCase()
  const colors = floorPlanBuildingColors()
  for (const [id, hex] of Object.entries(colors)) {
    if (f === hex.toLowerCase()) return id
  }
  if (/^#(3b[0-9a-f]{4}|4a5f[0-9a-f]{2})$/.test(f)) return "A"
  if (/^#2a9d/.test(f)) return "B"
  if (/^#d48a/.test(f)) return "C"
  if (/^#8b5c/.test(f)) return "D"
  return undefined
}

/** Parse every room polygon (with its native fill) out of the floor-plan SVG. */
function parsePlanPolygons(svgText: string): PlanPoly[] {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
  const nodes = Array.from(doc.querySelectorAll("polygon.proom, #planRooms polygon.proom"))
  const polys: PlanPoly[] = []
  nodes.forEach((node, i) => {
    const raw = node.getAttribute("points")
    if (!raw) return
    const nums = raw.trim().split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n))
    const points: Pt[] = []
    for (let k = 0; k + 1 < nums.length; k += 2) points.push({ x: nums[k], y: nums[k + 1] })
    if (points.length < 3) return
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length
    const id = node.getAttribute("data-i") ?? String(i)
    const defaultFill = node.getAttribute("fill") ?? "#94a3b8"
    polys.push({
      id,
      points,
      centroid: { x: cx, y: cy },
      defaultFill,
      building: node.getAttribute("data-building") ?? buildingFromRoomFill(defaultFill) ?? undefined,
    })
  })
  return polys
}

/** Parse building footprint polygons from a multi-building CAFM plan. */
function parseBuildingPolygons(svgText: string): BuildingPoly[] {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
  const colors = floorPlanBuildingColors()
  const nodes = Array.from(doc.querySelectorAll("#planBuildings polygon[data-building], polygon.pbuilding"))
  const polys: BuildingPoly[] = []
  nodes.forEach((node) => {
    const raw = node.getAttribute("points")
    const id = node.getAttribute("data-building")
    if (!raw || !id) return
    const nums = raw.trim().split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n))
    const points: Pt[] = []
    for (let k = 0; k + 1 < nums.length; k += 2) points.push({ x: nums[k], y: nums[k + 1] })
    if (points.length < 3) return
    polys.push({
      id,
      points,
      color: node.getAttribute("stroke") ?? node.getAttribute("fill") ?? colors[id] ?? "#64748b",
    })
  })
  return polys
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 4
const ZOOM_STEP = 0.25

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))
}

function DeficiencyMarkers({
  deficiencies,
  getCenter,
  selectedDeficiencyId,
  onSelect,
}: {
  deficiencies: Deficiency[]
  getCenter: (d: Deficiency) => { x: number; y: number } | null
  selectedDeficiencyId: string | null
  onSelect: (d: Deficiency) => void
}) {
  return (
    <>
      {deficiencies.map((d) => {
        const center = getCenter(d)
        if (!center) return null
        const isActive = selectedDeficiencyId === d.id
        return (
          <rect
            key={`sq-${d.id}`}
            x={center.x - 45}
            y={center.y - 45}
            width={90}
            height={90}
            rx={14}
            fill={ROOM_CONDITION_FILL[d.severity]}
            stroke="#ffffff"
            strokeWidth={isActive ? 18 : 10}
            className="cursor-pointer"
            style={{ pointerEvents: "all" }}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(d)
            }}
          />
        )
      })}
    </>
  )
}

function AssetMarkers({
  assets,
  getCenter,
  selectedAssetId,
  onSelect,
}: {
  assets: PlanAsset[]
  getCenter: (a: PlanAsset) => { x: number; y: number } | null
  selectedAssetId: string | null
  onSelect: (a: PlanAsset) => void
}) {
  return (
    <>
      {assets.map((a) => {
        const center = getCenter(a)
        if (!center) return null
        const isActive = selectedAssetId === a.id
        const sw = isActive ? 18 : 10
        return (
          <g
            key={`asset-${a.id}`}
            className="cursor-pointer"
            style={{ pointerEvents: "all" }}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(a)
            }}
          >
            <rect
              x={center.x - 45}
              y={center.y - 45}
              width={90}
              height={90}
              rx={14}
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth={sw}
            />
            <rect
              x={center.x - 22}
              y={center.y - 20}
              width={44}
              height={32}
              rx={5}
              fill="none"
              stroke="#ffffff"
              strokeWidth={6}
            />
            <path
              d={`M${center.x - 22} ${center.y - 20} L${center.x} ${center.y - 32} L${center.x + 22} ${center.y - 20}`}
              fill="none"
              stroke="#ffffff"
              strokeWidth={6}
              strokeLinejoin="round"
            />
          </g>
        )
      })}
    </>
  )
}

function ScorePill({ label, value, suffix = "%" }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-card px-3 py-3 text-center">
      <span className="text-2xl font-bold tracking-tight text-primary">
        {value}
        <span className="text-base font-semibold">{suffix}</span>
      </span>
      <span className="mt-0.5 text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function MetricBar({ name, score }: { name: string; score: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{name}</span>
        <span className="text-xs font-semibold text-foreground">{score}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-status-track">
        <div
          className={`h-full rounded-full ${STATUS_BAR[scoreToStatus(score)]}`}
          style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
        />
      </div>
    </div>
  )
}

function SystemChip({ name, condition }: { name: string; condition: RoomCondition }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
      <span className="text-xs text-foreground">{name}</span>
      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${ROOM_CONDITION_TEXT[condition]}`}>
        <span className={`size-2 rounded-full ${ROOM_CONDITION_BAR[condition]}`} aria-hidden="true" />
        {ROOM_CONDITION_LABEL[condition]}
      </span>
    </div>
  )
}

export function FloorPlanExplorer({ school, onBack }: FloorPlanExplorerProps) {
  const planLevels = floorPlanLevels(school)
  const defaultLevelId = floorPlanDefaultLevelId(school) ?? planLevels?.[0]?.id ?? "l1"
  const [activeLevelId, setActiveLevelId] = useState(defaultLevelId)
  const activeLevel = planLevels?.find((l) => l.id === activeLevelId) ?? planLevels?.[0]

  const planDisplaySrc = floorPlanDisplaySrc(school, activeLevelId)
  const planSrc = floorPlanSrc(school, activeLevelId)
  const planVb = floorPlanViewBox(school, activeLevelId)
  const planBuildingIds = floorPlanBuildings(school, activeLevelId)
  const buildingColors = floorPlanBuildingColors()
  const hotspotRoomIds = floorPlanHotspotRoomIds(school, activeLevelId)
  const hasAnyHotspots = floorPlanHasHotspots(school, activeLevelId)
  const hotspotOverlayEnabled = floorPlanShowHotspots(school)
  const dynamicLabels = floorPlanDynamicLabels(school)
  const hasPresetHotspots = floorPlanHasRoomOverlays(school)
  const showAssessmentTools = floorPlanHasAssessmentTools(school)
  const selectableRooms = floorPlanHasSelectableRooms(school)

  // Working copy of the rooms so in-session score edits persist.
  const [rooms, setRooms] = useState<FloorPlanRoom[]>(() =>
    hasPresetHotspots ? floorPlanRooms.map((r) => JSON.parse(JSON.stringify(r)) as FloorPlanRoom) : [],
  )
  const [planLocations, setPlanLocations] = useState<PlanRoomLocation[]>(() =>
    hasPresetHotspots ? allPlanRooms : [],
  )
  const [roomsReady, setRoomsReady] = useState(hasPresetHotspots)
  const [selected, setSelected] = useState<FloorPlanRoom | null>(null)
  const [detailTab, setDetailTab] = useState<"ea" | "fca">("ea")
  const [colorMode, setColorMode] = useState<PlanColorMode>("building")
  const [conditionFilter, setConditionFilter] = useState<Set<RoomCondition>>(new Set())
  const [subCategory, setSubCategory] = useState<string>("")
  const [esaSubCriterion, setEsaSubCriterion] = useState<string>("")
  const [showClusters, setShowClusters] = useState(false)
  const [showPriorityAreas, setShowPriorityAreas] = useState(false)
  const [shadingCalloutDismissed, setShadingCalloutDismissed] = useState(false)
  const [priorityCalloutDismissed, setPriorityCalloutDismissed] = useState(false)
  const [showDeficiencies, setShowDeficiencies] = useState(true)
  const [showAssets, setShowAssets] = useState(true)
  const [selectedDeficiency, setSelectedDeficiency] = useState<Deficiency | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<PlanAsset | null>(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [siteView, setSiteView] = useState<SiteView>("floorplan")

  // Scoring-editor state
  const [editMode, setEditMode] = useState(false)
  const [editorRoom, setEditorRoom] = useState<FloorPlanRoom | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deficiencies, setDeficiencies] = useState<Deficiency[]>([])
  const [addAssetOpen, setAddAssetOpen] = useState(false)
  const [assets, setAssets] = useState<PlanAsset[]>([])
  // Deficiency pin placement
  const [placingDeficiency, setPlacingDeficiency] = useState(false)
  const [pendingLocation, setPendingLocation] = useState<PickedLocation | null>(null)
  const [placingAsset, setPlacingAsset] = useState(false)
  const [pendingAssetLocation, setPendingAssetLocation] = useState<PickedLocation | null>(null)
  const [detailPanelOpenTab, setDetailPanelOpenTab] = useState<{
    tab: "assets" | "deficiencies"
    nonce: number
  } | null>(null)

  // Rename & recolor (room "design") state — operates on the real SVG polygons.
  const [designMode, setDesignMode] = useState(false)
  const [planPolys, setPlanPolys] = useState<PlanPoly[]>([])
  const [buildingPolys, setBuildingPolys] = useState<BuildingPoly[]>([])
  const [buildingFilter, setBuildingFilter] = useState<Set<string>>(
    () => new Set(planBuildingIds ?? []),
  )
  const [planLabels, setPlanLabels] = useState<PlanLabel[]>([])
  const [polyLoad, setPolyLoad] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [selectedPolyId, setSelectedPolyId] = useState<string | null>(null)
  const [polyOverrides, setPolyOverrides] = useState<Record<string, PolyOverride>>({})
  const fetchedPolysRef = useRef(false)

  const [planZoom, setPlanZoom] = useState(1)
  const [planPan, setPlanPan] = useState({ x: 0, y: 0 })
  const panDragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const planViewportRef = useRef<HTMLDivElement>(null)
  const [viewportWidth, setViewportWidth] = useState(800)

  const polyOverrideKey = useCallback((polyId: string) => `${activeLevelId}:${polyId}`, [activeLevelId])

  // Reset assessable-room state when switching schools (e.g. Maplewood → Casis).
  useEffect(() => {
    const levels = floorPlanLevels(school)
    setActiveLevelId(floorPlanDefaultLevelId(school) ?? levels?.[0]?.id ?? "l1")
    const levelBuildings = floorPlanBuildings(school, floorPlanDefaultLevelId(school) ?? levels?.[0]?.id)
    setSelected(null)
    setSelectedDeficiency(null)
    setSelectedAsset(null)
    setEditMode(false)
    setDesignMode(false)
    setEditorRoom(null)
    setSelectedPolyId(null)
    setPolyOverrides({})
    setDeficiencies([])
    setAssets([])
    setPlacingDeficiency(false)
    setPlacingAsset(false)
    setPendingLocation(null)
    setPendingAssetLocation(null)
    setSelectedAsset(null)
    setConditionFilter(new Set())
    setSubCategory("")
    setEsaSubCriterion("")
    setColorMode("building")
    setShowClusters(false)
    fetchedPolysRef.current = false
    setPlanPolys([])
    setBuildingPolys([])
    setPlanLabels([])
    setBuildingFilter(new Set(levelBuildings ?? []))
    setPolyLoad("idle")
    setPlanZoom(1)
    setPlanPan({ x: 0, y: 0 })
    panDragRef.current = null
    setSiteView("floorplan")

    if (hasPresetHotspots) {
      setRooms(floorPlanRooms.map((r) => JSON.parse(JSON.stringify(r)) as FloorPlanRoom))
      setPlanLocations(allPlanRooms)
      setRoomsReady(true)
    } else {
      setRooms([])
      setPlanLocations([])
      setRoomsReady(false)
    }
  }, [school.id, hasPresetHotspots])

  // Reset plan view and reload geometry when switching floors.
  useEffect(() => {
    setSelected(null)
    setSelectedDeficiency(null)
    setSelectedAsset(null)
    setSelectedPolyId(null)
    setEditorRoom(null)
    setPlacingDeficiency(false)
    setPlacingAsset(false)
    setPendingLocation(null)
    setPendingAssetLocation(null)
    fetchedPolysRef.current = false
    setPlanPolys([])
    setBuildingPolys([])
    setPlanLabels([])
    setBuildingFilter((prev) => {
      const ids = planBuildingIds ?? []
      if (ids.length === 0) return prev
      const kept = new Set([...prev].filter((id) => ids.includes(id)))
      return kept.size > 0 ? kept : new Set(ids)
    })
    setPolyLoad("idle")
    setPlanZoom(1)
    setPlanPan({ x: 0, y: 0 })
    panDragRef.current = null

    if (hasPresetHotspots) return
    setRooms([])
    setPlanLocations([])
    setRoomsReady(false)
  }, [activeLevelId, hasPresetHotspots, planBuildingIds])

  const buildingMatchesFilter = useCallback(
    (building?: string) => {
      if (!planBuildingIds || !building) return true
      return buildingFilter.has(building)
    },
    [planBuildingIds, buildingFilter],
  )

  const visibleRoomLabels = useMemo(() => {
    if (!dynamicLabels) return []
    const culled = visiblePlanLabels(planLabels, planZoom, viewportWidth, planVb)
    if (!planBuildingIds || buildingFilter.size >= planBuildingIds.length) return culled
    return culled.filter((l) => buildingMatchesFilter(l.building))
  }, [
    dynamicLabels,
    planLabels,
    planZoom,
    viewportWidth,
    planVb,
    planBuildingIds,
    buildingFilter,
    buildingMatchesFilter,
  ])

  // Load room polygons and assessment data from the school's SVG.
  useEffect(() => {
    if (hasPresetHotspots || !selectableRooms) return
    let cancelled = false
    setPolyLoad("loading")
    fetch(planSrc, { cache: "no-store" })
      .then((r) => r.text())
      .then((text) => {
        if (cancelled) return
        const built = roomsFromPlanSvg(text, school.squareFootage)
        setRooms(built)
        setPlanLocations(planLocationsFromRooms(built))
        const polys = parsePlanPolygons(text)
        setPlanPolys(polys)
        setBuildingPolys(parseBuildingPolygons(text))
        if (dynamicLabels) {
          setPlanLabels(parsePlanLabels(text, roomAreasFromPolys(polys)))
        }
        fetchedPolysRef.current = true
        setPolyLoad("ready")
        setRoomsReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setPolyLoad("error")
          setRoomsReady(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [hasPresetHotspots, selectableRooms, planSrc, school.squareFootage, school.id, dynamicLabels, activeLevelId])

  useLayoutEffect(() => {
    const el = planViewportRef.current
    if (!el) return
    const update = () => setViewportWidth(Math.max(el.clientWidth, 1))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  })

  const applyPlanWheel = useCallback((deltaY: number) => {
    const factor = deltaY < 0 ? 1.12 : 1 / 1.12
    setPlanZoom((z) => clampZoom(z * factor))
  }, [])

  const partialHotspotMode = !hotspotOverlayEnabled && (hotspotRoomIds?.length ?? 0) > 0
  const isHotspotRoom = useCallback(
    (roomId: string) => {
      if (hotspotOverlayEnabled) return true
      return hotspotRoomIds?.includes(roomId) ?? false
    },
    [hotspotOverlayEnabled, hotspotRoomIds],
  )

  useEffect(() => {
    const el = planViewportRef.current
    if (!el || (selected && isHotspotRoom(selected.id))) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      applyPlanWheel(e.deltaY)
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [applyPlanWheel, school.id, activeLevelId, selected, isHotspotRoom])

  const showRoomHotspots = hasAnyHotspots && (hasPresetHotspots || roomsReady)
  const hotspotRooms = useMemo(
    () => (partialHotspotMode ? rooms.filter((r) => isHotspotRoom(r.id)) : rooms),
    [partialHotspotMode, rooms, isHotspotRoom],
  )
  const polygonPickMode = designMode || (editMode && !hotspotOverlayEnabled)
  const hotspotPolyPickMode = partialHotspotMode && !designMode && !editMode
  const planPlacingMode = placingAsset || placingDeficiency
  const roomPolyPickMode =
    school.id === "lively" && !designMode && !editMode && !planPlacingMode && planPolys.length > 0
  const isLively = school.id === "lively"
  const livelyPlanBuildingMode = isLively && colorMode === "building" && roomsReady
  const livelyPlanScoreMode =
    isLively && (colorMode === "ea" || colorMode === "fca") && roomsReady
  const showPlanScoreFilters = showRoomHotspots || roomPolyPickMode
  const showLivelyPlanOverlay =
    (livelyPlanBuildingMode || livelyPlanScoreMode) && planPolys.length > 0

  const shadingViewKey = `${colorMode}|${subCategory}|${esaSubCriterion}|${activeLevelId}`
  const shadingCallout = useMemo(
    () =>
      showPlanScoreFilters
        ? planShadingCalloutText(colorMode, subCategory, esaSubCriterion, isLively)
        : null,
    [showPlanScoreFilters, colorMode, subCategory, esaSubCriterion, isLively],
  )
  const showShadingCallout =
    !!shadingCallout && !shadingCalloutDismissed && showPlanScoreFilters && (isLively ? roomsReady : showRoomHotspots)

  useEffect(() => {
    setShadingCalloutDismissed(false)
  }, [shadingViewKey])

  // Dismiss on any click/tap — deferred so the same interaction that opened it does not close it.
  useEffect(() => {
    if (!showShadingCallout) return
    let armed = false
    const armTimer = window.setTimeout(() => {
      armed = true
    }, 0)
    const dismiss = () => {
      if (!armed) return
      setShadingCalloutDismissed(true)
    }
    document.addEventListener("pointerdown", dismiss, { capture: true })
    return () => {
      clearTimeout(armTimer)
      document.removeEventListener("pointerdown", dismiss, { capture: true })
    }
  }, [showShadingCallout])

  const livelyPriorities = useMemo(
    () => (isLively ? livelyAllBuildingPriorities() : []),
    [isLively],
  )
  const priorityByBuilding = useMemo(
    () => new Map(livelyPriorities.map((p) => [p.building, p])),
    [livelyPriorities],
  )
  const esaFcaMatrix = useMemo(() => (isLively ? livelyEsaFcaMatrix() : null), [isLively])
  const priorityBuildings = useMemo(
    () => livelyPriorities.filter((p) => p.isPriority && buildingFilter.has(p.building)),
    [livelyPriorities, buildingFilter],
  )

  const priorityCallout = useMemo(
    () => (showPriorityAreas && isLively ? priorityCalloutText() : null),
    [showPriorityAreas, isLively],
  )
  const showPriorityCallout =
    !!priorityCallout && !priorityCalloutDismissed && showPriorityAreas && isLively && roomsReady

  useEffect(() => {
    setPriorityCalloutDismissed(false)
  }, [showPriorityAreas])

  useEffect(() => {
    if (!showPriorityCallout) return
    let armed = false
    const armTimer = window.setTimeout(() => {
      armed = true
    }, 0)
    const dismiss = () => {
      if (!armed) return
      setPriorityCalloutDismissed(true)
    }
    document.addEventListener("pointerdown", dismiss, { capture: true })
    return () => {
      clearTimeout(armTimer)
      document.removeEventListener("pointerdown", dismiss, { capture: true })
    }
  }, [showPriorityCallout])

  const selectedHasHotspot = selected ? isHotspotRoom(selected.id) : false
  const planZoomLocked = selectedHasHotspot

  const roomLabelFontSize = useMemo(
    () => planLabelFontSizeSvg(planZoom, viewportWidth, planVb),
    [planZoom, viewportWidth, planVb],
  )

  const labelsCulled =
    dynamicLabels && planLabels.length > 0 && visibleRoomLabels.length < planLabels.length

  // Lazily fetch + parse the floor-plan polygons the first time design mode opens.
  useEffect(() => {
    if (!designMode || !selectableRooms || fetchedPolysRef.current) return
    fetchedPolysRef.current = true
    setPolyLoad("loading")
    fetch(planSrc, { cache: "no-store" })
      .then((r) => r.text())
      .then((text) => {
        setPlanPolys(parsePlanPolygons(text))
        setBuildingPolys(parseBuildingPolygons(text))
        setPolyLoad("ready")
      })
      .catch(() => setPolyLoad("error"))
  }, [designMode, selectableRooms, planSrc, activeLevelId])

  const selectedPoly = planPolys.find((p) => p.id === selectedPolyId) ?? null
  const levelDeficiencies = useMemo(
    () =>
      deficiencies.filter(
        (d) => !planLevels || planLevels.length <= 1 || !d.floorId || d.floorId === activeLevelId,
      ),
    [deficiencies, planLevels, activeLevelId],
  )
  const levelAssets = useMemo(
    () =>
      assets.filter(
        (a) => !planLevels || planLevels.length <= 1 || !a.floorId || a.floorId === activeLevelId,
      ),
    [assets, planLevels, activeLevelId],
  )

  /** Toggle rename/recolor mode; mutually exclusive with score-edit mode. */
  function toggleDesignMode() {
    setSelected(null)
    setSelectedDeficiency(null)
    setSelectedAsset(null)
    setEditMode(false)
    setSelectedPolyId(null)
    setDesignMode((v) => !v)
  }

  function updateOverride(id: string, patch: PolyOverride) {
    const key = polyOverrideKey(id)
    setPolyOverrides((prev) => {
      const next = { ...(prev[key] ?? {}), ...patch }
      // Drop empty/whitespace names so they fall back to the default label.
      if (next.name !== undefined && next.name.trim() === "") delete next.name
      return { ...prev, [key]: next }
    })
  }

  function resetOverride(id: string) {
    const key = polyOverrideKey(id)
    setPolyOverrides((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function saveRoom(updated: FloorPlanRoom) {
    setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    setSelected((s) => (s && s.id === updated.id ? updated : s))
    setEditorRoom(null)
  }

  function addDeficiency(d: Deficiency) {
    setDeficiencies((prev) => [d, ...prev])
    setPendingLocation(null)
  }

  function removeDeficiency(id: string) {
    setDeficiencies((prev) => prev.filter((d) => d.id !== id))
    setSelectedDeficiency((s) => (s && s.id === id ? null : s))
  }

  function addAsset(asset: PlanAsset) {
    let x = asset.x
    let y = asset.y
    if (x == null || y == null) {
      const c = assetCenter(asset)
      if (c) {
        x = c.x
        y = c.y
      }
    }
    setAssets((prev) => [{ ...asset, x, y }, ...prev])
    setPendingAssetLocation(null)
    if (asset.roomId) {
      const room = findRoomById(asset.roomId)
      if (room) {
        setSelectedDeficiency(null)
        setSelectedAsset(null)
        setSelected(room)
      }
    }
    setDetailPanelOpenTab({ tab: "assets", nonce: Date.now() })
  }

  function removeAsset(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id))
    setSelectedAsset((s) => (s && s.id === id ? null : s))
  }

  /** Center point (SVG coords) of a deficiency's square marker, or null. */
  function deficiencyCenter(d: Deficiency): { x: number; y: number } | null {
    if (d.x != null && d.y != null) return { x: d.x, y: d.y }
    if (d.roomId) {
      const poly = planPolys.find((p) => p.id === d.roomId)
      if (poly) return polygonBottomCorner(poly.points)
      const room = planLocations.find((r) => r.id === d.roomId)
      if (room) return { x: room.x + 115, y: room.y + 115 }
    }
    return null
  }

  /** Center point (SVG coords) of an asset marker — click point or room polygon corner. */
  function assetCenter(a: PlanAsset): { x: number; y: number } | null {
    if (a.x != null && a.y != null) return { x: a.x, y: a.y }
    if (a.roomId) {
      const poly = planPolys.find((p) => p.id === a.roomId)
      if (poly) return polygonBottomCorner(poly.points)
      const room = planLocations.find((r) => r.id === a.roomId)
      if (room) return { x: room.x + 115, y: room.y + 115 }
    }
    return null
  }

  // Every room on the plan, labeled with its assessment name when one exists.
  const roomOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { id: string; name: string }[] = []
    const add = (id: string) => {
      if (seen.has(id)) return
      seen.add(id)
      const known = rooms.find((fr) => fr.id === id)
      options.push({ id, name: known ? known.name : "Unassessed space" })
    }
    for (const r of planLocations) add(r.id)
    for (const poly of planPolys) add(poly.id)
    return options
  }, [planLocations, planPolys, rooms])

  /** Room id at a plan point — polygon hit-test first, then nearest label. */
  function roomAtPoint(x: number, y: number): string | null {
    const pt = { x, y }
    for (let i = planPolys.length - 1; i >= 0; i--) {
      const poly = planPolys[i]
      if (pointInPolygon(pt, poly.points)) return poly.id
    }
    return nearestRoomId(x, y)
  }

  /** Nearest room to a plan point across the FULL plan, if reasonably close. */
  function nearestRoomId(x: number, y: number): string | null {
    let bestId: string | null = null
    let bestDist = Number.POSITIVE_INFINITY
    for (const r of planLocations) {
      const d = Math.hypot(r.x - x, r.y - y)
      if (d < bestDist) {
        bestDist = d
        bestId = r.id
      }
    }
    return bestDist <= planVb.w * 0.13 ? bestId : null
  }

  /** Enter "click on plan" mode; the dialog hides but keeps its form values. */
  function startPlacing() {
    setSelected(null)
    setSelectedAsset(null)
    setAddOpen(false)
    setPlacingAsset(false)
    setPlacingDeficiency(true)
  }

  function cancelPlacing() {
    setPlacingDeficiency(false)
    setAddOpen(true)
  }

  function startPlacingAsset() {
    setSelected(null)
    setSelectedDeficiency(null)
    setSelectedAsset(null)
    setAddAssetOpen(false)
    setPlacingDeficiency(false)
    setPlacingAsset(true)
  }

  function cancelPlacingAsset() {
    setPlacingAsset(false)
    setAddAssetOpen(true)
  }

  /** Capture the clicked point in SVG coordinates and reopen the dialog. */
  function handlePlaceClick(e: React.MouseEvent<SVGElement>) {
    e.stopPropagation()
    e.preventDefault()
    const svg = e.currentTarget.ownerSVGElement ?? (e.currentTarget instanceof SVGSVGElement ? e.currentTarget : null)
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const loc = pt.matrixTransform(ctm.inverse())
    const picked = { x: loc.x, y: loc.y, roomId: roomAtPoint(loc.x, loc.y) }
    if (placingAsset) {
      setPendingAssetLocation(picked)
      setPlacingAsset(false)
      setAddAssetOpen(true)
    } else if (placingDeficiency) {
      setPendingLocation(picked)
      setPlacingDeficiency(false)
      setAddOpen(true)
    }
  }

  /**
   * The condition that drives a room's color in the active dimension. When a
   * sub-category is selected, this reflects that sub-category's level; returns
   * null if the room does not include the selected sub-category.
   */
  const effectiveCondition = (room: FloorPlanRoom): RoomCondition | null => {
    if (colorMode === "building") return null
    if (colorMode === "fca" && isLively && room.building) {
      if (subCategory) {
        const buildingSys = livelyBuildingFcaSystem(room.building, subCategory)
        if (buildingSys) return buildingSys
      } else {
        const buildingOverall = livelyBuildingFcaOverall(room.building)
        if (buildingOverall) return buildingOverall
      }
    }
    if (colorMode === "ea" && isLively && room.building) {
      if (esaSubCriterion && subCategory) {
        const m = room.metrics.find((x) => x.name === subCategory)
        const sc = m?.subCriteria?.find((s) => s.name === esaSubCriterion)
        if (!sc) return null
        return sc.met ? "good" : "poor"
      }
      if (subCategory) {
        const cat = livelyBuildingEsaCategory(room.building, subCategory)
        if (cat) return cat
      } else {
        const buildingOverall = livelyBuildingEsaOverall(room.building)
        if (buildingOverall) return buildingOverall
      }
    }
    if (colorMode === "ea" && esaSubCriterion && subCategory) {
      const m = room.metrics.find((x) => x.name === subCategory)
      const sc = m?.subCriteria?.find((s) => s.name === esaSubCriterion)
      if (!sc) return null
      return sc.met ? "good" : "poor"
    }
    if (!subCategory) return colorMode === "ea" ? room.condition : room.fcaCondition
    if (colorMode === "ea") {
      const m = room.metrics.find((x) => x.name === subCategory)
      return m ? eaScoreToCondition(m.score) : null
    }
    // FCA sub-categories use clean labels (e.g. "Plumbing") that match data
    // system names by prefix (e.g. "Plumbing / restroom", "Plumbing / sink").
    const s = room.systems.find((x) => x.name === subCategory || x.name.startsWith(subCategory))
    return s ? s.condition : null
  }

  /** Whether a room passes the active filters. */
  const matchesFilters = (room: FloorPlanRoom): boolean => {
    if (!buildingMatchesFilter(room.building)) return false
    if (colorMode === "building") return true
    const cond = effectiveCondition(room)
    if (subCategory && cond === null) return false
    if (conditionFilter.size > 0 && (cond === null || !conditionFilter.has(cond))) return false
    return true
  }

  /**
   * Sub-category options scoped to classrooms only.
   * - EA: the suitability metrics found on classroom/kindergarten rooms.
   * - FCA: a fixed list of the core building systems.
   */
  const isClassroom = (r: FloorPlanRoom) => /^Classroom|^Kindergarten/.test(r.name)
  const subCategoryOptions =
    colorMode === "ea"
      ? isLively
        ? [...LIVELY_ESA_CATEGORIES]
        : partialHotspotMode
          ? [...LIVELY_ESA_CATEGORIES]
          : Array.from(new Set(rooms.filter(isClassroom).flatMap((r) => r.metrics.map((m) => m.name))))
      : colorMode === "fca"
        ? FCA_SUBCATEGORIES
        : []

  const esaSubCriterionOptions = useMemo(() => {
    if (!subCategory || colorMode !== "ea" || !partialHotspotMode) return []
    const sample = hotspotRooms.find((r) => r.metrics.some((m) => m.name === subCategory))
    const metric = sample?.metrics.find((m) => m.name === subCategory)
    return metric?.subCriteria?.map((s) => s.name) ?? []
  }, [subCategory, colorMode, partialHotspotMode, hotspotRooms])

  const filterRoomPool =
    partialHotspotMode && colorMode === "ea" && !isLively ? hotspotRooms : rooms
  const statsRoomPool =
    partialHotspotMode && colorMode === "ea" && !isLively ? hotspotRooms : rooms
  const scorePoolTotal =
    colorMode === "building" && planBuildingIds ? planBuildingIds.length : filterRoomPool.length
  const scoreMatchCount =
    colorMode === "building" && planBuildingIds
      ? planBuildingIds.filter((id) => buildingFilter.has(id)).length
      : filterRoomPool.filter(matchesFilters).length

  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms])

  const conditionForPoly = useCallback(
    (poly: PlanPoly): RoomCondition | null => {
      if (livelyPlanScoreMode && poly.building) {
        return colorMode === "fca"
          ? livelyBuildingFcaCondition(poly.building, subCategory)
          : livelyBuildingEsaCondition(poly.building, subCategory)
      }
      const room = roomById.get(poly.id)
      if (!room) return null
      if (colorMode === "fca" && isLively && room.building) {
        return livelyBuildingFcaCondition(room.building, subCategory)
      }
      if (colorMode === "ea" && isLively && room.building) {
        return livelyBuildingEsaCondition(room.building, subCategory)
      }
      if (colorMode === "ea" && esaSubCriterion && subCategory) {
        const m = room.metrics.find((x) => x.name === subCategory)
        const sc = m?.subCriteria?.find((s) => s.name === esaSubCriterion)
        if (!sc) return null
        return sc.met ? "good" : "poor"
      }
      if (!subCategory) return colorMode === "ea" ? room.condition : room.fcaCondition
      if (colorMode === "ea") {
        const m = room.metrics.find((x) => x.name === subCategory)
        return m ? eaScoreToCondition(m.score) : null
      }
      const s = room.systems.find((x) => x.name === subCategory || x.name.startsWith(subCategory))
      return s ? s.condition : null
    },
    [
      livelyPlanScoreMode,
      subCategory,
      roomById,
      colorMode,
      isLively,
      esaSubCriterion,
    ],
  )

  const buildingFilterActive =
    !!planBuildingIds && buildingFilter.size > 0 && buildingFilter.size < planBuildingIds.length
  const filtersActive =
    colorMode === "building"
      ? buildingFilterActive
      : conditionFilter.size > 0 || subCategory !== "" || esaSubCriterion !== "" || buildingFilterActive
  const matchCount = scoreMatchCount

  const findRoomById = useCallback(
    (id: string) => rooms.find((r) => r.id === id) ?? rooms.find((r) => r.id.toUpperCase() === id.toUpperCase()),
    [rooms],
  )

  function selectRoom(room: FloorPlanRoom) {
    if (editMode) {
      setEditorRoom(room)
      return
    }
    setSelectedDeficiency(null)
    setSelectedAsset(null)
    setSelected(room)
    setDetailTab(colorMode === "fca" ? "fca" : "ea")
  }

  function selectRoomById(id: string) {
    const room = findRoomById(id)
    if (room) selectRoom(room)
  }

  function changeColorMode(mode: PlanColorMode) {
    setColorMode(mode)
    setSubCategory("")
    setEsaSubCriterion("")
    setSelected(null)
  }

  function toggleCondition(c: RoomCondition) {
    setSelected(null)
    setConditionFilter((prev) => {
      const next = new Set(prev)
      next.has(c) ? next.delete(c) : next.add(c)
      return next
    })
  }

  function clearFilters() {
    setConditionFilter(new Set())
    setSubCategory("")
    setEsaSubCriterion("")
    setBuildingFilter(new Set(planBuildingIds ?? []))
    setSelected(null)
  }

  function selectFloor(levelId: string) {
    if (levelId === activeLevelId) return
    setActiveLevelId(levelId)
  }

  function toggleBuilding(id: string) {
    if (!planBuildingIds) return
    setSelected(null)
    setBuildingFilter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size > 1) next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function showAllBuildings() {
    setBuildingFilter(new Set(planBuildingIds ?? []))
    setSelected(null)
  }

  function handlePlanWheel(e: React.WheelEvent) {
    if (planZoomLocked) return
    e.preventDefault()
    e.stopPropagation()
    applyPlanWheel(e.deltaY)
  }

  function handlePlanPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (planZoomLocked) return
    if (!e.shiftKey && e.button !== 1) return
    e.preventDefault()
    panDragRef.current = { startX: e.clientX, startY: e.clientY, panX: planPan.x, panY: planPan.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePlanPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = panDragRef.current
    if (!drag) return
    setPlanPan({
      x: drag.panX + (e.clientX - drag.startX),
      y: drag.panY + (e.clientY - drag.startY),
    })
  }

  function handlePlanPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!panDragRef.current) return
    panDragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  function zoomPlanIn() {
    if (planZoomLocked) return
    setPlanZoom((z) => clampZoom(z + ZOOM_STEP))
  }

  function zoomPlanOut() {
    if (planZoomLocked) return
    setPlanZoom((z) => clampZoom(z - ZOOM_STEP))
  }

  function resetPlanView() {
    setPlanZoom(1)
    setPlanPan({ x: 0, y: 0 })
  }

  function focusPriorityBuilding(buildingId: string) {
    if (!planBuildingIds?.includes(buildingId)) return
    setSelected(null)
    setSelectedDeficiency(null)
    setSelectedAsset(null)
    setBuildingFilter(new Set([buildingId]))
    setPlanZoom(1.35)
    setPlanPan({ x: 0, y: 0 })
    panDragRef.current = null
  }

  const fci = school.portfolio.find((p) => p.label.includes("FCI"))?.value ?? "—"
  const condScore = school.portfolio.find((p) => p.label.includes("Condition"))?.value ?? "—"
  const goodCount = statsRoomPool.filter((r) => effectiveCondition(r) === "good").length
  const fairCount = statsRoomPool.filter((r) => effectiveCondition(r) === "fair").length
  const poorCount = statsRoomPool.filter((r) => effectiveCondition(r) === "poor").length
  const buildingScoreCounts = useMemo(() => {
    if (!livelyPlanScoreMode || !planBuildingIds) return null
    const visible = planBuildingIds.filter((id) => buildingFilter.has(id))
    const scoreFor = (id: string) =>
      colorMode === "fca"
        ? livelyBuildingFcaCondition(id, subCategory)
        : livelyBuildingEsaCondition(id, subCategory)
    return {
      good: visible.filter((id) => scoreFor(id) === "good").length,
      fair: visible.filter((id) => scoreFor(id) === "fair").length,
      poor: visible.filter((id) => scoreFor(id) === "poor").length,
    }
  }, [livelyPlanScoreMode, planBuildingIds, buildingFilter, subCategory, colorMode])

  const displayGoodCount = buildingScoreCounts?.good ?? goodCount
  const displayFairCount = buildingScoreCounts?.fair ?? fairCount
  const displayPoorCount = buildingScoreCounts?.poor ?? poorCount

  /**
   * Translucent hull polygons grouping spatially-adjacent rooms that share the
   * same condition under the active filter. Only clusters of 3+ rooms that form
   * a real (non-degenerate) area are kept, so the overlay stays legible.
   */
  const CLUSTER_THRESHOLD = planVb.w * 0.22
  const CLUSTER_PAD = 180 // outward padding so the polygon wraps the hotspots
  const clusterPolygons: { id: string; condition: RoomCondition; points: Pt[] }[] = []
  if (showClusters && colorMode !== "building") {
    const visible = rooms.filter(matchesFilters)
    for (const cond of CONDITION_ORDER) {
      const inCond = visible.filter((r) => effectiveCondition(r) === cond)
      if (inCond.length < 3) continue
      clusterByDistance(inCond, CLUSTER_THRESHOLD).forEach((cluster, idx) => {
        if (cluster.length < 3) return
        const hull = convexHull(cluster.map((r) => ({ x: r.x, y: r.y })))
        if (hull.length < 3) return // collinear / not a clear area
        clusterPolygons.push({ id: `${cond}-${idx}`, condition: cond, points: padHull(hull, CLUSTER_PAD) })
      })
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to dashboard
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Floor Plan Explorer</h2>
          <p className="text-sm text-muted-foreground">
            {school.name}
            {activeLevel ? ` — ${activeLevel.label}` : ""} — room-level educational suitability
          </p>
        </div>
      </div>

      <PageGuide guideId="floor-plan" />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-10">
        {/* Left panel — overall FCA & EA scores */}
        <Card data-guide="floor-plan-snapshot" className="gap-5 p-5 sm:p-6 lg:col-span-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Facility Snapshot</h3>
            <p className="text-sm text-muted-foreground">Building-wide condition &amp; suitability</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ScorePill label="Educational Adequacy" value={school.eaOverall} />
            <ScorePill label="Approx. FCI Score" value={fci} suffix="" />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-primary" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">Condition Indicators</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Facility Condition Score</span>
              <span className="font-semibold text-foreground">{condScore}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Building age</span>
              <span className="font-semibold text-foreground">{school.age} yrs</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Square footage</span>
              <span className="font-semibold text-foreground">{school.squareFootage.toLocaleString()}</span>
            </div>
          </div>

          {showPlanScoreFilters && (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">
                {colorMode === "building"
                  ? "Buildings on plan"
                  : livelyPlanScoreMode
                    ? "Buildings scored"
                    : "Rooms assessed"}
              </span>
              <span className="text-xs text-muted-foreground">
                {colorMode === "building"
                  ? "Color by building footprint"
                  : `${subCategory ? subCategory : "Building/Area"} · ${COLOR_MODE_LABEL[colorMode]}`}
              </span>
            </div>
            {colorMode === "building" && planBuildingIds ? (
              <div className="grid grid-cols-2 gap-2">
                {planBuildingIds
                  .filter((id) => buildingFilter.has(id))
                  .map((id) => (
                    <div
                      key={id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
                    >
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: buildingColors[id] ?? "#64748b" }}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-semibold text-foreground">Building {id}</span>
                    </div>
                  ))}
              </div>
            ) : (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Good", count: displayGoodCount, cond: "good" as const },
                { label: "Fair", count: displayFairCount, cond: "fair" as const },
                { label: "Poor", count: displayPoorCount, cond: "poor" as const },
              ].map((g) => (
                <div key={g.label} className="flex flex-col items-center rounded-lg border border-border bg-card py-2.5">
                  <span className={`text-xl font-bold ${ROOM_CONDITION_TEXT[g.cond]}`}>{g.count}</span>
                  <span className="text-xs text-muted-foreground">{g.label}</span>
                </div>
              ))}
            </div>
            )}
          </div>
          )}

          {isLively && showPriorityAreas && esaFcaMatrix && (
            <LivelyPrioritySidebar
              matrix={esaFcaMatrix}
              priorities={livelyPriorities}
              buildingColors={buildingColors}
              onFocus={focusPriorityBuilding}
            />
          )}

          {/* Assessment tools — edit existing scores or log a new deficiency */}
          {showAssessmentTools && (
          <div data-guide="floor-plan-tools" className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-center gap-2">
              <Pencil className="size-4 text-primary" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">Assessment Tools</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelected(null)
                  setDesignMode(false)
                  setEditMode((v) => !v)
                }}
                aria-pressed={editMode}
                disabled={!roomsReady}
                className="justify-start gap-1.5"
              >
                <Pencil className="size-4" aria-hidden="true" />
                {editMode ? "Editing — pick a room" : "Edit existing score"}
              </Button>
              <Button
                variant={designMode ? "default" : "outline"}
                size="sm"
                onClick={toggleDesignMode}
                aria-pressed={designMode}
                className="justify-start gap-1.5"
                disabled={!selectableRooms}
              >
                <Palette className="size-4" aria-hidden="true" />
                {designMode ? "Renaming — pick a room" : "Rename & recolor rooms"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(true)}
                className="justify-start gap-1.5"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add deficiency
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddAssetOpen(true)}
                className="justify-start gap-1.5"
              >
                <Package className="size-4" aria-hidden="true" />
                Add asset
              </Button>
            </div>

            {editMode && (
              <p className="text-xs leading-relaxed text-primary">
                {hotspotOverlayEnabled
                  ? "Edit mode is on — click any highlighted room on the plan to adjust its EA and FCA scores."
                  : "Edit mode is on — click any room shape on the plan to adjust its EA and FCA scores."}
              </p>
            )}

            {designMode && (
              <p className="text-xs leading-relaxed text-primary">
                {polyLoad === "loading"
                  ? "Loading room shapes…"
                  : polyLoad === "error"
                    ? "Could not load room shapes."
                    : "Click any room shape on the plan to rename it or change its color — one room at a time."}
              </p>
            )}

            {/* Tracked deficiencies */}
            {selected && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <span className="text-xs font-medium text-muted-foreground">Selected room</span>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-border bg-card p-3 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Building</p>
                    <p className="mt-0.5 font-semibold text-foreground">
                      {selected.building ? `Building ${selected.building}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Room #</p>
                    <p className="mt-0.5 font-semibold text-foreground">{selected.id}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Room use</p>
                    <p className="mt-0.5 font-medium text-foreground">{selected.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Square footage
                    </p>
                    <p className="mt-0.5 font-semibold text-foreground">{selected.sqft.toLocaleString()} SF</p>
                  </div>
                </div>
                {isLively && selected.building && (
                  <ExploreBuildingDetailNote building={selected.building} />
                )}
              </div>
            )}

            {deficiencies.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Tracked deficiencies ({deficiencies.length})
                </span>
                {deficiencies.map((d) => (
                  <div key={d.id} className="flex gap-2 rounded-md border border-border bg-card p-2">
                    {d.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.photoUrl || "/placeholder.svg"}
                        alt={`${d.category} deficiency`}
                        className="size-12 shrink-0 rounded object-cover"
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">{d.category}</span>
                        <button
                          type="button"
                          onClick={() => removeDeficiency(d.id)}
                          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={`Remove ${d.category} deficiency`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${ROOM_CONDITION_BAR[d.severity]}`} aria-hidden="true" />
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {d.type === "ea" ? "EA" : "FCA"}
                          {d.roomId ? ` · Room ${d.roomId}` : " · Building-wide"}
                          {planLevels && planLevels.length > 1 && d.floorId
                            ? ` · ${planLevels.find((l) => l.id === d.floorId)?.label ?? d.floorId}`
                            : ""}
                        </span>
                      </div>
                      {d.note && <p className="line-clamp-2 text-xs text-muted-foreground">{d.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {assets.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Logged assets ({assets.length})
                </span>
                {assets.map((a) => (
                  <div key={a.id} className="flex gap-2 rounded-md border border-border bg-card p-2">
                    {a.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.photoUrl || "/placeholder.svg"}
                        alt={`${a.category} asset`}
                        className="size-12 shrink-0 rounded object-cover"
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">{a.category}</span>
                        <button
                          type="button"
                          onClick={() => removeAsset(a.id)}
                          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={`Remove ${a.category} asset`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {a.roomId ? `Room ${a.roomId}` : "Building-wide"}
                        {planLevels && planLevels.length > 1 && a.floorId
                          ? ` · ${planLevels.find((l) => l.id === a.floorId)?.label ?? a.floorId}`
                          : ""}
                      </span>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {showRoomHotspots ? (
          <p className="text-xs italic leading-relaxed text-muted-foreground">
            Select a highlighted room on the plan to view its detail. Use the &ldquo;Color by&rdquo; toggle to shade
            hotspots by Educational Adequacy (EA) or Facility Condition (FCA).
          </p>
          ) : planBuildingIds && showAssessmentTools ? (
          <p className="text-xs italic leading-relaxed text-muted-foreground">
            {partialHotspotMode
              ? "Colored hotspots mark Band, Choir, Orchestra, and Cafeteria — click to view ESA drill-down and Building B FCA context. Scroll to zoom; Shift + drag to pan."
              : "Room labels are on the plan. Use Assessment Tools to edit scores, rename rooms, log deficiencies, or add assets. Scroll to zoom; Shift + drag to pan."}
          </p>
          ) : showAssessmentTools && !roomsReady ? (
          <p className="text-xs italic leading-relaxed text-muted-foreground">
            Loading room assessments from the floor plan…
          </p>
          ) : planBuildingIds ? (
          <p className="text-xs italic leading-relaxed text-muted-foreground">
            Room numbers are labeled on the plan. Buildings A–D are color-coded.
          </p>
          ) : (
          <p className="text-xs italic leading-relaxed text-muted-foreground">
            Room assessment tools are not available for this floor plan.
          </p>
          )}
        </Card>

        {/* Right panel — floor plan with hotspots */}
        <Card className="gap-3 p-4 sm:p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                {siteView === "floorplan" ? (
                  <Maximize2 className="size-4 text-primary" aria-hidden="true" />
                ) : (
                  <MapIcon className="size-4 text-primary" aria-hidden="true" />
                )}
                <h3 className="text-base font-semibold text-foreground">
                  {siteView === "floorplan" ? "Building Floor Plan" : "Campus Aerial"}
                </h3>
              </div>
              <div
                data-guide="floor-plan-view-toggle"
                className="inline-flex items-center rounded-lg border border-border bg-muted p-1"
                role="tablist"
                aria-label="Site view"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={siteView === "floorplan"}
                  onClick={() => setSiteView("floorplan")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    siteView === "floorplan"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="size-3.5" aria-hidden="true" />
                  Floor Plan
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={siteView === "aerial"}
                  onClick={() => setSiteView("aerial")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    siteView === "aerial"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MapIcon className="size-3.5" aria-hidden="true" />
                  Aerial
                </button>
              </div>
            </div>
            {siteView === "floorplan" && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
                <button
                  type="button"
                  onClick={zoomPlanOut}
                  disabled={planZoomLocked || planZoom <= ZOOM_MIN}
                  aria-label="Zoom out"
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <ZoomOut className="size-3.5" aria-hidden="true" />
                </button>
                <span className="min-w-12 text-center text-xs font-medium tabular-nums text-muted-foreground">
                  {Math.round(planZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={zoomPlanIn}
                  disabled={planZoomLocked || planZoom >= ZOOM_MAX}
                  aria-label="Zoom in"
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <ZoomIn className="size-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={resetPlanView}
                  aria-label="Reset zoom"
                  title="Reset view"
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                </button>
              </div>
              {showPlanScoreFilters && (
              <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {colorMode === "building" && planBuildingIds ? (
                  planBuildingIds.map((id) => (
                    <div key={id} className="flex items-center gap-1.5">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: buildingColors[id] ?? "#64748b" }}
                        aria-hidden="true"
                      />
                      <span className="text-xs text-muted-foreground">Building {id}</span>
                    </div>
                  ))
                ) : (
                  CONDITION_LEGEND.map((l) => (
                    <div key={l.condition} className="flex items-center gap-1.5">
                      <span className={`size-2.5 rounded-full ${ROOM_CONDITION_BAR[l.condition]}`} aria-hidden="true" />
                      <span className="text-xs text-muted-foreground">{l.label}</span>
                    </div>
                  ))
                )}
              </div>
              {/* Color plan by building footprint, ESA, or FCA */}
              <div data-guide="floor-plan-color" className="flex items-center gap-1 rounded-md bg-muted p-1">
                <span className="px-1.5 text-xs font-medium text-muted-foreground">Color by</span>
                {isLively && (
                  <button
                    type="button"
                    onClick={() => changeColorMode("building")}
                    aria-pressed={colorMode === "building"}
                    className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${colorMode === "building" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Building
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => changeColorMode("ea")}
                  aria-pressed={colorMode === "ea"}
                  className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${colorMode === "ea" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  ESA
                </button>
                <button
                  type="button"
                  onClick={() => changeColorMode("fca")}
                  aria-pressed={colorMode === "fca"}
                  className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${colorMode === "fca" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  FCA
                </button>
              </div>
              {/* Toggle the translucent cluster overlay */}
              {colorMode !== "building" && (
              <button
                type="button"
                onClick={() => setShowClusters((v) => !v)}
                aria-pressed={showClusters}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  showClusters
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="size-3.5" aria-hidden="true" />
                Clusters
              </button>
              )}
              {isLively && (
                <button
                  type="button"
                  onClick={() => setShowPriorityAreas((v) => !v)}
                  aria-pressed={showPriorityAreas}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    showPriorityAreas
                      ? "border-destructive bg-destructive text-destructive-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <AlertTriangle className="size-3.5" aria-hidden="true" />
                  Priority areas
                  {priorityBuildings.length > 0 && showPriorityAreas ? (
                    <span className="rounded-full bg-destructive-foreground/20 px-1.5 py-px text-[10px]">
                      {priorityBuildings.length}
                    </span>
                  ) : null}
                </button>
              )}
              {/* Toggle visibility of logged deficiency markers */}
              {levelDeficiencies.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDeficiencies((v) => !v)
                    setSelectedDeficiency(null)
                  }}
                  aria-pressed={showDeficiencies}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    showDeficiencies
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {showDeficiencies ? (
                    <Eye className="size-3.5" aria-hidden="true" />
                  ) : (
                    <EyeOff className="size-3.5" aria-hidden="true" />
                  )}
                  Deficiencies ({levelDeficiencies.length})
                </button>
              )}
              {levelAssets.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAssets((v) => !v)
                    setSelectedAsset(null)
                  }}
                  aria-pressed={showAssets}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    showAssets
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {showAssets ? (
                    <Eye className="size-3.5" aria-hidden="true" />
                  ) : (
                    <EyeOff className="size-3.5" aria-hidden="true" />
                  )}
                  Assets ({levelAssets.length})
                </button>
              )}
              </>
              )}
              {showAssessmentTools && !showRoomHotspots && levelDeficiencies.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDeficiencies((v) => !v)
                    setSelectedDeficiency(null)
                  }}
                  aria-pressed={showDeficiencies}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    showDeficiencies
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {showDeficiencies ? (
                    <Eye className="size-3.5" aria-hidden="true" />
                  ) : (
                    <EyeOff className="size-3.5" aria-hidden="true" />
                  )}
                  Deficiencies ({levelDeficiencies.length})
                </button>
              )}
              {showAssessmentTools && !showRoomHotspots && levelAssets.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAssets((v) => !v)
                    setSelectedAsset(null)
                  }}
                  aria-pressed={showAssets}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    showAssets
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {showAssets ? (
                    <Eye className="size-3.5" aria-hidden="true" />
                  ) : (
                    <EyeOff className="size-3.5" aria-hidden="true" />
                  )}
                  Assets ({levelAssets.length})
                </button>
              )}
            </div>
            )}
          </div>

          {/* Filter toolbar — floor/building filter and/or hotspot filters */}
          {siteView === "floorplan" && ((planLevels && planLevels.length > 1) || planBuildingIds || showPlanScoreFilters) && (
          <div data-guide="floor-plan-levels" className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            {planLevels && planLevels.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Floor</span>
                <div className="flex flex-wrap items-center gap-1">
                  {planLevels.map((level) => {
                    const on = level.id === activeLevelId
                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => selectFloor(level.id)}
                        aria-pressed={on}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          on
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Layers className="size-3" aria-hidden="true" />
                        {level.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {planBuildingIds && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Building</span>
                <div className="flex flex-wrap items-center gap-1">
                  {planBuildingIds.map((id) => {
                    const on = buildingFilter.has(id)
                    const color = buildingColors[id] ?? "#64748b"
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleBuilding(id)}
                        aria-pressed={on}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          on
                            ? "border-border bg-card text-foreground shadow-sm"
                            : "border-transparent bg-transparent text-muted-foreground/60 line-through"
                        }`}
                      >
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: color, opacity: on ? 1 : 0.35 }}
                          aria-hidden="true"
                        />
                        Building {id}
                      </button>
                    )
                  })}
                  {buildingFilterActive && (
                    <button
                      type="button"
                      onClick={showAllBuildings}
                      className="rounded-md px-2 py-0.5 text-[11px] font-medium text-primary hover:underline"
                    >
                      Show all
                    </button>
                  )}
                </div>
              </div>
            )}

            {showPlanScoreFilters && colorMode !== "building" && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Condition</span>
              <div className="flex items-center gap-1">
                {CONDITION_ORDER.map((c) => {
                  const on = conditionFilter.has(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCondition(c)}
                      aria-pressed={on}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        on
                          ? `border-transparent text-card ${ROOM_CONDITION_BAR[c]}`
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${on ? "bg-card" : ROOM_CONDITION_BAR[c]}`}
                        aria-hidden="true"
                      />
                      {ROOM_CONDITION_LABEL[c]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="subcategory-filter" className="text-xs font-medium text-muted-foreground">
                Sub-category
              </label>
              <select
                id="subcategory-filter"
                value={subCategory}
                onChange={(e) => {
                  setSelected(null)
                  setSubCategory(e.target.value)
                  setEsaSubCriterion("")
                }}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Building/Area ({COLOR_MODE_LABEL[colorMode]})</option>
                {subCategoryOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {colorMode === "ea" && esaSubCriterionOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="esa-criterion-filter" className="text-xs font-medium text-muted-foreground">
                Criterion
              </label>
              <select
                id="esa-criterion-filter"
                value={esaSubCriterion}
                onChange={(e) => {
                  setSelected(null)
                  setEsaSubCriterion(e.target.value)
                }}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All criteria in category</option>
                {esaSubCriterionOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            )}
            </div>
            )}

            {showPlanScoreFilters && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{matchCount}</span> of {scorePoolTotal}{" "}
                {colorMode === "building" ? "buildings" : "rooms"}
              </span>
              {filtersActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-muted"
                >
                  <X className="size-3.5" aria-hidden="true" />
                  Clear
                </button>
              )}
            </div>
            )}
          </div>
          )}

          {siteView === "aerial" ? (
            <div
              className="relative w-full overflow-hidden rounded-lg border border-border bg-card"
              style={{ aspectRatio: `${planVb.w} / ${planVb.h}`, minHeight: 420 }}
            >
              <CampusAerialMap
                schoolId={school.id}
                label={school.name}
                lat={school.lat}
                lng={school.lng}
                className="absolute inset-0 h-full w-full"
              />
            </div>
          ) : (
          <div
            ref={planViewportRef}
            data-guide="floor-plan-canvas"
            className="relative w-full overflow-hidden rounded-lg border border-border bg-card"
            style={{ aspectRatio: `${planVb.w} / ${planVb.h}` }}
            onWheel={planZoomLocked ? undefined : handlePlanWheel}
            onPointerDown={handlePlanPointerDown}
            onPointerMove={handlePlanPointerMove}
            onPointerUp={handlePlanPointerUp}
            onPointerCancel={handlePlanPointerUp}
          >
            {showShadingCallout && shadingCallout && (
              <div
                className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3"
                role="status"
                aria-live="polite"
              >
                <div className="flex max-w-lg items-start gap-2.5 rounded-lg border border-border bg-card/95 px-3.5 py-3 shadow-lg backdrop-blur-sm">
                  <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-foreground">{shadingCallout.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{shadingCallout.body}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground/80">Click anywhere to dismiss</p>
                  </div>
                </div>
              </div>
            )}
            {showPriorityCallout && priorityCallout && (
              <div
                className={`pointer-events-none absolute inset-x-0 z-20 flex justify-center px-3 ${
                  isLively && selected && !selectedHasHotspot ? "bottom-16" : "bottom-3"
                }`}
                role="status"
                aria-live="polite"
              >
                <div className="flex max-w-lg items-start gap-2.5 rounded-lg border border-destructive/30 bg-card/95 px-3.5 py-3 shadow-lg backdrop-blur-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-foreground">{priorityCallout.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{priorityCallout.body}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground/80">Click anywhere to dismiss</p>
                  </div>
                </div>
              </div>
            )}
            {isLively && selected && selected.building && !selectedHasHotspot && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
                <a
                  href="#lively-room-detail-panel"
                  className="pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border border-primary/30 bg-card/95 px-3.5 py-2.5 shadow-lg backdrop-blur-sm transition-colors hover:bg-primary/5"
                >
                  <ChevronDown className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      Room {selected.id} selected — building detail below
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      Scroll down for Building {selected.building} ESA, FCA, photos, assets, and logged issues.
                    </p>
                  </div>
                </a>
              </div>
            )}
            <div
              className="absolute inset-0 origin-center"
              style={{
                transform: `translate(${planPan.x}px, ${planPan.y}px) scale(${planZoom})`,
              }}
            >
            <div
              className="relative h-full w-full"
              onClick={() => {
                setSelected(null)
                setSelectedDeficiency(null)
              }}
            >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`${school.id}-${activeLevelId}`}
              src={planDisplaySrc || "/placeholder.svg"}
              alt={`${school.name} ${activeLevel?.label ?? "floor"} plan`}
              className={`absolute inset-0 h-full w-full object-contain transition-[filter,opacity] duration-300 ${
                showLivelyPlanOverlay ? "opacity-[0.38] saturate-[0.15] brightness-[1.08]" : ""
              }`}
              draggable={false}
            />

            {/* Light wash so FCA Good/Fair/Poor colors read clearly over the plan art */}
            {showLivelyPlanOverlay && (
              <div
                className="pointer-events-none absolute inset-0 z-[1] bg-slate-50/72"
                aria-hidden="true"
              />
            )}

            {planBuildingIds &&
              buildingFilter.size < planBuildingIds.length &&
              planPolys.length > 0 && (
              <svg
                viewBox={`${planVb.x} ${planVb.y} ${planVb.w} ${planVb.h}`}
                preserveAspectRatio="xMidYMid meet"
                className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
              >
                {planPolys.map((poly) => {
                  if (!poly.building || buildingFilter.has(poly.building)) return null
                  return (
                    <polygon
                      key={`dim-${poly.id}`}
                      points={poly.points.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="#e2e8f0"
                      fillOpacity={0.88}
                      stroke="none"
                    />
                  )
                })}
              </svg>
            )}

            {dynamicLabels && planLabels.length > 0 && (
            <svg
              viewBox={`${planVb.x} ${planVb.y} ${planVb.w} ${planVb.h}`}
              preserveAspectRatio="xMidYMid meet"
              className={`absolute inset-0 h-full w-full ${roomPolyPickMode ? "z-[6]" : "pointer-events-none z-[2]"}`}
              style={{ pointerEvents: roomPolyPickMode ? "all" : "none" }}
            >
              {visibleRoomLabels.map((label) => (
                <text
                  key={label.id}
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={roomLabelFontSize}
                  fontWeight={600}
                  fontFamily="system-ui, Segoe UI, Arial, sans-serif"
                  fill="#1f2328"
                  stroke="#ffffff"
                  strokeWidth={Math.max(roomLabelFontSize * 0.12, 1.5)}
                  paintOrder="stroke"
                  className={roomPolyPickMode ? "cursor-pointer" : undefined}
                  onClick={
                    roomPolyPickMode
                      ? (e) => {
                          e.stopPropagation()
                          selectRoomById(label.id)
                        }
                      : undefined
                  }
                >
                  {label.text}
                </text>
              ))}
            </svg>
            )}

            {planBuildingIds && buildingFilterActive && !showRoomHotspots && !showLivelyPlanOverlay && (
            <svg
              viewBox={`${planVb.x} ${planVb.y} ${planVb.w} ${planVb.h}`}
              preserveAspectRatio="xMidYMid meet"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {buildingPolys.map((b) =>
                buildingFilter.has(b.id) ? (
                  <polygon
                    key={`bldg-emphasis-${b.id}`}
                    points={b.points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={b.color}
                    strokeWidth={14}
                    strokeOpacity={0.85}
                    strokeLinejoin="round"
                  />
                ) : null,
              )}
            </svg>
            )}

            {/* Plan shading — building colors or ESA/FCA scores, under specialty hotspots */}
            {showLivelyPlanOverlay && (
            <svg
              viewBox={`${planVb.x} ${planVb.y} ${planVb.w} ${planVb.h}`}
              preserveAspectRatio="xMidYMid meet"
              className="pointer-events-none absolute inset-0 z-[3] h-full w-full"
            >
              {planPolys.map((poly) => {
                if (!buildingMatchesFilter(poly.building)) return null
                const pts = poly.points.map((p) => `${p.x},${p.y}`).join(" ")
                if (livelyPlanBuildingMode && poly.building) {
                  const fill = buildingColors[poly.building] ?? "#64748b"
                  const polyIsPriority = priorityByBuilding.get(poly.building)?.isPriority ?? false
                  const emphasized = !showPriorityAreas || polyIsPriority
                  return (
                    <LivelyPlanShadedPolygon
                      key={`bldg-${poly.id}`}
                      id={`bldg-${poly.id}`}
                      points={pts}
                      fill={fill}
                      emphasized={emphasized}
                    />
                  )
                }
                const cond = conditionForPoly(poly)
                if (!cond) return null
                const matches =
                  conditionFilter.size === 0 || conditionFilter.has(cond)
                const polyIsPriority = poly.building
                  ? (priorityByBuilding.get(poly.building)?.isPriority ?? false)
                  : false
                const emphasized = matches && (!showPriorityAreas || polyIsPriority)
                return (
                  <LivelyPlanShadedPolygon
                    key={`score-${poly.id}`}
                    id={`score-${poly.id}`}
                    points={pts}
                    fill={ROOM_CONDITION_FILL[cond]}
                    emphasized={emphasized}
                  />
                )
              })}
            </svg>
            )}

            {isLively && showPriorityAreas && buildingPolys.length > 0 && (
            <svg
              viewBox={`${planVb.x} ${planVb.y} ${planVb.w} ${planVb.h}`}
              preserveAspectRatio="xMidYMid meet"
              className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
            >
              {buildingPolys.map((b) => {
                const pri = priorityByBuilding.get(b.id)
                if (!pri?.isPriority || !buildingFilter.has(b.id)) return null
                const pts = b.points.map((p) => `${p.x},${p.y}`).join(" ")
                const c = polygonCentroid(b.points)
                const badgeCount = pri.poorEsaCategories.length + pri.poorFcaSystems.length
                return (
                  <g key={`priority-${b.id}`}>
                    <polygon
                      points={pts}
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth={14}
                      strokeOpacity={0.95}
                      strokeLinejoin="round"
                      strokeDasharray="32 20"
                    />
                    <circle cx={c.x} cy={c.y} r={52} fill="#dc2626" fillOpacity={0.92} />
                    <text
                      x={c.x}
                      y={c.y + 14}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={48}
                      fontWeight={700}
                      fontFamily="system-ui, sans-serif"
                    >
                      {badgeCount}
                    </text>
                  </g>
                )
              })}
            </svg>
            )}

            {/* Hotspot overlay shares the plan's coordinate space exactly */}
            {showRoomHotspots && (
            <svg
              viewBox={`${planVb.x} ${planVb.y} ${planVb.w} ${planVb.h}`}
              preserveAspectRatio="xMidYMid meet"
              className={`absolute inset-0 h-full w-full transition-opacity ${partialHotspotMode ? "z-[4]" : ""}`}
              style={{ opacity: designMode ? 0.3 : 1, pointerEvents: "none" }}
            >
              {buildingFilterActive && !showLivelyPlanOverlay &&
                buildingPolys.map((b) =>
                  buildingFilter.has(b.id) ? (
                    <polygon
                      key={`bldg-emphasis-${b.id}`}
                      points={b.points.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke={b.color}
                      strokeWidth={14}
                      strokeOpacity={0.85}
                      strokeLinejoin="round"
                      pointerEvents="none"
                    />
                  ) : null,
                )}

              {/* Cluster overlay — drawn beneath the hotspots so circles stay readable */}
              {clusterPolygons.map((poly) => (
                <polygon
                  key={poly.id}
                  points={poly.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill={ROOM_CONDITION_FILL[poly.condition]}
                  fillOpacity={0.35}
                  stroke={ROOM_CONDITION_FILL[poly.condition]}
                  strokeOpacity={0.8}
                  strokeWidth={10}
                  strokeLinejoin="round"
                  strokeDasharray="28 18"
                  pointerEvents="none"
                />
              ))}

              {(partialHotspotMode ? hotspotRooms : rooms).map((room) => {
                const isActive = selected?.id === room.id
                const cond = effectiveCondition(room)
                const isMatch =
                  partialHotspotMode
                    ? isHotspotRoom(room.id) && matchesFilters(room)
                    : matchesFilters(room)
                const fill =
                  colorMode === "building" && room.building
                    ? buildingColors[room.building] ?? ROOM_FILL_NA
                    : cond
                      ? ROOM_CONDITION_FILL[cond]
                      : ROOM_FILL_NA
                const badge = partialHotspotMode ? hotspotBadgeText(room) : room.id
                const radius = partialHotspotMode ? 110 : 90
                return (
                  <g
                    key={room.id}
                    className={isMatch ? "cursor-pointer" : "pointer-events-none"}
                    style={{ pointerEvents: isMatch ? "all" : "none" }}
                    opacity={isMatch ? 1 : 0.18}
                    onClick={(e) => {
                      if (planPlacingMode) return
                      e.stopPropagation()
                      if (isMatch) selectRoom(room)
                    }}
                  >
                    {isActive && <circle cx={room.x} cy={room.y} r={radius + 60} fill={fill} opacity={0.18} />}
                    <circle
                      cx={room.x}
                      cy={room.y}
                      r={radius}
                      fill={fill}
                      fillOpacity={0.85}
                      stroke="#ffffff"
                      strokeWidth={isActive ? 14 : 8}
                    />
                    <text
                      x={room.x}
                      y={room.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={partialHotspotMode ? 52 : 64}
                      fontWeight={700}
                      fill="#ffffff"
                    >
                      {badge}
                    </text>
                  </g>
                )
              })}

              {/* 360° tour camera badge in the upper-right of room 017's polygon */}
              <g
                className="cursor-pointer"
                style={{ pointerEvents: "all" }}
                onClick={(e) => {
                  e.stopPropagation()
                  setTourOpen(true)
                }}
                role="button"
                aria-label="Open 360 degree virtual tour of room 017"
              >
                <title>{"View 360\u00b0 tour"}</title>
                <rect x={10474} y={912} width={78} height={78} rx={14} fill="#0f172a" stroke="#ffffff" strokeWidth={5} />
                <Camera x={10483} y={921} width={60} height={60} color="#ffffff" strokeWidth={2} />
              </g>

              {/* Subtle, clickable square markers for all deficiencies */}
              {showDeficiencies &&
                levelDeficiencies.map((d) => {
                  const center = deficiencyCenter(d)
                  if (!center) return null
                  const isActive = selectedDeficiency?.id === d.id
                  return (
                    <rect
                      key={`sq-${d.id}`}
                      x={center.x - 45}
                      y={center.y - 45}
                      width={90}
                      height={90}
                      rx={14}
                      fill={ROOM_CONDITION_FILL[d.severity]}
                      stroke="#ffffff"
                      strokeWidth={isActive ? 18 : 10}
                      className="cursor-pointer"
                      style={{ pointerEvents: "all" }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(null)
                        setSelectedAsset(null)
                        setSelectedDeficiency(d)
                      }}
                    />
                  )
                })}

              {showAssets &&
                levelAssets.map((a) => {
                  const center = assetCenter(a)
                  if (!center) return null
                  const isActive = selectedAsset?.id === a.id
                  const sw = isActive ? 18 : 10
                  return (
                    <g
                      key={`asset-${a.id}`}
                      className="cursor-pointer"
                      style={{ pointerEvents: "all" }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(null)
                        setSelectedDeficiency(null)
                        setSelectedAsset(a)
                      }}
                    >
                      <rect
                        x={center.x - 45}
                        y={center.y - 45}
                        width={90}
                        height={90}
                        rx={14}
                        fill="#2563eb"
                        stroke="#ffffff"
                        strokeWidth={sw}
                      />
                      <rect
                        x={center.x - 22}
                        y={center.y - 20}
                        width={44}
                        height={32}
                        rx={5}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={6}
                      />
                      <path
                        d={`M${center.x - 22} ${center.y - 20} L${center.x} ${center.y - 32} L${center.x + 22} ${center.y - 20}`}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={6}
                        strokeLinejoin="round"
                      />
                    </g>
                  )
                })}

            </svg>
            )}

            {showAssessmentTools && !showRoomHotspots && showDeficiencies && levelDeficiencies.length > 0 && (
            <svg
              viewBox={`${planVb.x} ${planVb.y} ${planVb.w} ${planVb.h}`}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 h-full w-full"
            >
              <DeficiencyMarkers
                deficiencies={levelDeficiencies}
                getCenter={deficiencyCenter}
                selectedDeficiencyId={selectedDeficiency?.id ?? null}
                onSelect={(d) => {
                  setSelected(null)
                  setSelectedAsset(null)
                  setSelectedDeficiency(d)
                }}
              />
            </svg>
            )}

            {showAssessmentTools && !showRoomHotspots && showAssets && levelAssets.length > 0 && (
            <svg
              viewBox={`${planVb.x} ${planVb.y} ${planVb.w} ${planVb.h}`}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 h-full w-full"
            >
              <AssetMarkers
                assets={levelAssets}
                getCenter={assetCenter}
                selectedAssetId={selectedAsset?.id ?? null}
                onSelect={(a) => {
                  setSelected(null)
                  setSelectedDeficiency(null)
                  setSelectedAsset(a)
                }}
              />
            </svg>
            )}

            {/* Rename & recolor overlay — real room polygons sharing the plan's coordinate space.
                Always renders recolored rooms; captures clicks in design mode or edit mode (no hotspots). */}
            {selectableRooms && (
            <svg
              viewBox={`${planVb.x} ${planVb.y} ${planVb.w} ${planVb.h}`}
              preserveAspectRatio="xMidYMid meet"
              className={`absolute inset-0 h-full w-full ${roomPolyPickMode ? "z-[5]" : hotspotPolyPickMode ? "z-[2]" : ""}`}
              style={{
                pointerEvents: polygonPickMode || roomPolyPickMode ? "all" : "none",
                opacity: showRoomHotspots && designMode ? 0.3 : 1,
              }}
            >
              {/* Background deselect surface (interactive pick modes) */}
              {polygonPickMode && (
                <rect
                  x={planVb.x}
                  y={planVb.y}
                  width={planVb.w}
                  height={planVb.h}
                  fill="transparent"
                  style={{ pointerEvents: "all" }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedPolyId(null)
                  }}
                />
              )}

              {planPolys.map((poly) => {
                const ov = polyOverrides[polyOverrideKey(poly.id)]
                const hasColor = !!ov?.color
                const isDesignSel = designMode && selectedPolyId === poly.id
                const isEditTarget = editMode && !hotspotOverlayEnabled && editorRoom?.id === poly.id
                const isRoomPoly = roomPolyPickMode
                const isSelectedRoom = selected?.id === poly.id
                const pts = poly.points.map((p) => `${p.x},${p.y}`).join(" ")
                const isHitTarget = isRoomPoly && !isDesignSel && !isEditTarget && !hasColor && !isSelectedRoom
                const fill = ov?.color
                  ?? (isDesignSel || isEditTarget || isSelectedRoom
                    ? "var(--color-primary)"
                    : isHitTarget
                      ? "#000000"
                      : "transparent")
                const fillOpacity = hasColor
                  ? 0.5
                  : isDesignSel || isEditTarget
                    ? 0.22
                    : isSelectedRoom
                      ? 0.18
                      : isHitTarget
                        ? 0.001
                        : isRoomPoly
                          ? 0.04
                          : polygonPickMode
                            ? 0.04
                            : 0
                const stroke = isDesignSel || isEditTarget || isSelectedRoom
                  ? "var(--color-primary)"
                  : hasColor
                    ? (ov!.color as string)
                    : isRoomPoly && showLivelyPlanOverlay
                      ? "transparent"
                    : isRoomPoly && poly.building
                      ? buildingColors[poly.building] ?? "var(--color-primary)"
                      : isRoomPoly
                        ? "var(--color-primary)"
                        : polygonPickMode
                          ? "var(--color-primary)"
                          : "transparent"
                const strokeWidth =
                  isDesignSel || isEditTarget || isSelectedRoom ? 16 : hasColor ? 6 : isRoomPoly && showLivelyPlanOverlay ? 0 : isRoomPoly ? 4 : polygonPickMode ? 4 : 0
                const strokeOpacity =
                  showLivelyPlanOverlay && isRoomPoly && !isDesignSel && !isEditTarget && !hasColor && !isSelectedRoom
                    ? 0
                  : (polygonPickMode || isRoomPoly) && !isDesignSel && !isEditTarget && !hasColor && !isSelectedRoom ? 0.35 : 1
                const interactive = polygonPickMode || isRoomPoly
                return (
                  <polygon
                    key={poly.id}
                    points={pts}
                    fill={fill}
                    fillOpacity={fillOpacity}
                    stroke={stroke}
                    strokeOpacity={strokeOpacity}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                    className={interactive ? "cursor-pointer transition-colors hover:[fill:var(--color-primary)] hover:[fill-opacity:0.18]" : ""}
                    style={{ pointerEvents: interactive ? "all" : "none" }}
                    onClick={(e) => {
                      if (!interactive) return
                      e.stopPropagation()
                      if (planPlacingMode) return
                      if (designMode) {
                        setSelectedPolyId(poly.id)
                        return
                      }
                      if (editMode && !hotspotOverlayEnabled) {
                        const room = rooms.find((r) => r.id === poly.id)
                        if (room) selectRoom(room)
                        return
                      }
                      if (isRoomPoly) {
                        selectRoomById(poly.id)
                      }
                    }}
                  />
                )
              })}

              {/* Custom name labels for renamed rooms */}
              {planPolys.map((poly) => {
                const name = polyOverrides[polyOverrideKey(poly.id)]?.name
                if (!name) return null
                return (
                  <text
                    key={`lbl-${poly.id}`}
                    x={poly.centroid.x}
                    y={poly.centroid.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={72}
                    fontWeight={700}
                    fill="#0f172a"
                    stroke="#ffffff"
                    strokeWidth={6}
                    paintOrder="stroke"
                    style={{ pointerEvents: "none" }}
                  >
                    {name}
                  </text>
                )
              })}
            </svg>
            )}

            {/* Room rename/recolor editor — anchored near the selected polygon */}
            {designMode &&
              selectedPoly &&
              (() => {
                const ov = polyOverrides[polyOverrideKey(selectedPoly.id)]
                const currentColor = ov?.color ?? selectedPoly.defaultFill
                const pos = toPercent(selectedPoly.centroid.x, selectedPoly.centroid.y, planVb)
                const anchorRight = pos.left > 55
                const anchorBottom = pos.top > 55
                return (
                  <div
                    className="absolute z-20 w-[min(18rem,calc(100%-1rem))]"
                    style={{
                      left: `${pos.left}%`,
                      top: `${pos.top}%`,
                      transform: `translate(${anchorRight ? "-100%" : "0"}, ${anchorBottom ? "-100%" : "0"}) translate(${anchorRight ? "-14px" : "14px"}, ${anchorBottom ? "-14px" : "14px"})`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Card className="gap-3 border-border p-4 shadow-lg">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Palette className="size-4 text-primary" aria-hidden="true" />
                          <h4 className="text-sm font-semibold text-foreground">Edit room</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedPolyId(null)}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="Close room editor"
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="room-name" className="text-xs font-medium text-muted-foreground">
                          Room name
                        </label>
                        <Input
                          id="room-name"
                          value={ov?.name ?? ""}
                          placeholder={`Room ${selectedPoly.id}`}
                          onChange={(e) => updateOverride(selectedPoly.id, { name: e.target.value })}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Room color</span>
                        <div className="flex flex-wrap items-center gap-2">
                          {ROOM_COLOR_SWATCHES.map((sw) => {
                            const active = currentColor.toLowerCase() === sw.value.toLowerCase()
                            return (
                              <button
                                key={sw.value}
                                type="button"
                                onClick={() => updateOverride(selectedPoly.id, { color: sw.value })}
                                aria-label={sw.label}
                                aria-pressed={active}
                                className={`size-7 rounded-full border-2 transition-transform hover:scale-110 ${active ? "border-foreground" : "border-transparent"}`}
                                style={{ backgroundColor: sw.value }}
                              >
                                {active && <Check className="mx-auto size-4 text-white" aria-hidden="true" />}
                              </button>
                            )
                          })}
                          <label
                            className="flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border"
                            title="Custom color"
                          >
                            <input
                              type="color"
                              value={currentColor}
                              onChange={(e) => updateOverride(selectedPoly.id, { color: e.target.value })}
                              className="size-9 cursor-pointer border-0 bg-transparent p-0"
                              aria-label="Custom room color"
                            />
                          </label>
                        </div>
                      </div>

                      {(ov?.name || ov?.color) && (
                        <button
                          type="button"
                          onClick={() => resetOverride(selectedPoly.id)}
                          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <RotateCcw className="size-3.5" aria-hidden="true" />
                          Reset to default
                        </button>
                      )}
                    </Card>
                  </div>
                )
              })()}

            {/* Placement-mode banner */}
            {placingDeficiency && (
              <div className="pointer-events-auto absolute left-1/2 top-3 z-[30] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-primary bg-card px-3 py-2 shadow-lg">
                <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-xs font-medium text-foreground">Click anywhere on the plan to drop the deficiency pin</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    cancelPlacing()
                  }}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}
            {placingAsset && (
              <div className="pointer-events-auto absolute left-1/2 top-3 z-[30] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-primary bg-card px-3 py-2 shadow-lg">
                <Package className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-xs font-medium text-foreground">Click on the plan to place the asset marker</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    cancelPlacingAsset()
                  }}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Topmost click-capture while placing asset or deficiency — above room polygons and labels */}
            {planPlacingMode && (
            <svg
              viewBox={`${planVb.x} ${planVb.y} ${planVb.w} ${planVb.h}`}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 z-[25] h-full w-full cursor-crosshair"
              style={{ pointerEvents: "all" }}
            >
              <rect
                x={planVb.x}
                y={planVb.y}
                width={planVb.w}
                height={planVb.h}
                fill="transparent"
                style={{ pointerEvents: "all" }}
                onClick={handlePlaceClick}
              />
            </svg>
            )}

            {/* Popup card — hotspot rooms only; others update the detail table below */}
            {selected &&
              selectedHasHotspot &&
              (() => {
                const pos = toPercent(selected.x, selected.y, planVb)
                const anchorRight = pos.left > 55
                const anchorBottom = pos.top > 55
                const wideCard = isLivelyBuildingBSpecialtyRoom(selected.id)
                return (
                  <div
                    className={wideCard ? "absolute z-10 w-[min(26rem,calc(100%-1rem))]" : "absolute z-10 w-[min(20rem,calc(100%-1rem))]"}
                    style={{
                      left: `${pos.left}%`,
                      top: `${pos.top}%`,
                      transform: `translate(${anchorRight ? "-100%" : "0"}, ${anchorBottom ? "-100%" : "0"}) translate(${anchorRight ? "-14px" : "14px"}, ${anchorBottom ? "-14px" : "14px"})`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {wideCard ? (
                      <LivelyRoomDetailCard
                        room={selected}
                        buildingColor={selected.building ? buildingColors[selected.building] : undefined}
                        detailTab={detailTab}
                        onDetailTabChange={setDetailTab}
                        onClose={() => setSelected(null)}
                      />
                    ) : (
                    <Card className="gap-3 border-border p-4 shadow-lg">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Room {selected.id}</p>
                          <h4 className="text-sm font-semibold text-foreground">{selected.name}</h4>
                          {selected.building && (
                            <span
                              className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: buildingColors[selected.building] ?? "#64748b" }}
                            >
                              Building {selected.building}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelected(null)}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="Close room detail"
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5">
                          <Building2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          <span className="text-xs text-foreground">{selected.sqft.toLocaleString()} SF</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5">
                          <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          <span className="text-xs text-foreground">Capacity {selected.capacity}</span>
                        </div>
                      </div>

                      {/* Tab toggle: Educational Adequacy vs Facility Condition */}
                      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
                        <button
                          type="button"
                          onClick={() => setDetailTab("ea")}
                          className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${detailTab === "ea" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          Educational Adequacy
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailTab("fca")}
                          className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${detailTab === "fca" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          Facility Condition
                        </button>
                      </div>

                      {detailTab === "ea" ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${ROOM_CONDITION_TEXT[selected.condition]}`}
                            >
                              <span className={`size-2 rounded-full ${ROOM_CONDITION_BAR[selected.condition]}`} aria-hidden="true" />
                              {ROOM_CONDITION_LABEL[selected.condition]} suitability
                            </span>
                            <span className="text-sm font-bold text-primary">{selected.eaScore}% EA</span>
                          </div>
                          <div className="flex flex-col gap-2 border-t border-border pt-3">
                            {selected.metrics.map((m) => (
                              <MetricBar key={m.name} name={m.name} score={m.score} />
                            ))}
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">{selected.note}</p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${ROOM_CONDITION_TEXT[selected.fcaCondition]}`}
                            >
                              <span className={`size-2 rounded-full ${ROOM_CONDITION_BAR[selected.fcaCondition]}`} aria-hidden="true" />
                              {ROOM_CONDITION_LABEL[selected.fcaCondition]} condition
                            </span>
                            <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                              <Wrench className="size-3.5" aria-hidden="true" />
                              FCI {selected.fci.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                            <span className="text-xs font-medium text-muted-foreground">System conditions</span>
                            {selected.systems.map((s) => (
                              <SystemChip key={s.name} name={s.name} condition={s.condition} />
                            ))}
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">{selected.fcaNote}</p>
                        </>
                      )}
                    </Card>
                    )}
                  </div>
                )
              })()}

            {/* Popup card for a clicked asset marker */}
            {selectedAsset &&
              showAssets &&
              (() => {
                const center = assetCenter(selectedAsset)
                if (!center) return null
                const pos = toPercent(center.x, center.y, planVb)
                const anchorRight = pos.left > 55
                const anchorBottom = pos.top > 55
                return (
                  <div
                    className="absolute z-10 w-[min(18rem,calc(100%-1rem))]"
                    style={{
                      left: `${pos.left}%`,
                      top: `${pos.top}%`,
                      transform: `translate(${anchorRight ? "-100%" : "0"}, ${anchorBottom ? "-100%" : "0"}) translate(${anchorRight ? "-14px" : "14px"}, ${anchorBottom ? "-14px" : "14px"})`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Card className="gap-3 border-border p-4 shadow-lg">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded bg-blue-600">
                            <Package className="size-4 text-white" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">
                              Asset
                              {selectedAsset.roomId ? ` · Room ${selectedAsset.roomId}` : " · Building-wide"}
                            </p>
                            <h4 className="text-sm font-semibold text-foreground">{selectedAsset.category}</h4>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedAsset(null)}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="Close asset detail"
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      {selectedAsset.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedAsset.photoUrl || "/placeholder.svg"}
                          alt={`${selectedAsset.category} asset`}
                          className="h-32 w-full rounded-md border border-border object-cover"
                        />
                      )}

                      <p className="text-xs leading-relaxed text-muted-foreground">{selectedAsset.description}</p>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeAsset(selectedAsset.id)}
                        className="gap-1.5 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Remove asset
                      </Button>
                    </Card>
                  </div>
                )
              })()}

            {/* Popup card for a clicked deficiency marker */}
            {selectedDeficiency &&
              showDeficiencies &&
              (() => {
                const center = deficiencyCenter(selectedDeficiency)
                if (!center) return null
                const pos = toPercent(center.x, center.y, planVb)
                const anchorRight = pos.left > 55
                const anchorBottom = pos.top > 55
                return (
                  <div
                    className="absolute z-10 w-[min(18rem,calc(100%-1rem))]"
                    style={{
                      left: `${pos.left}%`,
                      top: `${pos.top}%`,
                      transform: `translate(${anchorRight ? "-100%" : "0"}, ${anchorBottom ? "-100%" : "0"}) translate(${anchorRight ? "-14px" : "14px"}, ${anchorBottom ? "-14px" : "14px"})`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Card className="gap-3 border-border p-4 shadow-lg">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded ${ROOM_CONDITION_BAR[selectedDeficiency.severity]}`}
                          >
                            <AlertTriangle className="size-4 text-white" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">
                              {selectedDeficiency.type === "ea" ? "Educational Adequacy" : "Facility Condition"}
                              {selectedDeficiency.roomId ? ` · Room ${selectedDeficiency.roomId}` : " · Building-wide"}
                            </p>
                            <h4 className="text-sm font-semibold text-foreground">{selectedDeficiency.category}</h4>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedDeficiency(null)}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="Close deficiency detail"
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      <span
                        className={`inline-flex w-fit items-center gap-1.5 text-xs font-semibold ${ROOM_CONDITION_TEXT[selectedDeficiency.severity]}`}
                      >
                        <span
                          className={`size-2 rounded-full ${ROOM_CONDITION_BAR[selectedDeficiency.severity]}`}
                          aria-hidden="true"
                        />
                        {ROOM_CONDITION_LABEL[selectedDeficiency.severity]} severity
                      </span>

                      {selectedDeficiency.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedDeficiency.photoUrl || "/placeholder.svg"}
                          alt={`${selectedDeficiency.category} deficiency`}
                          className="h-32 w-full rounded-md border border-border object-cover"
                        />
                      )}

                      {selectedDeficiency.note && (
                        <p className="text-xs leading-relaxed text-muted-foreground">{selectedDeficiency.note}</p>
                      )}

                      <button
                        type="button"
                        onClick={() => removeDeficiency(selectedDeficiency.id)}
                        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-destructive transition-colors hover:underline"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Remove deficiency
                      </button>
                    </Card>
                  </div>
                )
              })()}
            </div>
            </div>
          </div>
          )}

          <p className="text-xs italic text-muted-foreground">
            {siteView === "aerial"
              ? "Satellite imagery centered on the campus from AISD GeoJSON. Switch to Floor Plan to explore room-level scores and assessments."
              : planZoomLocked
              ? "Plan zoom is paused while a room is selected — close the popup to zoom or pan again."
              : showLivelyPlanOverlay
              ? colorMode === "building"
                ? "Building colors on all rooms — use the Building filter to focus on A, B, C, or D. Switch to ESA or FCA for suitability scores."
                : colorMode === "ea"
                ? subCategory
                  ? `ESA shading by ${subCategory} — Good, Fair, and Poor scores per building. Specialty hotspots remain on top.`
                  : "ESA shading by building score — all rooms in each building share Good, Fair, or Poor. Use Sub-category for category-level scores."
                : subCategory
                ? `FCA shading by ${subCategory} — Good, Fair, and Poor scores per building. Specialty hotspots remain on top.`
                : "FCA shading by building score — all rooms in each building share Good, Fair, or Poor. Use Sub-category for system-level scores."
              : showRoomHotspots && partialHotspotMode
              ? "Building B specialty spaces (Band/Music, Choir, Orchestra, Cafeteria) shown as hotspots — click any room for details below."
              : showRoomHotspots
              ? "Representative plan shown for room-level assessment. Click a numbered hotspot to inspect suitability detail."
              : dynamicLabels && planLabels.length > 0
                ? labelsCulled
                  ? `Showing ${visibleRoomLabels.length} of ${planLabels.length} room labels — zoom in to reveal more. Scroll to zoom · Shift + drag to pan.`
                  : `Showing ${visibleRoomLabels.length} room labels. Scroll to zoom · Shift + drag to pan.`
                : "Scroll to zoom · Shift + drag to pan · Use Assessment Tools to select and edit room shapes."}
          </p>
        </Card>
      </div>

      {isLively && selected && (
        <LivelyBuildingDetailPanel
          key={selected.id}
          room={selected}
          hasHotspotData={selectedHasHotspot}
          deficiencies={deficiencies}
          planAssets={levelAssets}
          allRooms={rooms}
          openTab={detailPanelOpenTab}
          buildingColor={selected.building ? buildingColors[selected.building] : undefined}
          esaCategory={subCategory}
          esaSubCriterion={esaSubCriterion}
        />
      )}

      <EditScoreDialog
        room={editorRoom}
        open={editorRoom !== null}
        onOpenChange={(o) => {
          if (!o) setEditorRoom(null)
        }}
        onSave={saveRoom}
      />

      <AddDeficiencyDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o)
          if (!o && !placingDeficiency) setPendingLocation(null)
        }}
        rooms={roomOptions}
        onAdd={addDeficiency}
        location={pendingLocation}
        onPickLocation={startPlacing}
        floorId={planLevels && planLevels.length > 1 ? activeLevelId : undefined}
      />

      <AddAssetDialog
        open={addAssetOpen}
        onOpenChange={(o) => {
          setAddAssetOpen(o)
          if (!o && !placingAsset) setPendingAssetLocation(null)
        }}
        rooms={roomOptions}
        onAdd={addAsset}
        location={pendingAssetLocation}
        onPickLocation={startPlacingAsset}
        floorId={planLevels && planLevels.length > 1 ? activeLevelId : undefined}
      />

      <Dialog open={tourOpen} onOpenChange={setTourOpen}>
        <DialogContent className="w-[96vw] max-w-[1600px] gap-3 p-4 sm:max-w-[1600px] sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="size-4 text-primary" aria-hidden="true" />
              {"Room 017 — 360\u00b0 Virtual Tour"}
            </DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full overflow-hidden rounded-md border border-border bg-muted">
            <iframe
              src={ROOM_017_TOUR_URL}
              title="Room 017 360 degree virtual tour"
              className="h-full w-full"
              allow="fullscreen; accelerometer; gyroscope; magnetometer; vr; xr-spatial-tracking"
              allowFullScreen
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
