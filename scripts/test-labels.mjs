import { readFileSync } from "fs"
import { JSDOM } from "jsdom"

const text = readFileSync("public/LivelyMS_plan.svg", "utf8")
const doc = new JSDOM(text, { contentType: "image/svg+xml" }).window.document
const polys = doc.querySelectorAll("polygon.proom[data-label]")
console.log("poly labels", polys.length)

function polygonArea(points) {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

const labels = []
doc.querySelectorAll("polygon.proom[data-label]").forEach((node) => {
  const id = node.getAttribute("data-i")
  const label = node.getAttribute("data-label")
  const x = Number(node.getAttribute("data-label-x"))
  const y = Number(node.getAttribute("data-label-y"))
  const raw = node.getAttribute("points")
  const nums = raw.trim().split(/[\s,]+/).map(Number)
  const points = []
  for (let k = 0; k + 1 < nums.length; k += 2) points.push({ x: nums[k], y: nums[k + 1] })
  labels.push({ id, text: label, x, y, area: polygonArea(points) })
})

const vb = { w: 6089, h: 4937.38 }
const vw = 800
const LABEL_SCREEN_PX = 11

function visible(labels, zoom) {
  const fontSizeSvg = (LABEL_SCREEN_PX * (vb.w / vw)) / Math.max(zoom, 0.35)
  const gap = fontSizeSvg * 0.15
  const minZoom = (area) => {
    if (area >= 120_000) return 0.55
    if (area >= 60_000) return 0.75
    if (area >= 25_000) return 0.95
    if (area >= 10_000) return 1.2
    if (area >= 4_000) return 1.55
    return 1.9
  }
  const sorted = [...labels].sort((a, b) => b.area - a.area)
  const boxes = []
  const accepted = []
  for (const label of sorted) {
    if (zoom < minZoom(label.area)) continue
    const w = Math.max(fontSizeSvg * 0.58 * label.text.length, fontSizeSvg * 0.9)
    const h = fontSizeSvg * 1.15
    const box = { x: label.x - w / 2, y: label.y - h / 2, w, h }
    const hit = boxes.some((b) =>
      box.x < b.x + b.w + gap && box.x + box.w + gap > b.x && box.y < b.y + b.h + gap && box.y + box.h + gap > b.y,
    )
    if (hit) continue
    accepted.push(label)
    boxes.push(box)
  }
  return accepted.length
}

for (const z of [0.5, 1, 1.5, 2, 3, 4]) {
  console.log(`zoom ${z}: ${visible(labels, z)} / ${labels.length}`)
}
