"""FastAPI application: grid, location detail, search, presets, recommendation.

Features:
- Instant 3D buildings cache
- Bangkok 50 Khets & Neighborhoods spatial geocoding
- Treasury-cycle district benchmarks & Spatial Hedonic Pricing
- Autocomplete search for stations, districts, and landmarks
- Weighted recommendation with land-use constraints; budget is informational
"""
from __future__ import annotations

import json
import math
import threading
import time
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Literal, Optional

import geopandas as gpd
import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from shapely.geometry import Point, mapping, shape
from shapely.ops import nearest_points
from shapely.strtree import STRtree

from .admin_geo import (
    BANGKOK_DISTRICTS,
    BANGKOK_LANDMARKS,
    BANGKOK_NEIGHBORHOODS,
    enrich_location_context,
    find_nearest_district,
    haversine_distance_m,
)
from .config import (
    BANGKOK_BBOX,
    CRS_WGS84,
    DATA_PROCESSED,
    DATA_RAW,
    DATA_STATUS,
    OVERPASS_UA,
    OVERPASS_URL,
    PRESETS,
    QUALITY_DIMENSIONS,
    QUALITY_WEIGHTS,
)
from .features import STATION_CATEGORIES
from .land_price import estimate_land_price
from .official_land_price import OfficialAppraisalUnavailable, lookup_bangkok_appraisal
from .lines import load_lines
from .memo import generate_investment_memo
from .quality import factors
from .recommend import comparables, top_recommendations
from .store import load_cells, load_dims, load_features
from .street_visual import compute_street_indices
from .treasury_reference import reference_for_district, reference_for_point, refresh_reference_for_point
from .official_road_reference import road_benchmark_for_context

@asynccontextmanager
async def lifespan(_: FastAPI):
    _load_data()
    yield


app = FastAPI(
    title="Bangkok Atlas — Neighborhood Analysis API",
    version="0.2.0",
    description="Explainable neighborhood quality, district-level appraisal-cycle "
                "benchmarks, hedonic screening estimates, and multimodal recommendation.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=6)


@lru_cache(maxsize=1)
def _load_buildings_3d() -> dict:
    """Load real, explicitly mapped OSM building heights from local processed cache."""
    cache_path = DATA_PROCESSED / "buildings_3d.geojson"
    if cache_path.exists():
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            data["metadata"] = {
                "source": "OpenStreetMap via Overpass API",
                "height_policy": "Only explicit OSM height=* values are rendered.",
                "coverage": "Bangkok study-area bounding box",
                "cached": True,
            }
            return data
        except Exception:
            pass

    # Fallback to Overpass if local file missing
    query = """[out:json][timeout:30];
      way[building][height](13.715,100.525,13.735,100.545);
      out geom;"""
    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": OVERPASS_UA},
            timeout=30,
        )
        response.raise_for_status()
        features = []
        for item in response.json().get("elements", []):
            coords = item.get("geometry", [])
            raw_height = str(item.get("tags", {}).get("height", ""))
            try:
                height = float(raw_height.removesuffix("m").strip())
            except ValueError:
                continue
            if len(coords) < 4 or height <= 0:
                continue
            ring = [[point["lon"], point["lat"]] for point in coords]
            features.append({
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [ring]},
                "properties": {
                    "osm_id": item["id"],
                    "height_m": height,
                    "name": item.get("tags", {}).get("name", ""),
                },
            })
        fc = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "source": "OpenStreetMap via Overpass API",
                "height_policy": "Only explicit OSM height=* values are rendered.",
                "coverage": "Silom-Sathorn preview window",
                "cached": False,
            },
        }
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(fc, f)
        return fc
    except Exception:
        pass

    return {"type": "FeatureCollection", "features": []}


@lru_cache(maxsize=1)
def _load_districts_geojson() -> dict:
    """Load Bangkok 50 official administrative districts GeoJSON with properties."""
    cache_path = DATA_PROCESSED / "districts.geojson"
    if cache_path.exists():
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                reference = reference_for_district(props.get("name_en", ""))
                if reference:
                    props["assessed_price_sqwah"] = reference["median"]
                    props["market_price_sqwah"] = reference["median"]
                    props["market_price_low"] = reference["p10"]
                    props["market_price_high"] = reference["p90"]
                    props["price_source"] = "treasury_district_reference"
                    props["price_record_count"] = reference["n"]
            return data
        except Exception:
            pass
    return {"type": "FeatureCollection", "features": []}


