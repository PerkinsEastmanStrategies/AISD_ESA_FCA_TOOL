"""Inspect building labels and outlines in Lively DXF."""
import sys
from pathlib import Path

import ezdxf

dxf_path = Path(sys.argv[1])
doc = ezdxf.readfile(str(dxf_path))
msp = doc.modelspace()

print("=== CAFM_BLDG_LABL ===")
for e in msp.query('TEXT[layer=="CAFM_BLDG_LABL"]'):
    print(f"  TEXT: {e.dxf.text!r} at ({e.dxf.insert.x:.1f}, {e.dxf.insert.y:.1f})")

print("\n=== CAFM_BLDG_OTLN closed polylines ===")
for i, e in enumerate(msp.query('LWPOLYLINE[layer=="CAFM_BLDG_OTLN"]')):
    pts = [(p[0], p[1]) for p in e.get_points("xy")]
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    print(f"  poly {i}: closed={e.closed} n={len(pts)} centroid=({cx:.1f}, {cy:.1f})")

print("\n=== CAFM_Floor_Label ===")
for e in msp.query('MTEXT[layer=="CAFM_Floor_Label"]'):
    print(f"  {e.text!r}")

print("\n=== Sample CAFM_ID labels ===")
for e in list(msp.query('TEXT[layer=="CAFM_ID"]'))[:10]:
    print(f"  {e.dxf.text!r} at ({e.dxf.insert.x:.1f}, {e.dxf.insert.y:.1f})")
