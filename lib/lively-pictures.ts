import livelyPictures from "@/data/lively-pictures.json"

export interface LivelyPicture {
  id: string
  parentType: string
  parentName: string
  photoName: string
  photoLinkLabel: string
  url: string
}

export const livelyPictureRecords = livelyPictures as LivelyPicture[]

/** All facility-level photos, including building and site-wide records. */
export function livelyFacilityPictures(): LivelyPicture[] {
  return livelyPictureRecords.filter((p) => p.parentType === "Facility")
}

/** All equipment and building-system asset photos. */
export function livelyAssetPictures(): LivelyPicture[] {
  return livelyPictureRecords.filter((p) => p.parentType === "Asset")
}

/** Photo records are currently linked only for the Lively demo campus. */
export function reportPicturesForSchool(
  schoolId: string,
): { facility: LivelyPicture[]; asset: LivelyPicture[] } {
  if (schoolId !== "lively") return { facility: [], asset: [] }

  return {
    facility: livelyFacilityPictures(),
    asset: livelyAssetPictures(),
  }
}

export function livelyBuildingParentName(building: string): string {
  return `Building ${building}`
}

/** Facility-level photos scoped to a CAFM building letter (A–D). */
export function livelyFacilityPicturesForBuilding(building?: string): LivelyPicture[] {
  if (!building) return []
  const parent = livelyBuildingParentName(building)
  return livelyPictureRecords.filter(
    (p) => p.parentType === "Facility" && p.parentName === parent,
  )
}

/** Site-wide facility photos (marquee, overall site). */
export function livelySitePictures(): LivelyPicture[] {
  return livelyPictureRecords.filter((p) => p.parentType === "Facility" && p.parentName === "Site")
}
