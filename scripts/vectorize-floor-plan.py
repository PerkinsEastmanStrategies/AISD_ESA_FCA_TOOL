"""Trace room regions separated by wall lines into polygon.proom SVG."""
from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

MIN_AREA = 250
SIMPLIFY_EPS = 1.2
WALL_DILATE = 2


def wall_mask(bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    # Thin white wall strokes and labels.
    walls = (gray > 175).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    walls = cv2.dilate(walls, kernel, iterations=WALL_DILATE)
    return walls


def room_mask(bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    walls = wall_mask(bgr)
    colored = (gray > 30) & (gray < 245) & (hsv[:, :, 1] > 30)
    interior = colored & (walls == 0)
    mask = interior.astype(np.uint8) * 255

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    return mask


def dominant_fill(bgr: np.ndarray, contour: np.ndarray) -> str:
    mask = np.zeros(bgr.shape[:2], dtype=np.uint8)
    cv2.drawContours(mask, [contour], -1, 255, -1)
    pixels = bgr[mask == 255]
    if len(pixels) == 0:
        return "#1e3a5f"
    med = np.median(pixels, axis=0).astype(int)
    return f"#{med[2]:02x}{med[1]:02x}{med[0]:02x}"


def contour_to_points(contour: np.ndarray) -> str:
    pts = contour.reshape(-1, 2)
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)


def build_svg(width: int, height: int, polygons: list[tuple[str, str]]) -> str:
    body = "\n".join(
        f'  <polygon class="proom" data-i="{i}" fill="{fill}" points="{pts}"/>'
        for i, (pts, fill) in enumerate(polygons)
    )
    return f"""<svg id="planSvg" viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">
<style>.proom{{stroke:#c8d0da;stroke-width:0.6;vector-effect:non-scaling-stroke;fill-opacity:0.95}}</style>
<rect x="0" y="0" width="{width}" height="{height}" fill="#000000"/>
<g id="planRooms">
{body}
</g>
</svg>
"""


def vectorize(input_path: Path, output_path: Path) -> int:
    bgr = cv2.imread(str(input_path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise SystemExit(f"Could not read {input_path}")

    height, width = bgr.shape[:2]
    mask = room_mask(bgr)

    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    polygons: list[tuple[str, str, float]] = []

    for label in range(1, num):
        area = stats[label, cv2.CC_STAT_AREA]
        if area < MIN_AREA:
            continue
        component = (labels == label).astype(np.uint8) * 255
        contours, _ = cv2.findContours(component, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            c_area = cv2.contourArea(contour)
            if c_area < MIN_AREA:
                continue
            approx = cv2.approxPolyDP(contour, SIMPLIFY_EPS, True)
            if len(approx) < 3:
                continue
            pts = contour_to_points(approx)
            fill = dominant_fill(bgr, contour)
            polygons.append((pts, fill, c_area))

    # Largest regions first for stable ids.
    polygons.sort(key=lambda p: -p[2])
    svg = build_svg(width, height, [(p, f) for p, f, _ in polygons])
    output_path.write_text(svg, encoding="utf-8")
    return len(polygons)


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("public/MaplewoodES_plan.png")
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("public/MaplewoodES_plan.svg")
    count = vectorize(src, dst)
    print(f"Wrote {count} room polygons to {dst}")
