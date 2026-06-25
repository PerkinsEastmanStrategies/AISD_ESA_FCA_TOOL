"""Convert CAFM DXF floor plans to interactive SVG for the AISD dashboard."""
from __future__ import annotations

import argparse
import math
import re
import sys
from pathlib import Path

import ezdxf

ROOM_LAYER = "CAFM_SPACE"
LABEL_LAYER = "CAFM_ID"
WALL_LAYER = "A-WALLS"
BUILDING_OUTLINE_LAYER = "CAFM_BLDG_OTLN"
BUILDING_LABEL_LAYER = "CAFM_BLDG_LABL"
DETAIL_LAYERS = ("A-DOOR", "A-WIN", "A-FLOR", "A-FLOR-STRS", "A-FLR-TPTN")
PAD = 40
ROOM_FILL = "#3b4f9a"
ROOM_FILL_ALT = "#4a5fad"
WALL_STROKE = "rgba(87,96,106,0.7)"
DETAIL_STROKE = "rgba(87,96,106,0.28)"

BUILDING_COLORS: dict[str, str] = {
    "A": "#3b6fd4",
    "B": "#2a9d6f",
    "C": "#d48a1f",
    "D": "#8b5cf6",
}
BUILDING_FILL_OPACITY = 0.55
BUILDING_OUTLINE_OPACITY = 0.35


def flip_y(y: float, ymin: float, ymax: float) -> float:
    return ymin + ymax - y


def poly_centroid(points: list[tuple[float, float]]) -> tuple[float, float]:
    if not points:
        return (0.0, 0.0)
    x = sum(p[0] for p in points) / len(points)
    y = sum(p[1] for p in points) / len(points)
    return (x, y)


def point_in_polygon(x: float, y: float, poly: list[tuple[float, float]]) -> bool:
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if ((y1 > y) != (y2 > y)) and (x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1):
            inside = not inside
    return inside


