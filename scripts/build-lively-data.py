"""Convert Lively FCA recommendations (xlsx) and asset inventory (csv) to JSON for the app."""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("pip install openpyxl", file=sys.stderr)
    raise


def clean(value) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    recs_xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads" / "AISD_Recs.xlsx"
    assets_csv = Path(sys.argv[2]) if len(sys.argv) > 2 else Path.home() / "Downloads" / "AISD_ASSET_Lively.csv"
    out_path = root / "data" / "lively-facility.json"

    wb = openpyxl.load_workbook(recs_xlsx, read_only=True, data_only=True)
    ws = wb.active
    recs = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[3] or "Lively" not in str(row[3]):
            continue
        recs.append(
            {
                "id": clean(row[1]),
                "building": clean(row[4]),
                "system": clean(row[5]),
                "subsystem": clean(row[6]),
                "deficiency": clean(row[7]),
                "recommendation": clean(row[8]),
                "estimateDescription": clean(row[9]),
                "estimateSow": clean(row[10]),
                "quantity": row[11],
                "unit": clean(row[12]),
                "directCost": float(row[13] or 0),
                "markups": float(row[14] or 0),
                "totalCost": float(row[15] or 0),
                "impactSeverity": clean(row[16]),
                "campusImpact": clean(row[17]),
                "priority": clean(row[18]),
                "sequencing": clean(row[19]),
                "timing": clean(row[20]),
            }
        )
    wb.close()

    assets = []
    with assets_csv.open(encoding="utf-8") as f:
        for a in csv.DictReader(f):
            if not clean(a.get("System")):
                continue
            year_raw = clean(a.get("Year Installed", ""))
            assets.append(
                {
                    "id": clean(a["Asset UUID"]),
                    "facility": clean(a["Facility"]),
                    "systemCode": clean(a["System"]),
                    "subsystem": clean(a["Subsystem"]),
                    "assetGroup": clean(a["Asset Group"]),
                    "assetName": clean(a["Asset Name"]),
                    "attribute1": clean(a.get("Attribute 1", "")),
                    "attribute2": clean(a.get("Attribute 2", "")),
                    "yearInstalled": int(year_raw) if year_raw.isdigit() else None,
                    "quantity": clean(a.get("Quantity", "")),
                    "quantityUom": clean(a.get("Quantity UOM", "")),
                    "status": clean(a.get("Operational Status", "")) or "Unknown",
                    "location": clean(a.get("Location", "")),
                    "capacity": clean(a.get("Capacity", "")),
                    "capacityUom": clean(a.get("Capacity UOM", "")),
                    "manufacturer": clean(a.get("Np Manufacturer", "")),
                    "model": clean(a.get("Np Model", "")),
                }
            )

    out_path.write_text(json.dumps({"recommendations": recs, "assets": assets}, indent=2), encoding="utf-8")
    print(f"Wrote {out_path} ({len(recs)} recommendations, {len(assets)} assets)")


if __name__ == "__main__":
    main()
