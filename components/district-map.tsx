"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import { Building2, ArrowRight, X, DollarSign, ClipboardList, Map as MapIcon, BarChart3, LayoutDashboard } from "lucide-react"
import { MAPBOX_TOKEN, ROOM_CONDITION_BAR, ROOM_CONDITION_LABEL, type RoomCondition } from "@/lib/dashboard-data"
import {
  districtSchools,
  teachingDistrictSchools,
  districtSchoolsGeoJSON,
  districtSchoolForDashboardId,
  DISTRICT_RATING_HEX,
  DISTRICT_METRIC_LABEL,
  SCHOOL_TYPE_LABEL,
  FCA_YEAR_MIN,
  FCA_YEAR_MAX,
  totalFcaDeficiencyCost,
  totalEsaProjects,
  type DistrictMetric,
} from "@/lib/district-data"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { AppHeader, SegmentedTabs } from "@/components/app-header"
import { DistrictSummary } from "@/components/district-summary"
import { PageGuide } from "@/components/page-guide"
import { schools } from "@/lib/schools-list"

const SOURCE_ID = "district-schools"
const LAYER_ID = "district-schools-circles"
const LABEL_LAYER_ID = "district-schools-labels"
const RATINGS: RoomCondition[] = ["good", "fair", "poor"]

