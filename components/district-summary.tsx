"use client"

import { useMemo } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"
import {
  Building2,
  GraduationCap,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  ClipboardList,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  DISTRICT_RATING_HEX,
  FCA_YEAR_MAX,
  FCA_YEAR_MIN,
  districtSchools,
} from "@/lib/district-data"
import { ROOM_CONDITION_LABEL, type RoomCondition } from "@/lib/dashboard-data"
import {
  districtScoreSummary,
  esaProjectsByRating,
  fcaCostBySchoolType,
  fcaEsaMatrix,
  formatDistrictCurrency,
  projectedFcaSeries,
  ratingDistributionChart,
} from "@/lib/district-summary"
import { median } from "@/lib/school-comparison"
import { FacilityNeedsDistrictCharts } from "@/components/facility-needs-district-charts"
import { DistrictEsaSpaceCharts } from "@/components/district-esa-space-charts"

const RATINGS: RoomCondition[] = ["good", "fair", "poor"]

const distChartConfig = {
  fca: { label: "FCA", color: "var(--chart-1)" },
  esa: { label: "ESA", color: "var(--chart-3)" },
  total: { label: "Total backlog", color: "var(--chart-1)" },
  increase: { label: "Deferral cost", color: "var(--chart-4)" },
  projects: { label: "Open projects", color: "var(--chart-2)" },
  elementary: { label: "Elementary", color: "var(--chart-1)" },
  middle: { label: "Middle", color: "var(--chart-3)" },
  high: { label: "High", color: "var(--chart-5)" },
}

