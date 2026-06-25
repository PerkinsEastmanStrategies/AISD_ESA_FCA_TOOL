"use client"

import { useMemo } from "react"
import {
  CartesianGrid,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  buildSchoolComparisonPoints,
  comparisonSchoolId,
  median,
  rankAmong,
  type SchoolComparisonPoint,
} from "@/lib/school-comparison"
import type { School } from "@/lib/dashboard-data"

interface SchoolComparisonChartsProps {
  school: School
}

const chartConfig = {
  peer: { label: "District schools", color: "var(--chart-3)" },
  selected: { label: "Selected school", color: "var(--chart-1)" },
}

export function SchoolComparisonCharts({ school }: SchoolComparisonChartsProps) {
  const selectedId = comparisonSchoolId(school)

  const { peers, selected, medians, ranks, total } = useMemo(() => {
    const points = buildSchoolComparisonPoints()
    const selectedPoint = points.find((p) => p.id === selectedId) ?? null
    const peerPoints = points.filter((p) => p.id !== selectedId)
    const allEsa = points.map((p) => p.esa)
    const allFci = points.map((p) => p.fci)

    return {
      peers: peerPoints,
      selected: selectedPoint,
      medians: { esa: median(allEsa), fci: median(allFci) },
      ranks: selectedPoint
        ? {
            esa: rankAmong(allEsa, selectedPoint.esa, true),
            fci: rankAmong(allFci, selectedPoint.fci, false),
          }
        : null,
      total: points.length,
    }
  }, [selectedId])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Each dot is a district school. Higher ESA and lower FCI indicate stronger overall performance.
          </p>
        </div>
        {selected && ranks && (
          <div className="flex flex-wrap gap-2 text-xs">
            <RankPill label="ESA rank" value={`${ranks.esa} of ${total}`} />
            <RankPill label="FCI rank" value={`${ranks.fci} of ${total}`} note="lower FCI is better" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:p-5">
        <ChartContainer config={chartConfig} className="aspect-[4/3] h-[min(420px,60vh)] w-full max-h-[420px]">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
            <XAxis
              type="number"
              dataKey="esa"
              name="ESA"
              domain={[30, 100]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
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
              name="FCI"
              domain={[0, 0.55]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => v.toFixed(2)}
              label={{
                value: "Facility Condition Index (FCI)",
                angle: -90,
                position: "insideLeft",
                offset: 12,
                className: "fill-muted-foreground text-[11px]",
              }}
            />
            <ZAxis type="number" dataKey="z" range={[48, 220]} />
            <ReferenceLine
              x={medians.esa}
              stroke="var(--color-muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.45}
            />
            <ReferenceLine
              y={medians.fci}
              stroke="var(--color-muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.45}
            />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const point = payload?.[0]?.payload as SchoolComparisonPoint | undefined
                    return point?.name ?? "School"
                  }}
                  formatter={(value, name) => {
                    if (name === "fci") return [Number(value).toFixed(2), "FCI"]
                    return [`${value}%`, "ESA"]
                  }}
                />
              }
            />
            <Scatter name="peer" data={peers.map((p) => ({ ...p, z: 1 }))} fill="var(--color-peer)" fillOpacity={0.45} />
            {selected && (
              <Scatter
                name="selected"
                data={[{ ...selected, z: 3 }]}
                fill="var(--color-selected)"
                stroke="var(--color-selected)"
                strokeWidth={2}
              />
            )}
          </ScatterChart>
        </ChartContainer>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 border-t border-border pt-3">
          <LegendSwatch color="bg-chart-3/50" label="District schools" />
          <LegendSwatch color="bg-chart-1 ring-2 ring-chart-1/30" label={school.name} />
          <LegendSwatch dashed label="District median" />
        </div>

        {selected && (
          <p className="text-center text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{school.name}</span> — ESA {selected.esa}%, FCI{" "}
            {selected.fci.toFixed(2)}
            <span className="text-muted-foreground">
              {" "}
              (district medians: ESA {Math.round(medians.esa)}%, FCI {medians.fci.toFixed(2)})
            </span>
          </p>
        )}
      </div>
    </div>
  )
}

function RankPill({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-semibold text-foreground">{value}</span>
      {note && <span className="text-muted-foreground"> ({note})</span>}
    </div>
  )
}

function LegendSwatch({ color, label, dashed }: { color?: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {dashed ? (
        <span className="h-0 w-4 border-t border-dashed border-muted-foreground" aria-hidden="true" />
      ) : (
        <span className={`size-2.5 rounded-full ${color}`} aria-hidden="true" />
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
