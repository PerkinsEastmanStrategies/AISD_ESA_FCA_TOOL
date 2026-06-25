import type { FloorPlanRoom, RoomCondition, RoomEAMetric } from "@/lib/dashboard-data"

export const LIVELY_ESA_CATEGORIES = [
  "Daylight",
  "Size",
  "Layout & shape",
  "Furniture",
  "Safety",
  "Technology",
  "Plumbing",
] as const

function yesRatio(subs: { met: boolean }[]): number {
  if (!subs.length) return 0
  return Math.round((subs.filter((s) => s.met).length / subs.length) * 100)
}

function conditionFromScore(score: number): RoomCondition {
  if (score >= 70) return "good"
  if (score >= 45) return "fair"
  return "poor"
}

function sub(name: string, met: boolean, note?: string) {
  return { name, met, note }
}

function category(name: string, subs: { name: string; met: boolean; note?: string }[]): RoomEAMetric {
  return { name, score: yesRatio(subs), subCriteria: subs }
}

/** Lively L1 Building B specialty spaces with full ESA drill-down data. */
function buildSpecialtyRoom(
  id: string,
  name: string,
  sqft: number,
  capacity: number,
  categories: RoomEAMetric[],
  note: string,
  fcaNote: string,
  fci: number,
  fcaCondition: RoomCondition,
): Omit<FloorPlanRoom, "x" | "y"> {
  const eaScore = Math.round(categories.reduce((s, c) => s + c.score, 0) / categories.length)
  return {
    id,
    name,
    building: "B",
    condition: conditionFromScore(eaScore),
    eaScore,
    sqft,
    capacity,
    metrics: categories,
    note,
    fci,
    fcaCondition,
    systems: [
      { name: "HVAC", condition: fcaCondition },
      { name: "Flooring", condition: "good" },
      { name: "Lighting", condition: "fair" },
      { name: "Finishes", condition: "fair" },
      { name: "Plumbing", condition: "poor" },
    ],
    fcaNote,
  }
}

const BAND = buildSpecialtyRoom(
  "BAND",
  "Band / Music",
  4200,
  72,
  [
    category("Daylight", [
      sub("Access to more than one window", false, "Limited perimeter glazing; interior rehearsal walls block secondary exposures."),
      sub("Views of nature", false, "Courtyard views partially obstructed by storage wing."),
      sub("Ability to control glare", false, "Manual shades on south clerestory only; no automated glare control."),
    ]),
    category("Size", [
      sub("Deviation from Ed Spec", false, "~12% below middle-school band rehearsal Ed Spec (4,800 SF target)."),
    ]),
    category("Layout & shape", [
      sub("Ability to organize room", true, "Risers and storage alcoves support sectional rehearsal."),
      sub("Clear sightlines", true, "Director podium sightlines good; rear corner blocked by instrument storage."),
    ]),
    category("Furniture", [
      sub("Flexible seating & stands", true, "Mix of fixed risers and movable chairs; limited stack storage."),
      sub("Instrument storage integration", true, "Adjacent dedicated storage rooms reduce clutter in rehearsal volume."),
    ]),
    category("Safety", [
      sub("Ability to shelter", false, "Interior corridor adjacency; no dedicated storm shelter designation."),
      sub("Adequate visibility", true, "Open plan with sightlines to all entries; limited blind corners."),
    ]),
    category("Technology", [
      sub("Access to ed tech", true, "Projector and PA present; no interactive display."),
      sub("More than 5 outlets", false, "Insufficient circuits at perimeter for amplified sections."),
      sub("WiFi AP", true, "AP in adjacent corridor provides adequate coverage."),
    ]),
    category("Plumbing", [sub("Sink in room", false, "No sink — students use restroom corridor for water.")]),
  ],
  "Large ensemble rehearsal space serving grades 6–8 band programs. Acoustic performance is adequate but daylight and power distribution lag peer campuses.",
  "Building B FCA identifies aging HVAC distribution and interior finishes across the fine-arts wing; band room shares rooftop units with choir and orchestra stacks.",
  0.42,
  "fair",
)

const CHOIR = buildSpecialtyRoom(
  "CHOIR",
  "Choir",
  3100,
  56,
  [
    category("Daylight", [
      sub("Access to more than one window", true, "North and east glazing provide dual exposures."),
      sub("Views of nature", true, "Tree canopy visible on east elevation; north faces parking."),
      sub("Ability to control glare", false, "No blackout capability for video or recording sessions."),
    ]),
    category("Size", [
      sub("Deviation from Ed Spec", true, "Within 8% of Ed Spec choral rehearsal target (3,350 SF)."),
    ]),
    category("Layout & shape", [
      sub("Ability to organize room", true, "Tiered seating supports mixed-voice rehearsal arcs."),
      sub("Clear sightlines", true, "Strong sightlines from director position to all sections."),
    ]),
    category("Furniture", [
      sub("Flexible seating & stands", true, "Movable chairs; music folio storage along west wall."),
      sub("Piano & accompaniment zone", true, "Dedicated platform; limited clearance for grand piano lid."),
    ]),
    category("Safety", [
      sub("Ability to shelter", false, "Exterior wall exposure on two sides."),
      sub("Adequate visibility", true, "Single entry visible from teaching position."),
    ]),
    category("Technology", [
      sub("Access to ed tech", true, "Audio playback only; no document camera or hybrid teaching kit."),
      sub("More than 5 outlets", true, "Five outlets along south wall — at minimum threshold."),
      sub("WiFi AP", true, "Dedicated AP in choir office provides strong signal."),
    ]),
    category("Plumbing", [sub("Sink in room", false, "No sink in rehearsal space.")]),
  ],
  "Primary choral rehearsal room with good layout and sightlines. Glare control and technology integration are the main adequacy gaps.",
  "Choir shares Building B air-handling with adjacent music spaces; FCA notes corrosion in ~25% of ductwork serving this wing.",
  0.38,
  "fair",
)

