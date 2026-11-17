"""Integration tests for FastAPI endpoints."""
import pytest
from fastapi import HTTPException

from bangkok_ai import api

from bangkok_ai.api import (
    _load_data,
    buildings_3d,
    get_districts,
    get_neighborhoods,
    get_presets,
    health,
    location,
    recommend,
    search,
    Preferences,
    grid,
)


def test_api_health():
    _load_data()
    h = health()
    assert h["status"] == "ok"
    assert h["cells_count"] > 0
    assert h["stations_count"] > 0


def test_api_presets():
    p = get_presets()
    assert len(p["presets"]) >= 5


def test_api_search():
    _load_data()
    res = search(q="Siam")
    assert res["count"] > 0
    assert any("Siam" in r["title_en"] or "สยาม" in r["title_th"] for r in res["results"])

    res2 = search(q="บางรัก")
    assert res2["count"] > 0


def test_api_buildings_3d():
    b = buildings_3d()
    assert b["type"] == "FeatureCollection"
    assert len(b["features"]) > 0
    assert b["metadata"]["height_policy"].startswith("Only explicit OSM")


def test_building_name_matches_only_containing_footprint(monkeypatch):
    monkeypatch.setattr(api, "_lookup_local_building_name", lambda lat, lng: None)
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"osm_id": 2, "name": "Clicked building", "category": "building", "geojson": {
                "type": "Polygon", "coordinates": [[[100.559, 13.739], [100.561, 13.739],
                [100.561, 13.741], [100.559, 13.741], [100.559, 13.739]]],
            }}

    monkeypatch.setattr(api.requests, "get", lambda *args, **kwargs: Response())
    api._lookup_building_name.cache_clear()
    assert api.building_name(13.74, 100.56)["name"] == "Clicked building"
    assert api.building_name(13.75, 100.56)["status"] == "unnamed"
    with pytest.raises(HTTPException):
        api.building_name(0, 0)


def test_local_osm_landmark_names_use_containing_footprints():
    import json
    from shapely.geometry import shape
    from bangkok_ai.config import DATA_RAW

    with (DATA_RAW / "poi.geojson").open(encoding="utf-8") as file:
        features = json.load(file)["features"]
    for expected in ("EMSPHERE", "ICONSIAM"):
        feature = next(item for item in features if item["properties"].get("name") == expected)
        point = shape(feature["geometry"]).representative_point()
        result = api._lookup_local_building_name(point.y, point.x)
        assert result is not None
        assert result["name"] == expected
        assert result["osm_id"] == feature["properties"]["osm_id"]


def test_selected_building_can_use_named_poi_inside_footprint(monkeypatch):
    from shapely.geometry import Point, Polygon
    from shapely.strtree import STRtree

    footprint = Polygon([(100.55, 13.73), (100.551, 13.73),
                         (100.551, 13.731), (100.55, 13.731)])
    hotel = Point(100.5505, 13.7305)
    monkeypatch.setattr(api, "_named_building_pois", lambda: (
        STRtree([]), [], [], STRtree([hotel]), [hotel],
        [{"name": "Hotel inside", "osm_id": 123, "category": "hotel"}],
    ))
    result = api.building_name_for_selection(api.BuildingNameSelection(
        lat=13.7305, lng=100.5505,
        footprint={"type": "Polygon", "coordinates": [list(map(list, footprint.exterior.coords))]},
    ))
    assert result["name"] == "Hotel inside"
    assert result["status"] == "matched_poi"


def test_grid_map_payload_has_centers():
    _load_data()
    payload = grid(include_dims=False)
    first = payload["features"][0]
    assert isinstance(first["properties"]["center_lat"], float)
    assert isinstance(first["properties"]["center_lng"], float)
    assert "transit" not in first["properties"]


def test_budget_is_informational_without_land_size():
    prefs = Preferences(budget=5_000_000)
    assert prefs.budget == 5_000_000
    assert prefs.land_size_sqwah is None


def test_api_budget_does_not_change_rank_without_parcel_price():
    _load_data()
    baseline = recommend(Preferences(k=5))["results"]
    with_budget = recommend(Preferences(k=5, budget=5_000_000, land_size_sqwah=50))["results"]
    assert [(r["hex_id"], r["match_score"]) for r in with_budget] == [
        (r["hex_id"], r["match_score"]) for r in baseline
    ]
    assert all(r["price_valuation"]["budget_fit"] is None for r in with_budget)


def test_api_recommend_and_location():
    _load_data()
    prefs = Preferences(
        weights={
            "transit": 90,
            "amenities": 80,
            "walkability": 70,
            "greenery": 30,
            "road_environment": 40,
            "commercial": 60,
            "residential": 40,
            "quietness": 30,
            "environmental": 30,
        },
        budget=15000000.0,
        land_size_sqwah=50.0,
        k=5,
    )
    rec = recommend(prefs)
    assert len(rec["results"]) == 5
    first = rec["results"][0]
    assert "hex_id" in first
    assert "context" in first
    assert "title_th" in first["context"]
    assert "district_th" in first["context"]
    assert "price_valuation" in first
    assert first["price_valuation"]["market_price_sqwah"] > 0

    # Test Location Detail
    loc = location(first["hex_id"], land_size_sqwah=50.0, budget=15000000.0)
    assert loc["hex_id"] == first["hex_id"]
    assert "price_valuation" in loc
    assert "multimodal_visual" in loc
    assert "transit_walk" in loc["context"]
    # AI Investment Memo
    assert "investment_memo" in loc
    memo = loc["investment_memo"]
    assert memo["investment_outlook"] in {"prime", "high", "stable", "cautious", "limited"}
    assert len(memo["executive_summary"]) > 10
    assert len(memo["use_cases"]) >= 1
    assert "yield_estimate" in memo

    no_size = location(first["hex_id"])
    assert no_size["price_valuation"]["valuation_thb"] is None
    assert no_size["price_valuation"]["assessed_price_type"] == "treasury_area_reference"
    assert no_size["price_valuation"]["reference_record_count"] >= 30


def test_siam_location_does_not_present_sheet_median_as_plot_price():
    _load_data()
    loc = location("300m-r49-c48", land_size_sqwah=50.0, budget=10_000_000.0)
    price = loc["price_valuation"]
    assert loc["context"]["short_name"] == "Siam - Pathum Wan"
    assert price["market_price_sqwah"] == 85_000
    assert price["reference_wide_spread"] is True
    assert price["valuation_thb"] is None
    assert price["budget_fit"] is None
    assert price["road_benchmark"]["road_name_en"] == "Rama I Road"
    assert price["road_benchmark"]["low"] == 400_000
    assert "ไม่ใช่ราคาแปลงนี้" in loc["investment_memo"]["executive_summary_th"]


def test_unknown_district_does_not_fall_back_to_all_bangkok():
    _load_data()
    rec = recommend(Preferences(district="Not A Bangkok District", k=3))
    assert rec["results"] == []


def test_api_neighborhoods():
    n = get_neighborhoods()
    assert n["count"] >= 30
    assert any(item["name_th"] == "สยาม" or "Siam" in item["name_en"] for item in n["neighborhoods"])
    assert any(item["name_th"] == "ทองหล่อ" or "Thong Lo" in item["name_en"] for item in n["neighborhoods"])


def test_api_districts():
    d = get_districts()
    assert d["type"] == "FeatureCollection"
    assert len(d["features"]) == 50
    assert any(f["properties"]["name_th"] == "ปทุมวัน" for f in d["features"])
    assert any(f["properties"]["name_en"] == "Bang Rak" for f in d["features"])
