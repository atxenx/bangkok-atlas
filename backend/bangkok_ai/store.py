"""Loaders for processed pipeline outputs (data/processed)."""
from __future__ import annotations

import geopandas as gpd
import pandas as pd

from .config import CRS_WGS84, DATA_PROCESSED


def load_cells() -> gpd.GeoDataFrame:
    """WGS84 hex cells with hex_id, center_lat/lng, cell_area_km2."""
    gdf = gpd.read_parquet(DATA_PROCESSED / "cells_wgs84.parquet")
    return gdf.reset_index(drop=True)


def load_features() -> pd.DataFrame:
    """Per-cell feature table (index aligned with cells)."""
    df = pd.read_parquet(DATA_PROCESSED / "features.parquet")
    return df.reset_index(drop=True)


def load_dims() -> pd.DataFrame:
    """Per-cell dimension scores + quality + contributions + hex_id."""
    df = pd.read_parquet(DATA_PROCESSED / "dims.parquet")
    return df.reset_index(drop=True)


def pipeline_ready() -> bool:
    return all(
        (DATA_PROCESSED / f).exists()
        for f in ("cells_wgs84.parquet", "features.parquet", "dims.parquet")
    )
