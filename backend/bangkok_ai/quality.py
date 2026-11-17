"""Explainable Neighborhood Quality Score.

Every dimension is a deterministic 0-100 index with a published formula built
from real features (no black boxes). The aggregate is a documented weighted
sum; each response carries the full per-dimension breakdown plus the signed
contribution of every dimension, so any score can be decomposed by hand.

Formulas use three building blocks, all monotone:
  saturation  s(x; k) = 100 * (1 - exp(-k * x))
  decay       d(x; tau) = 100 * exp(-x / tau)
  capped share c(x; cap) = 100 * min(1, x / cap)

See docs/ARCHITECTURE.md for the dimension list and initial weights.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import QUALITY_DIMENSIONS, QUALITY_WEIGHTS

_DIMENSION_DESCRIPTIONS = {
    "transit": "Stop density within the cell and proximity to the nearest transit stop "
               "(BTS/MRT/ARL/rail).",
    "amenities": "POI density (saturated) blended with category diversity (Shannon).",
    "walkability": "Minor-road density and total road density as walkability proxies.",
    "greenery": "Green-area share (capped) blended with proximity to the nearest green space.",
    "road_environment": "Inverted-U on distance to major roads: access without excessive noise.",
    "commercial": "Commercial/retail land-use share blended with retail POI density.",
    "residential": "Residential land-use share.",
    "quietness": "Inverse of major-road density and proximity (noise proxy).",
    "environmental": "Water and greenery share, penalized by industrial land use.",
}


def _s(x: pd.Series, k: float) -> pd.Series:
    return 100.0 * (1.0 - np.exp(-k * x.fillna(0.0)))


def _d(x: pd.Series, tau: float) -> pd.Series:
    return 100.0 * np.exp(-x.fillna(np.inf) / tau)


def _c(x: pd.Series, cap: float) -> pd.Series:
    return 100.0 * (x.fillna(0.0) / cap).clip(0.0, 1.0)


def compute_dimensions(feat: pd.DataFrame) -> pd.DataFrame:
    """Return one column per dimension (0-100) for every cell."""
    out = pd.DataFrame(index=feat.index)

    # Station distance in meters (fallback to 10,000m if missing)
    station_dist = feat["station_dist_m"].fillna(10000.0)
    transit_dist = feat["transit_dist_m"].fillna(10000.0)

    # 1. transit: BTS/MRT/ARL rail station access & transit walkability
    # Gaussian-exponential decay curve matching real Bangkok walking radii:
    # <= 200m -> 96-100, <= 400m -> 90-95, <= 600m -> 80-88, <= 800m -> 70-80, <= 1200m -> 50-68
    station_walk_score = 100.0 * np.exp(- (station_dist / 1350.0) ** 1.6)
    feeder_support = 8.0 * np.exp(-transit_dist / 400.0) * np.exp(-station_dist / 2000.0)
    density_bonus = (
        12.0 * np.clip(feat.get("n_station", 0), 0, 2)
        + 4.0 * np.clip(feat.get("n_transit", 0), 0, 3) * np.exp(-station_dist / 1500.0)
    )
    out["transit"] = (
        station_walk_score
        + feeder_support
        + density_bonus
    ).clip(0.0, 100.0)

    # 2. amenities: POI density + Shannon diversity + TOD Catchment baseline
    # Cells within walking distance (<= 500m) of a BTS/MRT station inherit guaranteed convenience & commercial services
    transit_catchment_boost = 32.0 * np.exp(-station_dist / 450.0)
    out["amenities"] = (
        0.70 * _s(feat["poi_density"], 1.0 / 80.0)
        + 0.30 * _s(feat["poi_diversity"], 1.0 / 1.0)
        + transit_catchment_boost
    ).clip(0.0, 100.0)

    # 3. walkability: minor pedestrian roads + road network density + station skywalk infrastructure
    walk_transit_boost = 18.0 * np.exp(-station_dist / 500.0)
    out["walkability"] = (
        0.65 * _s(feat["minor_density"], 1.0 / 10.0)
        + 0.35 * _s(feat["road_density"], 1.0 / 18.0)
        + walk_transit_boost
    ).clip(0.0, 100.0)

    # 4. greenery: green area share + proximity to parks
    out["greenery"] = (
        0.65 * _c(feat["green_share"], 0.25)
        + 0.35 * _d(feat["green_dist_m"], 800.0)
    ).clip(0.0, 100.0)

    # 5. road_environment (การเข้าถึงถนนสายหลัก): Road network connectivity & major road access
    out["road_environment"] = (
        0.60 * _d(feat["major_dist_m"], 500.0)
        + 0.40 * _s(feat["road_density"], 1.0 / 20.0)
    ).clip(0.0, 100.0)

    # 6. commercial: commercial landuse + retail POI density + transit commercial hub effect
    comm_transit_boost = 28.0 * np.exp(-station_dist / 400.0)
    out["commercial"] = (
        0.50 * _c(feat["commercial_share"] + feat["retail_share"], 0.25)
        + 0.50 * _s(feat["retail_density"], 1.0 / 15.0)
        + comm_transit_boost
    ).clip(0.0, 100.0)

    # 7. residential: residential land use + community balance
    comm_penalty = _c(feat["commercial_share"] + feat["industrial_share"], 0.6)
    out["residential"] = (
        0.55 * _c(feat["residential_share"], 0.30)
        + 0.45 * (100.0 - comm_penalty)
    ).clip(5.0, 100.0)

    # 8. quietness: inverse major-road exposure and high commercial traffic
    major_noise = _s(feat["major_density"], 1.0 / 4.0)
    comm_noise = _s(feat["commercial_share"], 1.0 / 0.3)
    out["quietness"] = (
        100.0 - (0.60 * major_noise + 0.40 * comm_noise)
    ).clip(0.0, 100.0)

    # 9. environmental: parks & greenery (0.65) + clean open water (0.35) minus industrial/heavy traffic penalty
    green_term = _c(feat["green_share"], 0.20)
    water_term = _c(feat["water_share"], 0.15)
    env_penalty = 0.5 * _c(feat["industrial_share"], 0.15) + 0.3 * _s(feat["major_density"], 1.0 / 5.0)
    out["environmental"] = (
        (0.65 * green_term + 0.35 * water_term) * (100.0 - env_penalty) / 100.0
        + 0.25 * _d(feat["green_dist_m"], 1000.0)
    ).clip(10.0, 100.0)

    return out


def aggregate(dims: pd.DataFrame,
              weights: dict[str, float] | None = None) -> pd.DataFrame:
    """Weighted aggregate + per-dimension contributions.

    Returns columns: quality, and contribution_<dim> = w_dim * dim / sum(w).
    The match/overall score is exactly the sum of the contributions.
    """
    w = dict(QUALITY_WEIGHTS if weights is None else weights)
    total_w = sum(w.values())
    out = pd.DataFrame(index=dims.index)
    out["quality"] = 0.0
    for dim in QUALITY_DIMENSIONS:
        c = w.get(dim, 0.0) * dims[dim] / total_w
        out[f"contribution_{dim}"] = c
        out["quality"] += c
    return out


def factors(row_dims: pd.Series, row_contrib: pd.Series,
            n: int = 3) -> tuple[list[dict], list[dict]]:
    """Positive and negative factors for one cell.

    Positive = highest-contribution dimensions scoring >= 50.
    Negative = lowest-scoring dimensions (< 50), worst first.
    """
    scored = [(dim, float(row_dims[dim]), float(row_contrib[f"contribution_{dim}"]))
              for dim in QUALITY_DIMENSIONS]
    pos = sorted([s for s in scored if s[1] >= 50.0],
                 key=lambda s: -s[2])[:n]
    neg = sorted([s for s in scored if s[1] < 50.0],
                 key=lambda s: s[1])[:n]
    pos = [{"dimension": d, "score": round(sc, 1),
            "contribution": round(c, 1),
            "description": _DIMENSION_DESCRIPTIONS[d]} for d, sc, c in pos]
    neg = [{"dimension": d, "score": round(sc, 1),
            "contribution": round(c, 1),
            "description": _DIMENSION_DESCRIPTIONS[d]} for d, sc, c in neg]
    return pos, neg
