"use client"

import { useMemo, type ReactNode } from "react"
import {
  ArrowLeft,
  Printer,
  MapPin,
  CalendarClock,
  Ruler,
  GraduationCap,
  Users,
  Building2,
  DollarSign,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  Map as MapIcon,
  ChartScatter,
  Hammer,
} from "lucide-react"
import {
  type School,
  type StatusLevel,
  type RoomCondition,
  STATUS_BAR,
  STATUS_TEXT,
  STATUS_DOT,
  scoreToStatus,
  spaceSufficiencyAverage,
  districtSpaceSufficiency,
  floorPlanRooms,
  floorPlanDisplaySrc,
  floorPlanViewBox,
  floorPlanHasRoomOverlays,
  ROOM_CONDITION_FILL,
  ROOM_CONDITION_LABEL,
  ROOM_CONDITION_TEXT,
  ROOM_CONDITION_BAR,
} from "@/lib/dashboard-data"
import {
  fcaProjects,
  fcaProjectsTotal,
  esaProjectsTotal,
  renovationCost,
  newConstructionCost,
  formatUsd,
  formatCompactUsd,
} from "@/lib/capital-projects"
import { buildCapitalPlanReportRows, capitalPlanReportTotal } from "@/lib/export-data"
import type { SchoolCapitalPlanState } from "@/lib/capital-plan-store"
import { formatNumber, formatMillions, formatRange } from "@/lib/format"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SchoolComparisonCharts } from "@/components/school-comparison-charts"

interface SchoolReportProps {
  school: School
  onBack?: () => void
  showActions?: boolean
  includeCapitalPlan?: boolean
  capitalPlan?: SchoolCapitalPlanState
}

const STATUS_LABEL: Record<StatusLevel, string> = {
  critical: "Critical",
  warning: "Needs Attention",
  info: "Fair",
  good: "Good",
}

/** Pull the Facility Condition Score out of the portfolio metric set. */
function facilityCondition(school: School): { value: string; status: StatusLevel } {
  const m = school.portfolio.find((p) => /Facility Condition/i.test(p.label))
  return { value: m?.value ?? "—", status: m?.color ?? "info" }
}

