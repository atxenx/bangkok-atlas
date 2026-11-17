"""Build a compact Bangkok appraisal-sheet index from Treasury's public CSV.

Run from the project root after downloading the Bangkok resource documented in
README.md. This is a reproducible aggregate, never a parcel-level spatial join.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path


RESOURCE_ID = "00da1ca3-2c41-436d-a426-d0c06f8cae03"
SOURCE_URL = (
    "https://catalog.treasury.go.th/dataset/"
    "f5072145-2f1a-4500-bf60-d122b866ac2f/resource/"
    f"{RESOURCE_ID}/download/land_10_bangkok.csv"
)
# Broad EPSG:24047 envelope of the bundled 50-district Bangkok boundary,
# padded by one 2-km sheet. This disambiguates the omitted 100-km UTM digits.
BANGKOK_UTM_BOUNDS = (642_000, 1_495_000, 712_000, 1_546_000)


def sheet_origin(code: str) -> tuple[int, int] | None:
    """Resolve the 2-km UTM sheet's lower-left corner within Bangkok."""
    if len(code) != 4 or not code.isdigit():
        return None
    east_suffix, north_suffix = int(code[:2]), int(code[2:])
    if east_suffix % 2 or north_suffix % 2:
        return None
    west, south, east, north = BANGKOK_UTM_BOUNDS
    candidates = [
        (e_base + east_suffix * 1000, n_base + north_suffix * 1000)
        for e_base in (600_000, 700_000)
        for n_base in (1_400_000, 1_500_000)
        if (west <= e_base + east_suffix * 1000 < east)
        and (south <= n_base + north_suffix * 1000 < north)
    ]
    return candidates[0] if len(candidates) == 1 else None


def tile_origin(sheet: tuple[int, int], scale: int, sheet_number: int) -> tuple[int, int] | None:
    """Place a 1:1,000 or 1:500 record on the official 500-m sheet grid."""
    if scale == 1000 and 1 <= sheet_number <= 16:
        row, col = divmod(sheet_number - 1, 4)
    elif scale == 500 and 1 <= sheet_number <= 64:
        small_row, small_col = divmod(sheet_number - 1, 8)
        row, col = small_row // 2, small_col // 2
    else:
        return None
    return sheet[0] + col * 500, sheet[1] + (3 - row) * 500


def quantile(values: list[float], fraction: float) -> int:
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    return round(ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower))


def summary(values: list[float]) -> dict[str, int]:
    return {
        "n": len(values),
        "median": quantile(values, 0.5),
        "p10": quantile(values, 0.1),
        "p90": quantile(values, 0.9),
    }


def build(source: Path, output: Path, source_modified: str, districts_path: Path | None = None) -> dict:
    tiles: dict[str, list[float]] = defaultdict(list)
    sheets: dict[str, list[float]] = defaultdict(list)
    scales: Counter[str] = Counter()
    skipped: Counter[str] = Counter()
    rows = 0

    with source.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        expected = {"UTMMAP1", "UTMMAP2", "UTMMAP3", "UTMMAP4", "UTMSCALE", "LAND_NO", "EVAPRICE"}
        if set(reader.fieldnames or []) != expected:
            raise ValueError(f"Unexpected Treasury CSV header: {reader.fieldnames}")
        for record in reader:
            rows += 1
            try:
                price = float(record["EVAPRICE"])
                scale = int(record["UTMSCALE"])
                number = int(record["UTMMAP4"])
            except (TypeError, ValueError):
                skipped["invalid_number"] += 1
                continue
            if not math.isfinite(price) or not 0 < price < 100_000_000:
                skipped["invalid_price"] += 1
                continue
            sheet = sheet_origin(record["UTMMAP3"])
            if sheet is None:
                skipped["unresolved_sheet"] += 1
                continue
            scales[str(scale)] += 1
            sheet_key = f"{sheet[0]},{sheet[1]}"
            sheets[sheet_key].append(price)
            tile = tile_origin(sheet, scale, number)
            if tile is not None:
                tiles[f"{tile[0]},{tile[1]}"].append(price)

    with source.open("rb") as csv_file:
        digest = hashlib.file_digest(csv_file, "sha256").hexdigest()
    district_summaries = {}
    if districts_path is not None:
        import geopandas as gpd
        from pyproj import Transformer
        from shapely.geometry import Point

        boundaries = gpd.read_file(districts_path).to_crs("EPSG:4326")
        to_wgs84 = Transformer.from_crs("EPSG:24047", "EPSG:4326", always_xy=True)
        district_prices: dict[str, list[float]] = defaultdict(list)
        district_shapes = [(row["name_en"], row.geometry) for _, row in boundaries.iterrows()]
        for key, prices in tiles.items():
            tile_e, tile_n = (int(part) for part in key.split(","))
            point = Point(*to_wgs84.transform(tile_e + 250, tile_n + 250))
            for name, geometry in district_shapes:
                if geometry.covers(point):
                    district_prices[name].extend(prices)
                    break
        district_summaries = {key: summary(values) for key, values in sorted(district_prices.items())}

    index = {
        "metadata": {
            "source": "Thai Treasury Department Bangkok land-valuation open data",
            "source_url": SOURCE_URL,
            "resource_id": RESOURCE_ID,
            "source_last_modified": source_modified,
            "source_sha256": digest,
            "rows_read": rows,
            "rows_indexed": sum(len(values) for values in sheets.values()),
            "scales": dict(sorted(scales.items())),
            "skipped": dict(sorted(skipped.items())),
            "unit": "THB/sq.wah",
            "tile_size_m": 500,
            "sheet_size_m": 2000,
            "coordinate_reference": "Indian 1975 / UTM zone 47N (EPSG:24047)",
            "note": "Spatial summaries of official appraisal records; not parcel matching or market transactions.",
        },
        "tiles": {key: summary(values) for key, values in sorted(tiles.items())},
        "sheets": {key: summary(values) for key, values in sorted(sheets.items())},
        "districts": district_summaries,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return index["metadata"] | {"tile_count": len(tiles), "sheet_count": len(sheets)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Downloaded Bangkok Treasury CSV")
    parser.add_argument("output", type=Path, help="Compact JSON index path")
    parser.add_argument("--source-modified", required=True, help="Last-modified date from Treasury resource metadata (YYYY-MM-DD)")
    parser.add_argument("--districts", type=Path, help="Bangkok 50-district GeoJSON for district summaries")
    args = parser.parse_args()
    print(json.dumps(build(args.source, args.output, args.source_modified, args.districts), ensure_ascii=False, indent=2))
