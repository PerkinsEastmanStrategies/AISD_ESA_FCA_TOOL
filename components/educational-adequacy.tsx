"use client"

import { ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { STATUS_BAR, scoreToStatus, type EACategory, type School } from "@/lib/dashboard-data"

interface EducationalAdequacyProps {
  school: School
}

function Bar({ score }: { score: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-status-track">
      <div
        className={`h-full rounded-full ${STATUS_BAR[scoreToStatus(score)]}`}
        style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
      />
    </div>
  )
}

function ScoreRow({ score }: { score: number }) {
  return <span className="w-10 shrink-0 text-right text-sm font-semibold text-foreground">{score}%</span>
}

function CategoryBlock({ category }: { category: EACategory }) {
  if (!category.items?.length) {
    return (
      <div className="flex flex-col gap-1.5 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-foreground">{category.name}</span>
          <ScoreRow score={category.score} />
        </div>
        <Bar score={category.score} />
      </div>
    )
  }

  return (
    <AccordionItem value={category.name} className="border-0">
      <AccordionTrigger className="py-2.5 hover:no-underline [&>svg]:hidden">
        <div className="flex w-full flex-col gap-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/accordion:rotate-90" />
              {category.name}
            </span>
            <ScoreRow score={category.score} />
          </div>
          <Bar score={category.score} />
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-2">
        <div className="flex flex-col gap-2.5 pl-5 pt-1">
          {category.items.map((item) => (
            <div key={item.name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">{item.name}</span>
                <span className="w-10 shrink-0 text-right text-xs font-medium text-foreground">{item.score}%</span>
              </div>
              <Bar score={item.score} />
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

const LEGEND = [
  { label: "<40%", color: "bg-status-critical" },
  { label: "40-59%", color: "bg-status-warning" },
  { label: "60-79%", color: "bg-status-info" },
  { label: "≥80%", color: "bg-status-good" },
]

export function EducationalAdequacy({ school }: EducationalAdequacyProps) {
  const withItems = school.eaCategories.filter((c) => c.items?.length)

  return (
    <Card className="gap-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-foreground">Educational Adequacy Breakdown</h2>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Overall EA Score</p>
          <p className="text-xl font-bold text-primary">{school.eaOverall}%</p>
        </div>
      </div>

      <Accordion
        type="multiple"
        defaultValue={withItems.map((c) => c.name)}
        className="flex flex-col divide-y divide-border [&_[data-slot=accordion-trigger]]:group/accordion"
      >
        {school.eaCategories.map((c) => (
          <CategoryBlock key={c.name} category={c} />
        ))}
      </Accordion>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-border pt-4">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${l.color}`} aria-hidden="true" />
            <span className="text-xs text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
