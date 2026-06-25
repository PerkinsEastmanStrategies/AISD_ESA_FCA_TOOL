"use client"

import { useMemo, useState } from "react"
import { Building2, Hammer, GraduationCap, AlertTriangle, PencilRuler, X, CheckCircle2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { School, StatusLevel } from "@/lib/dashboard-data"
import {
  RENOVATION_PSF,
  NEW_CONSTRUCTION_PSF,
  EOL_HORIZON_YEARS,
  capitalProjectType,
  renovationCost,
  newConstructionCost,
  fcaProjects,
  fcaProjectsTotal,
  esaProjects,
  esaProjectsTotal,
  formatUsd,
  genericFcaProjectKey,
} from "@/lib/capital-projects"
import { RenovationAreaDialog } from "@/components/renovation-area-dialog"
import {
  livelyCapitalFcaRecommendations,
  livelyCapitalFcaTotal,
  livelyPriorityStatus,
  sumLivelyRecommendationCost,
} from "@/lib/lively-capital-planning"
import { useCapitalPlan } from "@/lib/capital-plan-store"

const CONDITION_BADGE: Record<StatusLevel, string> = {
  critical: "bg-status-critical/15 text-status-critical",
  warning: "bg-status-warning/15 text-status-warning",
  info: "bg-status-info/15 text-status-info",
  good: "bg-status-good/15 text-status-good",
}

const CONDITION_LABEL: Record<StatusLevel, string> = {
  critical: "Critical",
  warning: "Poor",
  info: "Fair",
  good: "Good",
}

interface CapitalProjectsProps {
  school: School
}

export function CapitalProjects({ school }: CapitalProjectsProps) {
  const isLively = school.id === "lively"
  const fca = useMemo(() => fcaProjects(school), [school])
  const livelyFca = useMemo(
    () => (isLively ? livelyCapitalFcaRecommendations() : []),
    [isLively],
  )
  const esa = useMemo(() => esaProjects(school), [school])
  const fcaTotal = useMemo(
    () => (isLively ? livelyCapitalFcaTotal() : fcaProjectsTotal(school)),
    [school, isLively],
  )
  const esaTotal = useMemo(() => esaProjectsTotal(school), [school])

  const { plan, applyRenoSelection, clearPlan, toggleFcaSelection } = useCapitalPlan(school.id)
  const renoRooms = plan.roomIds
  const selectedSqft = plan.sqft
  const selectedProjectType = plan.projectType
  const scopeMode = plan.scopeMode
  const appliedCost = plan.appliedCost
  const criticalItemCount = plan.criticalItemCount
  const selectedFcaIds = useMemo(() => new Set(plan.selectedFcaIds), [plan.selectedFcaIds])
  const coveredFcaIds = useMemo(() => new Set(plan.coveredFcaIds), [plan.coveredFcaIds])
  const selectedProject = capitalProjectType(selectedProjectType)

  const [renoOpen, setRenoOpen] = useState(false)

  function clearRenoSelection() {
    clearPlan()
  }

  function toggleFcaSelectionLocal(id: string) {
    toggleFcaSelection(id)
  }

  const renoTotal = renovationCost(school)
  const newTotal = newConstructionCost(school)
  const coveredFcaCost = useMemo(() => {
    if (!isLively || coveredFcaIds.size === 0) return 0
    return sumLivelyRecommendationCost(livelyFca.filter((p) => coveredFcaIds.has(p.id)))
  }, [isLively, coveredFcaIds, livelyFca])
  const adjustedFcaTotal = useMemo(() => {
    if (!isLively || coveredFcaIds.size === 0) return fcaTotal
    return livelyFca.filter((p) => !coveredFcaIds.has(p.id)).reduce((s, p) => s + p.totalCost, 0)
  }, [isLively, coveredFcaIds, fcaTotal, livelyFca])
  const selectedFcaCost = useMemo(() => {
    if (selectedFcaIds.size === 0) return 0
    if (isLively) {
      return sumLivelyRecommendationCost(livelyFca.filter((p) => selectedFcaIds.has(p.id)))
    }
    return fca.filter((p) => selectedFcaIds.has(genericFcaProjectKey(p.system, p.subcomponent))).reduce(
      (s, p) => s + p.cost,
      0,
    )
  }, [selectedFcaIds, isLively, livelyFca, fca])
  const floorPlanProjectCost = selectedSqft > 0 ? appliedCost : 0
  const yourPlanTotal = floorPlanProjectCost + selectedFcaCost
  const hasPlanSelections = selectedSqft > 0 || selectedFcaIds.size > 0
  const grandTotal = fcaTotal + esaTotal

  return (
    <section className="flex flex-col gap-4 border-t border-border bg-muted/30 px-5 py-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold text-foreground">Identified Capital Projects</h2>
        <p className="text-sm text-muted-foreground">
          {isLively
            ? `${school.name} — FCA assessment recommendations and Educational Suitability (ESA) projects`
            : `${school.name} — FCA components at end of life and Educational Suitability (ESA) projects`}
        </p>
      </div>

      {/* Cost-basis estimates */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card data-guide="capital-renovation" className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-status-info/15 text-status-info">
              <Hammer className="size-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Renovation Estimate
              </span>
              <span className="text-xl font-bold tabular-nums text-foreground">{formatUsd(renoTotal)}</span>
              <span className="text-xs text-muted-foreground">
                {school.squareFootage.toLocaleString()} sf &times; ${RENOVATION_PSF}/sf
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRenoOpen(true)}
            className="justify-start gap-1.5"
          >
            <PencilRuler className="size-4" aria-hidden="true" />
            {selectedSqft > 0 ? "Edit project area" : "Select project area"}
          </Button>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Building2 className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              New Construction Estimate
            </span>
            <span className="text-xl font-bold tabular-nums text-foreground">{formatUsd(newTotal)}</span>
            <span className="text-xs text-muted-foreground">
              {school.squareFootage.toLocaleString()} sf &times; ${NEW_CONSTRUCTION_PSF}/sf
            </span>
          </div>
        </Card>
      </div>

      {/* Selected partial-renovation estimate */}
      {selectedSqft > 0 && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
            scopeMode === "critical-only"
              ? "border-status-critical/40 bg-status-critical/5"
              : "border-status-info/40 bg-status-info/5"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                scopeMode === "critical-only"
                  ? "bg-status-critical/15 text-status-critical"
                  : "bg-status-info/15 text-status-info"
              }`}
            >
              {scopeMode === "critical-only" ? (
                <AlertTriangle className="size-5" aria-hidden="true" />
              ) : (
                <PencilRuler className="size-5" aria-hidden="true" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {scopeMode === "critical-only"
                  ? "Critical FCA items — Selected Area"
                  : `${selectedProject.label} — Selected Area`}
              </span>
              <span
                className={`text-xl font-bold tabular-nums ${
                  scopeMode === "critical-only" ? "text-status-critical" : "text-foreground"
                }`}
              >
                {formatUsd(appliedCost)}
              </span>
              <div className="mt-2 flex flex-col gap-0.5 border-t border-border/60 pt-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Remaining FCA backlog
                </span>
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {formatUsd(coveredFcaIds.size > 0 ? adjustedFcaTotal : fcaTotal)}
                </span>
                {coveredFcaIds.size > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {formatUsd(coveredFcaCost)} included in renovation above — excluded from this total
                  </span>
                )}
              </div>
              <span className="mt-2 text-xs text-muted-foreground">
                {scopeMode === "critical-only" ? (
                  <>
                    {criticalItemCount > 0
                      ? `${criticalItemCount} critical item${criticalItemCount === 1 ? "" : "s"} in scope`
                      : "Critical backlog prorated to selected area"}
                    {" · "}
                    {selectedSqft.toLocaleString()} sf across {renoRooms.length} space
                    {renoRooms.length === 1 ? "" : "s"}
                  </>
                ) : (
                  <>
                    {selectedSqft.toLocaleString()} sf across {renoRooms.length} space
                    {renoRooms.length === 1 ? "" : "s"} &times; ${selectedProject.psf}/sf
                    {coveredFcaIds.size > 0 && (
                      <>
                        {" · "}
                        {coveredFcaIds.size} FCA item{coveredFcaIds.size === 1 ? "" : "s"} included in renovation (
                        {formatUsd(coveredFcaCost)} not double-counted)
                      </>
                    )}
                  </>
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRenoOpen(true)} className="gap-1.5">
              <PencilRuler className="size-4" aria-hidden="true" />
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={clearRenoSelection} className="gap-1.5">
              <X className="size-4" aria-hidden="true" />
              Clear
            </Button>
          </div>
        </div>
      )}

      <RenovationAreaDialog
        school={school}
        open={renoOpen}
        onOpenChange={setRenoOpen}
        initialSelected={renoRooms}
        initialProjectType={selectedProjectType}
        initialScopeMode={scopeMode}
        initialSelectedFcaIds={[...selectedFcaIds]}
        onApply={applyRenoSelection}
      />

      {/* Your selected plan total — above project list so totals stay visible while selecting */}
      {hasPlanSelections ? (
        <Card data-guide="capital-plan-total" className="overflow-hidden border-primary/40 bg-primary/5 p-0">
          <div className="border-b border-primary/20 bg-card px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Your Selected Capital Plan</h3>
            <p className="text-xs text-muted-foreground">
              Combined cost of your floor-plan scope and individually selected FCA projects
            </p>
          </div>
          <div className="flex flex-col gap-3 px-4 py-4">
            {selectedSqft > 0 && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {scopeMode === "critical-only"
                      ? "Critical FCA items — selected area"
                      : `${selectedProject.label} — selected area`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {selectedSqft.toLocaleString()} sf across {renoRooms.length} space
                    {renoRooms.length === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="text-base font-bold tabular-nums text-foreground">
                  {formatUsd(floorPlanProjectCost)}
                </span>
              </div>
            )}
            {selectedFcaIds.size > 0 && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {selectedFcaIds.size} FCA project{selectedFcaIds.size === 1 ? "" : "s"} selected
                  </span>
                  <span className="text-xs text-muted-foreground">Chosen from the project list below</span>
                </div>
                <span className="text-base font-bold tabular-nums text-foreground">
                  {formatUsd(selectedFcaCost)}
                </span>
              </div>
            )}
            {coveredFcaIds.size > 0 && (
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <div className="flex flex-col">
                  <span className="font-medium text-status-good">
                    {coveredFcaIds.size} FCA item{coveredFcaIds.size === 1 ? "" : "s"} included in renovation
                  </span>
                  <span className="text-xs">Excluded from plan total to avoid double-counting</span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-status-good">
                  {formatUsd(coveredFcaCost)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-primary/20 pt-3">
              <span className="text-sm font-semibold text-foreground">Your plan total</span>
              <span className="text-xl font-bold tabular-nums text-primary">{formatUsd(yourPlanTotal)}</span>
            </div>
          </div>
        </Card>
      ) : (
        <div
          data-guide="capital-plan-total"
          className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3"
        >
          <h3 className="text-sm font-semibold text-foreground">Your Selected Capital Plan</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Scope a renovation area or select FCA rows below — your running total will appear here.
          </p>
        </div>
      )}

      {/* FCA Projects */}
      <Card data-guide="capital-fca-table" className="overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
          <AlertTriangle className="size-4 text-status-warning" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">FCA Projects</h3>
          <span className="text-xs text-muted-foreground">
            {isLively
              ? `${livelyFca.length} recommendations from facility condition assessment`
              : `End of life or within ${EOL_HORIZON_YEARS} years · ${school.needsYear} assessment`}
          </span>
        </div>
        {selectedFcaIds.size > 0 && (
          <p className="border-b border-border bg-primary/5 px-4 py-2 text-xs text-foreground">
            {selectedFcaIds.size} project{selectedFcaIds.size === 1 ? "" : "s"} selected — reflected in your plan total
            above.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-24 px-4 py-2 font-medium">Select</th>
                <th className="px-4 py-2 font-medium">{isLively ? "Project / Recommendation" : "System / Component"}</th>
                <th className="px-4 py-2 font-medium">{isLively ? "Priority" : "Condition"}</th>
                <th className="px-4 py-2 font-medium">{isLively ? "Timing" : "Installed"}</th>
                <th className="px-4 py-2 text-right font-medium">{isLively ? "Impact" : "RUL"}</th>
                <th className="px-4 py-2 text-right font-medium">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {isLively
                ? livelyFca.map((p) => {
                    const status = livelyPriorityStatus(p.priority)
                    const isCovered = coveredFcaIds.has(p.id)
                    const isSelected = selectedFcaIds.has(p.id)
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-border/60 last:border-0 ${
                          isSelected ? "bg-primary/5" : isCovered ? "bg-status-good/5" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          {isCovered ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-status-good">
                              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                              In renovation
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => toggleFcaSelectionLocal(p.id)}
                            >
                              {isSelected ? "Selected" : "Select"}
                            </Button>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="block font-medium text-foreground">
                            {p.estimateDescription || p.subsystem}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {p.system} · {p.subsystem} · {p.building}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_BADGE[status]}`}
                          >
                            {p.priority}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.timing}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{p.campusImpact}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                          {formatUsd(p.totalCost)}
                        </td>
                      </tr>
                    )
                  })
                : fca.map((p) => {
                    const rowKey = genericFcaProjectKey(p.system, p.subcomponent)
                    const isSelected = selectedFcaIds.has(rowKey)
                    return (
                    <tr
                      key={rowKey}
                      className={`border-b border-border/60 last:border-0 ${isSelected ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-2.5">
                        <Button
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => toggleFcaSelectionLocal(rowKey)}
                        >
                          {isSelected ? "Selected" : "Select"}
                        </Button>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="block font-medium text-foreground">{p.subcomponent}</span>
                        <span className="block text-xs text-muted-foreground">{p.system}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_BADGE[p.condition]}`}
                        >
                          {CONDITION_LABEL[p.condition]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{p.installYear}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {p.atEol ? (
                          <span className="inline-flex rounded-full bg-status-critical/15 px-2 py-0.5 text-xs font-semibold text-status-critical">
                            EOL
                          </span>
                        ) : (
                          <span className="text-foreground">{p.rul} yr</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                        {formatUsd(p.cost)}
                      </td>
                    </tr>
                    )
                  })}
              {(isLively ? livelyFca.length : fca.length) === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {isLively
                      ? "No FCA recommendations are loaded for this campus."
                      : "No FCA components are at or near end of life for this assessment year."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ESA Projects */}
      <Card data-guide="capital-esa" className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-4 text-status-info" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">ESA Projects</h3>
            <span className="text-xs text-muted-foreground">Educational Suitability improvements</span>
          </div>
          <span className="rounded-md bg-muted px-2 py-1 text-sm font-bold tabular-nums text-foreground">
            {formatUsd(esaTotal)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Scope</th>
                <th className="px-4 py-2 text-right font-medium">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {esa.map((p) => (
                <tr key={p.name} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-pretty">{p.scope}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                    {formatUsd(p.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Grand total */}
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">Total Identified Capital Projects</span>
          <span className="text-xs text-muted-foreground">Full FCA and ESA backlog for this campus</span>
        </div>
        <span className="text-lg font-bold tabular-nums text-foreground">{formatUsd(grandTotal)}</span>
      </div>
    </section>
  )
}
