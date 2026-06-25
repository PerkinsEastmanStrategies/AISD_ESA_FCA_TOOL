"use client"

import { useEffect, useRef, useState } from "react"
import { ImagePlus, MapPin, Package, Save, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ROOM_CONDITION_BAR,
  ROOM_CONDITION_LABEL,
  type FloorPlanRoom,
  type RoomCondition,
} from "@/lib/dashboard-data"

const CONDITIONS: RoomCondition[] = ["good", "fair", "poor"]

/** A point picked on the floor plan (SVG coords) plus any auto-matched room. */
export interface PickedLocation {
  x: number
  y: number
  roomId: string | null
}

/** Asset categories aligned with facility inventory groupings. */
export const PLAN_ASSET_CATEGORIES = [
  "HVAC",
  "Electrical",
  "Plumbing",
  "Fire Protection",
  "Roofing",
  "Interior Finishes",
  "Furniture",
  "Technology",
  "Site / Exterior",
  "Other",
] as const

/** A user-logged asset pinned on the floor plan (optionally tied to a room). */
export interface PlanAsset {
  id: string
  roomId: string | null
  category: string
  description: string
  photoUrl?: string
  photoName?: string
  /** Pin location in SVG coordinate space. */
  x?: number
  y?: number
  floorId?: string
}

/** A tracked deficiency logged against the building (optionally a specific room). */
export interface Deficiency {
  id: string
  type: "ea" | "fca"
  roomId: string | null
  category: string
  severity: RoomCondition
  note: string
  photoUrl?: string
  photoName?: string
  /** Optional pin location on the plan, in SVG coordinate space. */
  x?: number
  y?: number
  /** Floor level when the school has multiple floors (e.g. lively l1, l2). */
  floorId?: string
}

/** Round to nearest whole number, clamped 0-100. */
function clampScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)))
}

function eaScoreToCondition(score: number): RoomCondition {
  if (score >= 70) return "good"
  if (score >= 45) return "fair"
  return "poor"
}

/** Small good/fair/poor segmented selector. */
function ConditionPicker({
  value,
  onChange,
  id,
}: {
  value: RoomCondition
  onChange: (c: RoomCondition) => void
  id?: string
}) {
  return (
    <div id={id} className="flex items-center gap-1 rounded-md bg-muted p-1">
      {CONDITIONS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-pressed={value === c}
          className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
            value === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className={`size-2 rounded-full ${ROOM_CONDITION_BAR[c]}`} aria-hidden="true" />
          {ROOM_CONDITION_LABEL[c]}
        </button>
      ))}
    </div>
  )
}

/* ----------------------------- Edit existing ----------------------------- */

interface EditScoreDialogProps {
  room: FloorPlanRoom | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (room: FloorPlanRoom) => void
}

