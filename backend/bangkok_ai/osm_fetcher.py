"""Fetch Bangkok OpenStreetMap layers from the Overpass API.

Layers (all real OSM data, ODbL licensed):

  transit  - stations/stops (BTS, MRT, ARL, heavy rail)
  poi      - amenities, shops, tourism, offices (point features)
  landuse  - land-use polygons
  greenery - parks, gardens, forests, grass, wetlands
  water    - water polygons
  roads    - road network (major + minor, line features)

Geometry from ``out geom``; nodes -> points, closed ways -> polygons,
open ways -> lines. Relations are skipped in Phase 1 (noted in docs/DATA.md).
Output is deduplicated on (osm_type, osm_id) and saved as GeoJSON + Parquet
under data/raw/.
"""
from __future__ import annotations

import logging
import time
from typing import Iterable

import geopandas as gpd
import pandas as pd
import requests
from shapely.geometry import LineString, Point, Polygon, shape

from .config import (
    BANGKOK_BBOX,
    CRS_WGS84,
    DATA_RAW,
    OVERPASS_MIRRORS,
    OVERPASS_UA,
)

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tag definitions (auditable)
# ---------------------------------------------------------------------------
TRANSIT_TAGS = [
    ("railway", ["station", "halt", "tram_stop", "subway_entrance", "stop"]),
    ("station", ["subway", "light_rail", "monorail"]),
]

POI_GROUPS: dict[str, dict] = {
    "food": {"amenity": ["restaurant", "cafe", "fast_food", "bar", "pub",
                         "nightclub", "food_court", "ice_cream"]},
    "retail": {"shop": ["supermarket", "convenience", "mall", "department_store",
                        "bakery", "clothes", "electronics", "furniture", "hardware",
                        "books", "florist", "greengrocer", "chemist", "optician",
                        "jewelry", "shoes", "sports", "toys", "gift"]},
    "services": {"amenity": ["bank", "atm", "post_office", "police", "fire_station",
                             "fuel", "car_parking", "bicycle_parking", "taxi",
                             "money_exchange", "veterinary", "dry_cleaning", "laundry"]},
    "education": {"amenity": ["school", "kindergarten", "university", "college",
                              "music_school", "language_school"]},
    "health": {"amenity": ["hospital", "clinic", "pharmacy", "dentist", "doctors"]},
    "culture": {"amenity": ["place_of_worship", "library", "cinema", "theatre",
                            "arts_centre", "community_centre", "courthouse", "townhall",
                            "marketplace"],
                "tourism": ["museum", "gallery", "attraction", "viewpoint"]},
    "lodging": {"tourism": ["hotel", "hostel", "guest_house", "motel", "apartment"]},
    "business": {"office": None},  # any office=*
}

LANDUSE_TAGS = ["residential", "commercial", "retail", "industrial", "mixed_use",
                "institutional", "education", "religious", "cemetery", "construction"]

GREEN_TAGS = [
    ("leisure", ["park", "garden", "nature_reserve", "recreation_ground", "golf_course"]),
    ("landuse", ["forest", "grass", "meadow", "orchard", "recreation_ground", "village_green"]),
    ("natural", ["wood", "scrub", "grassland", "wetland", "heath"]),
]

WATER_TAGS = [
    ("natural", ["water"]),
    ("landuse", ["reservoir"]),
]

ROAD_MAJOR = ["motorway", "trunk", "primary", "secondary", "tertiary"]
ROAD_MINOR = ["residential", "unclassified", "living_street"]


def _tag_clause(key: str, values: list[str] | None) -> str:
    """Overpass regex/presence clause for a key."""
    if values is None:
        return f'["{key}"]'
    return f'["{key}"~"^({"|".join(values)})$"]'


def _group_condition(key: str, values: list[str] | None) -> str:
    if key == "office" and values is None:
        return '["office"]'
    return _tag_clause(key, values)


def build_query(conditions: Iterable[tuple[str, list[str] | None]],
                geometry_types: Iterable[str] = ("node", "way")) -> str:
    """Build an Overpass query unioning the given (key, values) conditions.

    Overpass bbox order is (south, west, north, east) = (min_lat, min_lon,
    max_lat, max_lon); BANGKOK_BBOX is stored as (min_lon, min_lat, ...).
    """
    min_lon, min_lat, max_lon, max_lat = BANGKOK_BBOX
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    parts = ["[out:json][timeout:240];", "("]
    for key, values in conditions:
        for gtype in geometry_types:
            parts.append(f'  {gtype}{_group_condition(key, values)}({bbox});')
    parts.append(");")
    parts.append("out geom;")
    return "\n".join(parts)


LAYER_QUERIES: dict[str, str] = {
    "transit": build_query(TRANSIT_TAGS),
    "poi": build_query(
        [(key, vals) for group in POI_GROUPS.values() for key, vals in group.items()]
    ),
    "landuse": build_query([("landuse", LANDUSE_TAGS)], geometry_types=("way",)),
    "greenery": build_query(
        [(key, vals) for key, vals in GREEN_TAGS], geometry_types=("way",)
    ),
    "water": build_query(
        [(key, vals) for key, vals in WATER_TAGS], geometry_types=("way",)
    ),
    "roads_major": build_query([("highway", ROAD_MAJOR)], geometry_types=("way",)),
    "roads_minor": build_query([("highway", ROAD_MINOR)], geometry_types=("way",)),
}