FEATURE_SUMMARY = [
    "n_poi", "poi_density", "poi_diversity", "n_transit", "transit_dist_m",
    "station_dist_m", "retail_density", "green_share", "green_dist_m",
    "water_share", "road_density", "major_dist_m", "commercial_share",
    "residential_share", "industrial_share", "low_data",
]

_STATION_PRIORITY = {"subway": 0, "light_rail": 1, "monorail": 2, "station": 3, "halt": 4}


def _load_stations() -> list[dict]:
    """Station-like transit points (BTS/MRT/ARL/SRT) with Thai and English names."""
    try:
        tr = gpd.read_parquet(DATA_RAW / "transit.parquet")
    except FileNotFoundError:
        return []
    if tr.empty or "category" not in tr.columns:
        return []
    st = tr[tr["category"].isin(STATION_CATEGORIES)].copy()
    if st.empty:
        return []
    st["_prio"] = st["category"].map(lambda c: _STATION_PRIORITY.get(c, 5))
    st = st.sort_values("_prio")
    st = st.drop_duplicates(subset="name", keep="first")

    lines_meta, station_lines, _ = load_lines()
    line_by_ref = {ln["ref"]: ln for ln in lines_meta}

    rows = []
    for _, r in st.iterrows():
        g = r.geometry
        if g.geom_type != "Point":
            g = g.centroid if not g.is_empty else None
        if g is None:
            continue
        name = str(r["name"] or "")
        lines = [
            line_by_ref[ref] for ref in station_lines.get(name, [])
            if ref in line_by_ref
        ]
        rows.append({
            "name": name,
            "name_en": str(r.get("name_en", "") or ""),
            "lat": round(float(g.y), 6),
            "lng": round(float(g.x), 6),
            "category": str(r["category"] or "station"),
            "lines": lines,
        })
    return rows


def _get_nearest_operating_station(lat: float, lng: float, stations: list[dict]) -> tuple[str, float | None]:
    """Find nearest operating BTS/MRT/ARL/SRT station with accurate line prefix and distance."""
    op_stations = [s for s in stations if len(s.get("lines", [])) > 0]
    if not op_stations:
        op_stations = stations

    if not op_stations:
        return "", None

    closest = min(
        op_stations,
        key=lambda s: (s["lat"] - lat) ** 2 + (s["lng"] - lng) ** 2,
    )
    dist_m = haversine_distance_m(lat, lng, closest["lat"], closest["lng"])
    line_refs = [ln.get("ref", "") for ln in closest.get("lines", []) if ln.get("ref")]
    st_th = closest.get("name", "")
    st_en = closest.get("name_en", "")
    prefix = "/".join(line_refs) if line_refs else ""

    if prefix:
        if st_en and st_en != st_th:
            st_name = f"{prefix} {st_th} ({st_en})"
        else:
            st_name = f"{prefix} {st_th}"
    else:
        st_name = f"{st_th} ({st_en})" if st_en and st_en != st_th else st_th

    return st_name, dist_m


