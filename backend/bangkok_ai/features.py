"""Per-hex-cell spatial feature engineering.

All math in EPSG:32647 (metres). Points are joined with geopandas sjoin;
line lengths and polygon area shares use a shapely STRtree for speed.
Distances are from cell centroids to the nearest feature of a layer.
"""
from __future__ import annotations

import logging
import math

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely import STRtree
from shapely.geometry import Point
from shapely.validation import make_valid

from .config import CRS_UTM

log = logging.getLogger(__name__)

POI_GROUPS = ["food", "retail", "services", "education", "health",
              "culture", "lodging", "business"]

# Rail-station-like categories (BTS/MRT/ARL/heavy rail stops), used for the
# station-distance feature. subway_entrance/stop are excluded so the distance
# measures "how far to the actual station" rather than to any platform/exit.
STATION_CATEGORIES = {"station", "subway", "light_rail", "monorail", "halt"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _to_utm(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    return gdf.to_crs(CRS_UTM)


def point_counts(cells: gpd.GeoDataFrame, points: gpd.GeoDataFrame) -> pd.Series:
    """Count points per cell, ordered like cells (positional index)."""
    if points.empty:
        return pd.Series(0, index=range(len(cells)))
    joined = gpd.sjoin(points, cells[["hex_id", "geometry"]], predicate="within")
    return (joined.groupby("hex_id").size()
            .reindex(cells["hex_id"]).fillna(0)
            .reset_index(drop=True).astype(int))


def point_group_counts(cells: gpd.GeoDataFrame, points: gpd.GeoDataFrame,
                       group_col: str = "group") -> pd.DataFrame:
    """Pivot table of point counts per (hex_id, group), ordered like cells."""
    if points.empty:
        return pd.DataFrame(index=range(len(cells)))
    pts = points.copy()
    if group_col not in pts.columns:
        pts[group_col] = "other"
    joined = gpd.sjoin(pts, cells[["hex_id", "geometry"]], predicate="within")
    tab = joined.groupby(["hex_id", group_col]).size().unstack(fill_value=0)
    tab = tab.reindex(cells["hex_id"]).fillna(0)
    tab = tab.reset_index(drop=True).astype(int)
    return tab


def nearest_distance(cells: gpd.GeoDataFrame, geoms: gpd.GeoSeries) -> pd.Series:
    """Distance (m) from each cell centroid to the nearest geometry, NaN if none."""
    out = pd.Series(np.nan, index=cells.index, dtype=float)
    if geoms.empty:
        return out
    tree = STRtree(geoms)
    for idx, cell in cells.iterrows():
        cent = cell.geometry.centroid
        j = tree.nearest(Point(cent.x, cent.y))
        out.loc[idx] = float(cent.distance(geoms.iloc[j]))
    return out


def polygon_share(cells: gpd.GeoDataFrame, polys: gpd.GeoSeries) -> pd.Series:
    """Share of each cell's area covered by the given polygons (0..1)."""
    out = pd.Series(0.0, index=cells.index, dtype=float)
    if polys.empty:
        return out
    clean = polys.apply(lambda g: make_valid(g) if not g.is_valid else g)
    tree = STRtree(clean)
    for idx, cell in cells.iterrows():
        hits = tree.query(cell.geometry, predicate="intersects")
        if len(hits) == 0:
            continue
        inter = sum(cell.geometry.intersection(clean.iloc[i]).area for i in hits)
        out.loc[idx] = inter / cell.geometry.area
    return out.clip(0.0, 1.0)


def line_lengths(cells: gpd.GeoDataFrame, lines: gpd.GeoSeries) -> pd.Series:
    """Total length (m) of line features intersecting each cell."""
    out = pd.Series(0.0, index=cells.index, dtype=float)
    if lines.empty:
        return out
    clean = lines.apply(lambda g: make_valid(g) if not g.is_valid else g)
    tree = STRtree(clean)
    for idx, cell in cells.iterrows():
        hits = tree.query(cell.geometry, predicate="intersects")
        if len(hits) == 0:
            continue
        total = sum(cell.geometry.intersection(clean.iloc[i]).length for i in hits)
        out.loc[idx] = float(total)
    return out


def shannon_diversity(counts: np.ndarray) -> float:
    """Shannon entropy of category counts (0 if no observations)."""
    counts = np.asarray(counts, dtype=float)
    counts = counts[counts > 0]
    if counts.size == 0:
        return 0.0
    p = counts / counts.sum()
    return float(-(p * np.log(p)).sum())


# ---------------------------------------------------------------------------
# Main feature builder
# ---------------------------------------------------------------------------
def build_features(cells_utm: gpd.GeoDataFrame,
                   raw: dict[str, gpd.GeoDataFrame]) -> pd.DataFrame:
    """Compute the full per-cell feature table from raw OSM layers.

    raw keys: transit, poi, landuse, greenery, water, roads.
    """
    cells = _to_utm(cells_utm.copy())

    def _by_category(gdf: gpd.GeoDataFrame, col: str, value: str) -> gpd.GeoDataFrame:
        if gdf.empty or col not in gdf.columns:
            return gdf.iloc[0:0]
        return gdf[gdf[col] == value]

    area_km2 = cells["cell_area_km2"]

    poi = _to_utm(raw["poi"])
    transit = _to_utm(raw["transit"])
    landuse = _to_utm(raw["landuse"])
    greenery = _to_utm(raw["greenery"])
    water = _to_utm(raw["water"])
    roads = _to_utm(raw["roads"])

    major = _by_category(roads, "group", "major")
    minor = _by_category(roads, "group", "minor")

    # --- POI counts -------------------------------------------------------
    poi_groups = point_group_counts(cells, poi)
    for g in POI_GROUPS:
        poi_groups[g] = poi_groups.get(g, 0)
    n_poi = poi_groups[POI_GROUPS].sum(axis=1)

    diversity = poi_groups[POI_GROUPS].apply(
        lambda row: shannon_diversity(row.values), axis=1)

    # --- transit -----------------------------------------------------------
    n_transit = point_counts(cells, transit)
    transit_dist = nearest_distance(cells, transit.geometry)
    if transit.empty or "category" not in transit.columns:
        station_like = transit.iloc[0:0]
    else:
        station_like = transit[transit["category"].isin(STATION_CATEGORIES)]
    station_dist = nearest_distance(cells, station_like.geometry)
    n_station = point_counts(cells, station_like)

    # --- land use shares ---------------------------------------------------
    landuse_share = pd.DataFrame(index=cells.index)
    for lu in ["residential", "commercial", "retail", "industrial", "mixed_use",
               "institutional", "education", "religious", "cemetery", "construction"]:
        sub = _by_category(landuse, "category", lu)
        landuse_share[lu] = polygon_share(cells, sub.geometry)

    # --- greenery / water --------------------------------------------------
    green_share = polygon_share(cells, greenery.geometry)
    water_share = polygon_share(cells, water.geometry)
    green_dist = nearest_distance(cells, greenery.geometry)

    # --- roads -------------------------------------------------------------
    road_len = line_lengths(cells, roads.geometry)
    major_len = line_lengths(cells, major.geometry)
    minor_len = line_lengths(cells, minor.geometry)
    major_dist = nearest_distance(cells, major.geometry)

    feat = pd.DataFrame(index=cells.index)
    feat["hex_id"] = cells["hex_id"]
    feat["cell_area_km2"] = area_km2
    for g in POI_GROUPS:
        feat[f"n_{g}"] = poi_groups[g].astype(int)
    feat["n_poi"] = n_poi.astype(int)
    feat["poi_density"] = n_poi / area_km2
    feat["poi_diversity"] = diversity
    feat["retail_density"] = poi_groups["retail"] / area_km2
    feat["n_transit"] = n_transit.astype(int)
    feat["transit_density"] = n_transit / area_km2
    feat["transit_dist_m"] = transit_dist
    feat["station_density"] = n_station / area_km2
    feat["station_dist_m"] = station_dist
    feat["green_share"] = green_share
    feat["green_dist_m"] = green_dist
    feat["water_share"] = water_share
    for lu in landuse_share.columns:
        feat[f"{lu}_share"] = landuse_share[lu]
    feat["road_len_m"] = road_len
    feat["road_density"] = road_len / 1000.0 / area_km2      # km/km2
    feat["major_len_m"] = major_len
    feat["major_density"] = major_len / 1000.0 / area_km2
    feat["minor_len_m"] = minor_len
    feat["minor_density"] = minor_len / 1000.0 / area_km2
    feat["major_dist_m"] = major_dist
    feat["center_utm_x"] = cells["center_utm_x"]
    feat["center_utm_y"] = cells["center_utm_y"]

    # low-data flag: too little OSM evidence to score honestly (exempt station catchment)
    feat["low_data"] = (
        ((feat["n_poi"] + feat["n_transit"]) < 3) | (feat["road_len_m"] < 1000.0)
    ) & (feat["station_dist_m"].fillna(9999.0) > 600.0)

    return feat.reset_index(drop=True)


def distance_matrix(cells_utm: gpd.GeoDataFrame) -> np.ndarray:
    """Pairwise centroid distances (m) among cells (for comparables)."""
    cents = cells_utm.geometry.centroid
    coords = np.column_stack([cents.x, cents.y])
    d = coords[:, None, :] - coords[None, :, :]
    return np.sqrt((d ** 2).sum(axis=2))