def clean_label(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\\P", " ").strip())


def arc_to_lines(entity, segments: int = 12) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    center = entity.dxf.center
    radius = entity.dxf.radius
    start = math.radians(entity.dxf.start_angle)
    end = math.radians(entity.dxf.end_angle)
    if end < start:
        end += 2 * math.pi
    lines: list[tuple[tuple[float, float], tuple[float, float]]] = []
    prev = (
        center.x + radius * math.cos(start),
        center.y + radius * math.sin(start),
    )
    for i in range(1, segments + 1):
        t = start + (end - start) * i / segments
        nxt = (center.x + radius * math.cos(t), center.y + radius * math.sin(t))
        lines.append((prev, nxt))
        prev = nxt
    return lines


def entity_lines(entity) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    t = entity.dxftype()
    if t == "LINE":
        return [((entity.dxf.start.x, entity.dxf.start.y), (entity.dxf.end.x, entity.dxf.end.y))]
    if t == "ARC":
        return arc_to_lines(entity)
    if t == "LWPOLYLINE":
        pts = [(p[0], p[1]) for p in entity.get_points("xy")]
        lines = []
        for i in range(len(pts) - 1):
            lines.append((pts[i], pts[i + 1]))
        if entity.closed and len(pts) > 2:
            lines.append((pts[-1], pts[0]))
        return lines
    return []


def parse_building_outlines(msp) -> list[dict]:
    """Unique closed CAFM building footprints with assigned A/B/C/D ids."""
    outlines: list[dict] = []
    seen: set[tuple[int, int, int]] = set()
    for entity in msp.query(f'LWPOLYLINE[layer=="{BUILDING_OUTLINE_LAYER}"]'):
        if not entity.closed:
            continue
        raw = [(p[0], p[1]) for p in entity.get_points("xy")]
        if len(raw) < 3:
            continue
        cx, cy = poly_centroid(raw)
        key = (round(cx), round(cy), len(raw))
        if key in seen:
            continue
        seen.add(key)
        outlines.append({"raw": raw, "centroid": (cx, cy), "building": None})

    labels: list[tuple[str, float, float]] = []
    for entity in msp.query(f'TEXT[layer=="{BUILDING_LABEL_LAYER}"]'):
        text = clean_label(entity.dxf.text)
        if text:
            labels.append((text, entity.dxf.insert.x, entity.dxf.insert.y))

    for text, tx, ty in labels:
        for outline in outlines:
            if outline["building"]:
                continue
            if point_in_polygon(tx, ty, outline["raw"]):
                outline["building"] = text
                break
        else:
            candidates = [o for o in outlines if not o["building"]]
            if not candidates:
                continue
            nearest = min(
                candidates,
                key=lambda o: (o["centroid"][0] - tx) ** 2 + (o["centroid"][1] - ty) ** 2,
            )
            nearest["building"] = text

    # Keep only outlines that received a building letter.
    return [o for o in outlines if o["building"]]


def assign_room_building(
    raw_poly: list[tuple[float, float]],
    outlines: list[dict],
) -> str | None:
    cx, cy = poly_centroid(raw_poly)
    for outline in outlines:
        if point_in_polygon(cx, cy, outline["raw"]):
            return outline["building"]
    if not outlines:
        return None
    nearest = min(
        outlines,
        key=lambda o: (o["centroid"][0] - cx) ** 2 + (o["centroid"][1] - cy) ** 2,
    )
    return nearest["building"]


def convert(
    dxf_path: Path,
    svg_path: Path,
    *,
    room_layer: str = ROOM_LAYER,
    label_layer: str = LABEL_LAYER,
    include_walls: bool = True,
    include_detail: bool = True,
    include_buildings: bool = False,
    overlay_labels: bool = False,
) -> dict[str, float | int]:
    doc = ezdxf.readfile(str(dxf_path))
    msp = doc.modelspace()

    extmin = doc.header["$EXTMIN"]
    extmax = doc.header["$EXTMAX"]
    xmin, ymin, _ = extmin
    xmax, ymax, _ = extmax
    xmin -= PAD
    ymin -= PAD
    xmax += PAD
    ymax += PAD
    width = xmax - xmin
    height = ymax - ymin

    def map_point(x: float, y: float) -> tuple[float, float]:
        return (x, flip_y(y, ymin, ymax))

    building_outlines = parse_building_outlines(msp) if include_buildings else []

    # Room polygons
    rooms: list[dict] = []
    for entity in msp.query("LWPOLYLINE"):
        if entity.dxf.layer != room_layer or not entity.closed:
            continue
        raw = [(p[0], p[1]) for p in entity.get_points("xy")]
        if len(raw) < 3:
            continue
        mapped = [map_point(x, y) for x, y in raw]
        building = assign_room_building(raw, building_outlines) if building_outlines else None
        rooms.append({"points": mapped, "raw": raw, "id": str(len(rooms)), "building": building})

    # Match labels to rooms by text position inside polygon.
    labels: list[tuple[str, float, float]] = []
    for entity in msp.query("TEXT MTEXT"):
        if entity.dxf.layer != label_layer:
            continue
        text = clean_label(entity.dxf.text if entity.dxftype() == "TEXT" else entity.text)
        if not text:
            continue
        ins = entity.dxf.insert
        labels.append((text, ins.x, ins.y))

    for room in rooms:
        for text, tx, ty in labels:
            if point_in_polygon(tx, ty, room["raw"]):
                room["id"] = re.sub(r"[^\w.-]+", "_", text)[:40]
                room["label"] = text
                break

    # Walls + detail linework
    wall_lines: list[str] = []
    detail_lines: list[str] = []
    if include_walls:
        for entity in msp:
            layer = entity.dxf.layer
            if layer == WALL_LAYER:
                target = wall_lines
            elif include_detail and layer in DETAIL_LAYERS:
                target = detail_lines
            else:
                continue
            for (x1, y1), (x2, y2) in entity_lines(entity):
                mx1, my1 = map_point(x1, y1)
                mx2, my2 = map_point(x2, y2)
                target.append(f'<line x1="{mx1:.2f}" y1="{my1:.2f}" x2="{mx2:.2f}" y2="{my2:.2f}"/>')

    room_polys: list[str] = []
    label_texts: list[str] = []
    for i, room in enumerate(rooms):
        pts = " ".join(f"{x:.2f},{y:.2f}" for x, y in room["points"])
        building = room.get("building")
        if building and building in BUILDING_COLORS:
            fill = BUILDING_COLORS[building]
            bldg_attr = f' data-building="{building}"'
        else:
            fill = ROOM_FILL if i % 2 == 0 else ROOM_FILL_ALT
            bldg_attr = ""
        cx, cy = poly_centroid(room["points"])
        label_attr = ""
        if room.get("label"):
            safe = room["label"].replace('"', "&quot;")
            label_attr = f' data-label="{safe}" data-label-x="{cx:.2f}" data-label-y="{cy:.2f}"'
            if not overlay_labels:
                label_texts.append(
                    f'  <text x="{cx:.2f}" y="{cy:.2f}" font-size="{max(width, height) * 0.012:.1f}">{room["label"]}</text>'
                )
        room_polys.append(
            f'  <polygon class="proom" data-i="{room["id"]}"{bldg_attr}{label_attr} fill="{fill}" points="{pts}"/>'
        )

    building_polys: list[str] = []
    building_labels: list[str] = []
    if include_buildings:
        for outline in building_outlines:
            building = outline["building"]
            if not building:
                continue
            color = BUILDING_COLORS.get(building, "#64748b")
            mapped = [map_point(x, y) for x, y in outline["raw"]]
            pts = " ".join(f"{x:.2f},{y:.2f}" for x, y in mapped)
            building_polys.append(
                f'  <polygon class="pbuilding" data-building="{building}" fill="{color}" '
                f'fill-opacity="{BUILDING_OUTLINE_OPACITY}" stroke="{color}" stroke-width="3" '
                f'stroke-opacity="0.9" points="{pts}"/>'
            )
            cx, cy = poly_centroid(mapped)
            building_labels.append(
                f'  <text class="bldg-label" data-building="{building}" x="{cx:.2f}" y="{cy:.2f}" '
                f'font-size="{max(width, height) * 0.028:.1f}" fill="{color}">{building}</text>'
            )

    building_style = ""
    building_groups = ""
    if include_buildings:
        building_style = f"""
.pbuilding{{vector-effect:non-scaling-stroke}}
.proom{{fill-opacity:{BUILDING_FILL_OPACITY}}}
#planBuildingLabels text.bldg-label{{text-anchor:middle;dominant-baseline:central;font-weight:800;font-family:system-ui,'Segoe UI',Arial,sans-serif;paint-order:stroke;stroke:#ffffff;stroke-width:1.2px}}
"""
        building_groups = f"""<g id="planBuildings">
{chr(10).join(building_polys)}
</g>
<g id="planBuildingLabels">
{chr(10).join(building_labels)}
</g>
"""

    svg = f"""<svg id="planSvg" viewBox="{xmin:.2f} {ymin:.2f} {width:.2f} {height:.2f}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" width="{width:.0f}" height="{height:.0f}">
<style>
#planDetail line{{stroke:{DETAIL_STROKE};stroke-width:0.8;vector-effect:non-scaling-stroke}}
#planWalls line{{stroke:{WALL_STROKE};stroke-width:1.2;vector-effect:non-scaling-stroke}}
.proom{{stroke:#818b98;stroke-width:1;vector-effect:non-scaling-stroke;fill-opacity:0.72}}
#planLabels text{{text-anchor:middle;dominant-baseline:central;fill:#1f2328;paint-order:stroke;stroke:#ffffff;stroke-width:0.7px;font-weight:600;font-family:system-ui,'Segoe UI',Arial,sans-serif}}
{building_style}</style>
{building_groups}<g id="planRooms">
{chr(10).join(room_polys)}
</g>
<g id="planDetail">
{chr(10).join(detail_lines)}
</g>
<g id="planWalls">
{chr(10).join(wall_lines)}
</g>
{f'<g id="planLabels">\n{chr(10).join(label_texts)}\n</g>' if label_texts else ''}
</svg>
"""
    svg_path.write_text(svg, encoding="utf-8")
    buildings_found = sorted({o["building"] for o in building_outlines if o["building"]})
    return {
        "rooms": len(rooms),
        "walls": len(wall_lines),
        "buildings": len(buildings_found),
        "building_ids": ",".join(buildings_found),
        "viewBox_x": xmin,
        "viewBox_y": ymin,
        "viewBox_w": width,
        "viewBox_h": height,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert DXF floor plan to dashboard SVG")
    parser.add_argument("dxf", type=Path)
    parser.add_argument("svg", type=Path)
    parser.add_argument(
        "--buildings",
        action="store_true",
        help="Color rooms by CAFM building outline (A/B/C/D) and draw building footprints",
    )
    parser.add_argument(
        "--overlay-labels",
        action="store_true",
        help="Omit baked room labels; emit data-label on polygons for zoom-aware overlay",
    )
    args = parser.parse_args()
    stats = convert(
        args.dxf,
        args.svg,
        include_buildings=args.buildings,
        overlay_labels=args.overlay_labels,
    )
    extra = ""
    if stats.get("buildings"):
        extra = f", buildings={stats['building_ids']}"
    print(
        f"Wrote {args.svg} — {stats['rooms']} rooms, {stats['walls']} wall segments{extra}, "
        f"viewBox={stats['viewBox_x']:.1f} {stats['viewBox_y']:.1f} {stats['viewBox_w']:.1f} {stats['viewBox_h']:.1f}"
    )


if __name__ == "__main__":
    main()