class Preferences(BaseModel):
    """User preferences for location recommendation."""
    weights: dict[str, float] = Field(
        default_factory=lambda: {d: 50.0 for d in QUALITY_DIMENSIONS}
    )
    budget: Optional[float] = Field(None, gt=0, description="Optional THB budget, stored for context but not used to rank without parcel evidence")
    land_size_sqwah: Optional[float] = Field(None, gt=0, description="Preferred land size in sq. wah")
    land_use: Optional[Literal["residential", "commercial"]] = Field(
        None, description="Preferred land-use"
    )
    district: Optional[str] = Field(None, description="Filter by district name or code")
    k: int = Field(10, ge=1, le=50)

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
def _load_data() -> None:
    from .store import pipeline_ready
    if not pipeline_ready():
        raise RuntimeError(
            "Processed data missing. Run the pipeline first: "
            "python -m bangkok_ai.cli all"
        )
    app.state.cells = load_cells()
    app.state.features = load_features()
    app.state.dims = load_dims()
    app.state.cells_utm = app.state.cells.to_crs("EPSG:32647")
    app.state.cells_utm["center_utm_x"] = app.state.cells_utm.geometry.centroid.x
    app.state.cells_utm["center_utm_y"] = app.state.cells_utm.geometry.centroid.y
    app.state.features["center_utm_x"] = app.state.cells_utm["center_utm_x"].values
    app.state.features["center_utm_y"] = app.state.cells_utm["center_utm_y"].values

    # Pre-calculate district names for fast lookup
    districts = []
    for _, row in app.state.cells.iterrows():
        d = find_nearest_district(float(row["center_lat"]), float(row["center_lng"]))
        districts.append(f"{d['name_en']} {d.get('name_th', '')}".strip())
    app.state.districts = districts

    # Stations
    app.state.stations = _load_stations()
    _grid_payload.cache_clear()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
@app.get("/api/health", include_in_schema=False)
def health():
    return {
        "status": "ok",
        "data_status": DATA_STATUS,
        "cells_count": len(app.state.cells) if hasattr(app.state, "cells") else 0,
        "stations_count": len(app.state.stations) if hasattr(app.state, "stations") else 0,
        "buildings_count": len(_load_buildings_3d().get("features", [])),
    }


@app.get("/api/official-land-price")
def official_land_price(
    land_no: str = Query(..., pattern=r"^[0-9]{1,10}$"),
    utm_map1: str = Query(..., pattern=r"^[0-9]{4}$"),
    utm_map2: str = Query(..., pattern=r"^[0-9]{1,2}$"),
    utm_map3: str = Query(..., pattern=r"^[0-9]{4}$"),
    utm_map4: int = Query(..., ge=1, le=999),
    utm_scale: str = Query(..., pattern=r"^[0-9]{3,5}$"),
):
    """Fetch an exact Bangkok parcel record from Treasury's public CKAN API."""
    try:
        return lookup_bangkok_appraisal(
            land_no=land_no, utm_map1=utm_map1, utm_map2=utm_map2,
            utm_map3=utm_map3, utm_map4=utm_map4, utm_scale=utm_scale,
        )
    except OfficialAppraisalUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/treasury-sheet-price")
def treasury_sheet_price(
    lat: float = Query(..., ge=13.4, le=14.1),
    lng: float = Query(..., ge=100.2, le=101.1),
):
    """Fetch current public appraisals for a nearby 500-m map sheet when possible."""
    return {"reference": refresh_reference_for_point(lat, lng)}


@app.get("/api/presets")
def get_presets():
    """Return curated preference personas and slider profiles."""
    return {"presets": PRESETS}


@app.get("/api/buildings-3d")
def buildings_3d():
    """Instant 3D OSM building footprints with heights."""
    return _load_buildings_3d()


_building_name_lock = threading.Lock()
_building_name_last_request = 0.0

# A named restaurant or shop can be inside a building, but is not its name.
_BUILDING_POI_CATEGORIES = {
    "mall", "office", "hotel", "hospital", "school", "college", "university",
    "place_of_worship", "museum", "theatre", "cinema", "library", "stadium",
    "supermarket", "marketplace", "department_store", "apartments", "residential",
    "commercial", "government", "townhall", "community_centre", "bank",
}
_BUILDING_NODE_CATEGORIES = {
    "mall", "office", "hotel", "hospital", "school", "college", "university",
    "place_of_worship", "museum", "theatre", "cinema", "library", "stadium",
    "government", "townhall", "community_centre",
}


