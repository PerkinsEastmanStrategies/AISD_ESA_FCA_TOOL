"""Match Lively buildings A-D to outlines and room counts."""
import sys
from pathlib import Path

import ezdxf

dxf_path = Path(sys.argv[1])
doc = ezdxf.readfile(str(dxf_path))
msp = doc.modelspace()


def point_in_polygon(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if ((y1 > y) != (y2 > y)) and (x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1):
            inside = not inside
    return inside


def poly_centroid(pts):
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


# Unique closed building outlines (dedupe by centroid)
outlines = []
seen = set()
for e in msp.query('LWPOLYLINE[layer=="CAFM_BLDG_OTLN"]'):
    if not e.closed:
        continue
    pts = [(p[0], p[1]) for p in e.get_points("xy")]
    if len(pts) < 3:
        continue
    c = poly_centroid(pts)
    key = (round(c[0]), round(c[1]), len(pts))
    if key in seen:
        continue
    seen.add(key)
    outlines.append({"pts": pts, "centroid": c})

labels = []
for e in msp.query('TEXT[layer=="CAFM_BLDG_LABL"]'):
    labels.append({"id": e.dxf.text.strip(), "x": e.dxf.insert.x, "y": e.dxf.insert.y})

# Assign label to outline containing it, else nearest centroid
for lab in labels:
    for o in outlines:
        if point_in_polygon(lab["x"], lab["y"], o["pts"]):
            o["building"] = lab["id"]
            break
    else:
        best = min(outlines, key=lambda o: (o["centroid"][0] - lab["x"]) ** 2 + (o["centroid"][1] - lab["y"]) ** 2)
        best["building"] = lab["id"]

print("Building outlines:")
for o in outlines:
    print(f"  {o.get('building', '?')}: centroid={o['centroid']}, npts={len(o['pts'])}")

rooms = []
for e in msp.query('LWPOLYLINE[layer=="CAFM_SPACE"]'):
    if not e.closed:
        continue
    pts = [(p[0], p[1]) for p in e.get_points("xy")]
    if len(pts) < 3:
        continue
    cx, cy = poly_centroid(pts)
    building = "?"
    for o in outlines:
        if point_in_polygon(cx, cy, o["pts"]):
            building = o.get("building", "?")
            break
    rooms.append(building)

from collections import Counter

print("\nRooms per building:", dict(Counter(rooms)))
print("Unassigned:", rooms.count("?"))