export function SchoolReport({
  school,
  onBack,
  showActions = true,
  includeCapitalPlan = false,
  capitalPlan,
}: SchoolReportProps) {
  const generatedOn = useMemo(
    () => new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    [],
  )

  const eaStatus = scoreToStatus(school.eaOverall)
  const spaceAvg = spaceSufficiencyAverage(school.spaceSufficiency)
  const spaceStatus = scoreToStatus(spaceAvg)
  const fc = facilityCondition(school)
  const utilStatus: StatusLevel = school.utilPe > 100 ? "warning" : school.utilPe >= 70 ? "good" : "info"

  const fcaTotal = useMemo(() => fcaProjectsTotal(school), [school])
  const esaTotal = useMemo(() => esaProjectsTotal(school), [school])
  const combinedNeeds = faTotalSafe(fcaTotal, esaTotal)
  const priority = useMemo(() => fcaProjects(school).slice(0, 6), [school])

  const reno = renovationCost(school)
  const newBuild = newConstructionCost(school)

  const systemsSorted = useMemo(
    () => [...school.systems].sort((a, b) => b.pctOfTotal - a.pctOfTotal),
    [school.systems],
  )
  const maxSystemHigh = systemsSorted[0]?.high ?? 1

  const kpis: { label: string; value: string; sub: string; status: StatusLevel }[] = [
    {
      label: "Educational Adequacy",
      value: `${school.eaOverall.toFixed(0)}%`,
      sub: "Overall suitability score",
      status: eaStatus,
    },
    {
      label: "Space Sufficiency",
      value: `${spaceAvg}%`,
      sub: `vs. ${spaceSufficiencyAverage(districtSpaceSufficiency)}% district avg`,
      status: spaceStatus,
    },
    {
      label: "Facility Condition",
      value: fc.value,
      sub: "Lower score = poorer condition",
      status: fc.status,
    },
    {
      label: "Utilization (PE)",
      value: `${school.utilPe}%`,
      sub: `${formatNumber(school.enrollment)} of ${formatNumber(school.peCapacity)} seats`,
      status: utilStatus,
    },
  ]

  const recommendations = buildRecommendations(school, {
    eaStatus,
    spaceStatus,
    fcStatus: fc.status,
    reno,
    newBuild,
    combinedNeeds,
  })

  // ESA (Educational Suitability Assessment) points overlaid on the floor plan.
  const esaRooms = useMemo(() => [...floorPlanRooms].sort((a, b) => a.id.localeCompare(b.id)), [])
  const esaAvg = useMemo(
    () =>
      esaRooms.length ? Math.round(esaRooms.reduce((s, r) => s + r.eaScore, 0) / esaRooms.length) : 0,
    [esaRooms],
  )
  const esaCounts = useMemo(() => {
    const c: Record<RoomCondition, number> = { good: 0, fair: 0, poor: 0 }
    esaRooms.forEach((r) => {
      c[r.condition] += 1
    })
    return c
  }, [esaRooms])

  const planRows = useMemo(() => {
    if (!includeCapitalPlan || !capitalPlan) return []
    return buildCapitalPlanReportRows(school, capitalPlan)
  }, [includeCapitalPlan, capitalPlan, school])
  const planTotal = useMemo(() => capitalPlanReportTotal(planRows), [planRows])

  const planDisplaySrc = floorPlanDisplaySrc(school)
  const planVb = floorPlanViewBox(school)
  const showPlanOverlays = floorPlanHasRoomOverlays(school)

  return (
    <div className="flex flex-col gap-6">
      {/* Action bar — hidden when printing */}
      {showActions && onBack ? (
      <div data-guide="school-report-actions" className="no-print flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Dashboard
        </Button>
        <Button size="sm" onClick={() => window.print()} className="gap-1.5">
          <Printer className="size-4" aria-hidden="true" />
          Print / Export PDF
        </Button>
      </div>
      ) : null}

      {/* Report sheet */}
      <article data-guide="school-report-content" className="report-sheet mx-auto w-full max-w-[1000px] rounded-xl border border-border bg-card p-6 shadow-sm sm:p-10">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-border pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/images/aisd-logo.jpg" alt="Austin ISD logo" className="h-12 w-auto shrink-0" />
              <div className="border-l border-border pl-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Facility Assessment Summary
                </p>
                <h1 className="text-pretty text-2xl font-semibold text-foreground">{school.name}</h1>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Austin ISD</p>
              <p>Assessment year {school.needsYear}</p>
              <p>Generated {generatedOn}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Fact icon={MapPin} label="Address" value={school.address} />
            <Fact icon={GraduationCap} label="Grades" value={school.gradesServed} />
            <Fact icon={CalendarClock} label="Building Age" value={`${school.age} years`} />
            <Fact icon={Ruler} label="Square Footage" value={formatNumber(school.squareFootage)} />
          </dl>
        </header>

        {/* Executive summary KPIs */}
        <Section title="Executive Summary" icon={TrendingUp}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="flex flex-col gap-1 rounded-lg border border-border bg-background p-4">
                <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                <span className={`text-2xl font-semibold tabular-nums ${STATUS_TEXT[k.status]}`}>{k.value}</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={`size-2 rounded-full ${STATUS_DOT[k.status]}`} aria-hidden="true" />
                  {STATUS_LABEL[k.status]}
                </span>
                <span className="mt-1 text-[11px] leading-snug text-muted-foreground">{k.sub}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Enrollment & capacity */}
        <Section title="Enrollment & Capacity" icon={Users}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Current Enrollment" value={formatNumber(school.enrollment)} note={school.enrollmentDate} />
            <Stat label="Original Capacity" value={formatNumber(school.originalCapacity)} note={`${school.utilOriginal}% utilized`} />
            <Stat label="Program Capacity" value={formatNumber(school.peCapacity)} note={`${school.utilPe}% utilized`} />
            <Stat
              label="Seats Available"
              value={formatNumber(Math.max(0, school.peCapacity - school.enrollment))}
              note="vs. program capacity"
            />
          </div>
        </Section>

        {/* Capital needs overview */}
        <Section title="Capital Needs Overview" icon={DollarSign}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <BigStat
              icon={Building2}
              label="Total Identified Needs"
              value={formatRange(school.totalNeedsLow, school.totalNeedsHigh)}
              note={`Projected to ${school.needsYear}`}
              status="warning"
            />
            <BigStat
              icon={AlertTriangle}
              label="FCA Deficiency Projects"
              value={formatCompactUsd(fcaTotal)}
              note="At or near end of life"
              status="critical"
            />
            <BigStat
              icon={ClipboardList}
              label="ESA Suitability Projects"
              value={formatCompactUsd(esaTotal)}
              note="Educational improvements"
              status="info"
            />
          </div>

          {/* Renovation vs new construction */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CompareCard label="Full Renovation Estimate" value={formatUsd(reno)} note="Based on $690 / sq ft" />
            <CompareCard label="New Construction Estimate" value={formatUsd(newBuild)} note="Based on $950 / sq ft" />
          </div>
        </Section>

        {includeCapitalPlan && planRows.length > 0 && (
          <Section title="Selected Capital Plan" icon={Hammer}>
            <p className="mb-3 text-sm text-muted-foreground">
              Scoped renovation areas and individually selected FCA projects from Capital Planning.
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">Type</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Item</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Detail</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {planRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 capitalize text-muted-foreground">
                        {row.kind === "area" ? "Floor area" : "FCA project"}
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">{row.label}</td>
                      <td className="px-3 py-2 text-muted-foreground text-pretty">{row.detail}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                        {formatUsd(row.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30">
                    <td colSpan={3} className="px-3 py-2 text-right text-sm font-semibold text-foreground">
                      Plan total
                    </td>
                    <td className="px-3 py-2 text-right text-base font-bold tabular-nums text-primary">
                      {formatUsd(planTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>
        )}

        {/* Facility needs by system */}
        <Section title="Facility Needs by System" icon={Building2}>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">System</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Est. Need ($M)</th>
                  <th className="hidden px-3 py-2 font-medium text-muted-foreground sm:table-cell">Share of Total</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">% Total</th>
                </tr>
              </thead>
              <tbody>
                {systemsSorted.map((s) => (
                  <tr key={s.name} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{s.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatMillions(s.low)} - {formatMillions(s.high)}
                    </td>
                    <td className="hidden px-3 py-2 sm:table-cell">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-status-track">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.round((s.high / maxSystemHigh) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{s.pctOfTotal}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Priority deficiencies */}
        <Section title="Priority Deficiencies" icon={AlertTriangle}>
          {priority.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No components are at or near end of life for the {school.needsYear} assessment.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">Component</th>
                    <th className="hidden px-3 py-2 font-medium text-muted-foreground sm:table-cell">System</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {priority.map((p) => (
                    <tr key={`${p.system}-${p.subcomponent}`} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground">{p.subcomponent}</td>
                      <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">{p.system}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                          <span className={`size-2 rounded-full ${STATUS_DOT[p.condition]}`} aria-hidden="true" />
                          <span className={STATUS_TEXT[p.condition]}>
                            {p.atEol ? "Past EOL" : `${p.rul} yr${p.rul === 1 ? "" : "s"} left`}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">{formatCompactUsd(p.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Educational adequacy breakdown */}
        <Section title="Educational Adequacy by Category" icon={GraduationCap}>
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {school.eaCategories.map((c) => {
              const st = scoreToStatus(c.score)
              return (
                <div key={c.name} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span className={`font-semibold tabular-nums ${STATUS_TEXT[st]}`}>{c.score}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-status-track">
                    <div className={`h-full rounded-full ${STATUS_BAR[st]}`} style={{ width: `${c.score}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Recommendations */}
        <Section title="Summary & Recommendations" icon={ClipboardList}>
          <ul className="flex flex-col gap-2">
            {recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS_DOT[r.status]}`} aria-hidden="true" />
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </Section>

        <footer className="mt-8 border-t border-border pt-4 text-[11px] text-muted-foreground">
          This summary is generated from the district's Facility Condition Assessment (FCA) and Educational Suitability
          Assessment (ESA) data. Cost figures are planning-level estimates for prioritization purposes.
        </footer>
      </article>

      {/* ---------------------------- Page 2 ---------------------------- */}
      <article className="report-sheet report-page-break mx-auto w-full max-w-[1000px] rounded-xl border border-border bg-card p-6 shadow-sm sm:p-10">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <img src="/images/aisd-logo.jpg" alt="Austin ISD logo" className="h-12 w-auto shrink-0" />
            <div className="border-l border-border pl-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Educational Suitability Assessment
              </p>
              <h1 className="text-pretty text-2xl font-semibold text-foreground">{school.name} — Floor Plan</h1>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Austin ISD</p>
            <p>ESA points by room suitability</p>
            <p>Generated {generatedOn}</p>
          </div>
        </header>

        {/* ESA point summary */}
        <Section title="ESA Point Summary" icon={MapPin}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rooms Assessed" value={String(esaRooms.length)} note="ESA points placed" />
            <Stat label="Avg. Suitability" value={`${esaAvg}%`} note="Mean room EA score" />
            <Stat label="Good vs. Poor" value={`${esaCounts.good} / ${esaCounts.poor}`} note="Good / Poor rooms" />
            <Stat label="Fair" value={String(esaCounts.fair)} note="Rooms needing attention" />
          </div>
        </Section>

        {/* Floor plan */}
        <Section title={showPlanOverlays ? "Floor Plan — ESA Points" : "Floor Plan"} icon={MapIcon}>
          {showPlanOverlays && (
          <div className="mb-3 flex flex-wrap items-center gap-4">
            {(["good", "fair", "poor"] as RoomCondition[]).map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`size-3 rounded-full ${ROOM_CONDITION_BAR[c]}`} aria-hidden="true" />
                {ROOM_CONDITION_LABEL[c]}
              </span>
            ))}
          </div>
          )}

          <div
            className="relative w-full overflow-hidden rounded-lg border border-border bg-card"
            style={{ aspectRatio: `${planVb.w} / ${planVb.h}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={planDisplaySrc || "/placeholder.svg"}
              alt={`${school.name} floor plan${showPlanOverlays ? " with ESA assessment points" : ""}`}
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
            {showPlanOverlays && (
            <svg
              viewBox={`${planVb.x} ${planVb.y} ${planVb.w} ${planVb.h}`}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 h-full w-full"
            >
              {esaRooms.map((room) => (
                <g key={room.id}>
                  <circle
                    cx={room.x}
                    cy={room.y}
                    r={90}
                    fill={ROOM_CONDITION_FILL[room.condition]}
                    fillOpacity={0.85}
                    stroke="#ffffff"
                    strokeWidth={8}
                  />
                  <text
                    x={room.x}
                    y={room.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={64}
                    fontWeight={700}
                    fill="#ffffff"
                  >
                    {room.id}
                  </text>
                </g>
              ))}
            </svg>
            )}
          </div>
        </Section>

        {/* ESA points by room */}
        <Section title="ESA Points by Room" icon={GraduationCap}>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">Room</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="hidden px-3 py-2 text-right font-medium text-muted-foreground sm:table-cell">Sq Ft</th>
                  <th className="hidden px-3 py-2 text-right font-medium text-muted-foreground sm:table-cell">Capacity</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">EA Score</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Condition</th>
                </tr>
              </thead>
              <tbody>
                {esaRooms.map((room) => (
                  <tr key={room.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground tabular-nums">{room.id}</td>
                    <td className="px-3 py-2 text-foreground">{room.name}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">
                      {formatNumber(room.sqft)}
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">
                      {room.capacity}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{room.eaScore}%</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span className={`size-2 rounded-full ${ROOM_CONDITION_BAR[room.condition]}`} aria-hidden="true" />
                        <span className={ROOM_CONDITION_TEXT[room.condition]}>{ROOM_CONDITION_LABEL[room.condition]}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="District Comparison" icon={ChartScatter}>
          <SchoolComparisonCharts school={school} />
        </Section>

        <footer className="mt-8 border-t border-border pt-4 text-[11px] text-muted-foreground">
          ESA points reflect room-level Educational Suitability scores from the most recent walkthrough. Marker color
          indicates the overall suitability condition for each assessed space.
        </footer>
      </article>
    </div>
  )
}

/* ----------------------------- sub-components ----------------------------- */

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Building2
  children: ReactNode
}) {
  return (
    <section className="report-section mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  )
}

function Fact({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5 text-primary" aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-pretty text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-background p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-[11px] text-muted-foreground">{note}</span>
    </div>
  )
}

function BigStat({
  icon: Icon,
  label,
  value,
  note,
  status,
}: {
  icon: typeof Building2
  label: string
  value: string
  note: string
  status: StatusLevel
}) {
  return (
    <Card className="gap-2 p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className={`text-2xl font-semibold tabular-nums ${STATUS_TEXT[status]}`}>{value}</span>
      <span className="text-[11px] text-muted-foreground">{note}</span>
    </Card>
  )
}

function CompareCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{note}</span>
      </div>
      <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  )
}

/* ------------------------------- helpers --------------------------------- */

/** Safe sum guarding against NaN inputs. */
function faTotalSafe(a: number, b: number): number {
  return (Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0)
}

interface RecoContext {
  eaStatus: StatusLevel
  spaceStatus: StatusLevel
  fcStatus: StatusLevel
  reno: number
  newBuild: number
  combinedNeeds: number
}

/** Derive plain-language recommendations from the school's scores. */
function buildRecommendations(
  school: School,
  ctx: RecoContext,
): { text: string; status: StatusLevel }[] {
  const out: { text: string; status: StatusLevel }[] = []

  if (ctx.fcStatus === "critical" || ctx.fcStatus === "warning") {
    out.push({
      status: "critical",
      text: `Facility condition is a priority concern. Address ${formatCompactUsd(
        fcaProjectsTotal(school),
      )} in end-of-life building systems, prioritizing past-EOL components first.`,
    })
  } else {
    out.push({
      status: "good",
      text: "Building systems are in generally serviceable condition; maintain a routine lifecycle replacement schedule.",
    })
  }

  if (ctx.eaStatus === "critical" || ctx.eaStatus === "warning") {
    out.push({
      status: "warning",
      text: `Educational adequacy (${school.eaOverall.toFixed(
        0,
      )}%) falls below district expectations. Invest in suitability projects to modernize learning environments.`,
    })
  } else if (ctx.eaStatus === "info") {
    out.push({
      status: "info",
      text: `Educational adequacy (${school.eaOverall.toFixed(
        0,
      )}%) is fair. Targeted suitability improvements would lift the lowest-scoring program spaces.`,
    })
  } else {
    out.push({
      status: "good",
      text: `Educational adequacy (${school.eaOverall.toFixed(0)}%) meets or exceeds district norms.`,
    })
  }

  if (school.utilPe > 100) {
    out.push({
      status: "warning",
      text: `Enrollment exceeds program capacity (${school.utilPe}% utilized). Evaluate boundary adjustments or capacity expansion.`,
    })
  } else if (school.utilPe < 60) {
    out.push({
      status: "info",
      text: `Utilization is low (${school.utilPe}%). Consider consolidation or repurposing of underused space.`,
    })
  } else {
    out.push({
      status: "good",
      text: `Utilization (${school.utilPe}%) is within a healthy operating range.`,
    })
  }

  // Renovation vs replacement guidance.
  const ratio = ctx.newBuild > 0 ? ctx.reno / ctx.newBuild : 0
  if (ratio >= 0.6) {
    out.push({
      status: "warning",
      text: `Full renovation (${formatCompactUsd(ctx.reno)}) approaches the cost of new construction (${formatCompactUsd(
        ctx.newBuild,
      )}). A replacement study is warranted.`,
    })
  } else {
    out.push({
      status: "info",
      text: `Renovation (${formatCompactUsd(ctx.reno)}) remains substantially cheaper than replacement (${formatCompactUsd(
        ctx.newBuild,
      )}), favoring targeted modernization.`,
    })
  }

  return out
}
