"""Unit tests for the Street-Level Visual Indices module."""
import pytest
from bangkok_ai.street_visual import compute_street_indices, _green_canopy, _sidewalk_quality, _sky_openness

VALID_CHARS = {"green_residential", "urban_dense", "urban_mixed", "mixed_urban", "suburban_open", "low_density"}


def _feat(
    green_share=0.0, water_share=0.0, green_dist_m=2000.0,
    minor_density=8.0, road_density=10.0,
    major_density=0.0, commercial_share=0.0,
):
    return {
        "green_share": green_share,
        "water_share": water_share,
        "green_dist_m": green_dist_m,
        "minor_density": minor_density,
        "road_density": road_density,
        "major_density": major_density,
        "commercial_share": commercial_share,
    }


class TestBounds:
    def test_all_zero_feat(self):
        idx = compute_street_indices(_feat(), station_dist_m=9999.0)
        for k in ("green_canopy_score", "sidewalk_quality", "sky_openness"):
            assert 0.0 <= idx[k] <= 100.0, f"{k} out of bounds: {idx[k]}"

    def test_all_max_feat(self):
        idx = compute_street_indices(
            _feat(green_share=1.0, water_share=1.0, green_dist_m=0.0,
                  minor_density=40.0, road_density=40.0,
                  major_density=30.0, commercial_share=1.0),
            station_dist_m=0.0,
        )
        for k in ("green_canopy_score", "sidewalk_quality", "sky_openness"):
            assert 0.0 <= idx[k] <= 100.0, f"{k} out of bounds: {idx[k]}"


class TestGreenCanopy:
    def test_park_cell_high(self):
        score = _green_canopy(green_share=0.85, water_share=0.05, green_dist_m=0.0)
        assert score >= 70, f"Park cell canopy should be >=70, got {score}"

    def test_dense_urban_low(self):
        score = _green_canopy(green_share=0.0, water_share=0.0, green_dist_m=3000.0)
        assert score < 15, f"Dense urban canopy should be <15, got {score}"

    def test_proximity_matters(self):
        near = _green_canopy(green_share=0.0, water_share=0.0, green_dist_m=100.0)
        far  = _green_canopy(green_share=0.0, water_share=0.0, green_dist_m=2000.0)
        assert near > far


class TestSidewalkQuality:
    def test_cbd_station_adjacent_high(self):
        score = _sidewalk_quality(minor_density=20.0, road_density=25.0, station_dist_m=150.0)
        assert score >= 70, f"CBD TOD sidewalk should be >=70, got {score}"

    def test_outer_suburban_low(self):
        score = _sidewalk_quality(minor_density=2.0, road_density=4.0, station_dist_m=5000.0)
        assert score < 30, f"Suburban sidewalk should be <30, got {score}"

    def test_tod_bonus_meaningful(self):
        near = _sidewalk_quality(minor_density=8.0, road_density=10.0, station_dist_m=200.0)
        far  = _sidewalk_quality(minor_density=8.0, road_density=10.0, station_dist_m=5000.0)
        assert near > far + 5, "TOD bonus should add >=5 points"


class TestSkyOpenness:
    def test_low_density_suburban_high(self):
        score = _sky_openness(major_density=0.0, commercial_share=0.0, road_density=4.0, green_canopy_score=20.0)
        assert score >= 65, f"Suburban sky openness should be >=65, got {score}"

    def test_cbd_high_density_low(self):
        score = _sky_openness(major_density=10.0, commercial_share=0.7, road_density=30.0, green_canopy_score=5.0)
        assert score < 30, f"CBD sky openness should be <30, got {score}"

    def test_green_lifts_openness(self):
        without = _sky_openness(major_density=2.0, commercial_share=0.1, road_density=12.0, green_canopy_score=0.0)
        with_   = _sky_openness(major_density=2.0, commercial_share=0.1, road_density=12.0, green_canopy_score=60.0)
        assert with_ > without


class TestComputeStreetIndices:
    def test_returns_required_keys(self):
        idx = compute_street_indices(_feat(), station_dist_m=500.0)
        required = {
            "green_canopy_score", "sidewalk_quality", "sky_openness",
            "street_character", "street_character_label", "methodology",
        }
        assert required.issubset(idx.keys())

    def test_street_character_valid(self):
        for feat, dist in [
            (_feat(major_density=8.0, commercial_share=0.5, road_density=25.0, minor_density=18.0), 200.0),
            (_feat(green_share=0.8, green_dist_m=0.0), 3000.0),
            (_feat(major_density=0.0, road_density=4.0), 8000.0),
        ]:
            idx = compute_street_indices(feat, station_dist_m=dist)
            assert idx["street_character"] in VALID_CHARS

    def test_none_station_dist_handled(self):
        """Should not crash when station_dist_m is None."""
        idx = compute_street_indices(_feat(), station_dist_m=None)
        assert 0.0 <= idx["sidewalk_quality"] <= 100.0

    def test_nan_feat_values_handled(self):
        """NaN values in feature row should not crash."""
        import math
        feat = _feat()
        feat["green_dist_m"] = float("nan")
        feat["major_density"] = float("nan")
        idx = compute_street_indices(feat, station_dist_m=500.0)
        assert 0.0 <= idx["green_canopy_score"] <= 100.0
        assert 0.0 <= idx["sky_openness"] <= 100.0
