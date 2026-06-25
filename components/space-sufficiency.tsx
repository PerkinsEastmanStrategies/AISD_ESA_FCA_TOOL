"use client"

import { useMemo, useState } from "react"
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"
import { Card } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  STATUS_BAR,
  scoreToStatus,
  spaceSufficiencyAverage,
  districtSpaceSufficiency,
  SPACE_SUFFICIENCY_SCORING,
  type School,
} from "@/lib/dashboard-data"

interface SpaceSufficiencyProps {
  school: School
}

export function SpaceSufficiency({ school }: SpaceSufficiencyProps) {
  const [compare, setCompare] = useState(true)

  const chartData = useMemo(
    () =>
      school.spaceSufficiency.map((c) => {
        const district = districtSpaceSufficiency.find((d) => d.category === c.category)
        return { category: c.category, school: c.score, district: district?.score ?? 0 }
      }),
    [school],
  )

  const avg = spaceSufficiencyAverage(school.spaceSufficiency)
  const districtAvg = spaceSufficiencyAverage(districtSpaceSufficiency)

  const chartConfig = {
    school: { label: school.name, color: "var(--chart-1)" },
    district: { label: "District Average", color: "var(--chart-3)" },
  }

  return (
    <Card className="gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Space Sufficiency Score</h2>
          <p className="text-sm text-muted-foreground">Category sizing vs. Education Specification</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Average Score</p>
          <p className="text-xl font-bold text-primary">{avg}%</p>
          {compare && <p className="text-xs text-muted-foreground">District {districtAvg}%</p>}
        </div>
      </div>

      {/* Score scale — gauge styled like the Approximate FCI Score card */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-xs text-muted-foreground">Scale</p>
        <div className="flex items-end justify-between gap-3">
          <span className="text-3xl font-bold tabular-nums text-foreground">{avg}%</span>
          <span className="text-xs text-muted-foreground">Higher is better</span>
        </div>
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-status-track">
          <div
            className={`h-full rounded-full ${STATUS_BAR[scoreToStatus(avg)]}`}
            style={{ width: `${Math.min(avg, 100)}%` }}
          />
          {compare && (
            <span
              className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-foreground/70"
              style={{ left: `${Math.min(districtAvg, 100)}%` }}
              aria-hidden="true"
            />
          )}
        </div>
        {compare && (
          <p className="text-xs text-muted-foreground">
            District average <span className="font-semibold text-foreground">{districtAvg}%</span>
          </p>
        )}
      </div>

      {/* Compare toggle */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <span className="text-sm font-medium text-foreground">Compare to district average</span>
        <button
          type="button"
          role="switch"
          aria-checked={compare}
          onClick={() => setCompare((v) => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            compare ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`inline-block size-5 rounded-full bg-background shadow transition-transform ${
              compare ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* Spider / radar plot */}
        <div>
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[340px] w-full">
            <RadarChart data={chartData} outerRadius="72%">
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <PolarGrid className="stroke-border" />
              <PolarAngleAxis dataKey="category" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={5} />
              {compare && (
                <Radar
                  name="district"
                  dataKey="district"
                  stroke="var(--color-district)"
                  fill="var(--color-district)"
                  fillOpacity={0.12}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
              )}
              <Radar
                name="school"
                dataKey="school"
                stroke="var(--color-school)"
                fill="var(--color-school)"
                fillOpacity={0.35}
                strokeWidth={2}
              />
            </RadarChart>
          </ChartContainer>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-full bg-chart-1" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">{school.name}</span>
            </div>
            {compare && (
              <div className="flex items-center gap-1.5">
                <span className="h-0 w-4 border-t-2 border-dashed border-chart-3" aria-hidden="true" />
                <span className="text-xs text-muted-foreground">District Average</span>
              </div>
            )}
          </div>
        </div>

        {/* Category breakdown — stacked below the spider */}
        <div className="flex flex-col divide-y divide-border border-t border-border pt-1">
          {chartData.map((c) => (
            <div key={c.category} className="flex flex-col gap-1.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{c.category}</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{c.school}%</span>
                  {compare && (
                    <span className="text-xs text-muted-foreground">/ {c.district}%</span>
                  )}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-status-track">
                <div
                  className={`h-full rounded-full ${STATUS_BAR[scoreToStatus(c.school)]}`}
                  style={{ width: `${Math.min(c.school, 100)}%` }}
                />
                {compare && (
                  <span
                    className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-foreground/70"
                    style={{ left: `${Math.min(c.district, 100)}%` }}
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scoring rubric */}
      <details className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Scoring methodology</summary>
        <ul className="mt-3 flex flex-col gap-1.5">
          {SPACE_SUFFICIENCY_SCORING.map((s) => (
            <li key={s.range} className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
              <span>{s.range}</span>
              <span className="font-semibold text-foreground">{s.score}</span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  )
}