@lru_cache(maxsize=1)
def _named_building_pois():
    """Index named OSM footprints from the bundled Bangkok POI snapshot."""
    path = DATA_RAW / "poi.geojson"
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as file:
        features = json.load(file).get("features", [])
    geometries, properties = [], []
    node_geometries, node_properties = [], []
    for feature in features:
        props = feature.get("properties") or {}
        if not props.get("name") or props.get("category") not in _BUILDING_POI_CATEGORIES:
            continue
        geometry = feature.get("geometry")
        if not geometry or geometry.get("type") not in {"Polygon", "MultiPolygon", "Point"}:
            continue
        polygon = shape(geometry)
        if not polygon.is_valid or polygon.is_empty:
            continue
        if polygon.geom_type == "Point":
            if props.get("category") in _BUILDING_NODE_CATEGORIES:
                node_geometries.append(polygon)
                node_properties.append(props)
            continue
        geometries.append(polygon)
        properties.append(props)
    return STRtree(geometries), geometries, properties, STRtree(node_geometries), node_geometries, node_properties


def _lookup_local_building_name(lat: float, lng: float, footprint=None) -> dict | None:
    indexed = _named_building_pois()
    if indexed is None:
        return None
    tree, geometries, properties, node_tree, node_geometries, node_properties = indexed
    point = Point(lng, lat)
    matches = [int(index) for index in tree.query(point)
               if geometries[int(index)].covers(point)]
    if not matches and footprint is not None:
        nodes = [int(index) for index in node_tree.query(footprint)
                 if footprint.covers(node_geometries[int(index)])]
        if nodes:
            index = min(nodes, key=lambda candidate: node_geometries[candidate].distance(point))
            props = node_properties[index]
            return {
                "name": props["name"], "osm_id": props.get("osm_id"),
                "source": "OpenStreetMap named place inside selected building footprint",
                "status": "matched_poi",
            }
    if not matches:
        return None
    # Prefer the specific building over a containing campus or mall complex.
    index = min(matches, key=lambda candidate: geometries[candidate].area)
    props = properties[index]
    return {
        "name": props["name"], "osm_id": props.get("osm_id"),
        "source": "OpenStreetMap named footprint (bundled snapshot)",
        "status": "matched",
    }


def _nearby_named_places(lat: float, lng: float) -> list[dict]:
    indexed = _named_building_pois()
    if indexed is None:
        return []
    tree, polygons, polygon_props, node_tree, nodes, node_props = indexed
    point = Point(lng, lat)
    search_area = point.buffer(0.0015)
    candidates = []
    for spatial_index, geometries, properties in (
        (tree, polygons, polygon_props), (node_tree, nodes, node_props),
    ):
        for candidate in spatial_index.query(search_area):
            index = int(candidate)
            nearest = nearest_points(point, geometries[index])[1]
            distance = haversine_distance_m(lat, lng, nearest.y, nearest.x)
            if distance <= 150:
                candidates.append((distance, properties[index]["name"]))
    distinct = {}
    for distance, name in sorted(candidates):
        distinct.setdefault(name, round(distance))
        if len(distinct) >= 3:
            break
    return [{"name": name, "distance_m": distance} for name, distance in distinct.items()]


@lru_cache(maxsize=2048)
def _lookup_building_name(lat: float, lng: float) -> dict:
    """Resolve a name only when the clicked point lies in a named OSM building."""
    global _building_name_last_request
    # Public Nominatim permits user-triggered reverse lookups at <=1 request/s.
    # Serialize and cache server-side so all users share the same limit.
    with _building_name_lock:
        wait = 1.05 - (time.monotonic() - _building_name_last_request)
        if wait > 0:
            time.sleep(wait)
        _building_name_last_request = time.monotonic()
        response = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lng, "format": "jsonv2", "polygon_geojson": 1, "zoom": 18},
            headers={"User-Agent": OVERPASS_UA}, timeout=8,
        )
        response.raise_for_status()
    item = response.json()
    geometry = item.get("geojson")
    if geometry and item.get("name") and item.get("category") in {
        "building", "shop", "amenity", "tourism",
    }:
        polygon = shape(geometry)
        if polygon.is_valid and polygon.geom_type in {"Polygon", "MultiPolygon"} and polygon.covers(Point(lng, lat)):
            return {
                "name": item["name"],
                "osm_id": item.get("osm_id"),
                "source": "OpenStreetMap reverse lookup, verified by footprint",
                "status": "matched",
            }
    return {"name": None, "status": "unnamed"}


