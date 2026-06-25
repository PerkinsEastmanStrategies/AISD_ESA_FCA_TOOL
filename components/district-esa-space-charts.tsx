"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts"
import { GraduationCap, Ruler } from "lucide-react"
import { Card } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  districtEaCategoryAverages,
  districtEsaAvg,
  districtSpaceCategoryAverages,
  districtSpaceSufficiencyAvg,
  esaScoreDistribution,
  schoolsBelowSpaceThreshold,
} from "@/lib/suitability-district"
import { teachingDistrictSchools } from "@/lib/district-data"

const BAND_COLORS = {
  critical: "var(--color-status-critical)",
  warning: "var(--color-status-warning)",
  info: "var(--color-status-info)",
  good: "var(--color-status-good)",
}

const radarConfig = {
  district: { label: "District average", color: "var(--chart-1)" },
  below: { label: "Schools below 60%", color: "var(--chart-4)" },
}

export function DistrictEsaSpaceCharts() {
  const esaDist = useMemo(() => esaScoreDistribution(), [])
  const eaRadar = useMemo(() => districtEaCategoryAverages(), [])
  const spaceRadar = useMemo(() => districtSpaceCategoryAverages(), [])
  const belowSpace = useMemo(() => schoolsBelowSpaceThreshold(60), [])
  const avgEsa = useMemo(() => districtEsaAvg(), [])
  const avgSpace = useMemo(() => districtSpaceSufficiencyAvg(), [])

  const eaRadarData = eaRadar.map((c) => ({ category: c.name, district: c.score }))
  const spaceRadarData = spaceRadar.map((c) => ({ category: c.category, district: c.score }))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <GraduationCap className="size-4 text-primary" aria-hidden="true" />
          Educational suitability &amp; space sufficiency
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          District-wide ESA scores and space sizing vs. education specification — {teachingDistrictSchools.length} schools
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Avg ESA score" value={`${avgEsa}%`} />
        <MiniStat label="Avg space sufficiency" value={`${avgSpace}%`} />
        <MiniStat label="Below 60% ESA" value={String(esaDist.filter((b) => b.band === "critical" || b.band === "warning").reduce((s, b) => s + b.schools, 0))} />
        <MiniStat label="Schools assessed" value={String(teachingDistrictSchools.length)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="gap-4 p-5">
          <ChartHead title="ESA score distribution" subtitle="Schools by educational suitability band" />
          <ChartContainer config={{ schools: { label: "Schools", color: "var(--chart-1)" } }} className="h-[260px] w-full">
            <BarChart data={esaDist} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid vertical={false} className="stroke-border/60" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="schools" name="schools" radius={[4, 4, 0, 0]}>
                {esaDist.map((row) => (
                  <Cell key={row.band} fill={BAND_COLORS[row.band]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </Card>

        <Card className="gap-4 p-5">
          <ChartHead title="Schools below space threshold" subtitle="Count scoring under 60% by category" />
          <ChartContainer config={radarConfig} className="h-[260px] w-full">
            <BarChart data={belowSpace} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} className="stroke-border/60" />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="category" width={100} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="below" name="below" fill="var(--color-status-warning)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="gap-4 p-5">
          <ChartHead title="District EA category profile" subtitle="Average score across all suitability dimensions" icon={GraduationCap} />
          <ChartContainer config={radarConfig} className="mx-auto aspect-square max-h-[320px] w-full">
            <RadarChart data={eaRadarData} outerRadius="70%">
              <ChartTooltip content={<ChartTooltipContent />} />
              <PolarGrid className="stroke-border" />
              <PolarAngleAxis dataKey="category" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="district" dataKey="district" stroke="var(--color-district)" fill="var(--color-district)" fillOpacity={0.3} strokeWidth={2} />
            </RadarChart>
          </ChartContainer>
        </Card>

        <Card className="gap-4 p-5">
          <ChartHead title="District space sufficiency profile" subtitle="Average sizing vs. education specification by category" icon={Ruler} />
          <ChartContainer config={radarConfig} className="mx-auto aspect-square max-h-[320px] w-full">
            <RadarChart data={spaceRadarData} outerRadius="70%">
              <ChartTooltip content={<ChartTooltipContent />} />
              <PolarGrid className="stroke-border" />
              <PolarAngleAxis dataKey="category" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="district" dataKey="district" stroke="var(--color-district)" fill="var(--color-district)" fillOpacity={0.3} strokeWidth={2} />
            </RadarChart>
          </ChartContainer>
        </Card>
      </div>
    </div>
  )
}

function ChartHead({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string
  subtitle: string
  icon?: typeof GraduationCap
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon && <Icon className="size-4 text-primary" aria-hidden="true" />}
        {title}
      </h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-1 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
    </Card>
  )
}
