"""Export Lively Assessor Pro photo links from Lively_Pictures.xlsx to JSON."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("pip install openpyxl", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XLSX = Path.home() / "Downloads" / "Lively_Pictures.xlsx"
OUT = ROOT / "data" / "lively-pictures.json"


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def main() -> None:
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    if not xlsx.exists():
        print(f"Missing workbook: {xlsx}", file=sys.stderr)
        sys.exit(1)

    wb = openpyxl.load_workbook(xlsx)
    ws = wb.active
    records: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    for i, row in enumerate(ws.iter_rows(min_row=2), start=2):
        parent_type = str(row[0].value or "").strip()
        parent_name = str(row[1].value or "").strip()
        photo_name = str(row[2].value or "").strip()
        photo_link_label = str(row[3].value or photo_name).strip()
        link_cell = row[3]
        url = link_cell.hyperlink.target if link_cell.hyperlink else None
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        records.append(
            {
                "id": f"{slug(parent_type)}-{slug(parent_name)}-{slug(photo_name)}-{i}",
                "parentType": parent_type,
                "parentName": parent_name,
                "photoName": photo_name,
                "photoLinkLabel": photo_link_label,
                "url": url,
            }
        )

    wb.close()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"Wrote {len(records)} photos to {OUT}")


if __name__ == "__main__":
    main()
