"use client"

import { Fragment, useMemo, useState } from "react"
import { X, ImageIcon, ChevronDown, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { formatRange } from "@/lib/format"
import {
  STATUS_BAR,
  STATUS_DOT,
  STATUS_TEXT,
  SYSTEM_SUBCOMPONENTS,
  remainingUsefulLife,
  type School,
  type StatusLevel,
} from "@/lib/dashboard-data"
import { FacilityNeedsLively } from "@/components/facility-needs-lively"

interface FacilityNeedsProps {
  school: School
}

/** Higher share of the capital total = more urgent / heavier system. */
function pctToStatus(pct: number): StatusLevel {
  if (pct >= 15) return "critical"
  if (pct >= 7) return "warning"
  if (pct >= 2) return "info"
  return "good"
}

const STATUS_LABEL: Record<StatusLevel, string> = {
  critical: "Poor",
  warning: "Fair",
  info: "Moderate",
  good: "Good",
}

/** Map remaining useful life (years) to a status color band. */
function rulToStatus(rul: number): StatusLevel {
  if (rul <= 0) return "critical"
  if (rul <= 5) return "warning"
  if (rul <= 12) return "info"
  return "good"
}

/** Longest service life across all subcomponents, used to scale RUL bars. */
const MAX_SERVICE_LIFE = 40

/** Inspector note + recommendation available for specific subcomponents. */
const SUBCOMPONENT_NOTES: Record<string, { note: string; recommendation: string }> = {
  "Main Switchgear & Panels": {
    note: "The original main switchgear in the basement boiler room had a severely cracked meter bus covering, with significant wear on its front face and moderate rust on the base. (Quantity: 1 EA / Capacity: 500 AMP)",
    recommendation: "Replace the 1948 electrical service and distribution system.",
  },
}

/** Condition photos available for specific subcomponents. */
const SUBCOMPONENT_PHOTOS: Record<string, { src: string; alt: string }> = {
  "Fixtures & Faucets": {
    src: "/images/fixtures-faucets.jpg",
    alt: "Wall-mounted restroom sinks with dual-handle faucets and aging tile, showing fixtures & faucets condition",
  },
}

const YEARS = [2026, 2028, 2031, 2034]
const BASE_YEAR = 2026
const DEFAULT_ESCALATION = 0.045
const DEFAULT_SOFT_COST_FACTOR = 0.5

export function FacilityNeeds({ school }: FacilityNeedsProps) {
  if (school.id === "lively") {
    return <FacilityNeedsLively school={school} />
  }
  return <FacilityNeedsDefault school={school} />
}

function FacilityNeedsDefault({ school }: FacilityNeedsProps) {
  const [year, setYear] = useState(String(school.needsYear))
  const [selected, setSelected] = useState<string | null>(null)
  const [openPhoto, setOpenPhoto] = useState<string | null>(null)
  const [openNote, setOpenNote] = useState<string | null>(null)
  const [variablesOpen, setVariablesOpen] = useState(false)
  const [escalation, setEscalation] = useState(DEFAULT_ESCALATION)
  const [softCostFactor, setSoftCostFactor] = useState(DEFAULT_SOFT_COST_FACTOR)

  const factor = useMemo(() => {
    const years = Number(year) - BASE_YEAR
    const escalationFactor = Math.pow(1 + escalation, Math.max(years, 0))
    const softCostMultiplier = (1 + softCostFactor) / (1 + DEFAULT_SOFT_COST_FACTOR)
    return escalationFactor * softCostMultiplier
  }, [year, escalation, softCostFactor])

  const totalLow = school.totalNeedsLow * factor
  const totalHigh = school.totalNeedsHigh * factor
  const maxPct = Math.max(...school.systems.map((s) => s.pctOfTotal))

  const selectedSystem = school.systems.find((s) => s.name === selected) ?? null
  const subcomponents = selectedSystem ? SYSTEM_SUBCOMPONENTS[selectedSystem.name] ?? [] : []
  const weightTotal = subcomponents.reduce((sum, c) => sum + c.weight, 0) || 1

  return (
    <Card className="gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">Facility Needs by System</h2>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-8 w-24 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setVariablesOpen(true)}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            Adjust Variables
          </Button>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            Total Capital Needs (Base + {(softCostFactor * 100).toFixed(0)}% Cost Allowance/Cost Factor)
          </p>
          <p className="text-xl font-bold tracking-tight text-primary">
            {formatRange(totalLow, totalHigh)}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Select a system to view its subcomponent breakdown.
      </p>

      {/* Card grid + detail table */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* System cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {school.systems.map((s) => {
            const status = pctToStatus(s.pctOfTotal)
            const isActive = s.name === selected
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => setSelected(isActive ? null : s.name)}
                aria-pressed={isActive}
                className={`flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/60 ${
                  isActive ? "border-primary ring-1 ring-primary" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{s.name}</span>
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
                </div>
                <p className={`text-sm font-bold ${STATUS_TEXT[status]}`}>
                  {formatRange(s.low * factor, s.high * factor)}
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-status-track">
                  <div
                    className={`h-full rounded-full ${STATUS_BAR[status]}`}
                    style={{ width: `${(s.pctOfTotal / maxPct) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{s.pctOfTotal.toFixed(1)}% of total</p>
              </button>
            )
          })}
        </div>

        {/* Detail table */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          {selectedSystem ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{selectedSystem.name} Subcomponents</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatRange(selectedSystem.low * factor, selectedSystem.high * factor)} total
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close detail"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Subcomponent</th>
                    <th className="pb-2 text-right font-medium">Est. Cost</th>
                    <th className="pb-2 text-right font-medium">Remaining Life</th>
                    <th className="pb-2 text-right font-medium">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subcomponents.map((c) => {
                    const low = (selectedSystem.low * factor * c.weight) / weightTotal
                    const high = (selectedSystem.high * factor * c.weight) / weightTotal
                    const rul = remainingUsefulLife(c, Number(year))
                    const rulStatus = rulToStatus(rul)
                    const rulPct = Math.max(0, Math.min(100, (rul / MAX_SERVICE_LIFE) * 100))
                    const photo = SUBCOMPONENT_PHOTOS[c.name]
                    const isPhotoOpen = openPhoto === c.name
                    const noteInfo = SUBCOMPONENT_NOTES[c.name]
                    const isNoteOpen = openNote === c.name
                    return (
                      <Fragment key={c.name}>
                      <tr>
                        <td className="py-2 pr-2 text-foreground">
                          <span className="flex items-center gap-1.5">
                            {noteInfo ? (
                              <button
                                type="button"
                                onClick={() => setOpenNote(isNoteOpen ? null : c.name)}
                                aria-expanded={isNoteOpen}
                                className="inline-flex items-center gap-1 rounded text-left font-medium text-foreground transition-colors hover:text-primary"
                              >
                                {c.name}
                                <ChevronDown
                                  className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${isNoteOpen ? "rotate-180" : ""}`}
                                  aria-hidden="true"
                                />
                              </button>
                            ) : (
                              c.name
                            )}
                            {photo && (
                              <span className="relative inline-flex">
                                <button
                                  type="button"
                                  onClick={() => setOpenPhoto(isPhotoOpen ? null : c.name)}
                                  aria-label={`${isPhotoOpen ? "Hide" : "Show"} photo of ${c.name}`}
                                  aria-expanded={isPhotoOpen}
                                  className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                                >
                                  <ImageIcon className="size-3.5" aria-hidden="true" />
                                </button>
                                {isPhotoOpen && (
                                  <>
                                    <button
                                      type="button"
                                      aria-label="Close photo"
                                      className="fixed inset-0 z-40 cursor-default bg-black/25"
                                      onClick={() => setOpenPhoto(null)}
                                    />
                                    <div
                                      role="dialog"
                                      aria-label={`${c.name} photo`}
                                      className="fixed left-1/2 top-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
                                    >
                                      <img
                                        src={photo.src || "/placeholder.svg"}
                                        alt={photo.alt}
                                        className="max-h-[70vh] w-full object-contain bg-muted/30"
                                      />
                                      <p className="border-t border-border px-3 py-2 text-sm text-muted-foreground">{c.name}</p>
                                    </div>
                                  </>
                                )}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {formatRange(low, high)}
                        </td>
                        <td className="py-2 pl-2">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-status-track">
                              <div
                                className={`h-full rounded-full ${STATUS_BAR[rulStatus]}`}
                                style={{ width: `${rulPct}%` }}
                              />
                            </div>
                            <span className={`w-14 text-right text-xs font-medium tabular-nums ${STATUS_TEXT[rulStatus]}`}>
                              {rul <= 0 ? "Past EOL" : `${rul} yr${rul === 1 ? "" : "s"}`}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <span className="inline-flex items-center justify-end gap-1.5">
                            <span className={`size-2 rounded-full ${STATUS_DOT[c.condition]}`} aria-hidden="true" />
                            <span className={`text-xs font-medium ${STATUS_TEXT[c.condition]}`}>
                              {STATUS_LABEL[c.condition]}
                            </span>
                          </span>
                        </td>
                      </tr>
                      {noteInfo && isNoteOpen && (
                        <tr>
                          <td colSpan={4} className="pb-3">
                            <div className="rounded-lg border border-border bg-card p-3">
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                <span className="font-semibold text-foreground">Note: </span>
                                {noteInfo.note}
                              </p>
                              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                <span className="font-semibold text-foreground">Recommendation: </span>
                                {noteInfo.recommendation}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-full min-h-32 items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                Click a system card to see its detailed subcomponent costs and conditions.
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs italic text-muted-foreground">
        Range shows facility needs for {BASE_YEAR} with {(escalation * 100).toFixed(1)}% annual escalation, plus a{" "}
        {(softCostFactor * 100).toFixed(0)}% cost factor accounting for construction soft costs and owner contingency.
      </p>

      <Dialog open={variablesOpen} onOpenChange={setVariablesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Adjust cost variables</DialogTitle>
            <DialogDescription>
              Change annual escalation and the soft-cost allowance applied to facility needs estimates.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="facility-needs-escalation" className="text-xs font-normal text-muted-foreground">
                  Annual escalation
                </Label>
                <span className="text-xs font-semibold tabular-nums text-foreground">
                  {(escalation * 100).toFixed(1)}%
                </span>
              </div>
              <Slider
                id="facility-needs-escalation"
                value={[escalation * 100]}
                min={0}
                max={10}
                step={0.5}
                onValueChange={(v) => {
                  const next = Array.isArray(v) ? v[0] : v
                  if (Number.isFinite(next)) setEscalation(next / 100)
                }}
                aria-label="Annual escalation"
              />
              <p className="text-[11px] text-muted-foreground">
                Compounds from {BASE_YEAR} to the selected plan year.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="facility-needs-soft-costs" className="text-xs font-normal text-muted-foreground">
                  Soft costs &amp; contingency
                </Label>
                <span className="text-xs font-semibold tabular-nums text-foreground">
                  {(softCostFactor * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                id="facility-needs-soft-costs"
                value={[softCostFactor * 100]}
                min={0}
                max={100}
                step={5}
                onValueChange={(v) => {
                  const next = Array.isArray(v) ? v[0] : v
                  if (Number.isFinite(next)) setSoftCostFactor(next / 100)
                }}
                aria-label="Soft costs and contingency"
              />
              <p className="text-[11px] text-muted-foreground">
                Added on top of base facility needs for construction soft costs and owner contingency.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEscalation(DEFAULT_ESCALATION)
                setSoftCostFactor(DEFAULT_SOFT_COST_FACTOR)
              }}
            >
              Reset to defaults
            </Button>
            <Button type="button" size="sm" onClick={() => setVariablesOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg bg-muted/60 p-4">
        <p className="text-sm font-semibold text-foreground">Important Notes:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Data is illustrative and meant to show an initial idea of maintenance needs.</li>
          <li>These costs do not reflect total construction costs.</li>
          <li>Costs when scoped and bid will likely vary from these preliminary ranges and are meant to be directional.</li>
          <li>These estimates are intended to inform high-level planning, not project execution.</li>
          <li>Working toward adding operational costs to this dashboard.</li>
        </ul>
      </div>
    </Card>
  )
}
