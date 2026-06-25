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
