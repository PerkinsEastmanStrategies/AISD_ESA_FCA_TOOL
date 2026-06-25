"use client"

import { useMemo, useState } from "react"
import {
  Download,
  FileText,
  MapPin,
  Database,
  Layers,
  Printer,
  ClipboardList,
  GraduationCap,
  Package,
} from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { PageGuide } from "@/components/page-guide"
import { SchoolReport } from "@/components/school-report"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { schools } from "@/lib/schools-list"
import {
  buildEsaProjectsCsv,
  buildFcaAssetsCsv,
  buildFcaRecommendationsCsv,
  downloadSchoolLocationsGeoJSON,
  downloadTextFile,
  exportSchoolCount,
  type ExportScope,
} from "@/lib/export-data"
import { hasCapitalPlanSelections, useCapitalPlan } from "@/lib/capital-plan-store"

interface ExportsReportingProps {
  selectedId: string
  onSelectSchool: (id: string | null) => void
  onOpenMap: () => void
  onOpenSchool: () => void
  onOpenCapital: () => void
}

function DownloadCard({
  icon: Icon,
  title,
  description,
  onDownload,
  disabled,
  disabledNote,
}: {
  icon: typeof Download
  title: string
  description: string
  onDownload?: () => void
  disabled?: boolean
  disabledNote?: string
}) {
  return (
    <Card className={`flex flex-col gap-3 p-4 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          {disabled && disabledNote ? (
            <p className="mt-1.5 text-xs font-medium text-muted-foreground">{disabledNote}</p>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-center gap-1.5"
        disabled={disabled}
        onClick={onDownload}
      >
        <Download className="size-4" aria-hidden="true" />
        Download
      </Button>
    </Card>
  )
}

export function ExportsReporting({
  selectedId,
  onSelectSchool,
  onOpenMap,
  onOpenSchool,
  onOpenCapital,
}: ExportsReportingProps) {
  const school = schools.find((s) => s.id === selectedId) ?? schools[0]
  const { plan } = useCapitalPlan(school.id)
  const [exportScope, setExportScope] = useState<ExportScope>("school")
  const [includeCapitalPlan, setIncludeCapitalPlan] = useState(true)
  const [showReport, setShowReport] = useState(false)

  const planHasSelections = hasCapitalPlanSelections(plan)
  const exportCount = exportSchoolCount(exportScope, schools, school.id)
  const scopeSchoolId = exportScope === "school" ? school.id : undefined

  const reportIncludesPlan = includeCapitalPlan && planHasSelections

  const downloadSlug = useMemo(() => {
    if (exportScope === "school") return school.id
    return "portfolio"
  }, [exportScope, school.id])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader
        title="Exports & Reporting"
        subtitle="Generate facility reports and download assessment data"
        current="exports"
        selectedSchoolId={selectedId}
        onSelectSchool={(id) => onSelectSchool(id)}
        onMap={onOpenMap}
        onSchool={onOpenSchool}
        onCapital={onOpenCapital}
        onExports={() => {}}
      />

      <PageGuide guideId="exports-reporting" />

      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-6 sm:px-6">
        {/* Reports */}
        <section data-guide="exports-reports" className="flex flex-col gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <FileText className="size-5 text-primary" aria-hidden="true" />
              Facility Reports
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a printable summary for <span className="font-medium text-foreground">{school.name}</span>.
              Selections from Capital Planning can be appended when available.
            </p>
          </div>

          <Card className="gap-4 p-5">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <input
                type="checkbox"
                checked={includeCapitalPlan}
                onChange={(e) => setIncludeCapitalPlan(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border accent-primary"
              />
              <div>
                <span className="text-sm font-medium text-foreground">Include selected capital projects</span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Adds a table of floor-plan scoped areas and individually selected FCA line items from your capital
                  plan.
                </p>
                {!planHasSelections && (
                  <p className="mt-1.5 text-xs text-status-warning">
                    No capital projects selected for {school.name} yet — scope areas in Capital Planning → School
                    Projects first.
                  </p>
                )}
              </div>
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setShowReport(true)} className="gap-1.5">
                <FileText className="size-4" aria-hidden="true" />
                Preview Report
              </Button>
              {showReport && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.print()}
                  className="gap-1.5"
                >
                  <Printer className="size-4" aria-hidden="true" />
                  Print / Export PDF
                </Button>
              )}
            </div>
          </Card>

          {showReport && (
            <SchoolReport
              school={school}
              includeCapitalPlan={reportIncludesPlan}
              capitalPlan={plan}
              showActions={false}
            />
          )}
        </section>

        {/* Data downloads */}
        <section data-guide="exports-downloads" className="flex flex-col gap-4 border-t border-border pt-8">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Database className="size-5 text-primary" aria-hidden="true" />
              Data Downloads
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Export GeoJSON and CSV files for GIS tools and spreadsheet analysis.
            </p>
          </div>

          <Card className="gap-4 p-5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Export scope</span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "school" as const, label: "Selected school" },
                  { id: "portfolio" as const, label: "Full portfolio" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setExportScope(opt.id)}
                  aria-pressed={exportScope === opt.id}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    exportScope === opt.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {exportCount} school{exportCount === 1 ? "" : "s"} included
              {exportScope === "school" ? ` (${school.name})` : " (all assessed campuses)"}.
            </p>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DownloadCard
              icon={MapPin}
              title="School Locations (GeoJSON)"
              description="Point features with FCA/ESA ratings, enrollment, square footage, and EA scores."
              onDownload={() => downloadSchoolLocationsGeoJSON(schools, exportScope, scopeSchoolId)}
            />
            <DownloadCard
              icon={Layers}
              title="Spatial Assets (GeoJSON)"
              description="Floor-plan referenced assets with coordinates — for GIS integration."
              disabled
              disabledNote="Coming soon — spatial asset export is under development."
            />
            <DownloadCard
              icon={ClipboardList}
              title="FCA Recommendations (CSV)"
              description="Facility condition assessment recommendations and identified deficiencies."
              onDownload={() =>
                downloadTextFile(
                  buildFcaRecommendationsCsv(schools, exportScope, scopeSchoolId),
                  `aisd-fca-recommendations-${downloadSlug}.csv`,
                  "text/csv",
                )
              }
            />
            <DownloadCard
              icon={Package}
              title="FCA Assets (CSV)"
              description="Asset inventory tied to FCA systems — full detail for Lively Middle School."
              onDownload={() =>
                downloadTextFile(
                  buildFcaAssetsCsv(schools, exportScope, scopeSchoolId),
                  `aisd-fca-assets-${downloadSlug}.csv`,
                  "text/csv",
                )
              }
            />
            <DownloadCard
              icon={GraduationCap}
              title="ESA Projects (CSV)"
              description="Educational Suitability improvement projects with scope and cost estimates."
              onDownload={() =>
                downloadTextFile(
                  buildEsaProjectsCsv(schools, exportScope, scopeSchoolId),
                  `aisd-esa-projects-${downloadSlug}.csv`,
                  "text/csv",
                )
              }
            />
          </div>
        </section>
      </main>
    </div>
  )
}
