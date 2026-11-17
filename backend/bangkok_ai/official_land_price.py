"""Exact parcel appraisal lookup from the Treasury Department's public CKAN data.

The Bangkok resource has UTM sheet and land-number identifiers, but no parcel
geometry or title-deed number. Never infer a parcel from a map coordinate.
"""
from __future__ import annotations

import json
import requests


RESOURCE_ID = "00da1ca3-2c41-436d-a426-d0c06f8cae03"
DATASTORE_URL = "https://catalog.treasury.go.th/api/3/action/datastore_search"
RESOURCE_URL = (
    "https://catalog.treasury.go.th/dataset/f5072145-2f1a-4500-bf60-d122b866ac2f"
    f"/resource/{RESOURCE_ID}"
)
class OfficialAppraisalUnavailable(Exception):
    """The official upstream service did not return trustworthy data."""


def lookup_bangkok_appraisal(
    *, utm_map1: str, utm_map2: str, utm_map3: str,
    utm_map4: int, utm_scale: str, land_no: str,
) -> dict:
    """Return exact matches, without guessing when identifiers are incomplete."""
    filters = {
        "UTMMAP1": utm_map1.strip(),
        "UTMMAP2": utm_map2.strip(),
        "UTMMAP3": utm_map3.strip(),
        "UTMMAP4": utm_map4,
        "UTMSCALE": utm_scale.strip(),
        "LAND_NO": land_no.strip(),
    }
    try:
        response = requests.get(
            DATASTORE_URL,
            params={"resource_id": RESOURCE_ID, "filters": json.dumps(filters), "limit": 11},
            timeout=12,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("success") is not True or not isinstance(payload.get("result"), dict):
            raise ValueError("Unsuccessful datastore response")
        result = payload["result"]
        records = result.get("records")
        if not isinstance(records, list) or not isinstance(result.get("total"), int):
            raise ValueError("Invalid datastore result")
        matches = []
        for record in records:
            if not isinstance(record, dict) or any(
                (int(record.get(key, -1)) != value if key == "UTMMAP4" else str(record.get(key, "")) != value)
                for key, value in filters.items()
            ):
                raise ValueError("Datastore returned a mismatched parcel")
            value = float(record["EVAPRICE"])
            if not (0 < value < 100_000_000):
                raise ValueError("Invalid appraisal value")
            matches.append({"appraised_price_sqwah": value, "land_no": record["LAND_NO"]})
    except (requests.RequestException, ValueError, TypeError, KeyError) as exc:
        raise OfficialAppraisalUnavailable("Treasury data service is unavailable") from exc

    return {
        "source": "Thai Treasury Department public land-valuation dataset",
        "source_url": RESOURCE_URL,
        "unit": "THB/sq.wah",
        "identifiers": filters,
        "match_count": result["total"],
        "matches": matches,
        "complete": result["total"] <= len(matches),
        "notice": (
            "Only an exact UTM sheet and land-number match is shown. "
            "The source has no parcel coordinates; this result is not linked "
            "to the selected map location. The online datastore may not contain "
            "every record from the source CSV."
        ),
    }