@app.get("/api/building-name")
def building_name(lat: float, lng: float):
    if not (math.isfinite(lat) and math.isfinite(lng)):
        raise HTTPException(status_code=422, detail="Invalid coordinate")
    west, south, east, north = BANGKOK_BBOX
    if not (south <= lat <= north and west <= lng <= east):
        raise HTTPException(status_code=422, detail="Outside Bangkok study area")
    try:
        local = _lookup_local_building_name(lat, lng)
        if local:
            return local
        return _lookup_building_name(round(lat, 5), round(lng, 5))
    except (OSError, requests.RequestException, ValueError, KeyError, TypeError):
        return {"name": None, "status": "unavailable"}


class BuildingNameSelection(BaseModel):
    lat: float
    lng: float
    footprint: dict | None = None


@app.post("/api/building-name")
def building_name_for_selection(selection: BuildingNameSelection):
    lat, lng = selection.lat, selection.lng
    west, south, east, north = BANGKOK_BBOX
    if not (math.isfinite(lat) and math.isfinite(lng) and south <= lat <= north and west <= lng <= east):
        raise HTTPException(status_code=422, detail="Invalid Bangkok coordinate")
    footprint = None
    if selection.footprint is not None:
        try:
            coordinates = selection.footprint["coordinates"]
            if selection.footprint.get("type") != "Polygon" or sum(len(ring) for ring in coordinates) > 2000:
                raise ValueError("Invalid building footprint")
            footprint = shape(selection.footprint)
            if (not footprint.is_valid or footprint.is_empty or footprint.area > 0.001
                    or not footprint.covers(Point(lng, lat))):
                raise ValueError("Invalid building footprint")
        except (KeyError, TypeError, ValueError, IndexError) as exc:
            raise HTTPException(status_code=422, detail="Invalid building footprint") from exc
    try:
        local = _lookup_local_building_name(lat, lng, footprint)
        if local:
            return local
        result = _lookup_building_name(round(lat, 5), round(lng, 5))
        if result["status"] == "unnamed":
            result["nearby_places"] = _nearby_named_places(lat, lng)
        return result
    except (OSError, requests.RequestException, ValueError, KeyError, TypeError):
        return {"name": None, "status": "unavailable", "nearby_places": _nearby_named_places(lat, lng)}


@app.get("/api/search")
def search(q: str = Query(..., min_length=1)):
    """Search for transit stations, districts, neighborhoods, or landmarks."""
    query = q.strip().lower()
    results = []

    # 1. Search Transit Stations
    for s in app.state.stations:
        name_th = s.get("name", "")
        name_en = s.get("name_en", "")
        if query in name_th.lower() or query in name_en.lower():
            lines_str = ", ".join(l["label"]["en"] for l in s.get("lines", []))
            results.append({
                "type": "station",
                "title_th": f"สถานี {name_th}",
                "title_en": f"{name_en} Station" if name_en else f"{name_th} Station",
                "subtitle": lines_str or s.get("category", "transit"),
                "lat": s["lat"],
                "lng": s["lng"],
                "badge": "BTS/MRT",
            })

    # 2. Search Districts (Khet)
    for d in BANGKOK_DISTRICTS:
        if query in d["name_th"].lower() or query in d["name_en"].lower():
            results.append({
                "type": "district",
                "title_th": f"เขต{d['name_th']}",
                "title_en": f"{d['name_en']} District",
                "subtitle": f"Bangkok {d['zone']} Zone",
                "lat": d["center_lat"],
                "lng": d["center_lng"],
                "badge": "District",
            })

    # 3. Search Key Neighborhoods
    for n in BANGKOK_NEIGHBORHOODS:
        if query in n["name_th"].lower() or query in n["name_en"].lower():
            results.append({
                "type": "neighborhood",
                "title_th": n["name_th"],
                "title_en": n["name_en"],
                "subtitle": f"Area in {n['district']}",
                "lat": n["lat"],
                "lng": n["lng"],
                "badge": "Neighborhood",
            })

    # 4. Search Landmarks
    for lm in BANGKOK_LANDMARKS:
        if query in lm["name_th"].lower() or query in lm["name_en"].lower():
            results.append({
                "type": "landmark",
                "title_th": lm["name_th"],
                "title_en": lm["name_en"],
                "subtitle": f"Category: {lm['category']}",
                "lat": lm["lat"],
                "lng": lm["lng"],
                "badge": "Landmark",
            })

    return {"query": q, "count": len(results), "results": results[:15]}


