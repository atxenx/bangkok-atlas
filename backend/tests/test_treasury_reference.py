"""Official area-price summaries must be spatially traceable and never parcel claims."""
from __future__ import annotations

from bangkok_ai import treasury_reference as treasury
from bangkok_ai.land_price import estimate_land_price
from bangkok_ai.official_road_reference import road_benchmark_for_context


def test_real_snapshot_is_used_for_nearby_sheet():
    reference = treasury.reference_for_point(13.7279, 100.5241)  # Silom
    assert reference is not None
    assert reference["resolution_m"] == 500
    assert reference["n"] >= 30
    assert reference["p10"] <= reference["median"] <= reference["p90"]
    assert reference["source_mode"] == "official_csv_snapshot"

    valuation = estimate_land_price("Bang Rak", reference=reference, land_size_sqwah=50)
    assert valuation["market_price_sqwah"] == reference["median"]
    assert valuation["assessed_price_sqwah"] == reference["median"]
    assert valuation["market_price_low"] == reference["p10"]
    assert valuation["valuation_thb"] is None
    assert valuation["budget_fit"] is None
    assert valuation["market_price_type"] == "treasury_area_reference"
    assert "not an appraisal for the selected parcel" in valuation["disclaimer"]


def test_sparse_tile_falls_back_to_real_sheet_or_district():
    sparse = treasury.reference_for_point(13.746, 100.5348)  # Siam tile has one record
    assert sparse is not None
    assert sparse["resolution_m"] == 2000
    assert sparse["n"] >= 30
    district = treasury.reference_for_district("Pathum Wan")
    assert district is not None
    assert district["resolution_m"] is None
    assert district["n"] > sparse["n"]


def test_mixed_siam_sheet_is_not_a_parcel_or_budget_price():
    reference = treasury.reference_for_point(13.74799, 100.534135)
    assert reference is not None
    assert reference["utm_sheet"] == "6620"
    assert reference["utm_subsheet"] == 13
    assert reference["median"] == 85_000
    assert reference["p90"] >= reference["median"] * 3

    valuation = estimate_land_price(
        "Pathum Wan", reference=reference, land_size_sqwah=50, budget_thb=10_000_000,
    )
    assert valuation["reference_wide_spread"] is True
    assert valuation["valuation_thb"] is None
    assert valuation["budget_fit"] is None
    assert valuation["market_price_sqwah"] == 85_000  # retained only as a labelled sheet statistic


def test_narrower_thong_lo_sheet_still_cannot_price_clicked_parcel():
    reference = treasury.reference_for_point(13.735468911977508, 100.58450170703348)
    assert reference is not None
    assert reference["resolution_m"] == 500
    assert reference["median"] == 200_000
    assert reference["p10"] == 140_000
    assert reference["p90"] == 440_000
    assert reference["p90"] < 3 * reference["median"]

    valuation = estimate_land_price(
        "Watthana", reference=reference, land_size_sqwah=50, budget_thb=12_000_000,
    )
    assert valuation["reference_wide_spread"] is False
    assert valuation["valuation_thb"] is None
    assert valuation["budget_fit"] is None


def test_published_road_range_is_context_not_clicked_parcel():
    benchmark = road_benchmark_for_context({"short_name": "Siam - Pathum Wan"})
    assert benchmark is not None
    assert benchmark["low"] == 400_000
    assert benchmark["high"] == 1_000_000
    assert benchmark["scope"] == "published_road_unit_comparator_not_clicked_parcel"
    assert benchmark["source_copy_url"].endswith(".pdf")
    assert road_benchmark_for_context({"short_name": "Silom"}) is None


def test_bilingual_grid_district_name_keeps_official_fallback():
    reference = treasury.reference_for_district("Nong Chok หนองจอก")
    assert reference is not None
    assert reference["source_mode"] == "official_csv_district_snapshot"
    assert reference["n"] >= 30

    valuation = estimate_land_price("Nong Chok หนองจอก", reference=reference)
    assert valuation["market_price_type"] == "treasury_area_reference"
    assert valuation["zone_tier"] == "Agricultural & Expansion"


def test_live_api_refresh_is_complete_and_cached(monkeypatch):
    treasury._LIVE_CACHE.clear()
    calls = []

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            filters = calls[0]["filters"]
            rows = [
                {**filters, "EVAPRICE": 100_000 + index * 1_000}
                for index in range(40)
            ]
            return {"success": True, "result": {"total": len(rows), "records": rows}}

    def fake_get(url, params, timeout):
        import json
        calls.append({"filters": json.loads(params["filters"]), "limit": params["limit"]})
        assert url == treasury.DATASTORE_URL
        assert timeout == 5
        return Response()

    monkeypatch.setattr(treasury.requests, "get", fake_get)
    refreshed = treasury.refresh_reference_for_point(13.7279, 100.5241)
    assert refreshed is not None
    assert refreshed["source_mode"] == "official_live_api"
    assert refreshed["n"] == 40
    assert refreshed["median"] == 119_500
    assert calls[0]["limit"] == treasury.LIVE_LIMIT
    assert treasury.refresh_reference_for_point(13.7279, 100.5241) == refreshed
    assert len(calls) == 1


def test_incomplete_live_api_never_replaces_snapshot(monkeypatch):
    treasury._LIVE_CACHE.clear()

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"success": True, "result": {"total": 100, "records": []}}

    monkeypatch.setattr(treasury.requests, "get", lambda *args, **kwargs: Response())
    reference = treasury.refresh_reference_for_point(13.7279, 100.5241)
    assert reference is not None
    assert reference["source_mode"] == "official_csv_snapshot"