export function EditScoreDialog({ room, open, onOpenChange, onSave }: EditScoreDialogProps) {
  const [tab, setTab] = useState<"ea" | "fca">("ea")
  const [draft, setDraft] = useState<FloorPlanRoom | null>(null)

  // Re-seed the working copy whenever a different room is opened.
  useEffect(() => {
    if (room) setDraft(JSON.parse(JSON.stringify(room)) as FloorPlanRoom)
  }, [room])

  if (!draft) return null

  const eaScore = draft.metrics.length
    ? clampScore(draft.metrics.reduce((s, m) => s + m.score, 0) / draft.metrics.length)
    : 0
  const eaCondition = eaScoreToCondition(eaScore)

  function setMetric(name: string, score: number) {
    setDraft((d) =>
      d ? { ...d, metrics: d.metrics.map((m) => (m.name === name ? { ...m, score: clampScore(score) } : m)) } : d,
    )
  }

  function setSystem(name: string, condition: RoomCondition) {
    setDraft((d) =>
      d ? { ...d, systems: d.systems.map((s) => (s.name === name ? { ...s, condition } : s)) } : d,
    )
  }

  function handleSave() {
    if (!draft) return
    onSave({
      ...draft,
      eaScore,
      condition: eaCondition,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-base">
            Edit scores · Room {draft.id}
          </DialogTitle>
          <DialogDescription>{draft.name}</DialogDescription>
        </DialogHeader>

        {/* EA / FCA tab toggle */}
        <div className="grid grid-cols-2 gap-1 border-b border-border bg-muted/40 p-3">
          <button
            type="button"
            onClick={() => setTab("ea")}
            className={`rounded px-2 py-1.5 text-xs font-semibold transition-colors ${tab === "ea" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Educational Adequacy
          </button>
          <button
            type="button"
            onClick={() => setTab("fca")}
            className={`rounded px-2 py-1.5 text-xs font-semibold transition-colors ${tab === "fca" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Facility Condition
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto px-6 py-4">
          {tab === "ea" ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">Computed EA score</span>
                <span className="text-sm font-bold text-primary">
                  {eaScore}% · {ROOM_CONDITION_LABEL[eaCondition]}
                </span>
              </div>
              {draft.metrics.map((m) => (
                <div key={m.name} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`metric-${m.name}`} className="text-xs text-muted-foreground">
                      {m.name}
                    </Label>
                    <span className="text-xs font-semibold tabular-nums text-foreground">{m.score}%</span>
                  </div>
                  <input
                    id={`metric-${m.name}`}
                    type="range"
                    min={0}
                    max={100}
                    value={m.score}
                    onChange={(e) => setMetric(m.name, Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-status-track accent-primary"
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ea-note" className="text-xs text-muted-foreground">
                  Suitability note
                </Label>
                <Textarea
                  id="ea-note"
                  value={draft.note}
                  onChange={(e) => setDraft((d) => (d ? { ...d, note: e.target.value } : d))}
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="fci-input" className="text-xs text-muted-foreground">
                  FCI (0.00 – 1.00)
                </Label>
                <Input
                  id="fci-input"
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  value={draft.fci}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, fci: Math.min(1, Math.max(0, Number(e.target.value))) } : d))
                  }
                  className="h-8 w-24 text-right text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Overall FCA condition</span>
                <ConditionPicker
                  value={draft.fcaCondition}
                  onChange={(c) => setDraft((d) => (d ? { ...d, fcaCondition: c } : d))}
                />
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <span className="text-xs font-medium text-muted-foreground">System conditions</span>
                {draft.systems.map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-foreground">{s.name}</span>
                    <ConditionPicker value={s.condition} onChange={(c) => setSystem(s.name, c)} />
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fca-note" className="text-xs text-muted-foreground">
                  Condition note
                </Label>
                <Textarea
                  id="fca-note"
                  value={draft.fcaNote}
                  onChange={(e) => setDraft((d) => (d ? { ...d, fcaNote: e.target.value } : d))}
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Save className="size-4" aria-hidden="true" />
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------- Add deficiency ---------------------------- */

interface AddDeficiencyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Every selectable room on the plan (id + display name), assessed or not. */
  rooms: { id: string; name: string }[]
  onAdd: (deficiency: Deficiency) => void
  /** Location picked on the plan (drives the pin + auto room match). */
  location: PickedLocation | null
  /** Ask the parent to enter "click on plan" placement mode. */
  onPickLocation: () => void
  /** Current floor level id for multi-floor schools. */
  floorId?: string
}

const EMPTY_FORM = {
  type: "fca" as "ea" | "fca",
  roomId: "",
  category: "",
  severity: "fair" as RoomCondition,
  note: "",
}

export function AddDeficiencyDialog({
  open,
  onOpenChange,
  rooms,
  onAdd,
  location,
  onPickLocation,
  floorId,
}: AddDeficiencyDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [photoUrl, setPhotoUrl] = useState<string>("")
  const [photoName, setPhotoName] = useState<string>("")
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // When the parent returns a picked location, store the pin and auto-select the
  // nearest room (the user can still override the room from the dropdown).
  useEffect(() => {
    if (location) {
      setCoords({ x: location.x, y: location.y })
      if (location.roomId) setForm((f) => ({ ...f, roomId: location.roomId as string }))
    }
  }, [location])

  function reset() {
    setForm(EMPTY_FORM)
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl("")
    setPhotoName("")
    setCoords(null)
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl(URL.createObjectURL(file))
    setPhotoName(file.name)
  }

  function handleSubmit() {
    if (!form.category.trim() && !form.note.trim()) return
    onAdd({
      id: `def-${Date.now()}`,
      type: form.type,
      roomId: form.roomId || null,
      category: form.category.trim() || "General deficiency",
      severity: form.severity,
      note: form.note.trim(),
      photoUrl: photoUrl || undefined,
      photoName: photoName || undefined,
      x: coords?.x,
      y: coords?.y,
      floorId,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Add deficiency</DialogTitle>
          <DialogDescription>Log a new finding to track against this building.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Category type: EA vs FCA */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Assessment area</span>
            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: "fca" }))}
                className={`rounded px-2 py-1.5 text-xs font-semibold transition-colors ${form.type === "fca" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Facility Condition
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: "ea" }))}
                className={`rounded px-2 py-1.5 text-xs font-semibold transition-colors ${form.type === "ea" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Educational Adequacy
              </button>
            </div>
          </div>

          {/* Location: pick from dropdown OR drop a pin anywhere on the plan */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="def-room" className="text-xs text-muted-foreground">
              Location
            </Label>
            <div className="flex items-center gap-2">
              <select
                id="def-room"
                value={form.roomId}
                onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
                className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Building-wide / unassigned</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} — {r.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPickLocation}
                className="shrink-0 gap-1.5"
              >
                <MapPin className="size-4" aria-hidden="true" />
                {coords ? "Re-pick" : "Pick on plan"}
              </Button>
            </div>
            {coords && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
                <span className="flex items-center gap-1.5 text-xs text-foreground">
                  <MapPin className="size-3.5 text-primary" aria-hidden="true" />
                  Pin placed on plan{form.roomId ? ` · near Room ${form.roomId}` : " · custom point"}
                </span>
                <button
                  type="button"
                  onClick={() => setCoords(null)}
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Remove pin"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="def-category" className="text-xs text-muted-foreground">
              Category / component
            </Label>
            <Input
              id="def-category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder={form.type === "fca" ? "e.g. Roofing, HVAC" : "e.g. Daylighting, Acoustics"}
              className="h-9 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Severity</span>
            <ConditionPicker value={form.severity} onChange={(c) => setForm((f) => ({ ...f, severity: c }))} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="def-note" className="text-xs text-muted-foreground">
              Note
            </Label>
            <Textarea
              id="def-note"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Describe the deficiency…"
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Photo upload */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Photo (optional)</span>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            {photoUrl ? (
              <div className="relative overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl || "/placeholder.svg"} alt="Deficiency preview" className="h-40 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(photoUrl)
                    setPhotoUrl("")
                    setPhotoName("")
                  }}
                  className="absolute right-2 top-2 rounded-md bg-card/90 p-1 text-foreground shadow-sm transition-colors hover:bg-card"
                  aria-label="Remove photo"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-20 w-full flex-col gap-1.5 border-dashed text-muted-foreground"
              >
                <ImagePlus className="size-5" aria-hidden="true" />
                <span className="text-xs">Upload a picture</span>
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} className="gap-1.5">
            <Save className="size-4" aria-hidden="true" />
            Log deficiency
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------- Add asset ------------------------------- */

interface AddAssetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rooms: { id: string; name: string }[]
  onAdd: (asset: PlanAsset) => void
  location: PickedLocation | null
  onPickLocation: () => void
  floorId?: string
}

const EMPTY_ASSET_FORM = {
  roomId: "",
  category: "",
  description: "",
}

export function AddAssetDialog({
  open,
  onOpenChange,
  rooms,
  onAdd,
  location,
  onPickLocation,
  floorId,
}: AddAssetDialogProps) {
  const [form, setForm] = useState(EMPTY_ASSET_FORM)
  const [photoUrl, setPhotoUrl] = useState<string>("")
  const [photoName, setPhotoName] = useState<string>("")
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (location) {
      setCoords({ x: location.x, y: location.y })
      if (location.roomId) setForm((f) => ({ ...f, roomId: location.roomId as string }))
    }
  }, [location])

  function reset() {
    setForm(EMPTY_ASSET_FORM)
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl("")
    setPhotoName("")
    setCoords(null)
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl(URL.createObjectURL(file))
    setPhotoName(file.name)
  }

  function handleSubmit() {
    if (!form.category.trim() || !form.description.trim()) return
    onAdd({
      id: `asset-${Date.now()}`,
      roomId: form.roomId || null,
      category: form.category.trim(),
      description: form.description.trim(),
      photoUrl: photoUrl || undefined,
      photoName: photoName || undefined,
      x: coords?.x,
      y: coords?.y,
      floorId,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Add asset</DialogTitle>
          <DialogDescription>
            Log equipment or a building component on the plan — pick a room or click to place the marker.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-room" className="text-xs text-muted-foreground">
              Location
            </Label>
            <div className="flex items-center gap-2">
              <select
                id="asset-room"
                value={form.roomId}
                onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
                className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Building-wide / unassigned</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} — {r.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPickLocation}
                className="shrink-0 gap-1.5"
              >
                <MapPin className="size-4" aria-hidden="true" />
                {coords ? "Re-pick" : "Pick on plan"}
              </Button>
            </div>
            {coords ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
                <span className="flex items-center gap-1.5 text-xs text-foreground">
                  <MapPin className="size-3.5 text-primary" aria-hidden="true" />
                  Pin placed on plan{form.roomId ? ` · near Room ${form.roomId}` : " · custom point"}
                </span>
                <button
                  type="button"
                  onClick={() => setCoords(null)}
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Remove pin"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : form.roomId ? (
              <p className="text-[11px] text-muted-foreground">
                Marker will appear in the bottom corner of Room {form.roomId} unless you pick a point on the plan.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-category" className="text-xs text-muted-foreground">
              Asset category
            </Label>
            <select
              id="asset-category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="rounded-md border border-border bg-card px-2 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select a category…</option>
              {PLAN_ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-description" className="text-xs text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="asset-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the asset — make, model, condition, quantity…"
              rows={3}
              className="text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Photo (optional)</span>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            {photoUrl ? (
              <div className="relative overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl || "/placeholder.svg"} alt="Asset preview" className="h-40 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(photoUrl)
                    setPhotoUrl("")
                    setPhotoName("")
                  }}
                  className="absolute right-2 top-2 rounded-md bg-card/90 p-1 text-foreground shadow-sm transition-colors hover:bg-card"
                  aria-label="Remove photo"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-20 w-full flex-col gap-1.5 border-dashed text-muted-foreground"
              >
                <ImagePlus className="size-5" aria-hidden="true" />
                <span className="text-xs">Upload a picture</span>
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!form.category.trim() || !form.description.trim()}
            className="gap-1.5"
          >
            <Package className="size-4" aria-hidden="true" />
            Add asset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