@app.get("/api/stations")
def stations():
    """Transit stations with route polylines and line metadata."""
    lines_meta, _, routes = load_lines()
    by_name = {s["name"]: s for s in app.state.stations}
    line_routes = []
    for ln in lines_meta:
        stops = [
            {"name": s["name"], "name_en": s.get("name_en", ""),
             "lat": s["lat"], "lng": s["lng"]}
            for s in (by_name.get(n) for n in routes.get(ln["ref"], []))
            if s is not None
        ]
        if len(stops) >= 2:
            line_routes.append({
                "ref": ln["ref"],
                "label": ln["label"],
                "colour": ln["colour"],
                "stops": stops,
            })
    return {
        "stations": app.state.stations,
        "count": len(app.state.stations),
        "lines": lines_meta,
        "routes": line_routes,
    }


@app.get("/api/neighborhoods")
def get_neighborhoods():
    """List of all Bangkok recognized neighborhood hubs with coordinates."""
    return {"neighborhoods": BANGKOK_NEIGHBORHOODS, "count": len(BANGKOK_NEIGHBORHOODS)}


@app.get("/api/districts")
def get_districts():
    """Bangkok 50 official administrative districts GeoJSON with dimensions and stats."""
    return _load_districts_geojson()


def _rounded_geometry(geometry, precision: int = 6) -> dict:
    mapped = mapping(geometry)

    def rounded(value):
        if isinstance(value, (list, tuple)):
            return [rounded(item) for item in value]
        if isinstance(value, (float, np.floating)):
            return round(float(value), precision)
        return value

    return {"type": mapped["type"], "coordinates": rounded(mapped["coordinates"])}


@lru_cache(maxsize=2)
def _grid_payload(include_dims: bool) -> dict:
    """Build and cache map GeoJSON; source tables are immutable after startup."""
    cells = app.state.cells
    dims = app.state.dims
    feat = app.state.features
    districts = app.state.districts

    features = []
    for i, row in cells.iterrows():
        district_name = districts[i] if i < len(districts) else "Pathum Wan"
        st_dist = feat.loc[i, "station_dist_m"] if "station_dist_m" in feat.columns else None

        price_est = estimate_land_price(
            district_en=district_name,
            station_dist_m=float(st_dist) if st_dist is not None and not np.isnan(st_dist) else None,
            poi_density=float(feat.loc[i, "poi_density"]),
            commercial_share=float(feat.loc[i, "commercial_share"]),
            major_dist_m=float(feat.loc[i, "major_dist_m"]) if "major_dist_m" in feat.columns else None,
            green_share=float(feat.loc[i, "green_share"]),
            industrial_share=float(feat.loc[i, "industrial_share"]),
            reference=(
                reference_for_point(float(row["center_lat"]), float(row["center_lng"]))
                or reference_for_district(district_name)
            ),
        )

        props = {
            "hex_id": row["hex_id"],
            "center_lat": round(float(row["center_lat"]), 6),
            "center_lng": round(float(row["center_lng"]), 6),
            "quality": _safe(dims.loc[i, "quality"]),
            "district_en": district_name,
            "market_price_sqwah": price_est["market_price_sqwah"],
            "assessed_price_sqwah": price_est["assessed_price_sqwah"],
            "market_price_low": price_est["market_price_low"],
            "market_price_high": price_est["market_price_high"],
            "price_source": price_est["market_price_type"],
            "price_record_count": price_est.get("reference_record_count"),
            "price_resolution_m": price_est.get("reference_resolution_m"),
            "zone_tier": price_est["zone_tier"],
            "is_golden_location": bool(price_est.get("is_golden_location", False)),
        }
        if include_dims:
            for d in QUALITY_DIMENSIONS:
                props[d] = round(float(dims.loc[i, d]), 1)
        props["n_poi"] = int(feat.loc[i, "n_poi"])
        props["n_transit"] = int(feat.loc[i, "n_transit"])
        props["station_dist_m"] = _safe(st_dist)
        is_near_station = st_dist is not None and not math.isnan(st_dist) and st_dist <= 600.0
        props["low_data"] = bool(feat.loc[i, "low_data"]) and not is_near_station

        features.append({
            "type": "Feature",
            "geometry": _rounded_geometry(row.geometry),
            "properties": props,
        })
    return {"type": "FeatureCollection", "features": features}


