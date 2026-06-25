"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Building2,
  Camera,
  ChevronDown,
  ClipboardList,
  Package,
  Wrench,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  ROOM_CONDITION_BAR,
  ROOM_CONDITION_LABEL,
  ROOM_CONDITION_TEXT,
  STATUS_DOT,
  STATUS_TEXT,
  type FloorPlanRoom,
  type RoomCondition,
} from "@/lib/dashboard-data"
import type { Deficiency, PlanAsset } from "@/components/scoring-editor"
import {
  buildingBAssets,
  buildingBRecommendationsForRoom,
  buildingBFcaContextForBuilding,
  buildingBCampusFciEstimate,
} from "@/lib/lively-building-b-fca"
import { isLivelyBuildingBSpecialtyRoom, LIVELY_ESA_CATEGORIES } from "@/lib/lively-building-b-rooms"
import {
  LIVELY_BUILDING_FCA_SCORES,
  type LivelyFcaSystemKey,
} from "@/lib/lively-building-fca-scores"
import { LIVELY_BUILDING_ESA_SCORES } from "@/lib/lively-building-esa-scores"
import {
  assetStatusToLevel,
  formatDollars,
  priorityToStatus,
} from "@/lib/lively-facility-data"
import { livelyFacilityPicturesForBuilding, type LivelyPicture } from "@/lib/lively-pictures"

interface LivelyBuildingDetailPanelProps {
  room: FloorPlanRoom
  hasHotspotData?: boolean
  deficiencies: Deficiency[]
  planAssets?: PlanAsset[]
  /** All assessable rooms — used to match logged assets to the current building wing. */
  allRooms?: FloorPlanRoom[]
  buildingColor?: string
  esaCategory?: string
  esaSubCriterion?: string
  /** When set, switches to the requested tab (e.g. after logging an asset). */
  openTab?: { tab: "assets" | "deficiencies"; nonce: number } | null
}

function planAssetMatchesRoom(
  asset: PlanAsset,
  room: FloorPlanRoom,
  allRooms: FloorPlanRoom[],
): boolean {
  if (asset.roomId === room.id) return true
  if (!asset.roomId && room.building) return true
  if (!asset.roomId || !room.building) return false
  const assetRoom = allRooms.find((r) => r.id === asset.roomId)
  return assetRoom?.building === room.building
}

function DataPending({ label }: { label?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
      <p className="text-sm font-medium text-foreground">Data pending</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {label ??
          "ESA and facility assessment data has not been loaded for this room yet. Hotspot spaces include detailed drill-down."}
      </p>
    </div>
  )
}

/** Prompt shown when a room is selected — points users to the detail panel below the plan. */
export function ExploreBuildingDetailNote({ building }: { building?: string }) {
  const label = building ? `Building ${building}` : "this building"
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
      <p className="text-xs font-semibold text-foreground">Explore building-level detail below</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Scroll down the page for {label} — ESA and FCA scores, recommendations, assets, facility photos, and
        logged issues.
      </p>
    </div>
  )
}

const FCA_SYSTEM_KEYS: LivelyFcaSystemKey[] = ["Flooring", "HVAC", "Plumbing", "Finishes", "Lighting"]

