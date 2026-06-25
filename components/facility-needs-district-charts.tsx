"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Layers } from "lucide-react"
import { Card } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  FACILITY_NEEDS_BASE_YEAR,
  FACILITY_NEEDS_ESCALATION,
  FACILITY_SYSTEM_COLORS,
  FACILITY_SYSTEM_NAMES,
  facilitySystemChartConfig,
  stackedFacilityNeedsByEsa,
  stackedFacilityNeedsByFca,
  stackedFacilityNeedsBySchoolType,
  stackedFacilityNeedsByYear,
} from "@/lib/facility-needs-district"
import { formatDistrictCurrency } from "@/lib/district-summary"

const DIVISION_YEAR = 2034

const systemChartConfig = facilitySystemChartConfig()

export function FacilityNeedsDistrictCharts() {
  const byYear = useMemo(() => stackedFacilityNeedsByYear(), [])
  const byType = useMemo(() => stackedFacilityNeedsBySchoolType(DIVISION_YEAR), [])
  const byFca = useMemo(() => stackedFacilityNeedsByFca(DIVISION_YEAR), [])
  const byEsa = useMemo(() => stackedFacilityNeedsByEsa(DIVISION_YEAR), [])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Layers className="size-4 text-primary" aria-hidden="true" />
          Facility needs by system
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          District-wide capital needs by FCA system category — {(FACILITY_NEEDS_ESCALATION * 100).toFixed(1)}% annual
          escalation from {FACILITY_NEEDS_BASE_YEAR}, allocated using standard system mix
        </p>
      </div>

      <Card className="gap-4 p-5">
        <SectionLabel
          title="Total needs by plan year"
          subtitle="Stacked system categories showing how deferred backlog grows over time"
        />
        <StackedNeedsChart data={byYear} xKey="label" height={320} />
        <SystemLegend />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="gap-4 p-5">
          <SectionLabel title="By school level" subtitle={`System mix at ${DIVISION_YEAR}`} />
          <StackedNeedsChart data={byType} xKey="label" height={260} />
        </Card>
        <Card className="gap-4 p-5">
          <SectionLabel title="By FCA rating" subtitle={`Needs concentration at ${DIVISION_YEAR}`} />
          <StackedNeedsChart data={byFca} xKey="label" height={260} />
        </Card>
        <Card className="gap-4 p-5">
          <SectionLabel title="By ESA rating" subtitle={`Suitability band at ${DIVISION_YEAR}`} />
          <StackedNeedsChart data={byEsa} xKey="label" height={260} />
        </Card>
      </div>
    </div>
  )
}

function SectionLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function StackedNeedsChart({
  data,
  xKey,
  height = 280,
}: {
  data: Record<string, string | number>[]
  xKey: string
  height?: number
}) {
  return (
    <ChartContainer config={systemChartConfig} className="w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} className="stroke-border/60" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatDistrictCurrency(v as number)}
          width={56}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => [formatDistrictCurrency(Number(value)), String(name)]}
            />
          }
        />
        {FACILITY_SYSTEM_NAMES.map((name, idx) => (
          <Bar
            key={name}
            dataKey={name}
            name={name}
            stackId="needs"
            fill={FACILITY_SYSTEM_COLORS[name]}
            radius={
              idx === 0
                ? [0, 0, 4, 4]
                : idx === FACILITY_SYSTEM_NAMES.length - 1
                  ? [4, 4, 0, 0]
                  : undefined
            }
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

function SystemLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3">
      {FACILITY_SYSTEM_NAMES.map((name) => (
        <span key={name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className="size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: FACILITY_SYSTEM_COLORS[name] }}
            aria-hidden="true"
          />
          {name}
        </span>
      ))}
    </div>
  )
}
