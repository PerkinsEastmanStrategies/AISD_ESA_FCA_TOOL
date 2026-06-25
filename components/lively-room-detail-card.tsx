"use client"

import { useState } from "react"
import { Building2, ChevronDown, ChevronRight, Users, Wrench, X } from "lucide-react"
import {
  ROOM_CONDITION_BAR,
  ROOM_CONDITION_LABEL,
  ROOM_CONDITION_TEXT,
  STATUS_BAR,
  scoreToStatus,
  type FloorPlanRoom,
  type RoomCondition,
} from "@/lib/dashboard-data"
import { isLivelyBuildingBSpecialtyRoom } from "@/lib/lively-building-b-rooms"
import { ExploreBuildingDetailNote } from "@/components/lively-building-detail-panel"

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

function YesNoBadge({ met }: { met: boolean }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        met ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
      }`}
    >
      {met ? "Yes" : "No"}
    </span>
  )
}

function EsaCategoryList({ room }: { room: FloorPlanRoom }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
      <span className="text-xs font-medium text-muted-foreground">ESA categories — tap to expand</span>
      {room.metrics.map((m) => {
        const open = expanded === m.name
        const hasSubs = (m.subCriteria?.length ?? 0) > 0
        return (
          <div key={m.name} className="rounded-md border border-border bg-muted/30">
            <button
              type="button"
              onClick={() => hasSubs && setExpanded(open ? null : m.name)}
              className={`flex w-full items-center gap-2 px-2.5 py-2 text-left ${hasSubs ? "cursor-pointer hover:bg-muted/50" : "cursor-default"}`}
              aria-expanded={open}
            >
              {hasSubs ? (
                open ? (
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                )
              ) : (
                <span className="size-3.5 shrink-0" />
              )}
              <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">{m.name}</span>
              <span className="text-xs font-bold tabular-nums text-primary">{m.score}%</span>
            </button>
            {open && m.subCriteria && (
              <div className="space-y-1.5 border-t border-border px-2.5 pb-2.5 pt-2">
                {m.subCriteria.map((sub) => (
                  <div
                    key={sub.name}
                    className="flex items-start justify-between gap-2 rounded-md bg-card px-2 py-1.5"
                  >
                    <span className="text-[11px] font-medium leading-snug text-foreground">{sub.name}</span>
                    <YesNoBadge met={sub.met} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface LivelyRoomDetailCardProps {
  room: FloorPlanRoom
  buildingColor?: string
  detailTab: "ea" | "fca"
  onDetailTabChange: (tab: "ea" | "fca") => void
  onClose: () => void
  /** When true, omit outer Card chrome (used inside DraggableRoomPanel). */
  embedded?: boolean
}

export function LivelyRoomDetailCard({
  room,
  buildingColor,
  detailTab,
  onDetailTabChange,
  onClose,
  embedded = false,
}: LivelyRoomDetailCardProps) {
  const isSpecialty = isLivelyBuildingBSpecialtyRoom(room.id)

  const content = (
    <>
      <div className="flex items-start justify-between gap-2 p-4 pb-0">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{room.id}</p>
          <h4 className="text-sm font-semibold text-foreground">{room.name}</h4>
          {room.building && (
            <span
              className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: buildingColor ?? "#64748b" }}
            >
              Building {room.building}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close room detail"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5">
            <Building2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs text-foreground">{room.sqft.toLocaleString()} SF</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5">
            <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs text-foreground">Capacity {room.capacity}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          <button
            type="button"
            onClick={() => onDetailTabChange("ea")}
            className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${detailTab === "ea" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Educational Adequacy
          </button>
          <button
            type="button"
            onClick={() => onDetailTabChange("fca")}
            className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${detailTab === "fca" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Facility Condition
          </button>
        </div>

        {detailTab === "ea" ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${ROOM_CONDITION_TEXT[room.condition]}`}>
                <span className={`size-2 rounded-full ${ROOM_CONDITION_BAR[room.condition]}`} aria-hidden="true" />
                {ROOM_CONDITION_LABEL[room.condition]} suitability
              </span>
              <span className="text-sm font-bold text-primary">{room.eaScore}% EA</span>
            </div>
            {isSpecialty ? (
              <EsaCategoryList room={room} />
            ) : (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                {room.metrics.map((m) => (
                  <MetricBar key={m.name} name={m.name} score={m.score} />
                ))}
              </div>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">{room.note}</p>
            <ExploreBuildingDetailNote building={room.building} />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${ROOM_CONDITION_TEXT[room.fcaCondition]}`}>
                <span className={`size-2 rounded-full ${ROOM_CONDITION_BAR[room.fcaCondition]}`} aria-hidden="true" />
                {ROOM_CONDITION_LABEL[room.fcaCondition]} condition
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                <Wrench className="size-3.5" aria-hidden="true" />
                FCI {room.fci.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 border-t border-border pt-3">
              <span className="text-xs font-medium text-muted-foreground">System conditions</span>
              {room.systems.map((s) => (
                <SystemChip key={s.name} name={s.name} condition={s.condition} />
              ))}
            </div>
            {room.fcaNote && (
              <p className="text-xs leading-relaxed text-muted-foreground">{room.fcaNote}</p>
            )}
            <ExploreBuildingDetailNote building={room.building} />
          </>
        )}
      </div>
    </>
  )

  if (embedded) {
    return <div className="max-h-[min(60vh,28rem)] overflow-y-auto">{content}</div>
  }

  return (
    <div className="max-h-[min(70vh,32rem)] overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
      {content}
    </div>
  )
}