export function DistrictSummary() {
  const stats = useMemo(() => districtScoreSummary(), [])
  const ratingData = useMemo(() => ratingDistributionChart(), [])
  const fcaSeries = useMemo(() => projectedFcaSeries(), [])
  const esaByRating = useMemo(() => esaProjectsByRating(), [])
  const fcaByType = useMemo(() => fcaCostBySchoolType(districtSchools, FCA_YEAR_MAX), [])
  const matrix = useMemo(() => fcaEsaMatrix(), [])

  const medians = useMemo(
    () => ({
      esa: median(stats.scatterPoints.map((p) => p.esa)),
      fci: median(stats.scatterPoints.map((p) => p.fci)),
    }),
    [stats.scatterPoints],
  )

  return (
    <div className="flex-1 overflow-y-auto bg-muted/20">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-5 sm:p-6">
        {/* KPI strip */}
        <div data-guide="summary-kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={Building2}
            label="Schools assessed"
            value={String(stats.schoolCount)}
            note={`${stats.poorFca} poor FCA · ${stats.poorEsa} poor ESA`}
          />
          <KpiCard
            icon={GraduationCap}
            label="District ESA score"
            value={`${stats.avgEsa}%`}
            note={`Median ${stats.medianEsa}% suitability`}
            tone="info"
          />
          <KpiCard
            icon={TrendingUp}
            label="District FCI (avg)"
            value={stats.avgFci.toFixed(2)}
            note={`Median ${stats.medianFci} · lower is better`}
            tone="warning"
          />
          <KpiCard
            icon={DollarSign}
            label={`FCA backlog (${FCA_YEAR_MAX})`}
            value={formatDistrictCurrency(stats.fcaProjected)}
            note={`+${stats.fcaIncreasePct}% vs ${FCA_YEAR_MIN} if deferred`}
            tone="critical"
          />
        </div>

        <div data-guide="summary-charts" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Rating distribution */}
          <Card className="gap-4 p-5">
            <SectionHead
              title="Condition ratings across the district"
              subtitle="How many schools fall in each FCA and ESA band today"
            />
            <ChartContainer config={distChartConfig} className="h-[280px] w-full">
              <BarChart data={ratingData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} className="stroke-border/60" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="fca" name="fca" fill="var(--color-fca)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="esa" name="esa" fill="var(--color-esa)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <RatingLegend />
          </Card>

          {/* Projected FCA deferral */}
          <Card className="gap-4 p-5">
            <SectionHead
              title="Projected FCA needs if deferred"
              subtitle={`Escalating backlog from ${FCA_YEAR_MIN} to ${FCA_YEAR_MAX} at 6% annual deferral`}
            />
            <ChartContainer config={distChartConfig} className="h-[280px] w-full">
              <AreaChart data={fcaSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fcaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-total)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-total)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} className="stroke-border/60" />
                <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatDistrictCurrency(v as number)}
                  width={56}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        if (name === "total") return [formatDistrictCurrency(Number(value)), "Total backlog"]
                        return [formatDistrictCurrency(Number(value)), "Added from deferral"]
                      }}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="total"
                  stroke="var(--color-total)"
                  fill="url(#fcaFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
            <p className="text-xs text-muted-foreground">
              Baseline {FCA_YEAR_MIN}:{" "}
              <span className="font-semibold text-foreground">{formatDistrictCurrency(stats.fcaBaseline)}</span>
              {" · "}
              Cost of waiting to {FCA_YEAR_MAX}:{" "}
              <span className="font-semibold text-destructive">
                +{formatDistrictCurrency(stats.fcaProjected - stats.fcaBaseline)}
              </span>
            </p>
          </Card>
        </div>

        {/* ESA vs FCI scatter */}
        <Card className="gap-4 p-5">
          <SectionHead
            title="ESA vs. FCI — every school"
            subtitle="Upper-right = strong suitability & condition · Lower-left = highest combined need"
          />
          <ChartContainer config={{ peer: { label: "Schools", color: "var(--chart-3)" } }} className="h-[360px] w-full">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis
                type="number"
                dataKey="esa"
                domain={[30, 100]}
                name="ESA"
                tickLine={false}
                axisLine={false}
                label={{
                  value: "Educational Suitability (ESA) %",
                  position: "insideBottom",
                  offset: -16,
                  className: "fill-muted-foreground text-[11px]",
                }}
              />
              <YAxis
                type="number"
                dataKey="fci"
                domain={[0, 0.55]}
                name="FCI"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => Number(v).toFixed(2)}
                label={{
                  value: "Facility Condition Index (FCI)",
                  angle: -90,
                  position: "insideLeft",
                  offset: 12,
                  className: "fill-muted-foreground text-[11px]",
                }}
              />
              <ZAxis type="number" dataKey="z" range={[24, 24]} />
              <ReferenceLine x={medians.esa} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.4} />
              <ReferenceLine y={medians.fci} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.4} />
              <ChartTooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as { name?: string } | undefined
                      return p?.name ?? "School"
                    }}
                    formatter={(value, name) => {
                      if (name === "fci") return [Number(value).toFixed(2), "FCI"]
                      return [`${value}%`, "ESA"]
                    }}
                  />
                }
              />
              <Scatter
                name="peer"
                data={stats.scatterPoints.map((p) => ({ ...p, z: 1 }))}
                fill="var(--color-peer)"
                fillOpacity={0.55}
              />
            </ScatterChart>
          </ChartContainer>
          <QuadrantLegend />
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* FCA × ESA heatmap */}
          <Card className="gap-4 p-5 xl:col-span-1">
            <SectionHead title="FCA × ESA overlap" subtitle="School counts by combined rating" />
            <MatrixHeatmap matrix={matrix} />
          </Card>

          {/* ESA projects */}
          <Card className="gap-4 p-5">
            <SectionHead
              title="Open ESA improvement projects"
              subtitle={`${stats.esaOpen} projects district-wide`}
              icon={ClipboardList}
            />
            <ChartContainer config={distChartConfig} className="h-[220px] w-full">
              <BarChart data={esaByRating} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} className="stroke-border/60" />
                <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={52} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="projects" name="projects" radius={[0, 4, 4, 0]}>
                  {esaByRating.map((row) => (
                    <Cell key={row.rating} fill={DISTRICT_RATING_HEX[row.rating]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </Card>

          {/* FCA by school level */}
          <Card className="gap-4 p-5">
            <SectionHead
              title={`Projected FCA need by level (${FCA_YEAR_MAX})`}
              subtitle="Deferred backlog stacked by school type"
              icon={AlertTriangle}
            />
            <ChartContainer config={distChartConfig} className="h-[220px] w-full">
              <BarChart data={fcaByType} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid vertical={false} className="stroke-border/60" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatDistrictCurrency(v as number)} width={52} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [formatDistrictCurrency(Number(value)), "Projected need"]}
                    />
                  }
                />
                <Bar dataKey="total" name="total" radius={[4, 4, 0, 0]}>
                  {fcaByType.map((_, i) => (
                    <Cell key={i} fill={`var(--chart-${i + 1})`} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </Card>
        </div>

        <FacilityNeedsDistrictCharts />

        <DistrictEsaSpaceCharts />
      </div>
    </div>
  )
}

function SectionHead({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string
  subtitle: string
  icon?: typeof Building2
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon && <Icon className="size-4 text-primary" aria-hidden="true" />}
        {title}
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof Building2
  label: string
  value: string
  note: string
  tone?: "info" | "warning" | "critical"
}) {
  const toneClass =
    tone === "critical"
      ? "border-status-critical/30 bg-status-critical/5"
      : tone === "warning"
        ? "border-status-warning/30 bg-status-warning/5"
        : tone === "info"
          ? "border-status-info/30 bg-status-info/5"
          : "border-border bg-card"

  return (
    <Card className={`gap-2 p-4 ${toneClass}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] leading-snug text-muted-foreground">{note}</p>
    </Card>
  )
}

function RatingLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-chart-1" /> FCA count
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-chart-3" /> ESA count
      </span>
      {RATINGS.map((r) => (
        <span key={r} className="flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ backgroundColor: DISTRICT_RATING_HEX[r] }} />
          {ROOM_CONDITION_LABEL[r]}
        </span>
      ))}
    </div>
  )
}

function QuadrantLegend() {
  return (
    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
      <span className="rounded-md border border-status-good/30 bg-status-good/10 px-2 py-1">High ESA · Low FCI</span>
      <span className="rounded-md border border-status-info/30 bg-status-info/10 px-2 py-1">High ESA · High FCI</span>
      <span className="rounded-md border border-status-warning/30 bg-status-warning/10 px-2 py-1">Low ESA · Low FCI</span>
      <span className="rounded-md border border-status-critical/30 bg-status-critical/10 px-2 py-1">Low ESA · High FCI</span>
    </div>
  )
}

function MatrixHeatmap({ matrix }: { matrix: ReturnType<typeof fcaEsaMatrix> }) {
  const max = Math.max(...RATINGS.flatMap((fca) => RATINGS.map((esa) => matrix[fca][esa])))

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full border-collapse text-center text-sm">
        <thead>
          <tr>
            <th className="bg-muted/50 p-2 text-[10px] font-medium text-muted-foreground" />
            {RATINGS.map((esa) => (
              <th key={esa} className="bg-muted/50 p-2 text-[10px] font-medium text-foreground">
                {ROOM_CONDITION_LABEL[esa]} ESA
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RATINGS.map((fca) => (
            <tr key={fca}>
              <th className="bg-muted/50 p-2 text-left text-[10px] font-medium text-foreground">
                {ROOM_CONDITION_LABEL[fca]} FCA
              </th>
              {RATINGS.map((esa) => {
                const count = matrix[fca][esa]
                const intensity = max > 0 ? count / max : 0
                return (
                  <td
                    key={esa}
                    className="border-l border-t border-border p-0"
                    style={{
                      backgroundColor:
                        count > 0
                          ? `color-mix(in oklab, var(--primary) ${Math.round(12 + intensity * 55)}%, var(--card))`
                          : undefined,
                    }}
                  >
                    <div className="flex h-14 flex-col items-center justify-center gap-0.5">
                      <span className="text-lg font-bold tabular-nums text-foreground">{count}</span>
                      <span className="text-[9px] text-muted-foreground">schools</span>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
