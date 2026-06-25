"use client"

import { useState } from "react"
import { schools, defaultSchoolId } from "@/lib/schools-list"
import { DistrictMap } from "@/components/district-map"
import { AppHeader } from "@/components/app-header"
import { InfoCards } from "@/components/info-cards"
import { LocationSection } from "@/components/location-section"
import { EnrollmentSection } from "@/components/enrollment-section"
import { PortfolioComparison } from "@/components/portfolio-comparison"
import { FacilityNeeds } from "@/components/facility-needs"
import { PrincipalSentimentSurvey } from "@/components/principal-sentiment-survey"
import { EducationalAdequacy } from "@/components/educational-adequacy"
import { SpaceSufficiency } from "@/components/space-sufficiency"
import { FloorPlanExplorer } from "@/components/floor-plan-explorer"
import { CapitalPlanning } from "@/components/capital-planning"
import { ExportsReporting } from "@/components/exports-reporting"
import { PageGuide } from "@/components/page-guide"
import { CapitalPlanProvider } from "@/lib/capital-plan-store"

function DashboardInner() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<"dashboard" | "floorplan">("dashboard")
  const [appView, setAppView] = useState<"map" | "school" | "capital" | "exports">("map")
  const activeSchoolId = selectedId ?? defaultSchoolId()
  const school = schools.find((s) => s.id === activeSchoolId) ?? schools[0]

  function openSchoolView(id?: string) {
    const target = id ?? selectedId ?? defaultSchoolId()
    setSelectedId(target)
    setView("dashboard")
    setAppView("school")
  }

  function openCapitalPlanning() {
    if (!selectedId) setSelectedId(defaultSchoolId())
    setAppView("capital")
  }

  function openExports() {
    if (!selectedId) setSelectedId(defaultSchoolId())
    setAppView("exports")
  }

  if (appView === "map") {
    return (
      <DistrictMap
        dashboardSchoolId={selectedId}
        onSelectSchool={setSelectedId}
        onOpenSchool={openSchoolView}
        onOpenCapital={openCapitalPlanning}
        onOpenExports={openExports}
      />
    )
  }

  if (appView === "capital") {
    return (
      <CapitalPlanning
        selectedId={activeSchoolId}
        onSelectSchool={setSelectedId}
        onOpenMap={() => setAppView("map")}
        onOpenSchoolView={() => openSchoolView()}
        onOpenExports={openExports}
      />
    )
  }

  if (appView === "exports") {
    return (
      <ExportsReporting
        selectedId={activeSchoolId}
        onSelectSchool={setSelectedId}
        onOpenMap={() => setAppView("map")}
        onOpenSchool={() => openSchoolView()}
        onOpenCapital={openCapitalPlanning}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={school.name}
        subtitle="Facility Condition & Educational Suitability Assessment"
        current="school"
        selectedSchoolId={selectedId}
        onSelectSchool={setSelectedId}
        onMap={() => setAppView("map")}
        onSchool={() => {}}
        onCapital={openCapitalPlanning}
        onExports={openExports}
      />

      <PageGuide guideId={view === "floorplan" ? "floor-plan" : "school-dashboard"} />

      <main className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-6 sm:px-6">
        <h1 className="sr-only">{school.name} facility dashboard</h1>

        {view === "floorplan" ? (
          <FloorPlanExplorer key={school.id} school={school} onBack={() => setView("dashboard")} />
        ) : (
          <>
            <InfoCards school={school} />
            <LocationSection school={school} onOpenFloorPlan={() => setView("floorplan")} />
            <EnrollmentSection school={school} />
            <PortfolioComparison school={school} />

            <div data-guide="school-suitability" className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <SpaceSufficiency school={school} />
              <EducationalAdequacy school={school} />
            </div>

            <div data-guide="school-facility-needs">
              <FacilityNeeds school={school} />
            </div>
            <PrincipalSentimentSurvey school={school} />
          </>
        )}
      </main>
    </div>
  )
}

export function Dashboard() {
  return (
    <CapitalPlanProvider>
      <DashboardInner />
    </CapitalPlanProvider>
  )
}
