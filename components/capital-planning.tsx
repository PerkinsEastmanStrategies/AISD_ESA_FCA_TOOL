"use client"

import { useMemo, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { CheckCircle2, GitBranch, ClipboardList } from "lucide-react"
import { schools } from "@/lib/schools-list"
import {
  DEFAULT_THRESHOLDS,
  PLANNING_NODES,
  PLANNING_EDGES,
  FLOW_META,
  evaluate,
  classifyDistrictSchools,
  type PlanningThresholds,
  type FlowGroup,
} from "@/lib/capital-planning"
import { AppHeader, SegmentedTabs } from "@/components/app-header"
import { PageGuide } from "@/components/page-guide"
import { CapitalPlanningTable } from "@/components/capital-planning-table"
import { CapitalProjects } from "@/components/capital-projects"
import { Slider } from "@/components/ui/slider"

interface CapitalPlanningProps {
  selectedId: string
  onSelectSchool: (id: string | null) => void
  onOpenMap: () => void
  onOpenSchoolView: () => void
  onOpenExports: () => void
}

// ---- Custom node data ----
interface FlowNodeData extends Record<string, unknown> {
  label: string
  chip?: string
  active: boolean
  isOutcome: boolean
  isRecommended: boolean
  branch?: "yes" | "no"
}

function StartNode({ data }: NodeProps) {
  const d = data as FlowNodeData
  return (
    <div className="flex h-14 w-32 items-center justify-center rounded-md border-2 border-status-good bg-status-good/10 text-center text-xs font-semibold text-foreground">
      {d.label}
      <Handle type="source" position={Position.Right} className="!bg-status-good" />
    </div>
  )
}

function DecisionNode({ data }: NodeProps) {
  const d = data as FlowNodeData
  return (
    <div
      className={`flex w-44 flex-col items-center gap-1.5 rounded-md border bg-card px-3 py-2.5 text-center shadow-sm transition-all ${
        d.active ? "border-primary ring-2 ring-primary/40" : "border-border"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <span className="text-[11px] font-medium leading-tight text-foreground text-pretty">{d.label}</span>
      {d.chip && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground">
          {d.chip}
        </span>
      )}
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </div>
  )
}

function OutcomeNode({ data }: NodeProps) {
  const d = data as FlowNodeData
  return (
    <div
      className={`flex w-44 items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-center text-xs font-semibold transition-all ${
        d.isRecommended
          ? "bg-primary text-primary-foreground ring-4 ring-primary/30"
          : d.active
            ? "bg-primary text-primary-foreground"
            : "bg-primary/30 text-primary-foreground/80"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      {d.isRecommended && <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
      <span className="leading-tight text-balance">{d.label}</span>
    </div>
  )
}

function GroupLabelNode({ data }: NodeProps) {
  const d = data as { title: string; subtitle: string }
  return (
    <div className="pointer-events-none text-center">
      <p className="text-sm font-bold tracking-wide text-foreground">{d.title}</p>
      <p className="text-xs font-medium text-muted-foreground">{d.subtitle}</p>
    </div>
  )
}

const nodeTypes = { start: StartNode, decision: DecisionNode, outcome: OutcomeNode, grouplabel: GroupLabelNode }

/** Title-label positions above each flow cluster. */
const GROUP_LABEL_POSITIONS: Record<FlowGroup, { x: number; y: number }> = {
  flow1: { x: 150, y: 90 },
  flow2: { x: 900, y: -180 },
  flow3: { x: 900, y: 320 },
  flow4: { x: 720, y: 660 },
}

// ---- Slider configuration ----
interface SliderDef {
  key: keyof PlanningThresholds
  label: string
  min: number
  max: number
  step: number
  unit?: string
}

const FLOW_SLIDERS: Record<FlowGroup, { title: string; color: string; sliders: SliderDef[] }> = {
  flow1: {
    title: "Flow 1: Decision Routing",
    color: "text-primary",
    sliders: [
      { key: "currentUtilThreshold", label: "Current Utilization Threshold", min: 25, max: 100, step: 1, unit: "%" },
      { key: "highUtilThreshold", label: "High Utilization Threshold", min: 25, max: 100, step: 1, unit: "%" },
      { key: "growthThreshold", label: "Enrollment Growth Threshold", min: 0, max: 20, step: 1, unit: "%" },
    ],
  },
  flow2: {
    title: "Flow 2: Expansion",
    color: "text-foreground",
    sliders: [
      { key: "attendanceAreaEnrollment", label: "Attendance Area Enrollment", min: 0, max: 100, step: 1, unit: "%" },
      { key: "expansionComposite", label: "Composite Building Score", min: 0, max: 10, step: 0.5 },
      { key: "expansionEA", label: "Educational Adequacy", min: 0, max: 100, step: 1, unit: "%" },
    ],
  },
  flow3: {
    title: "Flow 3: Maintenance / Investment",
    color: "text-status-warning",
    sliders: [
      { key: "compositeAbove", label: "Composite Building Score Above Threshold", min: 0, max: 10, step: 0.5 },
      { key: "compositeBelow", label: "Composite Building Score Below Threshold", min: 0, max: 10, step: 0.5 },
      { key: "flow3EA", label: "Educational Adequacy (Flow 3 only)", min: 0, max: 100, step: 1, unit: "%" },
    ],
  },
  flow4: {
    title: "Flow 4: Closure / Consolidation",
    color: "text-status-critical",
    sliders: [
      { key: "closureComposite", label: "Composite Building Score", min: 0, max: 10, step: 0.5 },
      { key: "welcomingDistance", label: "Distance to Welcoming Schools", min: 0, max: 10, step: 0.5, unit: " mi" },
    ],
  },
}

type CapitalPlanningView = "flow" | "projects"

const CAPITAL_VIEW_TABS: { id: CapitalPlanningView; label: string; icon: typeof GitBranch }[] = [
  { id: "projects", label: "School Projects", icon: ClipboardList },
  { id: "flow", label: "Flow Diagram", icon: GitBranch },
]

export function CapitalPlanning({ selectedId, onSelectSchool, onOpenMap, onOpenSchoolView, onOpenExports }: CapitalPlanningProps) {
  const [thresholds, setThresholds] = useState<PlanningThresholds>(DEFAULT_THRESHOLDS)
  const [capitalView, setCapitalView] = useState<CapitalPlanningView>("projects")
  const school = schools.find((s) => s.id === selectedId) ?? schools[0]

  const result = useMemo(() => evaluate(school, thresholds), [school, thresholds])

  // Every district (GeoJSON) school classified under the current slider thresholds.
  const tableRows = useMemo(() => classifyDistrictSchools(thresholds), [thresholds])

  const setValue = (key: keyof PlanningThresholds, value: number) =>
    setThresholds((prev) => ({ ...prev, [key]: value }))

  // Build React Flow nodes with live active state and threshold chips.
  const nodes: Node[] = useMemo(() => {
    const activeSet = new Set(result.activeNodes)
    const labelNodes: Node[] = (Object.keys(GROUP_LABEL_POSITIONS) as FlowGroup[]).map((g) => ({
      id: `label-${g}`,
      type: "grouplabel",
      position: GROUP_LABEL_POSITIONS[g],
      data: { title: FLOW_META[g].title, subtitle: FLOW_META[g].subtitle },
      draggable: false,
      selectable: false,
    }))
    const flowNodes = PLANNING_NODES.map((n) => {
      const chip =
        n.thresholdKey !== undefined
          ? `${thresholds[n.thresholdKey]}${n.unit ?? ""}`
          : undefined
      return {
        id: n.id,
        type: n.kind,
        position: n.position,
        data: {
          label: n.label,
          chip,
          active: activeSet.has(n.id),
          isOutcome: n.kind === "outcome",
          isRecommended: n.id === result.outcome,
        } satisfies FlowNodeData,
        draggable: true,
      }
    })
    return [...labelNodes, ...flowNodes]
  }, [result, thresholds])

  // Build edges, coloring by branch and emphasizing the active path.
  const edges: Edge[] = useMemo(() => {
    const activeEdgeSet = new Set(result.activeEdges)
    return PLANNING_EDGES.map((e) => {
      const onPath = activeEdgeSet.has(e.id)
      const base =
        e.branch === "yes"
          ? "var(--color-status-good)"
          : e.branch === "no"
            ? "var(--color-status-critical)"
            : "var(--color-muted-foreground)"
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        animated: onPath,
        style: {
          stroke: base,
          strokeWidth: onPath ? 3 : 1.25,
          opacity: onPath ? 1 : 0.25,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: base, width: 16, height: 16 },
      }
    })
  }, [result])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader
        title="Capital Planning"
        subtitle={
          capitalView === "flow"
            ? "Strategic sorting flow — adjust thresholds to route decisions"
            : "School-level FCA and ESA project identification"
        }
        current="capital"
        selectedSchoolId={selectedId}
        onSelectSchool={(id) => onSelectSchool(id)}
        onMap={onOpenMap}
        onSchool={onOpenSchoolView}
        onCapital={() => {}}
        onExports={onOpenExports}
        subNav={
          <div data-guide="capital-subnav">
            <SegmentedTabs
              ariaLabel="Capital planning view"
              tabs={CAPITAL_VIEW_TABS}
              value={capitalView}
              onChange={setCapitalView}
            />
          </div>
        }
      />

      <PageGuide guideId={capitalView === "projects" ? "capital-projects" : "capital-flow"} />

      {capitalView === "projects" ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border bg-card px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">School-Level Project Identification</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              FCA recommendations, ESA projects, and scoped renovation estimates for {school.name}
            </p>
          </div>
          <CapitalProjects school={school} />
        </div>
      ) : (
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Strategic Sorting sidebar */}
        <aside
          data-guide="capital-thresholds"
          className="flex w-full shrink-0 flex-col gap-4 border-b border-border bg-card p-4 lg:sticky lg:top-32 lg:h-[calc(100vh-8rem)] lg:w-80 lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Strategic Sorting</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Threshold routing for <span className="font-medium text-foreground">{school.name}</span>
          </p>

          {/* Recommendation summary */}
          <div className="flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended Path</span>
            <span className="text-sm font-semibold text-primary text-balance">{result.outcomeLabel}</span>
          </div>

          {/* Slider groups */}
          {(Object.keys(FLOW_SLIDERS) as FlowGroup[]).map((group) => {
            const cfg = FLOW_SLIDERS[group]
            return (
              <div key={group} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <h3 className={`text-xs font-semibold ${cfg.color}`}>{cfg.title}</h3>
                {cfg.sliders.map((s) => (
                  <div key={s.key} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground text-pretty">{s.label}</label>
                      <span className="text-xs font-semibold tabular-nums text-foreground">
                        {thresholds[s.key] as number}
                        {s.unit ?? ""}
                      </span>
                    </div>
                    <Slider
                      value={[thresholds[s.key] as number]}
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      onValueChange={(v) => {
                        const next = Array.isArray(v) ? v[0] : v
                        if (Number.isFinite(next)) setValue(s.key, next as number)
                      }}
                      aria-label={s.label}
                    />
                  </div>
                ))}
                {group === "flow1" && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={thresholds.includePK}
                      onChange={(e) => setThresholds((prev) => ({ ...prev, includePK: e.target.checked }))}
                      className="size-4 rounded border-border accent-primary"
                    />
                    Include PK in enrollment
                  </label>
                )}
              </div>
            )
          })}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div data-guide="capital-flow-diagram" className="relative h-[70vh] min-h-[460px] w-full shrink-0 overflow-hidden">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.2}
              proOptions={{ hideAttribution: true }}
              nodesConnectable={false}
              edgesFocusable={false}
            >
              <Background color="var(--color-border)" gap={20} />
              <Controls showInteractive={false} />
            </ReactFlow>

            {/* Slide-up classification table */}
            <CapitalPlanningTable rows={tableRows} />
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
