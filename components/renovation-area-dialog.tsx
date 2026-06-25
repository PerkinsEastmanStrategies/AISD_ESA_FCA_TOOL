"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Lasso, Trash2, Check, CheckCheck, Undo2, MousePointerClick } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { floorPlanSrc, floorPlanDisplaySrc, floorPlanViewBoxString, floorPlanViewBox, floorPlanHasSelectableRooms, type School } from "@/lib/dashboard-data"
import { FLOOR_PLAN_BUILDING_COLORS } from "@/lib/floor-plan"
import {
  CAPITAL_PROJECT_TYPES,
  DEFAULT_CAPITAL_PROJECT_TYPE,
  selectedRenovationCost,
  proratedCriticalFcaCost,
  formatUsd,
  polygonArea,
  polygonCentroid,
  pointInPolygon,
  type CapitalProjectTypeId,
  type ProjectScopeMode,
  type RenovationAreaSelection,
  type Pt,
} from "@/lib/capital-projects"
import {
  livelyCriticalBuildingIds,
  livelyRecommendationsForSelection,
  livelyRecommendationsCoveredByRenovation,
  livelyPriorityStatus,
  sumLivelyRecommendationCost,
} from "@/lib/lively-capital-planning"
import { formatDollars } from "@/lib/lively-facility-data"

interface RenovationAreaDialogProps {
  school: School
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSelected: string[]
  initialProjectType?: CapitalProjectTypeId
  initialScopeMode?: ProjectScopeMode
  initialSelectedFcaIds?: string[]
  onApply: (selection: RenovationAreaSelection) => void
}

/** A parsed room polygon from the floor-plan SVG. */
interface PlanPolygon {
  id: string
  points: Pt[]
  centroid: Pt
  area: number
  building?: string
}

function buildingFromRoomFill(fill: string): string | undefined {
  const f = fill.toLowerCase()
  for (const [id, hex] of Object.entries(FLOOR_PLAN_BUILDING_COLORS)) {
    if (f === hex.toLowerCase()) return id
  }
  return undefined
}

/** Parse all <polygon class="proom"> shapes out of the floor-plan SVG text. */
function parsePolygons(svgText: string): PlanPolygon[] {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
  const nodes = Array.from(doc.querySelectorAll("polygon.proom, #planRooms polygon.proom"))
  const polys: PlanPolygon[] = []
  nodes.forEach((node, i) => {
    const raw = node.getAttribute("points")
    if (!raw) return
    const nums = raw.trim().split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n))
    const points: Pt[] = []
    for (let k = 0; k + 1 < nums.length; k += 2) points.push({ x: nums[k], y: nums[k + 1] })
    const area = polygonArea(points)
    if (points.length < 3 || area <= 0) return
    const fill = node.getAttribute("fill") ?? ""
    const id = node.getAttribute("data-i") ?? String(i)
    polys.push({
      id,
      points,
      centroid: polygonCentroid(points),
      area,
      building: node.getAttribute("data-building") ?? buildingFromRoomFill(fill) ?? undefined,
    })
  })
  return polys
}

const MIN_LASSO_POINTS = 3
/** Drag distance (in svg units) beyond which a press becomes a lasso rather than a click. */
const LASSO_DRAG_THRESHOLD = 30

