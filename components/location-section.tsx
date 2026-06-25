"use client"

import { LayoutGrid, ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { SchoolMap, SCHOOL_MAP_HEIGHT } from "@/components/school-map"
import { floorPlanDisplaySrc, type School } from "@/lib/dashboard-data"

interface LocationSectionProps {
  school: School
  onOpenFloorPlan: () => void
}

export function LocationSection({ school, onOpenFloorPlan }: LocationSectionProps) {
  const planSrc = floorPlanDisplaySrc(school)

  return (
    <div data-guide="school-location" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Location</h2>
        </div>
        <SchoolMap key={school.id} lat={school.lat} lng={school.lng} label={school.name} />
      </Card>

      <Card className="gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Building Floor Plan</h2>
        </div>
        <button
          type="button"
          onClick={onOpenFloorPlan}
          className="group relative block w-full overflow-hidden bg-muted/30 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          style={{ height: SCHOOL_MAP_HEIGHT }}
          aria-label={`Open floor plan explorer for ${school.name}`}
        >
          <div className="flex h-full items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={planSrc}
              alt={`${school.name} floor plan preview`}
              className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              draggable={false}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/0 transition-colors group-hover:bg-foreground/10">
            <span className="flex items-center gap-2 rounded-lg border border-border bg-card/95 px-4 py-2.5 text-sm font-semibold text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <LayoutGrid className="size-4 text-primary" aria-hidden="true" />
              Open floor plan explorer
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </div>
        </button>
      </Card>
    </div>
  )
}
