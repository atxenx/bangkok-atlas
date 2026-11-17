"""Hex grid over the Bangkok study area.

Grid is generated in EPSG:32647 (UTM 47N, metric) and exposed in EPSG:4326.
Edge cells are clipped to the study-area rectangle so map overlays and area
shares stay consistent. The primary geographic key is the hex id.
"""
from __future__ import annotations

import logging
import math

from pathlib import Path

import geopandas as gpd
from shapely.geometry import Polygon, box
from shapely.ops import transform
import pyproj

from .config import BANGKOK_BBOX, CRS_UTM, CRS_WGS84, HEX_EDGE_M

log = logging.getLogger(__name__)

_WGS84_TO_UTM = pyproj.Transformer.from_crs(CRS_WGS84, CRS_UTM, always_xy=True).transform
_UTM_TO_WGS84 = pyproj.Transformer.from_crs(CRS_UTM, CRS_WGS84, always_xy=True).transform


def hex_vertices(cx: float, cy: float, edge: float) -> list[tuple[float, float]]:
    """Pointy-top hexagon vertices (UTM metres) around (cx, cy)."""
    r = edge
    angles_deg = [30, 90, 150, 210, 270, 330]
    return [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
            for a in angles_deg]


def build_grid(edge: float = HEX_EDGE_M, bbox_wgs84=BANGKOK_BBOX, boundary_path: Path | None = None) -> gpd.GeoDataFrame:
    """Build a hex grid clipped to the study area, filtered to authentic Bangkok boundary if applicable."""
    from .config import DATA_RAW
    
    bkk_poly_utm = None
    if boundary_path is not None:
        bpath = boundary_path
    elif bbox_wgs84 == BANGKOK_BBOX and (DATA_RAW / "bangkok_boundary.geojson").exists():
        bpath = DATA_RAW / "bangkok_boundary.geojson"
    else:
        bpath = None

    if bpath and bpath.exists():
        try:
            bkk_gdf = gpd.read_file(bpath).to_crs(CRS_UTM)
            if not bkk_gdf.empty:
                bkk_poly_utm = bkk_gdf.geometry.union_all()
        except Exception as e:
            log.warning("Could not load Bangkok boundary polygon from %s: %s", bpath, e)

    min_lon, min_lat, max_lon, max_lat = bbox_wgs84
    minx, miny = _WGS84_TO_UTM(min_lon, min_lat)
    maxx, maxy = _WGS84_TO_UTM(max_lon, max_lat)
    study = box(minx, miny, maxx, maxy)

    width = math.sqrt(3) * edge          # horizontal spacing
    vspacing = 1.5 * edge                # vertical spacing
    n_cols = int(math.ceil((maxx - minx) / width)) + 2
    n_rows = int(math.ceil((maxy - miny) / vspacing)) + 2

    cells = []
    for row in range(n_rows):
        yoff = miny + vspacing * row
        for col in range(n_cols):
            xoff = minx + width * (col + 0.5 * (row % 2))
            cx, cy = xoff, yoff
            cell = Polygon(hex_vertices(cx, cy, edge))
            
            if bkk_poly_utm is not None and not cell.centroid.within(bkk_poly_utm):
                continue

            clipped = cell.intersection(study)
            if clipped.is_empty:
                continue
            cells.append({
                "hex_id": f"{int(edge)}m-r{row}-c{col}",
                "geometry": clipped,
            })

    gdf = gpd.GeoDataFrame(cells, geometry="geometry", crs=CRS_UTM)
    gdf["cell_area_m2"] = gdf.geometry.area
    gdf["cell_area_km2"] = gdf["cell_area_m2"] / 1e6
    gdf["center_utm_x"] = gdf.geometry.centroid.x
    gdf["center_utm_y"] = gdf.geometry.centroid.y
    return gdf


def to_wgs84(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Return a copy of the grid in WGS84 with center lat/lon columns."""
    out = gdf.copy()
    cents = gdf.geometry.centroid  # computed in UTM before reprojection
    out["geometry"] = out.geometry.apply(lambda g: transform(_UTM_TO_WGS84, g))
    out = out.set_crs(CRS_WGS84, allow_override=True)
    cents84 = cents.apply(lambda p: transform(_UTM_TO_WGS84, p))
    out["center_lng"] = cents84.x
    out["center_lat"] = cents84.y
    return out