export function RenovationAreaDialog({
  school,
  open,
  onOpenChange,
  initialSelected,
  initialProjectType = DEFAULT_CAPITAL_PROJECT_TYPE,
  initialScopeMode = "renovate",
  initialSelectedFcaIds = [],
  onApply,
}: RenovationAreaDialogProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const fcaTouchedRef = useRef(false)
  const lassoRef = useRef<Pt[]>([])
  const [polys, setPolys] = useState<PlanPolygon[]>([])
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [selected, setSelected] = useState<string[]>(initialSelected)
  const [projectType, setProjectType] = useState<CapitalProjectTypeId>(initialProjectType)
  const [scopeMode, setScopeMode] = useState<ProjectScopeMode>(initialScopeMode)
  const [selectedFcaIds, setSelectedFcaIds] = useState<Set<string>>(() => new Set(initialSelectedFcaIds))

  // Lasso drawing state.
  const [lasso, setLasso] = useState<Pt[]>([])
  const drawingRef = useRef(false)
  const movedRef = useRef(false)
  const startRef = useRef<Pt | null>(null)

  const activeProject = CAPITAL_PROJECT_TYPES.find((t) => t.id === projectType) ?? CAPITAL_PROJECT_TYPES[0]

  const planDisplaySrc = floorPlanDisplaySrc(school)
  const planSrc = floorPlanSrc(school)
  const planVb = floorPlanViewBox(school)
  const selectableRooms = floorPlanHasSelectableRooms(school)
  const isLively = school.id === "lively"
  const criticalBuildings = useMemo(
    () => (isLively ? livelyCriticalBuildingIds() : new Set<string>()),
    [isLively],
  )

  // Re-seed from the parent when the dialog opens (not on every parent re-render).
  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setSelected(initialSelected)
      setProjectType(initialProjectType)
      setScopeMode(initialScopeMode)
      setSelectedFcaIds(new Set(initialSelectedFcaIds))
      fcaTouchedRef.current = false
    }
    if (!open && prevOpenRef.current) {
      setLoadState("idle")
      setPolys([])
      lassoRef.current = []
      setLasso([])
      drawingRef.current = false
    }
    prevOpenRef.current = open
  }, [open, initialSelected, initialProjectType, initialScopeMode, initialSelectedFcaIds])

  // Lazily fetch + parse the floor-plan SVG once the dialog first opens.
  useEffect(() => {
    if (!open || loadState !== "idle") return
    if (!selectableRooms) {
      setLoadState("ready")
      return
    }
    setLoadState("loading")
    fetch(planSrc)
      .then((r) => r.text())
      .then((text) => {
        setPolys(parsePolygons(text))
        setLoadState("ready")
      })
      .catch(() => setLoadState("error"))
  }, [open, loadState, planSrc, selectableRooms])

  const selectedSet = useMemo(() => new Set(selected), [selected])

  // Calibrate svg area -> square feet so the whole footprint equals gross sf.
  const totalArea = useMemo(() => polys.reduce((s, p) => s + p.area, 0), [polys])
  const sqftFor = useCallback(
    (area: number) => (totalArea > 0 ? Math.round((area / totalArea) * school.squareFootage) : 0),
    [totalArea, school.squareFootage],
  )

  const selectedSqft = useMemo(
    () => polys.filter((p) => selectedSet.has(p.id)).reduce((s, p) => s + sqftFor(p.area), 0),
    [polys, selectedSet, sqftFor],
  )

  const selectedBuildings = useMemo(() => {
    const ids = new Set<string>()
    for (const p of polys) {
      if (selectedSet.has(p.id) && p.building) ids.add(p.building)
    }
    return ids
  }, [polys, selectedSet])

  const areaRecommendations = useMemo(() => {
    if (!isLively || selected.length === 0) return []
    return livelyRecommendationsForSelection(selected, selectedBuildings)
  }, [isLively, selected, selectedBuildings])

  const areaCritical = useMemo(
    () => areaRecommendations.filter((r) => r.priority === "Critical"),
    [areaRecommendations],
  )

  const coveredRecs = useMemo(() => {
    if (!isLively || scopeMode !== "renovate" || selected.length === 0) return []
    return livelyRecommendationsCoveredByRenovation(areaRecommendations, projectType)
  }, [isLively, scopeMode, selected.length, areaRecommendations, projectType])

  const uncoveredRecs = useMemo(
    () => areaRecommendations.filter((r) => !coveredRecs.some((c) => c.id === r.id)),
    [areaRecommendations, coveredRecs],
  )

  useEffect(() => {
    if (scopeMode !== "critical-only" || !isLively || fcaTouchedRef.current) return
    if (selected.length === 0) {
      setSelectedFcaIds(new Set())
      return
    }
    setSelectedFcaIds(new Set(areaCritical.map((r) => r.id)))
  }, [scopeMode, isLively, selected.length, areaCritical])

  function onScopeChange(mode: ProjectScopeMode) {
    setScopeMode(mode)
    fcaTouchedRef.current = false
  }

  function toggleFcaId(id: string) {
    fcaTouchedRef.current = true
    setSelectedFcaIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renovationEstimate = selectedRenovationCost(selectedSqft, projectType)
  const criticalOnlyCost = useMemo(() => {
    if (selected.length === 0) return 0
    if (isLively) {
      return areaRecommendations
        .filter((r) => selectedFcaIds.has(r.id))
        .reduce((sum, r) => sum + r.totalCost, 0)
    }
    return proratedCriticalFcaCost(school, selectedSqft)
  }, [selected.length, isLively, areaRecommendations, selectedFcaIds, school, selectedSqft])

  const totalCost = scopeMode === "renovate" ? renovationEstimate : criticalOnlyCost
  const criticalOnlyRecs = isLively ? areaCritical : areaRecommendations.filter((r) => r.priority === "Critical")

  // Convert a pointer event to floor-plan SVG coordinates.
  function toSvgPoint(e: React.PointerEvent): Pt | null {
    const svg = svgRef.current
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const p = new DOMPointReadOnly(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function roomAtPoint(pt: Pt): string | null {
    for (let i = polys.length - 1; i >= 0; i--) {
      const poly = polys[i]
      if (pointInPolygon(pt, poly.points)) return poly.id
    }
    return null
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!selectableRooms || loadState !== "ready" || polys.length === 0) return
    const pt = toSvgPoint(e)
    if (!pt) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    movedRef.current = false
    startRef.current = pt
    lassoRef.current = [pt]
    setLasso([pt])
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawingRef.current) return
    const pt = toSvgPoint(e)
    if (!pt) return
    e.preventDefault()
    const start = startRef.current
    if (start && !movedRef.current) {
      const d = Math.hypot(pt.x - start.x, pt.y - start.y)
      if (d > LASSO_DRAG_THRESHOLD) movedRef.current = true
    }
    lassoRef.current = [...lassoRef.current, pt]
    setLasso(lassoRef.current)
  }

  function finishPointer(e: React.PointerEvent) {
    if (!drawingRef.current) return
    drawingRef.current = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)

    if (!movedRef.current) {
      const pt = toSvgPoint(e)
      lassoRef.current = []
      setLasso([])
      if (pt) {
        const roomId = roomAtPoint(pt)
        if (roomId) toggle(roomId)
      }
      return
    }

    const loop = lassoRef.current
    lassoRef.current = []
    setLasso([])
    if (loop.length >= MIN_LASSO_POINTS) {
      const hits = polys.filter((p) => pointInPolygon(p.centroid, loop)).map((p) => p.id)
      if (hits.length > 0) {
        setSelected((prev) => Array.from(new Set([...prev, ...hits])))
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    finishPointer(e)
  }

  function onPointerCancel(e: React.PointerEvent) {
    finishPointer(e)
  }

  function selectAll() {
    setSelected(polys.map((p) => p.id))
  }
  function clearAll() {
    setSelected([])
  }
  function undo() {
    setSelected((prev) => prev.slice(0, -1))
  }
  function apply() {
    onApply({
      roomIds: selected,
      sqft: selectedSqft,
      projectType,
      scopeMode,
      estimatedCost: totalCost,
      criticalItemCount: scopeMode === "critical-only" && isLively ? selectedFcaIds.size : 0,
      selectedFcaIds: scopeMode === "critical-only" && isLively ? [...selectedFcaIds] : [],
      coveredFcaIds: scopeMode === "renovate" && isLively ? coveredRecs.map((r) => r.id) : [],
    })
    onOpenChange(false)
  }

  const vb = floorPlanViewBoxString(school)
  const planInteractive = selectableRooms && loadState === "ready" && polys.length > 0
  const lassoPath = lasso.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,1100px)] max-w-[96vw] flex-col gap-4 overflow-hidden p-5 sm:max-w-[1100px] sm:p-6">
        <DialogHeader>
          <DialogTitle>Select project area</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {scopeMode === "renovate" ? (
              selectableRooms ? (
                <>
                  Drag to draw a lasso around the spaces to include — every room inside the loop is selected. Click a
                  room to toggle it. Selected floor area is priced at ${activeProject.psf}/sf for{" "}
                  {activeProject.label.toLowerCase()}.
                </>
              ) : (
                <>
                  Drag to draw a lasso around the spaces to include, or click a room to toggle it. Selected floor area
                  is priced at ${activeProject.psf}/sf for {activeProject.label.toLowerCase()}.
                </>
              )
            ) : (
              <>
                Select the area on the plan, then scope the project to identified critical FCA items only. Cost is the
                sum of critical recommendations in the selected buildings
                {isLively ? "" : " (prorated from campus critical backlog)"}.
              </>
            )}
          </p>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_16rem]">
          {/* Plan with lasso-selectable polygons */}
          <div
            className="relative mx-auto h-[min(64vh,620px)] w-auto max-w-full self-start overflow-hidden rounded-lg border border-border bg-card"
            style={{ aspectRatio: `${planVb.w} / ${planVb.h}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={planDisplaySrc || "/placeholder.svg"}
              alt={`${school.name} floor plan`}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
            <svg
              ref={svgRef}
              viewBox={vb}
              preserveAspectRatio="xMidYMid meet"
              className={`absolute inset-0 h-full w-full ${planInteractive ? "touch-none cursor-crosshair select-none" : "pointer-events-none"}`}
              onPointerDown={planInteractive ? onPointerDown : undefined}
              onPointerMove={planInteractive ? onPointerMove : undefined}
              onPointerUp={planInteractive ? onPointerUp : undefined}
              onPointerCancel={planInteractive ? onPointerCancel : undefined}
            >
              {selectableRooms &&
              polys.map((p) => {
                const isSelected = selectedSet.has(p.id)
                const pts = p.points.map((pt) => `${pt.x},${pt.y}`).join(" ")
                const inSelectedArea =
                  selected.length === 0 ||
                  isSelected ||
                  (p.building != null && selectedBuildings.has(p.building))
                const hasCriticalNeed =
                  isLively && p.building != null && criticalBuildings.has(p.building) && inSelectedArea
                return (
                  <polygon
                    key={p.id}
                    points={pts}
                    pointerEvents="none"
                    fill={
                      isSelected
                        ? "var(--color-primary)"
                        : hasCriticalNeed
                          ? "var(--color-status-critical)"
                          : "transparent"
                    }
                    fillOpacity={isSelected ? 0.42 : hasCriticalNeed ? 0.22 : 0}
                    stroke={
                      isSelected
                        ? "var(--color-primary)"
                        : hasCriticalNeed
                          ? "var(--color-status-critical)"
                          : "transparent"
                    }
                    strokeWidth={isSelected ? 6 : hasCriticalNeed ? 5 : 0}
                    strokeDasharray={hasCriticalNeed && !isSelected ? "14 10" : undefined}
                    className="transition-colors"
                  />
                )
              })}

              {/* In-progress lasso loop */}
              {selectableRooms && lasso.length > 1 && (
                <path
                  d={`${lassoPath} Z`}
                  fill="var(--color-primary)"
                  fillOpacity={0.1}
                  stroke="var(--color-primary)"
                  strokeWidth={6}
                  strokeDasharray="18 12"
                  className="pointer-events-none"
                />
              )}
            </svg>

            {/* On-canvas hint */}
            {selectableRooms && (
            <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-1.5 shadow-sm">
              <Lasso className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="text-xs font-medium text-foreground">
                {loadState === "loading"
                  ? "Loading floor plan…"
                  : loadState === "error"
                    ? "Could not load floor plan"
                    : polys.length === 0
                      ? "No selectable rooms on this plan"
                    : selected.length === 0
                      ? isLively
                        ? "Drag to lasso rooms — critical FCA needs highlight in red"
                        : "Drag to lasso rooms, or click a room"
                      : `${selected.length} room(s) selected`}
              </span>
            </div>
            )}
            {selectableRooms && isLively && selected.length > 0 && areaCritical.length > 0 && (
              <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex justify-center px-1">
                <div className="flex max-w-lg items-center gap-2 rounded-lg border border-status-critical/40 bg-card/95 px-3 py-2 shadow-sm">
                  <AlertTriangle className="size-4 shrink-0 text-status-critical" aria-hidden="true" />
                  <span className="text-xs font-medium text-foreground">
                    {areaCritical.length} critical FCA need{areaCritical.length === 1 ? "" : "s"} in selected area
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Side panel — totals + tools */}
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Project scope</Label>
              <div
                className="inline-flex w-full flex-col gap-1 rounded-lg border border-border bg-muted p-1 sm:flex-row"
                role="tablist"
                aria-label="Project scope"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={scopeMode === "renovate"}
                  onClick={() => onScopeChange("renovate")}
                  className={`flex-1 rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                    scopeMode === "renovate"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Full renovation
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={scopeMode === "critical-only"}
                  onClick={() => onScopeChange("critical-only")}
                  className={`flex-1 rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                    scopeMode === "critical-only"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Critical items only
                </button>
              </div>
            </div>

            {scopeMode === "renovate" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="renovation-project-type" className="text-xs text-muted-foreground">
                Project type
              </Label>
              <Select value={projectType} onValueChange={(v) => setProjectType(v as CapitalProjectTypeId)}>
                <SelectTrigger id="renovation-project-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAPITAL_PROJECT_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.label} (${type.psf}/sf)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{activeProject.description}</p>
            </div>
            )}

            <div
              className={`rounded-lg border p-4 ${
                scopeMode === "critical-only"
                  ? "border-status-critical/30 bg-status-critical/5"
                  : "border-primary/30 bg-primary/5"
              }`}
            >
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {scopeMode === "critical-only"
                  ? "Critical FCA scope"
                  : `Selected ${activeProject.label}`}
              </span>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  scopeMode === "critical-only" ? "text-status-critical" : "text-primary"
                }`}
              >
                {formatUsd(totalCost)}
              </p>
              {scopeMode === "renovate" ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {selectedSqft.toLocaleString()} sf &times; ${activeProject.psf}/sf
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selected.length} of {polys.length} spaces
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    {isLively
                      ? `${selectedFcaIds.size} of ${areaCritical.length} critical item${areaCritical.length === 1 ? "" : "s"} selected`
                      : "Critical FCA backlog prorated to selected floor area"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selected.length} of {polys.length} spaces selected
                  </p>
                </>
              )}
            </div>

            {isLively && selected.length > 0 && scopeMode === "critical-only" && criticalOnlyRecs.length > 0 && (
              <div className="rounded-lg border border-status-critical/30 bg-status-critical/5 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="size-4 text-status-critical" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Select critical items
                  </span>
                </div>
                <ul className="max-h-48 space-y-2 overflow-y-auto">
                  {criticalOnlyRecs.map((rec) => {
                    const isChecked = selectedFcaIds.has(rec.id)
                    return (
                      <li key={rec.id} className="rounded-md border border-border/60 bg-card px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium leading-snug text-foreground">
                              {rec.estimateDescription || rec.subsystem}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {rec.system} · {rec.building}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold tabular-nums text-primary">
                              {formatDollars(rec.totalCost)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant={isChecked ? "default" : "outline"}
                            size="sm"
                            className="h-7 shrink-0 text-xs"
                            onClick={() => toggleFcaId(rec.id)}
                          >
                            {isChecked ? "Selected" : "Select"}
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {isLively && selected.length > 0 && scopeMode === "renovate" && coveredRecs.length > 0 && (
              <div className="rounded-lg border border-status-good/30 bg-status-good/5 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-status-good" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Included in renovation
                  </span>
                </div>
                <p className="mb-2 text-[11px] text-muted-foreground">
                  These FCA items are typically covered by {activeProject.label.toLowerCase()} — not double-counted (
                  {formatDollars(sumLivelyRecommendationCost(coveredRecs))}).
                </p>
                <ul className="max-h-36 space-y-2 overflow-y-auto">
                  {coveredRecs.slice(0, 6).map((rec) => (
                    <li key={rec.id} className="rounded-md border border-border/60 bg-card px-2.5 py-2">
                      <p className="text-xs font-medium leading-snug text-foreground">
                        {rec.estimateDescription || rec.subsystem}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {rec.system} · {rec.building}
                      </p>
                    </li>
                  ))}
                </ul>
                {coveredRecs.length > 6 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    +{coveredRecs.length - 6} more items included in renovation scope
                  </p>
                )}
              </div>
            )}

            {isLively && selected.length > 0 && scopeMode === "renovate" && uncoveredRecs.length > 0 && (
              <div className="rounded-lg border border-status-critical/30 bg-status-critical/5 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="size-4 text-status-critical" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Remaining FCA needs in area
                  </span>
                </div>
                <ul className="max-h-36 space-y-2 overflow-y-auto">
                  {uncoveredRecs.slice(0, 6).map((rec) => {
                    const status = livelyPriorityStatus(rec.priority)
                    const statusClass =
                      status === "critical"
                        ? "text-status-critical"
                        : status === "warning"
                          ? "text-status-warning"
                          : "text-muted-foreground"
                    return (
                      <li key={rec.id} className="rounded-md border border-border/60 bg-card px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium leading-snug text-foreground">
                            {rec.estimateDescription || rec.subsystem}
                          </p>
                          <span className={`shrink-0 text-[10px] font-semibold uppercase ${statusClass}`}>
                            {rec.priority}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {rec.system} · {rec.building}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold tabular-nums text-primary">
                          {formatDollars(rec.totalCost)}
                        </p>
                      </li>
                    )
                  })}
                </ul>
                {uncoveredRecs.length > 6 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    +{uncoveredRecs.length - 6} more recommendations still needed outside renovation
                  </p>
                )}
              </div>
            )}

            {scopeMode === "critical-only" && selected.length > 0 && areaCritical.length === 0 && isLively && (
              <p className="text-xs text-muted-foreground">
                No critical FCA items were identified for the selected buildings. Adjust the selection or switch to full
                renovation.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={selectAll} disabled={!planInteractive} className="gap-1.5">
                <CheckCheck className="size-4" aria-hidden="true" />
                Select all
              </Button>
              <Button variant="outline" size="sm" onClick={undo} disabled={!planInteractive || selected.length === 0} className="gap-1.5">
                <Undo2 className="size-4" aria-hidden="true" />
                Undo
              </Button>
              <Button variant="outline" size="sm" onClick={clearAll} disabled={!planInteractive || selected.length === 0} className="gap-1.5">
                <Trash2 className="size-4" aria-hidden="true" />
                Clear
              </Button>
            </div>

            {selectableRooms ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-start gap-2">
                <MousePointerClick className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span>
                    <strong className="font-semibold text-foreground">Lasso:</strong> drag a loop around an area to
                    select all rooms inside it.
                  </span>
                  <span>
                    <strong className="font-semibold text-foreground">Click:</strong> tap a single room to add or
                    remove it.
                  </span>
                  <span>Square footage is derived from each polygon&apos;s true floor area.</span>
                </div>
              </div>
            </div>
            ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Provide a vector SVG floor plan with room polygons to enable lasso and click-to-select area pricing.
            </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!planInteractive || selected.length === 0} className="gap-1.5">
            <Check className="size-4" aria-hidden="true" />
            Apply selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
