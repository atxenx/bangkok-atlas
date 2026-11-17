"""Unit tests for Bangkok administrative geocoding, land price valuation, and search."""
import pytest
from bangkok_ai.admin_geo import (
    enrich_location_context,
    find_nearest_district,
    find_neighborhood,
    find_nearest_landmark,
)
from bangkok_ai.land_price import estimate_land_price
from bangkok_ai.config import PRESETS


def test_find_nearest_district_siam():
    # Coordinates of Siam Paragon
    d = find_nearest_district(13.7460, 100.5348)
    assert d["name_en"] == "Pathum Wan"
    assert d["name_th"] == "ปทุมวัน"
    assert d["zone"] == "CBD"


def test_find_nearest_district_silom():
    # Coordinates in Bang Rak / Silom
    d = find_nearest_district(13.7279, 100.5241)
    assert d["name_en"] == "Bang Rak"
    assert d["zone"] == "CBD"


def test_find_neighborhood_thong_lo():
    # Coordinates in Thong Lo (Sukhumvit 55)
    nb = find_neighborhood(13.7335, 100.5840)
    assert nb is not None
    assert "ทองหล่อ" in nb[0] or "Thong Lo" in nb[1]


def test_enrich_location_context():
    ctx = enrich_location_context(
        lat=13.7335,
        lng=100.5840,
        station_name="Thong Lo",
        station_dist_m=350.0,
    )
    assert "district_en" in ctx
    assert ctx["transit_walk"]["walk_time_min"] is not None
    assert ctx["transit_walk"]["distance_m"] == 350
    assert "nearest_landmark" in ctx


def test_estimate_land_price_cbd():
    val = estimate_land_price(
        district_en="Pathum Wan",
        station_dist_m=150.0,
        poi_density=40.0,
        commercial_share=0.25,
        major_dist_m=200.0,
        land_size_sqwah=100.0,
        budget_thb=100000000.0,
    )
    assert val["market_price_sqwah"] >= val["assessed_price_sqwah"]
    assert val["market_price_sqwah"] >= 500000
    assert val["valuation_thb"] is None
    assert val["budget_fit"] is None
    assert val["price_level"] == "Ultra-Luxury CBD"


def test_estimate_land_price_suburban():
    val = estimate_land_price(
        district_en="Nong Chok",
        station_dist_m=5000.0,
        poi_density=2.0,
        commercial_share=0.01,
        land_size_sqwah=100.0,
    )
    assert val["market_price_sqwah"] < 150000
    assert val["price_level"] in ("Budget Accessible", "Suburban Growth")


def test_presets_exist():
    assert len(PRESETS) >= 5
    for p in PRESETS:
        assert "id" in p
        assert "name_th" in p
        assert "weights" in p
