"""The official lookup must never substitute a model estimate for a parcel price."""
import json

import pytest

from bangkok_ai import official_land_price


IDENTIFIERS = {
    "utm_map1": "5136", "utm_map2": "3", "utm_map3": "6416",
    "utm_map4": 11, "utm_scale": "1000", "land_no": "203",
}


def test_exact_treasury_record(monkeypatch):
    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"success": True, "result": {"total": 1, "records": [{
                "UTMMAP1": "5136", "UTMMAP2": "3", "UTMMAP3": "6416",
                "UTMMAP4": 11, "UTMSCALE": "1000", "LAND_NO": "203",
                "EVAPRICE": 100000,
            }]}}

    def fake_get(url, *, params, timeout):
        assert url == official_land_price.DATASTORE_URL
        assert params["resource_id"] == official_land_price.RESOURCE_ID
        assert json.loads(params["filters"])["LAND_NO"] == "203"
        assert timeout <= 15
        return Response()

    monkeypatch.setattr(official_land_price.requests, "get", fake_get)
    result = official_land_price.lookup_bangkok_appraisal(**IDENTIFIERS)
    assert result["match_count"] == 1
    assert result["matches"][0]["appraised_price_sqwah"] == 100000
    assert result["source_url"].startswith("https://catalog.treasury.go.th/")


def test_rejects_mismatched_upstream_parcel(monkeypatch):
    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"success": True, "result": {"total": 1, "records": [{
                "UTMMAP1": "5136", "UTMMAP2": "3", "UTMMAP3": "6416",
                "UTMMAP4": 11, "UTMSCALE": "1000", "LAND_NO": "204",
                "EVAPRICE": 100000,
            }]}}

    monkeypatch.setattr(official_land_price.requests, "get", lambda *args, **kwargs: Response())
    with pytest.raises(official_land_price.OfficialAppraisalUnavailable):
        official_land_price.lookup_bangkok_appraisal(**IDENTIFIERS)


def test_empty_result_is_not_replaced_with_estimate(monkeypatch):
    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"success": True, "result": {"total": 0, "records": []}}

    monkeypatch.setattr(official_land_price.requests, "get", lambda *args, **kwargs: Response())
    result = official_land_price.lookup_bangkok_appraisal(**IDENTIFIERS)
    assert result["match_count"] == 0
    assert result["matches"] == []
