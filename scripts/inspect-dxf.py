"""Quick DXF layer inspection."""
import sys
from pathlib import Path

import ezdxf

dxf_path = Path(sys.argv[1])
doc = ezdxf.readfile(str(dxf_path))
msp = doc.modelspace()
layers: dict[str, int] = {}
for e in msp:
    l = e.dxf.layer
    layers[l] = layers.get(l, 0) + 1

print("Layers:", len(layers))
for k, v in sorted(layers.items(), key=lambda x: -x[1]):
    print(f"  {k}: {v}")

extmin = doc.header["$EXTMIN"]
extmax = doc.header["$EXTMAX"]
print("EXTMIN", tuple(extmin), "EXTMAX", tuple(extmax))

for layer in sorted(layers):
    u = layer.upper()
    if any(x in u for x in ("BUILD", "BLDG", "CAFM", "WALL", "SPACE", "A-", "B-", "C-", "D-")):
        types: dict[str, int] = {}
        for e in msp:
            if e.dxf.layer != layer:
                continue
            types[e.dxftype()] = types.get(e.dxftype(), 0) + 1
        print(f"  >> {layer}: {types}")