@app.get("/api/grid")
def grid(include_dims: bool = True):
    """Hex cells with quality scores and nearby official appraisal summaries."""
    return _grid_payload(bool(include_dims))


@app.get("/api/location/{hex_id}")
def location(hex_id: str, land_size_sqwah: Optional[float] = None, budget: Optional[float] = None):
    """Full detail for one cell: administrative names, price valuation, dimensions, factors."""
    cells = app.state.cells
    dims = app.state.dims
    feat = app.state.features
    idx = cells.index[cells["hex_id"] == hex_id]
    if len(idx) == 0:
        raise HTTPException(status_code=404, detail=f"Unknown hex_id: {hex_id}")
    i = idx[0]

    lat = float(cells.loc[i, "center_lat"])
    lng = float(cells.loc[i, "center_lng"])
    drow = dims.loc[i]
    dim_scores = {d: round(float(drow[d]), 1) for d in QUALITY_DIMENSIONS}
    pos, neg = factors(drow, drow)

    feature_summary = {c: _safe(feat.loc[i, c]) for c in FEATURE_SUMMARY}
    if isinstance(feature_summary.get("low_data"), bool):
        feature_summary["low_data"] = feature_summary["low_data"]

    # Nearest operating rapid transit station
    st_name, st_dist_val = _get_nearest_operating_station(lat, lng, app.state.stations)

    # Administrative context
    geo_context = enrich_location_context(lat, lng, station_name=st_name, station_dist_m=st_dist_val)

    # Land Price Valuation Model
    price_val = estimate_land_price(
        district_en=geo_context["district_en"],
        station_dist_m=st_dist_val,
        poi_density=float(feat.loc[i, "poi_density"]),
        commercial_share=float(feat.loc[i, "commercial_share"]),
        major_dist_m=float(feat.loc[i, "major_dist_m"]) if "major_dist_m" in feat.columns else None,
        green_share=float(feat.loc[i, "green_share"]),
        industrial_share=float(feat.loc[i, "industrial_share"]),
        land_size_sqwah=land_size_sqwah,
        budget_thb=budget,
        reference=reference_for_point(lat, lng) or reference_for_district(geo_context["district_en"]),
    )
    road_benchmark = road_benchmark_for_context(geo_context)
    if road_benchmark:
        price_val["road_benchmark"] = road_benchmark

    comparable = comparables(
        app.state.cells_utm, feat, dims, hex_id, k=3, radius_m=3000.0
    )

    # Visual imagery & Mapillary / Google street preview links
    multimodal_visual = {
        "satellite_preview_url": f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/16/{int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * (2**16))}/{int((lng + 180.0) / 360.0 * (2**16))}",
        "street_view_link": f"https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat},{lng}",
        "mapillary_link": f"https://www.mapillary.com/app/?lat={lat}&lng={lng}&z=16",
        "urban_density_index": round(min(100.0, float(feat.loc[i, "poi_density"]) * 0.8 + float(feat.loc[i, "road_density"]) * 3.0), 1),
        "green_canopy_pct": round(float(feat.loc[i, "green_share"]) * 100.0, 1),
    }

    # AI Investment Memo — fully local Thai narrative engine
    dims_dict = {d: float(drow[d]) for d in QUALITY_DIMENSIONS}
    dims_dict["quality"] = float(drow["quality"])
    investment_memo = generate_investment_memo(
        dims=dims_dict,
        geo_context=geo_context,
        price_val=price_val,
        feat_summary=feature_summary,
    )

    # Street-Level Visual Indices — OSM-derived spatial proxies
    feat_row_dict = {c: _safe(feat.loc[i, c]) for c in feat.columns if c != "hex_id"}
    street_visual = compute_street_indices(feat_row_dict, station_dist_m=st_dist_val)

    return {
        "hex_id": hex_id,
        "center": {"lat": round(lat, 6), "lng": round(lng, 6)},
        "context": geo_context,
        "quality": round(float(drow["quality"]), 1),
        "dimensions": dim_scores,
        "contributions": {
            d: round(float(drow[f"contribution_{d}"]), 1) for d in QUALITY_DIMENSIONS
        },
        "positive_factors": pos,
        "negative_factors": neg,
        "feature_summary": feature_summary,
        "comparables": comparable,
        "price_valuation": price_val,
        "multimodal_visual": multimodal_visual,
        "investment_memo": investment_memo,
        "street_visual": street_visual,
    }


