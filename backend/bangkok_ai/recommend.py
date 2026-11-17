"""Weighted preference-based location recommendation.

Match score = weighted sum of dimension scores, normalized by total user weight,
with a per-preference contribution breakdown so every recommendation is explainable.
Budget is accepted for API compatibility but cannot safely rank cells until
parcel-level appraisal or verified transaction data is available.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import QUALITY_DIMENSIONS, QUALITY_WEIGHTS

FEATURE_COLS = [
    "n_poi", "poi_diversity", "n_transit", "transit_dist_m", "green_share",
    "green_dist_m", "water_share", "road_density", "major_dist_m",
    "commercial_share", "residential_share", "industrial_share",
]


def match_scores(dims: pd.DataFrame,
                 weights: dict[str, float]) -> pd.DataFrame:
    """Return match_score and contribution_<dim> for the given weights."""
    w = {d: max(0.0, float(weights.get(d, 0.0))) for d in QUALITY_DIMENSIONS}
    total = sum(w.values())
    if total <= 0:
        w = dict(QUALITY_WEIGHTS)
        total = sum(w.values())
    out = pd.DataFrame(index=dims.index)
    out["match_score"] = 0.0
    for dim in QUALITY_DIMENSIONS:
        contrib = w[dim] * dims[dim] / total
        out[f"contribution_{dim}"] = contrib
        out["match_score"] += contrib
    return out


def top_recommendations(
    dims: pd.DataFrame,
    feat: pd.DataFrame,
    weights: dict[str, float],
    k: int = 10,
    budget: float | None = None,
    land_size_sqwah: float | None = None,
    land_use: str | None = None,
    district_filter: str | None = None,
    districts: list[str] | None = None,
) -> pd.DataFrame:
    """Rank cells by weighted match score, land use, and district (not budget)."""
    valid = ~feat["low_data"].fillna(True)
    dims_v = dims[valid]
    feat_v = feat[valid]

    # Filter to specific district if requested
    if district_filter and district_filter.strip() and district_filter != "all" and districts is not None:
        q_d = district_filter.strip().lower().replace("เขต", "").replace("district", "").strip()
        matched = [
            i for i in dims_v.index
            if i < len(districts) and (
                q_d in districts[i].lower()
            )
        ]
        dims_v = dims_v.loc[matched]
        feat_v = feat_v.loc[matched]

    # Adjust weights if land-use preference is given
    adj_weights = dict(weights)
    if land_use == "residential":
        adj_weights["residential"] = adj_weights.get("residential", 50.0) * 1.5 + 20.0
        adj_weights["quietness"] = adj_weights.get("quietness", 40.0) * 1.2 + 10.0
    elif land_use == "commercial":
        adj_weights["commercial"] = adj_weights.get("commercial", 50.0) * 1.5 + 20.0
        adj_weights["amenities"] = adj_weights.get("amenities", 50.0) * 1.3 + 15.0

    scores = match_scores(dims_v, adj_weights)
    out = scores.copy()
    out["hex_id"] = dims_v.index.map(lambda i: feat.loc[i, "hex_id"])
    out["quality"] = dims_v["quality"] if "quality" in dims_v else scores["match_score"]

    out = out.sort_values("match_score", ascending=False).head(k)
    out = out.reset_index(drop=True)
    return out


def comparables(cells_utm: pd.DataFrame, feat: pd.DataFrame, dims: pd.DataFrame,
                hex_id: str, k: int = 3, radius_m: float = 3000.0) -> list[dict]:
    """Nearest cells in standardized feature space, spatially constrained."""
    idx = feat.index[feat["hex_id"] == hex_id]
    if len(idx) == 0:
        return []
    i = idx[0]

    x, y = feat.loc[i, "center_utm_x"], feat.loc[i, "center_utm_y"]
    cand = feat.index[
        (np.sqrt((feat["center_utm_x"] - x) ** 2 + (feat["center_utm_y"] - y) ** 2)
         <= radius_m) & (feat.index != i)
    ]
    if len(cand) == 0:
        return []

    X = feat.loc[cand, FEATURE_COLS].astype(float)
    Xq = feat.loc[[i], FEATURE_COLS].astype(float)
    mu, sigma = X.mean(), X.std().replace(0.0, 1.0)
    Xz = (X - mu) / sigma
    Xqz = (Xq - mu) / sigma
    dist = np.sqrt(((Xz - Xqz.iloc[0]) ** 2).sum(axis=1))
    top = dist.nsmallest(k)

    results = []
    for j, d in top.items():
        results.append({
            "hex_id": feat.loc[j, "hex_id"],
            "feature_distance": round(float(d), 2),
            "quality": round(float(dims.loc[j, "quality"]), 1)
            if "quality" in dims else None,
        })
    return results
