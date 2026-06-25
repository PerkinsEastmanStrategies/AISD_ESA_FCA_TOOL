import { detailedSchoolProfiles } from "@/lib/detailed-school-profiles"
import type { School } from "@/lib/dashboard-data"
import { teachingDistrictSchools } from "@/lib/district-data"
import { generateSchoolProfile, syncSchoolWithDistrict } from "@/lib/school-profile-generator"

/** Full school list: detailed Maplewood & Casis profiles plus generated teaching campuses. */
export const schools: School[] = (() => {
  const detailedIds = new Set(detailedSchoolProfiles.map((s) => s.id))

  const detailed = detailedSchoolProfiles.map((s) => {
    const ds = teachingDistrictSchools.find((d) => d.dashboardId === s.id || d.id === s.id)
    return ds ? syncSchoolWithDistrict(s, ds, teachingDistrictSchools) : s
  })

  // Include all teaching campuses without a hand-built profile (dashboardId alone does not exclude).
  const generated = teachingDistrictSchools
    .filter((ds) => !detailedIds.has(ds.id) && !(ds.dashboardId != null && detailedIds.has(ds.dashboardId)))
    .map((ds) => generateSchoolProfile(ds, teachingDistrictSchools))

  return [...detailed, ...generated].sort((a, b) => {
    if (a.id === "lively") return -1
    if (b.id === "lively") return 1
    return a.name.localeCompare(b.name)
  })
})()

/** Primary demo campus — most interactive features are built for this school. */
export const DEMO_SCHOOL_ID = "lively"

export function defaultSchoolId(): string {
  return schools.find((s) => s.id === DEMO_SCHOOL_ID)?.id ?? schools[0]?.id ?? ""
}
