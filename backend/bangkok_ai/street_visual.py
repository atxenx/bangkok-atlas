"""Street-form proxy indices derived from mapped OSM features.

Computes three street-level quality indicators from existing per-cell features
(features.parquet). No additional data download required.

Indices
-------
green_canopy_score  : 0–100  — mapped green/water share and park proximity proxy
sidewalk_quality    : 0–100  — minor-road/network-density walkability proxy
sky_openness        : 0–100  — inverse urban-form density proxy

All scores derived from OpenStreetMap data already in the feature pipeline.
"""
from __future__ import annotations

import math
from typing import Any


def _f(val: Any, default: float = 0.0) -> float:
    try:
        v = float(val)
        return default if math.isnan(v) else v
    except (TypeError, ValueError):
        return default


def _green_canopy(
    green_share: float,
    water_share: float,
    green_dist_m: float,
) -> float:
    """Mapped green/water access proxy (0–100); not measured tree canopy."""
    cover = min(1.0, green_share / 0.45)
    water = min(1.0, water_share / 0.25)
    proximity = math.exp(-green_dist_m / 450.0)
    score = 100.0 * (0.60 * cover + 0.25 * proximity + 0.15 * water)
    return round(min(100.0, max(0.0, score)), 1)


def _sidewalk_quality(
    minor_density: float,
    road_density: float,
    station_dist_m: float,
) -> float:
    """Walkability-network proxy (0–100); not a sidewalk condition survey."""
    infra = min(1.0, minor_density / 18.0)
    network = min(1.0, road_density / 22.0)
    tod_bonus = math.exp(-station_dist_m / 550.0)
    score = 100.0 * (0.55 * infra + 0.25 * network + 0.20 * tod_bonus)
    return round(min(100.0, max(0.0, score)), 1)


def _sky_openness(
    major_density: float,
    commercial_share: float,
    road_density: float,
    green_canopy_score: float,
) -> float:
    """Sky view factor proxy (0–100)."""
    density_factor = (
        major_density / 12.0
        + commercial_share * 1.8
        + road_density / 35.0
    )
    base_openness = 100.0 * math.exp(-density_factor * 0.44)
    canopy_lift = 0.12 * green_canopy_score
    score = base_openness + canopy_lift
    return round(min(100.0, max(0.0, score)), 1)


def _street_character(
    sky_openness: float,
    sidewalk_quality: float,
    green_canopy_score: float,
) -> tuple[str, str, str]:
    """Return (character_key, label_en, label_th) describing the street typology."""
    if green_canopy_score >= 55:
        return "green_residential", "🌳 Green Residential / Park", "🌳 ย่านสีเขียว / Green Residential"
    if sky_openness < 32 and sidewalk_quality >= 55:
        return "urban_dense", "🏙️ Urban Dense (CBD Core)", "🏙️ เมืองหนาแน่น / Urban Dense (CBD)"
    if sky_openness < 32 and sidewalk_quality < 55:
        return "urban_mixed", "🌆 High-Density Urban Mixed", "🌆 เมืองผสม / High-Density Mixed"
    if sky_openness >= 32 and sidewalk_quality >= 45:
        return "mixed_urban", "🌆 Urban Mixed-Use Corridor", "🌆 Urban Mixed-Use"
    if sky_openness >= 58:
        return "suburban_open", "🏘️ Suburban Open / Low-Rise", "🏘️ ชานเมือง / Suburban Open"
    return "low_density", "🏘️ Low-Density Residential", "🏘️ ที่อยู่อาศัยความหนาแน่นต่ำ"


def compute_street_indices(
    feat_row: dict[str, Any],
    station_dist_m: float | None = None,
) -> dict[str, Any]:
    """Compute all three street-level visual indices for a single hex cell."""
    gs   = _f(feat_row.get("green_share"), 0.0)
    ws   = _f(feat_row.get("water_share"), 0.0)
    gd   = _f(feat_row.get("green_dist_m"), 5000.0)
    md   = _f(feat_row.get("minor_density"), 0.0)
    rd   = _f(feat_row.get("road_density"), 0.0)
    majd = _f(feat_row.get("major_density"), 0.0)
    cs   = _f(feat_row.get("commercial_share"), 0.0)
    st_d = _f(station_dist_m, 9999.0)

    gc  = _green_canopy(gs, ws, gd)
    sw  = _sidewalk_quality(md, rd, st_d)
    sky = _sky_openness(majd, cs, rd, gc)

    char_key, char_label_en, char_label_th = _street_character(sky, sw, gc)

    return {
        "green_canopy_score": gc,
        "sidewalk_quality": sw,
        "sky_openness": sky,
        "street_character": char_key,
        "street_character_label": char_label_en,
        "street_character_label_en": char_label_en,
        "street_character_label_th": char_label_th,
        "methodology": (
            "OSM-derived spatial proxies: "
            "green_share + water_share + green_dist (canopy); "
            "minor_density + road_density + TOD bonus (walkability proxy); "
            "major_density + commercial_share + road_density inverse (sky openness)"
        ),
    }