@app.post("/api/recommend")
def recommend(prefs: Preferences):
    """Rank cells by weighted user preferences; budget does not affect ranking."""
    cells = app.state.cells
    dims = app.state.dims
    feat = app.state.features
    districts = app.state.districts

    ranked = top_recommendations(
        dims, feat, prefs.weights, k=prefs.k,
        budget=prefs.budget, land_size_sqwah=prefs.land_size_sqwah,
        land_use=prefs.land_use, district_filter=prefs.district,
        districts=districts,
    )

    results = []
    for _, r in ranked.iterrows():
        hex_id = r["hex_id"]
        i = feat.index[feat["hex_id"] == hex_id][0]
        lat = float(cells.loc[i, "center_lat"])
        lng = float(cells.loc[i, "center_lng"])

        drow = dims.loc[i]
        dim_scores = {d: round(float(drow[d]), 1) for d in QUALITY_DIMENSIONS}
        contribs = {d: round(float(r[f"contribution_{d}"]), 1) for d in QUALITY_DIMENSIONS}
        pos, neg = factors(drow, drow)

        st_name, st_dist_val = _get_nearest_operating_station(lat, lng, app.state.stations)

        geo_context = enrich_location_context(lat, lng, station_name=st_name, station_dist_m=st_dist_val)

        price_val = estimate_land_price(
            district_en=geo_context["district_en"],
            station_dist_m=st_dist_val,
            poi_density=float(feat.loc[i, "poi_density"]),
            commercial_share=float(feat.loc[i, "commercial_share"]),
            major_dist_m=float(feat.loc[i, "major_dist_m"]) if "major_dist_m" in feat.columns else None,
            green_share=float(feat.loc[i, "green_share"]),
            industrial_share=float(feat.loc[i, "industrial_share"]),
            land_size_sqwah=prefs.land_size_sqwah,
            budget_thb=prefs.budget,
            reference=reference_for_point(lat, lng) or reference_for_district(geo_context["district_en"]),
        )
        road_benchmark = road_benchmark_for_context(geo_context)
        if road_benchmark:
            price_val["road_benchmark"] = road_benchmark

        results.append({
            "hex_id": hex_id,
            "center": {"lat": round(lat, 6), "lng": round(lng, 6)},
            "context": geo_context,
            "match_score": round(float(r["match_score"]), 1),
            "quality": round(float(drow["quality"]), 1),
            "dimensions": dim_scores,
            "contributions": contribs,
            "positive_factors": pos,
            "negative_factors": neg,
            "feature_summary": {c: _safe(feat.loc[i, c]) for c in FEATURE_SUMMARY},
            "price_valuation": price_val,
        })

    return {
        "request": {
            "weights": prefs.weights,
            "budget": prefs.budget,
            "land_size_sqwah": prefs.land_size_sqwah,
            "land_use": prefs.land_use,
            "k": prefs.k,
        },
        "data_status": DATA_STATUS,
        "results": results,
    }


def _safe(v):
    """JSON-safe conversion of numpy/pandas scalar values."""
    if v is None:
        return None
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.floating):
        f = float(v)
        return None if f != f else round(f, 4)
    if isinstance(v, np.bool_):
        return bool(v)
    if isinstance(v, bool):
        return bool(v)
    if isinstance(v, float):
        return None if v != v else round(v, 4)
    if isinstance(v, int):
        return int(v)
    return v
