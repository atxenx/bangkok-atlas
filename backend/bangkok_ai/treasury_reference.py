"""Location-level summaries of public Treasury appraisal records.

The official CSV has map-sheet codes and appraisals, but no parcel geometry.
This module maps a point to a nearby *sheet*, never to an individual parcel.
"""
from __future__ import annotations

import json
import math
import threading
import time
from datetime import datetime, timezone
from functools import lru_cache

import requests
from pyproj import Transformer

from .config import DATA_PROCESSED
from .official_land_price import DATASTORE_URL, RESOURCE_ID, RESOURCE_URL


_WGS84_TO_INDIAN = Transformer.from_crs("EPSG:4326", "EPSG:24047", always_xy=True)
_WGS_UTM_TO_INDIAN = Transformer.from_crs("EPSG:32647", "EPSG:24047", always_xy=True)
_LIVE_CACHE: dict[str, tuple[float, dict]] = {}
_LIVE_LOCK = threading.Lock()
MIN_TILE_RECORDS = 30
MIN_SHEET_RECORDS = 30
LIVE_LIMIT = 2500


@lru_cache(maxsize=1)
def load_index() -> dict:
    path = DATA_PROCESSED / "treasury_price_index.json"
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def sheet_location(easting: float, northing: float) -> dict:
    tile_e = math.floor(easting / 500) * 500
    tile_n = math.floor(northing / 500) * 500
    sheet_e = math.floor(easting / 2000) * 2000
    sheet_n = math.floor(northing / 2000) * 2000
    col = (tile_e - sheet_e) // 500
    row_from_top = 3 - (tile_n - sheet_n) // 500
    return {
        "tile_key": f"{tile_e},{tile_n}",
        "sheet_key": f"{sheet_e},{sheet_n}",
        "utm_sheet": f"{(sheet_e // 1000) % 100:02d}{(sheet_n // 1000) % 100:02d}",
        "utm_subsheet": row_from_top * 4 + col + 1,
    }


def _reference_for_xy(easting: float, northing: float) -> dict | None:
    index = load_index()
    if not index:
        return None
    location = sheet_location(easting, northing)
    tile = index["tiles"].get(location["tile_key"])
    sheet = index["sheets"].get(location["sheet_key"])
    if tile and tile["n"] >= MIN_TILE_RECORDS:
        record, resolution = tile, 500
    elif sheet and sheet["n"] >= MIN_SHEET_RECORDS:
        record, resolution = sheet, 2000
    else:
        return None
    return {
        **record,
        "resolution_m": resolution,
        "source_mode": "official_csv_snapshot",
        "source_last_modified": index["metadata"]["source_last_modified"],
        "source_url": RESOURCE_URL,
        "utm_sheet": location["utm_sheet"],
        "utm_subsheet": location["utm_subsheet"] if resolution == 500 else None,
    }


def reference_for_point(lat: float, lng: float) -> dict | None:
    if not (13.4 <= lat <= 14.1 and 100.2 <= lng <= 101.1):
        return None
    return _reference_for_xy(*_WGS84_TO_INDIAN.transform(lng, lat))


def reference_for_wgs_utm(easting: float, northing: float) -> dict | None:
    if not (math.isfinite(easting) and math.isfinite(northing)):
        return None
    return _reference_for_xy(*_WGS_UTM_TO_INDIAN.transform(easting, northing))


def reference_for_district(district_en: str) -> dict | None:
    """Use actual appraisal records as a broad fallback, not invented baselines."""
    index = load_index()
    districts = index.get("districts", {})
    # Grid labels contain both languages (e.g. "Nong Chok หนองจอก").
    # Match the complete English district before its Thai display name.
    canonical_name = next(
        (name for name in districts if district_en == name or district_en.startswith(f"{name} ")),
        district_en,
    )
    record = districts.get(canonical_name)
    if not record or record["n"] < MIN_SHEET_RECORDS:
        return None
    return {
        **record,
        "resolution_m": None,
        "source_mode": "official_csv_district_snapshot",
        "source_last_modified": index["metadata"]["source_last_modified"],
        "source_url": RESOURCE_URL,
        "utm_sheet": None,
        "utm_subsheet": None,
    }


def _quantile(values: list[float], fraction: float) -> int:
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    return round(ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower))


def refresh_reference_for_point(lat: float, lng: float) -> dict | None:
    """Refresh a selected 500-m sheet from CKAN; fall back to the CSV snapshot.

    A 2-km sheet can contain >10,000 records, so those use the published
    snapshot instead of silently sampling a truncated API response.
    """
    snapshot = reference_for_point(lat, lng)
    if not snapshot or snapshot["resolution_m"] != 500:
        return snapshot
    cache_key = f'{snapshot["utm_sheet"]}:{snapshot["utm_subsheet"]}'
    with _LIVE_LOCK:
        cached = _LIVE_CACHE.get(cache_key)
    if cached and cached[0] > time.monotonic():
        return cached[1]

    filters = {
        "UTMMAP3": snapshot["utm_sheet"],
        "UTMMAP4": snapshot["utm_subsheet"],
        "UTMSCALE": "1000",
    }
    try:
        response = requests.get(
            DATASTORE_URL,
            params={"resource_id": RESOURCE_ID, "filters": json.dumps(filters), "limit": LIVE_LIMIT},
            timeout=5,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("success") is not True:
            return snapshot
        result = payload.get("result", {})
        records = result.get("records", [])
        if not isinstance(records, list) or result.get("total") != len(records) or len(records) < MIN_TILE_RECORDS:
            return snapshot
        prices = []
        for record in records:
            if (
                str(record.get("UTMMAP3")) != filters["UTMMAP3"]
                or int(record.get("UTMMAP4", -1)) != filters["UTMMAP4"]
                or str(record.get("UTMSCALE")) != filters["UTMSCALE"]
            ):
                return snapshot
            price = float(record["EVAPRICE"])
            if not math.isfinite(price) or not 0 < price < 100_000_000:
                return snapshot
            prices.append(price)
    except (requests.RequestException, ValueError, TypeError, KeyError, AttributeError):
        return snapshot

    refreshed = {
        **snapshot,
        "n": len(prices),
        "median": _quantile(prices, 0.5),
        "p10": _quantile(prices, 0.1),
        "p90": _quantile(prices, 0.9),
        "source_mode": "official_live_api",
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
    with _LIVE_LOCK:
        _LIVE_CACHE[cache_key] = (time.monotonic() + 3600, refreshed)
    return refreshed
