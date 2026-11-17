import pandas as pd

from bangkok_ai.config import QUALITY_DIMENSIONS, QUALITY_WEIGHTS
from bangkok_ai.quality import aggregate, compute_dimensions, factors
from bangkok_ai.recommend import match_scores, top_recommendations


def _feat_row(**over):
    base = {
        "station_density": 0.0, "station_dist_m": 50000.0,
        "transit_density": 0.0, "transit_dist_m": 50000.0,
        "poi_density": 0.0, "poi_diversity": 0.0,
        "minor_density": 0.0, "road_density": 0.0,
        "green_share": 0.0, "green_dist_m": 50000.0,
        "major_dist_m": 50000.0,
        "commercial_share": 0.0, "retail_share": 0.0, "n_retail": 0,
        "retail_density": 0.0,
        "residential_share": 0.0,
        "major_density": 0.0,
        "water_share": 0.0, "industrial_share": 0.0,
        "n_poi": 0, "n_transit": 0, "road_len_m": 0.0, "low_data": False,
        "hex_id": "h",
    }
    base.update(over)
    return base


def test_scores_in_range():
    feat = pd.DataFrame([_feat_row(), _feat_row(poi_density=300, transit_density=5)])
    dims = compute_dimensions(feat)
    assert (dims.values >= 0).all() and (dims.values <= 100).all()
    agg = aggregate(dims)
    assert agg["quality"].between(0, 100).all()


def test_monotonic_amenities():
    a = _feat_row(poi_density=0, poi_diversity=0)
    b = _feat_row(poi_density=400, poi_diversity=2.0)
    dims = compute_dimensions(pd.DataFrame([a, b]))
    assert dims.loc[1, "amenities"] > dims.loc[0, "amenities"]


def test_monotonic_transit():
    a = _feat_row(station_density=0, station_dist_m=50000)
    b = _feat_row(station_density=4, station_dist_m=150)
    dims = compute_dimensions(pd.DataFrame([a, b]))
    assert dims.loc[1, "transit"] > dims.loc[0, "transit"]


def test_transit_ignores_bus_stops():
    # a cell full of non-station transit elements (stops/entrances) but no
    # actual station must NOT score high on transit
    a = _feat_row(station_density=0, station_dist_m=50000,
                  transit_density=20, transit_dist_m=50)
    dims = compute_dimensions(pd.DataFrame([a]))
    assert dims.loc[0, "transit"] < 10


def test_factors_never_invented():
    row = pd.Series({**{d: 20.0 for d in QUALITY_DIMENSIONS},
                     **{f"contribution_{d}": 0.1 for d in QUALITY_DIMENSIONS}})
    pos, neg = factors(row, row)
    # everything scores < 50 -> no positive factors claimed
    assert pos == []
    assert len(neg) > 0


def test_recommend_weights_change_ranking():
    rich = _feat_row(transit_density=8, transit_dist_m=100, n_poi=200,
                     poi_density=300, poi_diversity=1.5, n_transit=3,
                     road_len_m=5000, minor_density=10, road_density=12,
                     hex_id="h0")
    poor = _feat_row(transit_density=0, transit_dist_m=50000, n_poi=2,
                     poi_density=1, poi_diversity=0.1, n_transit=0,
                     road_len_m=1500, minor_density=2, road_density=2,
                     hex_id="h1")
    feat = pd.DataFrame([rich, poor])
    dims = compute_dimensions(feat)
    agg = aggregate(dims)
    dims_full = dims.join(agg)

    w_transit = dict(QUALITY_WEIGHTS)
    w_transit["transit"] = 1.0
    w_green = dict(QUALITY_WEIGHTS)
    w_green["greenery"] = 1.0

    r_t = top_recommendations(dims_full, feat, w_transit, k=2)
    assert r_t.iloc[0]["hex_id"] == "h0"  # transit-rich cell wins
    r_with_budget = top_recommendations(
        dims_full, feat, w_transit, k=2, budget=1_000_000, land_size_sqwah=50,
    )
    assert r_with_budget[["hex_id", "match_score"]].equals(r_t[["hex_id", "match_score"]])

    r_g = top_recommendations(dims_full, feat, w_green, k=2)
    # greenery identical for both; ranking must still be well-formed
    assert r_g.iloc[0]["match_score"] >= r_g.iloc[1]["match_score"]


def test_match_score_is_contribution_sum():
    feat = pd.DataFrame([_feat_row(poi_density=100)])
    dims = compute_dimensions(feat)
    m = match_scores(dims, QUALITY_WEIGHTS)
    contribs = sum(m[f"contribution_{d}"].iloc[0] for d in QUALITY_DIMENSIONS)
    assert abs(contribs - m["match_score"].iloc[0]) < 1e-9
