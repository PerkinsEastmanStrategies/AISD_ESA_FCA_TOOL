import { Card } from "@/components/ui/card"
import { STATUS_BAR, type School } from "@/lib/dashboard-data"
import { SchoolComparisonCharts } from "@/components/school-comparison-charts"

interface PortfolioComparisonProps {
  school: School
}

export function PortfolioComparison({ school }: PortfolioComparisonProps) {
  return (
    <Card className="gap-5 p-5 sm:p-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Portfolio Comparison</h2>
        <p className="text-sm text-muted-foreground">Compared to all Austin ISD schools</p>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {school.portfolio.map((m) => (
          <div key={m.label} className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">{m.label}</p>
            <p className="text-xs text-muted-foreground">{m.scaleNote ?? "Current Value"}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{m.value}</p>

            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {m.scaleNote ? "" : "vs. District"}
              </span>
              {m.badge ? (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                  {m.badge}
                </span>
              ) : (
                <span className="text-[11px] font-medium text-muted-foreground">{m.comparison}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-status-track">
                <div
                  className={`h-full rounded-full ${STATUS_BAR[m.color]}`}
                  style={{ width: `${Math.min(Math.max(m.ratio, 0), 1) * 100}%` }}
                />
              </div>
              {m.badge && (
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{m.comparison}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="mb-1 text-sm font-semibold text-foreground">ESA vs. FCI — District Position</h3>
        <SchoolComparisonCharts school={school} />
      </div>
    </Card>
  )
}
