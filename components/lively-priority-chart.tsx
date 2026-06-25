"use client"

import { useCallback, useMemo, useState } from "react"
import { BarChart3 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from "recharts"
import type { TooltipProps } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import {
  formatDollars,
  formatLivelyChartAxis,
  livelyRecSystemNames,
  livelyStackedByPriority,
  livelySystemChartColors,
  livelySystemChartConfig,
  livelySystemSummaries,
} from "@/lib/lively-facility-data"

type ChartRow = Record<string, string | number>

function rowTotal(row: ChartRow, systems: string[]): number {
  return systems.reduce((sum, key) => sum + (Number(row[key]) || 0), 0)
}

function PriorityTooltip({
  active,
  payload,
  label,
  visibleSystems,
}: TooltipProps<number, string> & { visibleSystems: string[] }) {
  if (!active || !payload?.length || !label) return null

  const items = visibleSystems
    .map((name) => {
      const entry = payload.find((p) => p.dataKey === name)
      const value = Number(entry?.value) || 0
      return { name, value, color: entry?.color }
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)

  const total = items.reduce((s, i) => s + i.value, 0)
  if (total <= 0) return null

  return (
    <div className="min-w-[200px] rounded-lg border border-border/60 bg-background/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-sm">
      <p className="mb-2 font-semibold text-foreground">{label} priority</p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color ?? "currentColor" }}
                aria-hidden="true"
              />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums text-foreground">
              {formatDollars(item.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 font-semibold text-foreground">
        <span>Total</span>
        <span className="tabular-nums">{formatDollars(total)}</span>
      </div>
    </div>
  )
}

function TotalBarLabel({
  x,
  y,
  width,
  index,
  data,
  visibleSystems,
}: {
  x?: number
  y?: number
  width?: number
  index?: number
  data: ChartRow[]
  visibleSystems: string[]
}) {
  if (x == null || y == null || width == null || index == null) return null
  const row = data[index]
  const total = rowTotal(row, visibleSystems)
  if (total <= 0) return null
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      className="fill-muted-foreground text-[10px] font-medium"
    >
      {formatLivelyChartAxis(total)}
    </text>
  )
}

export function LivelyPriorityChart() {
  const allSystems = useMemo(() => livelyRecSystemNames(), [])
  const chartData = useMemo(() => livelyStackedByPriority(), [])
  const chartConfig = useMemo(() => livelySystemChartConfig(), [])
  const systemColors = useMemo(() => livelySystemChartColors(), [])
  const systemCosts = useMemo(
    () => Object.fromEntries(livelySystemSummaries().map((s) => [s.system, s.totalCost])),
    [],
  )

  const [hidden, setHidden] = useState<Set<string>>(() => new Set())

  const visibleSystems = useMemo(
    () => allSystems.filter((name) => !hidden.has(name)),
    [allSystems, hidden],
  )

  const visibleGrandTotal = useMemo(
    () => chartData.reduce((sum, row) => sum + rowTotal(row, visibleSystems), 0),
    [chartData, visibleSystems],
  )

  const yMax = useMemo(() => {
    const peak = Math.max(...chartData.map((row) => rowTotal(row, visibleSystems)), 0)
    if (peak <= 0) return 1_000_000
    const step = peak > 4_000_000 ? 1_000_000 : peak > 1_500_000 ? 500_000 : 250_000
    return Math.ceil(peak / step) * step
  }, [chartData, visibleSystems])

  const toggleSystem = useCallback((name: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else if (visibleSystems.length > 1) next.add(name)
      return next
    })
  }, [visibleSystems.length])

  const showAll = useCallback(() => setHidden(new Set()), [])
  const hideMinor = useCallback(() => {
    const threshold = visibleGrandTotal * 0.03
    setHidden(new Set(allSystems.filter((name) => (systemCosts[name] ?? 0) < threshold)))
  }, [allSystems, systemCosts, visibleGrandTotal])

  const barRadius = useCallback(
    (name: string): [number, number, number, number] | undefined => {
      const idx = visibleSystems.indexOf(name)
      if (idx === -1) return undefined
      if (visibleSystems.length === 1) return [6, 6, 6, 6]
      if (idx === 0) return [0, 0, 6, 6]
      if (idx === visibleSystems.length - 1) return [6, 6, 0, 0]
      return undefined
    },
    [visibleSystems],
  )

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-muted/30 to-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BarChart3 className="size-4 text-primary" aria-hidden="true" />
            Recommendations by priority &amp; system
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Click legend items to show or hide systems — chart updates instantly
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Visible total
          </p>
          <p className="text-lg font-bold tabular-nums tracking-tight text-primary">
            {formatDollars(visibleGrandTotal)}
          </p>
        </div>
      </div>

      <div className="px-2 pb-2 pt-4 sm:px-4">
        <ChartContainer config={chartConfig} className="h-[320px] w-full aspect-auto">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 12, left: 0, bottom: 4 }}
            barCategoryGap="28%"
            maxBarSize={52}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis
              dataKey="priority"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fontSize: 12, fontWeight: 500 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatLivelyChartAxis(v as number)}
              width={48}
              domain={[0, yMax]}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.35, radius: 6 }}
              content={<PriorityTooltip visibleSystems={visibleSystems} />}
            />
            {allSystems.map((name) => {
              const isHidden = hidden.has(name)
              const isTop = visibleSystems[visibleSystems.length - 1] === name
              return (
                <Bar
                  key={name}
                  dataKey={name}
                  name={name}
                  stackId="priority"
                  fill={systemColors[name]}
                  hide={isHidden}
                  radius={barRadius(name)}
                  fillOpacity={isHidden ? 0 : 1}
                  isAnimationActive
                  animationDuration={400}
                >
                  {isTop && visibleSystems.length > 0 && (
                    <LabelList
                      content={(props) => (
                        <TotalBarLabel {...props} data={chartData} visibleSystems={visibleSystems} />
                      )}
                    />
                  )}
                </Bar>
              )
            })}
          </BarChart>
        </ChartContainer>
      </div>

      <div className="border-t border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Systems
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={showAll}
              className="rounded-md px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              Show all
            </button>
            <button
              type="button"
              onClick={hideMinor}
              className="rounded-md px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              Major only
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allSystems.map((name) => {
            const active = !hidden.has(name)
            const cost = systemCosts[name] ?? 0
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleSystem(name)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                  active
                    ? "border-border/80 bg-background text-foreground shadow-sm"
                    : "border-transparent bg-transparent text-muted-foreground/60 line-through",
                )}
              >
                <span
                  className={cn("size-2 shrink-0 rounded-full transition-opacity", !active && "opacity-30")}
                  style={{ backgroundColor: systemColors[name] }}
                  aria-hidden="true"
                />
                <span className="truncate">{name}</span>
                <span className="hidden tabular-nums text-muted-foreground sm:inline">
                  {formatLivelyChartAxis(cost)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
