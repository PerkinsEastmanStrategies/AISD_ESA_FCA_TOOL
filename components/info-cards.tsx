import { MapPin, CalendarClock, Ruler, GraduationCap } from "lucide-react"
import { Card } from "@/components/ui/card"
import { formatNumber } from "@/lib/format"
import type { School } from "@/lib/dashboard-data"

interface InfoCardsProps {
  school: School
}

export function InfoCards({ school }: InfoCardsProps) {
  const items = [
    { icon: MapPin, label: "Address", value: school.address },
    { icon: CalendarClock, label: "Age", value: `${school.age} years` },
    { icon: Ruler, label: "Square Footage", value: formatNumber(school.squareFootage) },
    { icon: GraduationCap, label: "Grades Served", value: school.gradesServed },
  ]

  return (
    <div data-guide="school-info-cards" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ icon: Icon, label, value }) => (
        <Card key={label} className="gap-3 p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="size-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium">{label}</span>
          </div>
          <p className="text-pretty text-base font-semibold text-foreground">{value}</p>
        </Card>
      ))}
    </div>
  )
}
