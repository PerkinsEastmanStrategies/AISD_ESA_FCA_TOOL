"use client"

import { School2, ChevronDown } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { School } from "@/lib/dashboard-data"

interface DashboardHeaderProps {
  schools: School[]
  selectedId: string
  onSelect: (id: string) => void
}

export function DashboardHeader({ schools, selectedId, onSelect }: DashboardHeaderProps) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground shadow-sm">
          <School2 className="size-4" aria-hidden="true" />
          <span className="text-sm font-semibold">Select School:</span>
        </div>

        <Select value={selectedId} onValueChange={onSelect}>
          <SelectTrigger className="h-10 w-[260px] border-border bg-card font-medium shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {schools.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto hidden flex-col text-right sm:flex">
          <span className="text-sm font-semibold text-foreground">Austin ISD</span>
          <span className="text-xs text-muted-foreground">
            Facility Condition &amp; Educational Suitability Assessment
          </span>
        </div>
      </div>
    </header>
  )
}
