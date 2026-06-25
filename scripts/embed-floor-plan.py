"""Embed a PNG inside an SVG as a data URI so it renders via <img src>."""
from __future__ import annotations

import base64
import sys
from pathlib import Path


def embed(png_path: Path, svg_path: Path) -> None:
    data = base64.b64encode(png_path.read_bytes()).decode("ascii")
    w, h = 1024, 801  # known dimensions for Maplewood plan
    svg = f"""<svg id="planSvg" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}">
<image href="data:image/png;base64,{data}" x="0" y="0" width="{w}" height="{h}"/>
</svg>
"""
    svg_path.write_text(svg, encoding="utf-8")
    print(f"Wrote {svg_path} ({svg_path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    png = Path(sys.argv[1])
    svg = Path(sys.argv[2])
    embed(png, svg)
