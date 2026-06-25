import type { FloorPlanViewBox } from "@/lib/floor-plan"

export interface PlanLabel {
  id: string
  text: string
  x: number
  y: number
  /** Room polygon area in SVG units² — larger rooms get label priority. */
  area: number
  building?: string
}

interface BBox {
  x: number
  y: number
  w: number
  h: number
}

const LABEL_SCREEN_PX = 10

function polygonArea(points: { x: number; y: number }[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`))
  return match?.[1] ?? null
}

/** Regex parse — reliable for large SVG strings in the browser. */
function parsePlanLabelsRegex(svgText: string, roomAreas?: Map<string, number>): PlanLabel[] {
  const labels: PlanLabel[] = []
  const re = /<polygon class="proom"([^>]*)\/>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(svgText)) !== null) {
    const attrs = match[1]
    const text = attr(attrs, "data-label")
    if (!text) continue
    const id = attr(attrs, "data-i") ?? text
    const x = Number(attr(attrs, "data-label-x"))
    const y = Number(attr(attrs, "data-label-y"))
    if (Number.isNaN(x) || Number.isNaN(y)) continue
    labels.push({
      id,
      text,
      x,
      y,
      area: roomAreas?.get(id) ?? roomAreas?.get(text) ?? 8_000,
      building: attr(attrs, "data-building") ?? undefined,
    })
  }
  return labels
}

/** Parse room labels from polygon data-label attributes or legacy #planLabels text nodes. */
export function parsePlanLabels(
  svgText: string,
  roomAreas?: Map<string, number>,
): PlanLabel[] {
  const fromRegex = parsePlanLabelsRegex(svgText, roomAreas)
  if (fromRegex.length > 0) return fromRegex

  if (typeof DOMParser === "undefined") return []

  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
  const fromPolys: PlanLabel[] = []
  doc.querySelectorAll("polygon.proom[data-label], #planRooms polygon[data-label]").forEach((node) => {
    const text = node.getAttribute("data-label")
    if (!text) return
    const id = node.getAttribute("data-i") ?? text
    const x = Number(node.getAttribute("data-label-x"))
    const y = Number(node.getAttribute("data-label-y"))
    if (Number.isNaN(x) || Number.isNaN(y)) return
    fromPolys.push({
      id,
      text,
      x,
      y,
      area: roomAreas?.get(id) ?? roomAreas?.get(text) ?? 8_000,
      building: node.getAttribute("data-building") ?? undefined,
    })
  })
  if (fromPolys.length > 0) return fromPolys

  const labels: PlanLabel[] = []
  doc.querySelectorAll("#planLabels text").forEach((node) => {
    const text = node.textContent?.trim()
    if (!text) return
    const x = Number(node.getAttribute("x"))
    const y = Number(node.getAttribute("y"))
    if (Number.isNaN(x) || Number.isNaN(y)) return
    labels.push({
      id: text,
      text,
      x,
      y,
      area: roomAreas?.get(text) ?? 8_000,
    })
  })
  return labels
}

function labelBBox(label: PlanLabel, fontSizeSvg: number): BBox {
  const w = Math.max(fontSizeSvg * 0.52 * label.text.length, fontSizeSvg * 0.75)
  const h = fontSizeSvg * 1.05
  return { x: label.x - w / 2, y: label.y - h / 2, w, h }
}

function rectsOverlap(a: BBox, b: BBox, gap: number): boolean {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  )
}

/** Minimum zoom before a room label is eligible (smaller rooms need more zoom). */
function minZoomForArea(area: number): number {
  if (area >= 150_000) return 0.45
  if (area >= 80_000) return 0.6
  if (area >= 35_000) return 0.8
  if (area >= 15_000) return 1.0
  if (area >= 6_000) return 1.25
  if (area >= 2_500) return 1.55
  return 1.85
}

/**
 * Pick labels that fit without overlap at the current zoom.
 * Font size is fixed in screen pixels so spacing grows relative to text as you zoom in.
 */
export function visiblePlanLabels(
  labels: PlanLabel[],
  zoom: number,
  viewportWidth: number,
  viewBox: FloorPlanViewBox,
): PlanLabel[] {
  if (labels.length === 0 || viewportWidth <= 0) return []

  const fontSizeSvg =
    (LABEL_SCREEN_PX * (viewBox.w / viewportWidth)) / Math.max(zoom, 0.4)
  const gap = fontSizeSvg * 0.12

  const sorted = [...labels].sort((a, b) => b.area - a.area)
  const accepted: PlanLabel[] = []
  const boxes: BBox[] = []

  for (const label of sorted) {
    if (zoom < minZoomForArea(label.area)) continue
    const box = labelBBox(label, fontSizeSvg)
    if (boxes.some((b) => rectsOverlap(box, b, gap))) continue
    accepted.push(label)
    boxes.push(box)
  }

  return accepted
}

export function planLabelFontSizeSvg(
  zoom: number,
  viewportWidth: number,
  viewBox: FloorPlanViewBox,
): number {
  return (LABEL_SCREEN_PX * (viewBox.w / Math.max(viewportWidth, 1))) / Math.max(zoom, 0.4)
}

/** Build id → polygon area map from parsed room polygons. */
export function roomAreasFromPolys(
  polys: { id: string; points: { x: number; y: number }[] }[],
): Map<string, number> {
  return new Map(polys.map((p) => [p.id, polygonArea(p.points)]))
}