const ORCH = buildSpecialtyRoom(
  "ORCH",
  "Orchestra",
  3600,
  48,
  [
    category("Daylight", [
      sub("Access to more than one window", false, "Single bank of high windows on west facade."),
      sub("Views of nature", false, "High sill limits student-level views."),
      sub("Ability to control glare", false, "Afternoon glare on conductor stand; no shades."),
    ]),
    category("Size", [
      sub("Deviation from Ed Spec", false, "~10% below orchestra Ed Spec when full string section enrolled."),
    ]),
    category("Layout & shape", [
      sub("Ability to organize room", true, "Rectangular footprint supports standard orchestral arc."),
      sub("Clear sightlines", true, "Cello/bass section partially obscured from podium."),
    ]),
    category("Furniture", [
      sub("Flexible seating & stands", true, "Chair and stand storage in adjacent practice rooms."),
      sub("Instrument storage integration", true, "String bass storage competes with circulation path."),
    ]),
    category("Safety", [
      sub("Ability to shelter", false, "Interior location with corridor egress."),
      sub("Adequate visibility", true, "Good visibility to main door; practice room doors are blind spots."),
    ]),
    category("Technology", [
      sub("Access to ed tech", false, "Recording capability via portable cart only."),
      sub("More than 5 outlets", false, "Insufficient outlets for electric piano and recording equipment simultaneously."),
      sub("WiFi AP", true, "Coverage acceptable; drops during full-class device use."),
    ]),
    category("Plumbing", [sub("Sink in room", false, "No sink.")]),
  ],
  "Orchestra rehearsal volume with adequate organization but constrained daylight and power. Practice rooms ORCHPRA1–3 support sectional work.",
  "Orchestra stack tied to Building B HVAC zone; interior finishes in adjacent practice rooms flagged for replacement in FCA.",
  0.44,
  "fair",
)

const CAFE = buildSpecialtyRoom(
  "CAFE",
  "Cafeteria",
  6800,
  280,
  [
    category("Daylight", [
      sub("Access to more than one window", true, "Continuous clerestory and courtyard-facing glazing on two sides."),
      sub("Views of nature", true, "Courtyard planting visible from half of seating area."),
      sub("Ability to control glare", true, "Fixed solar film on south clerestory; limited adjustment."),
    ]),
    category("Size", [
      sub("Deviation from Ed Spec", true, "Meets Ed Spec for 280-seat MS dining at peak lunch wave."),
    ]),
    category("Layout & shape", [
      sub("Ability to organize room", true, "Servery and seating zones clearly separated."),
      sub("Clear sightlines", true, "Supervision sightlines excellent across open floor plate."),
    ]),
    category("Furniture", [
      sub("Flexible seating & tables", true, "Fixed booth seating limits reconfiguration for events."),
      sub("Serving line flow", false, "Bottleneck at cashiers during peak; double-line not possible."),
    ]),
    category("Safety", [
      sub("Ability to shelter", false, "Large open volume; designated shelter is exterior corridor."),
      sub("Adequate visibility", true, "360° supervision from center platform."),
    ]),
    category("Technology", [
      sub("Access to ed tech", false, "No classroom technology — dining use only."),
      sub("More than 5 outlets", true, "Adequate outlets along perimeter for cleaning and events."),
      sub("WiFi AP", true, "Multiple APs cover dining floor."),
    ]),
    category("Plumbing", [
      sub("Sink in room", false, "Servery sinks in adjacent kitchen — no hand-wash in dining area."),
    ]),
  ],
  "Main student dining hall serving Building B kitchen. Strong size and supervision; shelter and in-room plumbing are weaknesses.",
  "Cafeteria adjoins commercial kitchen (KITCHEN). Building B FCA includes kitchen exhaust, grease trap, and cooler/freezer equipment needs.",
  0.36,
  "good",
)

export const LIVELY_BUILDING_B_SPECIALTY_ROOMS: Record<string, Omit<FloorPlanRoom, "x" | "y">> = {
  BAND,
  CHOIR,
  ORCH,
  CAFE,
}

export const LIVELY_BUILDING_B_HOTSPOT_IDS = ["BAND", "CHOIR", "ORCH", "CAFE"] as const

export function isLivelyBuildingBSpecialtyRoom(roomId: string): boolean {
  return roomId in LIVELY_BUILDING_B_SPECIALTY_ROOMS
}

export function mergeLivelySpecialtyRoom(room: FloorPlanRoom): FloorPlanRoom {
  const preset = LIVELY_BUILDING_B_SPECIALTY_ROOMS[room.id]
  if (!preset) return room
  return { ...room, ...preset, x: room.x, y: room.y, building: room.building ?? preset.building }
}

export function mergeLivelySpecialtyRooms(rooms: FloorPlanRoom[]): FloorPlanRoom[] {
  return rooms.map(mergeLivelySpecialtyRoom)
}