def _element_geometry(el: dict):
    """Convert an Overpass element (out geom) to a shapely geometry or None.

    With `out geom`, node coordinates live in top-level lat/lon keys while
    ways/relations carry a nested `geometry` list.
    """
    if el["type"] == "node":
        lat, lon = el.get("lat"), el.get("lon")
        if lat is None or lon is None:
            geom = el.get("geometry")
            if geom:
                lon, lat = geom.get("lon"), geom.get("lat")
        if lat is None or lon is None:
            return None
        return Point(lon, lat)
    geom = el.get("geometry")
    if not geom:
        return None
    coords = [(p["lon"], p["lat"]) for p in geom]
    if len(coords) < 2:
        return None
    if len(coords) >= 4 and coords[0] == coords[-1]:
        return Polygon(coords)
    return LineString(coords)


def _categorize(tags: dict) -> tuple[str | None, str | None]:
    """Return (group, category) for a POI element."""
    for group, mapping in POI_GROUPS.items():
        for key, values in mapping.items():
            val = tags.get(key)
            if val is None:
                continue
            if values is None:  # presence-only (office)
                return group, key
            if val in values:
                return group, val
    return None, None


def overpass_fetch(query: str, max_attempts: int = 4) -> dict:
    """Run an Overpass query with mirror fallback and retry-on-429/504."""
    last_err: Exception | None = None
    for attempt in range(max_attempts):
        for url in OVERPASS_MIRRORS:
            try:
                resp = requests.post(url, data={"data": query},
                                     headers={"User-Agent": OVERPASS_UA},
                                     timeout=300)
                if resp.status_code in (429, 504, 502):
                    retry_after = resp.headers.get("Retry-After")
                    wait = float(retry_after) if retry_after else 5.0 * (attempt + 1)
                    log.warning("Overpass %s on %s, waiting %.0fs", resp.status_code, url, wait)
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                return resp.json()
            except requests.RequestException as exc:  # noqa: PERF203
                last_err = exc
                log.warning("Overpass request failed on %s: %s", url, exc)
                time.sleep(3)
    raise RuntimeError(f"Overpass query failed after {max_attempts} attempts: {last_err}")


def elements_to_gdf(elements: list[dict], layer: str) -> gpd.GeoDataFrame:
    """Convert Overpass elements to a WGS84 GeoDataFrame with provenance columns."""
    rows = []
    seen = set()
    for el in elements:
        key = (el["type"], el["id"])
        if key in seen:
            continue
        seen.add(key)
        geom = _element_geometry(el)
        if geom is None or geom.is_empty:
            continue
        tags = el.get("tags", {})
        row = {
            "osm_type": el["type"],
            "osm_id": el["id"],
            "geometry": geom,
            "name": tags.get("name", ""),
        }
        if layer == "transit":
            if tags.get("railway") == "construction":
                continue  # not yet operational: would inflate accessibility
            row["category"] = tags.get("station") or tags.get("railway", "")
            row["group"] = "transit"
            row["name_en"] = tags.get("name:en", "")
        elif layer == "poi":
            group, category = _categorize(tags)
            if group is None:
                continue  # matched a tag family but not a curated value
            row["group"] = group
            row["category"] = category
        elif layer == "landuse":
            row["category"] = tags.get("landuse", "")
            row["group"] = "landuse"
        elif layer == "greenery":
            row["category"] = tags.get("leisure") or tags.get("landuse") or tags.get("natural", "")
            row["group"] = "greenery"
        elif layer == "water":
            row["category"] = tags.get("natural") or tags.get("landuse", "")
            row["group"] = "water"
        elif layer in ("roads_major", "roads_minor"):
            row["category"] = tags.get("highway", "")
            row["group"] = "major" if layer == "roads_major" else "minor"
            row["lanes"] = tags.get("lanes", "")
            row["oneway"] = tags.get("oneway", "")
        rows.append(row)
    gdf = gpd.GeoDataFrame(rows, geometry="geometry", crs=CRS_WGS84)
    return gdf


def fetch_layer(layer: str, out_dir=DATA_RAW) -> gpd.GeoDataFrame:
    """Fetch one layer and persist GeoJSON + Parquet. Returns the frame."""
    out_dir.mkdir(parents=True, exist_ok=True)
    query = LAYER_QUERIES[layer]
    log.info("Fetching OSM layer: %s", layer)
    data = overpass_fetch(query)
    elements = data.get("elements", [])
    log.info("  %s: %d raw elements", layer, len(elements))
    gdf = elements_to_gdf(elements, layer)
    if gdf.empty:
        log.warning("  layer %s is EMPTY", layer)
        return gdf
    gdf.to_file(out_dir / f"{layer}.geojson", driver="GeoJSON")
    gdf.to_parquet(out_dir / f"{layer}.parquet")
    log.info("  %s: %d features saved", layer, len(gdf))
    return gdf


def fetch_all(out_dir=DATA_RAW) -> dict[str, gpd.GeoDataFrame]:
    """Fetch all layers; 'roads' merges major+minor into one frame."""
    frames = {}
    for layer in LAYER_QUERIES:
        frames[layer] = fetch_layer(layer, out_dir=out_dir)
    roads = pd.concat([frames["roads_major"], frames["roads_minor"]],
                      ignore_index=True)
    roads = gpd.GeoDataFrame(roads, geometry="geometry", crs=CRS_WGS84)
    roads.to_file(out_dir / "roads.geojson", driver="GeoJSON")
    roads.to_parquet(out_dir / "roads.parquet")
    frames["roads"] = roads
    return frames
