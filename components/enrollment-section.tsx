import { Users, Building2, Gauge, TrendingUp } from "lucide-react"
import { Card } from "@/components/ui/card"
import { formatNumber } from "@/lib/format"
import type { School } from "@/lib/dashboard-data"

interface EnrollmentSectionProps {
  school: School
}

function UtilizationBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-status-track">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}

export function EnrollmentSection({ school }: EnrollmentSectionProps) {
  return (
    <section data-guide="school-enrollment" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-foreground">Enrollment, Capacity &amp; Utilization</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="gap-2 p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium">Enrollment</span>
          </div>
          <p className="text-xs text-muted-foreground">{school.enrollmentDate}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">{formatNumber(school.enrollment)}</p>
        </Card>

        <Card className="gap-2 p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="size-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium">Original Capacity</span>
          </div>
          <p className="mt-auto text-3xl font-bold tracking-tight text-foreground">
            {formatNumber(school.originalCapacity)}
          </p>
        </Card>

        <Card className="gap-2 p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Gauge className="size-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium">PE Calculated Capacity</span>
          </div>
          <p className="mt-auto text-3xl font-bold tracking-tight text-foreground">
            {formatNumber(school.peCapacity)}
          </p>
        </Card>

        <Card className="justify-center gap-4 p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="size-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium">Utilization Rate</span>
          </div>
          <UtilizationBar label="Original Capacity" value={school.utilOriginal} color="bg-primary" />
          <UtilizationBar label="PE Capacity" value={school.utilPe} color="bg-status-good" />
        </Card>
      </div>
    </section>
  )
}