function BuildingConditionChip({ label, condition }: { label: string; condition: RoomCondition }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
      <span className="text-xs text-foreground">{label}</span>
      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${ROOM_CONDITION_TEXT[condition]}`}>
        <span className={`size-2 rounded-full ${ROOM_CONDITION_BAR[condition]}`} aria-hidden="true" />
        {ROOM_CONDITION_LABEL[condition]}
      </span>
    </div>
  )
}

function BuildingEsaSummary({ building }: { building: string }) {
  const profile = LIVELY_BUILDING_ESA_SCORES[building]
  if (!profile) return null
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Building-level ESA for Building {building} — all rooms in this wing share these suitability ratings.
      </p>
      <BuildingConditionChip label="Overall suitability" condition={profile.overall} />
      <div className="grid gap-2 sm:grid-cols-2">
        {LIVELY_ESA_CATEGORIES.map((cat) => (
          <BuildingConditionChip key={cat} label={cat} condition={profile.categories[cat]} />
        ))}
      </div>
    </div>
  )
}

function BuildingFcaSummary({ building }: { building: string }) {
  const profile = LIVELY_BUILDING_FCA_SCORES[building]
  if (!profile) return null
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Building-level FCA for Building {building} — overall condition and core systems.
      </p>
      <BuildingConditionChip label="Overall condition" condition={profile.overall} />
      <div className="grid gap-2 sm:grid-cols-2">
        {FCA_SYSTEM_KEYS.map((sys) => (
          <BuildingConditionChip key={sys} label={sys} condition={profile.systems[sys]} />
        ))}
      </div>
    </div>
  )
}

export function LivelyBuildingDetailPanel({
  room,
  hasHotspotData = false,
  deficiencies,
  planAssets = [],
  allRooms = [],
  buildingColor,
  esaCategory,
  esaSubCriterion,
  openTab,
}: LivelyBuildingDetailPanelProps) {
  const [recExpanded, setRecExpanded] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<"esa" | "fca" | "assets" | "deficiencies" | "photos">("esa")
  const [activePhoto, setActivePhoto] = useState<LivelyPicture | null>(null)

  useEffect(() => {
    if (openTab?.tab) setPanelTab(openTab.tab)
  }, [openTab?.nonce, openTab?.tab])

  const buildingPhotos = useMemo(
    () => livelyFacilityPicturesForBuilding(room.building),
    [room.building],
  )

  const isBuildingB = room.building === "B"
  const isSpecialtyRoom = isLivelyBuildingBSpecialtyRoom(room.id)
  const isSpecialty = hasHotspotData && isSpecialtyRoom
  const buildingEsaProfile = room.building ? LIVELY_BUILDING_ESA_SCORES[room.building] : null
  const buildingFcaProfile = room.building ? LIVELY_BUILDING_FCA_SCORES[room.building] : null
  const displayFci = room.fci > 0 ? room.fci : isBuildingB ? buildingBCampusFciEstimate() : null

  const fcaCtx = useMemo(
    () => (isBuildingB ? buildingBFcaContextForBuilding(isSpecialtyRoom ? room.id : undefined) : null),
    [isBuildingB, isSpecialtyRoom, room.id],
  )
  const roomRecs = useMemo(
    () => (isBuildingB ? buildingBRecommendationsForRoom(room.id) : []),
    [isBuildingB, room.id],
  )
  const assets = isBuildingB ? buildingBAssets() : []
  const roomPlanAssets = useMemo(
    () => planAssets.filter((a) => planAssetMatchesRoom(a, room, allRooms)),
    [planAssets, room, allRooms],
  )
  const loggedAssetsForRoom = useMemo(
    () => roomPlanAssets.filter((a) => a.roomId === room.id),
    [roomPlanAssets, room.id],
  )
  const roomDeficiencies = deficiencies.filter(
    (d) => d.roomId === room.id || (d.roomId === null && isBuildingB),
  )

  const activeMetric = esaCategory ? room.metrics.find((m) => m.name === esaCategory) : null
  const activeSub = esaSubCriterion
    ? activeMetric?.subCriteria?.find((s) => s.name === esaSubCriterion)
    : null

  const buildingLabel = room.building ? `Building ${room.building}` : "Campus"

  return (
    <Card id="lively-room-detail-panel" className="gap-4 p-4 sm:p-5 scroll-mt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" aria-hidden="true" />
            <h3 className="text-base font-semibold text-foreground">{buildingLabel} — Room Details</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {room.name} ({room.id}) · {room.sqft.toLocaleString()} SF
            {hasHotspotData ? ` · EA ${room.eaScore}%` : ""}
          </p>
        </div>
        {room.building && (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: buildingColor ?? "#64748b" }}
          >
            Building {room.building}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1">
        {(
          [
            { id: "photos" as const, label: "Photos", icon: Camera },
            { id: "fca" as const, label: "FCA & Deficiencies", icon: Wrench },
            { id: "assets" as const, label: "Assets", icon: Package },
            { id: "esa" as const, label: "ESA", icon: ClipboardList },
            { id: "deficiencies" as const, label: "Logged Issues", icon: AlertTriangle },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanelTab(id)}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              panelTab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
            {id === "photos" && buildingPhotos.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                {buildingPhotos.length}
              </span>
            )}
            {id === "deficiencies" && roomDeficiencies.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                {roomDeficiencies.length}
              </span>
            )}
            {id === "assets" && (roomPlanAssets.length > 0 || assets.length > 0) && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                {roomPlanAssets.length > 0 ? roomPlanAssets.length : assets.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {panelTab === "esa" && (
        <div className="flex flex-col gap-3">
          {isSpecialty ? (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">{room.note}</p>
              {(esaCategory || activeMetric) && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-semibold text-foreground">
                    {esaCategory ? `ESA: ${esaCategory}` : "All ESA categories"}
                    {esaSubCriterion ? ` → ${esaSubCriterion}` : ""}
                  </p>
                  {activeSub && (
                    <div className="mt-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-bold ${activeSub.met ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
                      >
                        {activeSub.met ? "YES" : "NO"}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {room.metrics.map((m) => (
                  <div key={m.name} className="rounded-md border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">{m.name}</span>
                      <span className="text-xs font-bold text-primary">{m.score}%</span>
                    </div>
                    {m.subCriteria && (
                      <ul className="mt-2 space-y-1.5">
                        {m.subCriteria.map((s) => (
                          <li key={s.name} className="flex items-start justify-between gap-2 text-[11px]">
                            <span className="text-muted-foreground">{s.name}</span>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 font-bold ${s.met ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
                            >
                              {s.met ? "YES" : "NO"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : buildingEsaProfile && room.building ? (
            <BuildingEsaSummary building={room.building} />
          ) : (
            <DataPending label="ESA category scores are available for assessed specialty spaces and building-level summaries on Lively." />
          )}
        </div>
      )}

      {panelTab === "fca" && (
        <div className="flex flex-col gap-3">
          {isBuildingB && fcaCtx ? (
            <>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm font-medium text-foreground">{fcaCtx.headline}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{fcaCtx.insight}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-md border border-border bg-muted/40 p-2 text-center">
                  <p className="text-lg font-bold text-primary">{formatDollars(fcaCtx.buildingTotalCost)}</p>
                  <p className="text-[10px] text-muted-foreground">Total est. need</p>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-2 text-center">
                  <p className="text-lg font-bold text-foreground">{fcaCtx.recCount}</p>
                  <p className="text-[10px] text-muted-foreground">FCA items</p>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-2 text-center">
                  <p className="text-lg font-bold text-destructive">{fcaCtx.criticalCount}</p>
                  <p className="text-[10px] text-muted-foreground">Critical</p>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-2 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {displayFci != null ? displayFci.toFixed(2) : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isSpecialtyRoom ? "Room FCI" : "Building B FCI est."}
                  </p>
                </div>
              </div>
              {!isSpecialtyRoom && (
                <p className="text-xs text-muted-foreground">
                  Showing Building B FCA backlog — recommendations apply to the whole wing; items below are
                  prioritized for this building.
                </p>
              )}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  FCA recommendations {isSpecialtyRoom ? "for this space" : "(Building B)"}
                </p>
                {roomRecs.length > 0 ? (
                  roomRecs.slice(0, 12).map((rec) => {
                    const status = priorityToStatus(rec.priority)
                    const open = recExpanded === rec.id
                    return (
                      <div key={rec.id} className="rounded-lg border border-border bg-card">
                        <button
                          type="button"
                          onClick={() => setRecExpanded(open ? null : rec.id)}
                          className="flex w-full items-start gap-2 p-3 text-left hover:bg-muted/40"
                        >
                          <span className={`mt-1 size-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {rec.estimateDescription || rec.subsystem}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {rec.system} · {rec.timing}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-sm font-bold tabular-nums text-primary">
                              {formatDollars(rec.totalCost)}
                            </span>
                            <ChevronDown
                              className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                            />
                          </div>
                        </button>
                        {open && (
                          <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
                            <div>
                              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Deficiency</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-foreground">{rec.deficiency}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Recommendation</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-foreground">{rec.recommendation}</p>
                            </div>
                            <span className={`text-[10px] font-semibold uppercase ${STATUS_TEXT[status]}`}>
                              {rec.priority}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No FCA recommendations matched this room.</p>
                )}
              </div>
            </>
          ) : buildingFcaProfile && room.building ? (
            <BuildingFcaSummary building={room.building} />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium text-foreground">No FCA capital data for {buildingLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Imported FCA recommendations and asset inventory are available for Building B. Other wings show
                building-level condition scores when assessed.
              </p>
            </div>
          )}
        </div>
      )}

      {panelTab === "assets" && (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <p className="border-b border-border bg-muted/50 px-3 py-2 text-xs font-semibold text-foreground">
              Logged assets
              {loggedAssetsForRoom.length > 0
                ? ` · Room ${room.id}`
                : roomPlanAssets.length > 0
                  ? ` · ${buildingLabel}`
                  : ""}
            </p>
            {roomPlanAssets.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-sm font-medium text-foreground">No assets logged yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use Assessment Tools → Add asset to pin equipment on the plan for {room.name}.
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[32rem] text-left text-xs">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Category</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Location</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Description</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Photo</th>
                  </tr>
                </thead>
                <tbody>
                  {roomPlanAssets.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2.5 font-medium text-foreground">{a.category}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {a.roomId ? (
                          a.roomId === room.id ? (
                            `Room ${a.roomId}`
                          ) : (
                            <span>
                              Room {a.roomId}
                              <span className="ml-1 text-[10px] text-muted-foreground/70">(same wing)</span>
                            </span>
                          )
                        ) : (
                          "Building-wide"
                        )}
                      </td>
                      <td className="max-w-xs px-3 py-2.5 text-muted-foreground">{a.description}</td>
                      <td className="px-3 py-2.5">
                        {a.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.photoUrl}
                            alt={a.category}
                            className="size-12 rounded border border-border object-cover"
                          />
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {isBuildingB && assets.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <p className="border-b border-border bg-muted/50 px-3 py-2 text-xs font-semibold text-foreground">
                Building B inventory
              </p>
              <table className="w-full min-w-[32rem] text-left text-xs">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Asset</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Location</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Installed</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.slice(0, 20).map((asset) => {
                    const status = assetStatusToLevel(asset.status)
                    return (
                      <tr key={asset.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground">{asset.assetGroup || asset.assetName}</p>
                          <p className="text-muted-foreground">{asset.subsystem}</p>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{asset.location || "—"}</td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{asset.yearInstalled ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 font-medium ${STATUS_TEXT[status]}`}>
                            <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
                            {asset.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {assets.length > 20 && (
                <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                  Showing 20 of {assets.length} Building B inventory components
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {panelTab === "photos" && (
        <div className="flex flex-col gap-3">
          {!room.building ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium text-foreground">No building selected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Photos are organized by building — select a room on the plan to view its building gallery.
              </p>
            </div>
          ) : buildingPhotos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium text-foreground">No photos for {buildingLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Assessor Pro facility photos for this building have not been linked yet.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {buildingPhotos.length} facility photo{buildingPhotos.length === 1 ? "" : "s"} for {buildingLabel}.
                Click a thumbnail to open full size.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {buildingPhotos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setActivePhoto(photo)}
                    className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.photoName}
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="line-clamp-2 text-xs font-semibold text-foreground">{photo.photoName}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{photo.parentName}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {panelTab === "deficiencies" && (
        <div className="flex flex-col gap-2">
          {roomDeficiencies.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium text-foreground">No logged issues for this room</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use Assessment Tools → Add deficiency to log a finding against {room.name}.
              </p>
            </div>
          ) : (
            roomDeficiencies.map((d) => (
              <div key={d.id} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                {d.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.photoUrl} alt="" className="size-14 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{d.category}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${ROOM_CONDITION_BAR[d.severity]}`} aria-hidden="true" />
                    <span className={`text-xs font-medium ${ROOM_CONDITION_TEXT[d.severity]}`}>
                      {ROOM_CONDITION_LABEL[d.severity]}
                    </span>
                    <span className="text-xs text-muted-foreground">· {d.type.toUpperCase()}</span>
                  </div>
                  {d.note && <p className="mt-1 text-xs text-muted-foreground">{d.note}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Dialog open={activePhoto !== null} onOpenChange={(open) => !open && setActivePhoto(null)}>
        <DialogContent className="w-[96vw] max-w-5xl gap-3 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
              <Camera className="size-4 text-primary" aria-hidden="true" />
              {activePhoto?.photoName}
              {activePhoto?.parentName && (
                <span className="text-sm font-normal text-muted-foreground">· {activePhoto.parentName}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          {activePhoto && (
            <div className="flex flex-col gap-3">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-muted sm:aspect-video">
                <iframe
                  src={activePhoto.url}
                  title={activePhoto.photoName}
                  className="h-full w-full"
                  allowFullScreen
                />
              </div>
              <a
                href={activePhoto.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary hover:underline"
              >
                Open original image in new tab
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