/** Compact currency, e.g. $1.12B / $12.4M / $980K. */
function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value)}`
}

interface DistrictMapProps {
  dashboardSchoolId: string | null
  onSelectSchool: (id: string | null) => void
  onOpenSchool: (dashboardId: string) => void
  onOpenCapital: () => void
  onOpenExports: () => void
}

/** Mapbox circle-color expression keyed to the active metric's rating value. */
function colorExpression(metric: DistrictMetric): mapboxgl.Expression {
  return [
    "case",
    ["==", ["get", "type"], "OT"],
    "#94a3b8",
    [
      "match",
      ["get", metric],
      "good",
      DISTRICT_RATING_HEX.good,
      "fair",
      DISTRICT_RATING_HEX.fair,
      "poor",
      DISTRICT_RATING_HEX.poor,
      "#94a3b8",
    ],
  ]
}

/** Build a Mapbox filter from the selected FCA/ESA rating sets. */
function buildFilter(fca: Set<RoomCondition>, esa: Set<RoomCondition>): mapboxgl.Expression {
  const clauses: mapboxgl.Expression[] = []
  if (fca.size > 0) clauses.push(["in", ["get", "fca"], ["literal", Array.from(fca)]])
  if (esa.size > 0) clauses.push(["in", ["get", "esa"], ["literal", Array.from(esa)]])
  return ["all", ...clauses] as mapboxgl.Expression
}

export function DistrictMap({ dashboardSchoolId, onSelectSchool, onOpenSchool, onOpenCapital, onOpenExports }: DistrictMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const [landingView, setLandingView] = useState<"map" | "summary">("map")

  const [metric, setMetric] = useState<DistrictMetric>("fca")
  const [fcaFilter, setFcaFilter] = useState<Set<RoomCondition>>(new Set())
  const [esaFilter, setEsaFilter] = useState<Set<RoomCondition>>(new Set())
  const [planYear, setPlanYear] = useState(FCA_YEAR_MIN)
  const [schoolViewPrompt, setSchoolViewPrompt] = useState(false)
  const skipPromptRef = useRef(true)

  const mappedSchool = useMemo(
    () => (dashboardSchoolId ? districtSchoolForDashboardId(dashboardSchoolId) : undefined),
    [dashboardSchoolId],
  )
  const dashboardSchool = dashboardSchoolId ? schools.find((s) => s.id === dashboardSchoolId) : undefined

  // Schools passing the active multi-filter (drives both the map and the list).
  const visibleSchools = useMemo(() => {
    return districtSchools.filter(
      (s) => (fcaFilter.size === 0 || fcaFilter.has(s.fca)) && (esaFilter.size === 0 || esaFilter.has(s.esa)),
    )
  }, [fcaFilter, esaFilter])

  const assessableSchools = useMemo(
    () => visibleSchools.filter((s) => s.type !== "OT"),
    [visibleSchools],
  )

  // Total identified FCA deficiency dollars, escalated to the selected plan year.
  const fcaCostBaseline = useMemo(() => totalFcaDeficiencyCost(assessableSchools, FCA_YEAR_MIN), [assessableSchools])
  const fcaCostAtYear = useMemo(() => totalFcaDeficiencyCost(assessableSchools, planYear), [assessableSchools, planYear])
  const fcaCostIncrease = fcaCostAtYear - fcaCostBaseline
  // Total open ESA improvement projects across the filtered schools.
  const esaProjectsOpen = useMemo(() => totalEsaProjects(assessableSchools), [assessableSchools])

  // FCA (rows) × ESA (columns) cross-tab of the filtered schools.
  const matrix = useMemo(() => {
    const grid: Record<RoomCondition, Record<RoomCondition, number>> = {
      good: { good: 0, fair: 0, poor: 0 },
      fair: { good: 0, fair: 0, poor: 0 },
      poor: { good: 0, fair: 0, poor: 0 },
    }
    for (const s of assessableSchools) grid[s.fca][s.esa]++
    return grid
  }, [assessableSchools])

  const maxCell = useMemo(() => {
    let m = 0
    for (const fca of RATINGS) for (const esa of RATINGS) m = Math.max(m, matrix[fca][esa])
    return m
  }, [matrix])

  // Create the map when the map view is shown; tear it down when switching away.
  useEffect(() => {
    if (landingView !== "map") {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        setReady(false)
      }
      return
    }

    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-97.735, 30.305],
      zoom: 11,
      attributionControl: true,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right")

    map.on("load", () => {
      map.addSource(SOURCE_ID, { type: "geojson", data: districtSchoolsGeoJSON() })

      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 8, 12, 12, 15, 18],
          "circle-color": colorExpression("fca"),
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.92,
        },
      })

      map.addLayer({
        id: LABEL_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        minzoom: 10.5,
        layout: {
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10.5, 10, 15, 13],
          "text-offset": [0, 1.5],
          "text-anchor": "top",
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": "#334155",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4,
        },
      })

      const onEnter = () => (map.getCanvas().style.cursor = "pointer")
      const onLeave = () => (map.getCanvas().style.cursor = "")
      map.on("mouseenter", LAYER_ID, onEnter)
      map.on("mouseleave", LAYER_ID, onLeave)
      map.on("click", LAYER_ID, (e) => {
        const geoId = e.features?.[0]?.properties?.id as string | undefined
        if (!geoId) return
        const ds = districtSchools.find((s) => s.id === geoId)
        if (!ds) return
        const targetId = ds.dashboardId ?? ds.id
        onSelectSchool(targetId)
      })

      setReady(true)
      // Container was hidden while on summary — ensure tiles fill the panel.
      map.resize()
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [landingView, onSelectSchool])

  // Prompt to open School View when a school is chosen from the header or map.
  useEffect(() => {
    if (skipPromptRef.current) {
      skipPromptRef.current = false
      return
    }
    setSchoolViewPrompt(dashboardSchoolId !== null)
  }, [dashboardSchoolId])

  // Update circle color when the metric toggle changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setPaintProperty(LAYER_ID, "circle-color", colorExpression(metric))
  }, [metric, ready])

  // Update the layer filter when the multi-filter changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const filter = buildFilter(fcaFilter, esaFilter)
    map.setFilter(LAYER_ID, filter)
    map.setFilter(LABEL_LAYER_ID, filter)
  }, [fcaFilter, esaFilter, ready])

  // Emphasize the header-selected school and fly to it.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const highlightId = mappedSchool?.id ?? null
    map.setPaintProperty(
      LAYER_ID,
      "circle-stroke-color",
      highlightId ? ["case", ["==", ["get", "id"], highlightId], "#0f172a", "#ffffff"] : "#ffffff",
    )
    map.setPaintProperty(
      LAYER_ID,
      "circle-stroke-width",
      highlightId ? ["case", ["==", ["get", "id"], highlightId], 4, 2.5] : 2.5,
    )
    if (mappedSchool) {
      map.flyTo({ center: [mappedSchool.lng, mappedSchool.lat], zoom: 13.5, essential: true })
    }
  }, [dashboardSchoolId, ready, mappedSchool])

  function toggleRating(setter: typeof setFcaFilter, value: RoomCondition) {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const filtersActive = fcaFilter.size > 0 || esaFilter.size > 0

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader
        title="District Facilities Overview"
        subtitle={`${teachingDistrictSchools.length} schools assessed for Facility Condition & Educational Suitability (${districtSchools.length} total locations on map)`}
        current="map"
        selectedSchoolId={dashboardSchoolId}
        onSelectSchool={(id) => onSelectSchool(id)}
        highlightSchoolSelector={!dashboardSchoolId}
        onMap={() => setLandingView("map")}
        onSchool={() => dashboardSchoolId && onOpenSchool(dashboardSchoolId)}
        onCapital={onOpenCapital}
        onExports={onOpenExports}
        schoolDisabled={!dashboardSchoolId}
        subNav={
          <div data-guide="district-subnav">
            <SegmentedTabs
              ariaLabel="District overview view"
              tabs={[
                { id: "map" as const, label: "Map", icon: MapIcon },
                { id: "summary" as const, label: "District Summary", icon: BarChart3 },
              ]}
              value={landingView}
              onChange={setLandingView}
            />
          </div>
        }
      />

      <PageGuide guideId={landingView === "summary" ? "district-summary" : "district-map"} />

      {landingView === "summary" ? (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <DistrictSummary />
        </div>
      ) : (
      <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Left control panel */}
        <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-b border-border bg-card lg:w-96 lg:border-b-0 lg:border-r">
          {/* Metric toggle */}
        <div data-guide="district-metric" className="flex flex-col gap-2 border-b border-border p-5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Color schools by</span>
          <div className="grid grid-cols-2 gap-2">
            {(["fca", "esa"] as DistrictMetric[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                aria-pressed={metric === m}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  metric === m
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "fca" ? "FCA" : "ESA"}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Showing: {DISTRICT_METRIC_LABEL[metric]}</p>
        </div>

        {/* Capital planning summary — updates live with filters */}
        <div data-guide="district-capital-totals" className="flex flex-col gap-4 border-b border-border p-5">
          <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-1.5">
              <DollarSign className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total FCA Deficiencies Identified
              </span>
            </div>
            <span className="text-3xl font-semibold tabular-nums text-foreground">{formatCurrency(fcaCostAtYear)}</span>
            <span className="text-xs text-muted-foreground">
              {fcaCostIncrease > 0 ? (
                <>
                  <span className="font-medium text-destructive">+{formatCurrency(fcaCostIncrease)}</span> vs.{" "}
                  {FCA_YEAR_MIN} from deferral
                </>
              ) : (
                <>Baseline backlog in {FCA_YEAR_MIN}</>
              )}
            </span>
            <div className="mt-1 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Plan year</span>
                <span className="font-semibold text-foreground tabular-nums">{planYear}</span>
              </div>
              <Slider
                value={[planYear]}
                min={FCA_YEAR_MIN}
                max={FCA_YEAR_MAX}
                step={1}
                onValueChange={(v) => {
                  const next = Array.isArray(v) ? v[0] : v
                  if (Number.isFinite(next)) setPlanYear(next as number)
                }}
                aria-label="Capital plan year"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{FCA_YEAR_MIN}</span>
                <span>{Math.round((FCA_YEAR_MIN + FCA_YEAR_MAX) / 2)}</span>
                <span>{FCA_YEAR_MAX}</span>
              </div>
            </div>
          </div>

          {/* Total open ESA projects */}
          <div className="flex items-center justify-between rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-1.5">
              <ClipboardList className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total ESA Projects Open
              </span>
            </div>
            <span className="text-3xl font-semibold tabular-nums text-foreground">{esaProjectsOpen}</span>
          </div>
        </div>

        {/* FCA × ESA matrix + rating filters */}
        <div data-guide="district-filters" className="flex flex-col border-b border-border">
        <div className="flex flex-col gap-2 p-5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            FCA &times; ESA matrix
          </span>
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr>
                  <th className="bg-muted/50 p-1.5 text-[10px] font-medium text-muted-foreground" aria-hidden="true">
                    <span className="block text-right text-muted-foreground">FCA &darr;</span>
                    <span className="block text-left text-muted-foreground">ESA &rarr;</span>
                  </th>
                  {RATINGS.map((esa) => (
                    <th key={esa} className="bg-muted/50 p-1.5">
                      <span className="flex items-center justify-center gap-1 text-[11px] font-medium text-foreground">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: DISTRICT_RATING_HEX[esa] }}
                          aria-hidden="true"
                        />
                        {ROOM_CONDITION_LABEL[esa]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RATINGS.map((fca) => (
                  <tr key={fca}>
                    <th className="bg-muted/50 p-1.5 text-left">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: DISTRICT_RATING_HEX[fca] }}
                          aria-hidden="true"
                        />
                        {ROOM_CONDITION_LABEL[fca]}
                      </span>
                    </th>
                    {RATINGS.map((esa) => {
                      const count = matrix[fca][esa]
                      const isActive =
                        fcaFilter.size === 1 && fcaFilter.has(fca) && esaFilter.size === 1 && esaFilter.has(esa)
                      return (
                        <td key={esa} className="border-l border-t border-border p-0">
                          <button
                            type="button"
                            onClick={() => {
                              setFcaFilter(new Set([fca]))
                              setEsaFilter(new Set([esa]))
                            }}
                            className={`flex h-12 w-full items-center justify-center text-sm font-semibold tabular-nums transition-colors ${
                              isActive ? "ring-2 ring-inset ring-primary" : "hover:bg-muted"
                            } ${count === 0 ? "text-muted-foreground/40" : "text-foreground"}`}
                            style={{
                              backgroundColor:
                                count > 0 && maxCell > 0
                                  ? `color-mix(in oklab, var(--primary) ${Math.round((count / maxCell) * 70)}%, transparent)`
                                  : undefined,
                            }}
                            aria-label={`${ROOM_CONDITION_LABEL[fca]} FCA and ${ROOM_CONDITION_LABEL[esa]} ESA: ${count} schools. Click to filter.`}
                          >
                            {count}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">Tap a cell to filter the map to that combination.</p>
        </div>

        {/* Multi-filter */}
        <div className="flex flex-col gap-4 border-t border-border p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filter</span>
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setFcaFilter(new Set())
                  setEsaFilter(new Set())
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          <FilterGroup
            label="Facility Condition (FCA)"
            selected={fcaFilter}
            onToggle={(v) => toggleRating(setFcaFilter, v)}
          />
          <FilterGroup
            label="Educational Suitability (ESA)"
            selected={esaFilter}
            onToggle={(v) => toggleRating(setEsaFilter, v)}
          />

          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{visibleSchools.length}</span> of {districtSchools.length}{" "}
            schools shown
          </p>
        </div>
        </div>

        {/* Selected school detail */}
        {mappedSchool && dashboardSchoolId && (
          <div data-guide="district-school-card" className="border-b border-border bg-muted/40 p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {dashboardSchool?.name ?? mappedSchool.name}
                </h2>
                <p className="text-xs text-muted-foreground">{SCHOOL_TYPE_LABEL[mappedSchool.type]} School</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  skipPromptRef.current = true
                  setSchoolViewPrompt(false)
                  onSelectSchool(null)
                }}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear selection"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <RatingPill label="FCA" value={mappedSchool.fca} />
              <RatingPill label="ESA" value={mappedSchool.esa} />
            </div>
            {mappedSchool.dashboardId ? (
              <Button
                onClick={() => {
                  setSchoolViewPrompt(false)
                  onOpenSchool(mappedSchool.dashboardId as string)
                }}
                className="mt-4 w-full gap-1.5"
              >
                Open School View
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            ) : (
              <p className="mt-4 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                Detailed building dashboard not yet available for this school.
              </p>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-auto border-t border-border p-5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legend</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {RATINGS.map((r) => (
              <span key={r} className="flex items-center gap-1.5 text-xs text-foreground">
                <span
                  className="size-3 rounded-full ring-2 ring-white"
                  style={{ backgroundColor: DISTRICT_RATING_HEX[r] }}
                  aria-hidden="true"
                />
                {ROOM_CONDITION_LABEL[r]}
              </span>
            ))}
          </div>
          </div>
        </aside>

        {/* Map */}
        <div data-guide="district-map-canvas" className="relative h-[60vh] w-full lg:h-auto lg:flex-1">
          <div ref={containerRef} className="h-full w-full" aria-label="District map of schools" />
          {schoolViewPrompt && dashboardSchoolId && mappedSchool?.dashboardId && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
              <div className="pointer-events-auto flex max-w-lg flex-col gap-3 rounded-lg border border-primary/30 bg-card/95 p-4 shadow-lg backdrop-blur-sm sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <LayoutDashboard className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      View {dashboardSchool?.name ?? mappedSchool.name} in School View
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Open the school dashboard for facility condition, educational adequacy, and floor-plan tools.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSchoolViewPrompt(false)}
                  >
                    Not now
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSchoolViewPrompt(false)
                      onOpenSchool(dashboardSchoolId)
                    }}
                    className="gap-1.5"
                  >
                    Open School View
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
      )}
    </div>
  )
}

function FilterGroup({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: Set<RoomCondition>
  onToggle: (value: RoomCondition) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        {RATINGS.map((r) => {
          const active = selected.has(r)
          return (
            <button
              key={r}
              type="button"
              onClick={() => onToggle(r)}
              aria-pressed={active}
              className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`size-2 rounded-full ${ROOM_CONDITION_BAR[r]}`} aria-hidden="true" />
              {ROOM_CONDITION_LABEL[r]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RatingPill({ label, value }: { label: string; value: RoomCondition }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2">
      <span
        className="size-3 shrink-0 rounded-full ring-2 ring-white"
        style={{ backgroundColor: DISTRICT_RATING_HEX[value] }}
        aria-hidden="true"
      />
      <span className="text-xs">
        <span className="font-semibold text-foreground">{label}</span>{" "}
        <span className="text-muted-foreground">{ROOM_CONDITION_LABEL[value]}</span>
      </span>
    </div>
  )
}
