"""Published road-unit benchmarks, shown only as context beside sheet statistics.

The Treasury's example table reports prices for land units on named roads.
It cannot identify whether an arbitrary clicked point belongs to such a unit.
"""
from __future__ import annotations


TREASURY_ROAD_TABLE_URL = "https://assessprice.treasury.go.th/assessprice_manual.pdf"
# The Treasury URL currently serves its search-app shell instead of the PDF.
# Keep the original publication URL for provenance and offer an accessible copy.
ROAD_TABLE_COPY_URL = (
    "https://thaipropertymentor.com/wp-content/uploads/2023/01/"
    "สรุปราคาประเมินทุนทรัพย์ที่ดินรอบบัญชี-พ.ศ.-2566-2569-กรุงเทพมหานคร.pdf"
)


def road_benchmark_for_context(context: dict) -> dict | None:
    """Return a clearly scoped comparator for the Siam neighborhood label."""
    if context.get("short_name") != "Siam - Pathum Wan":
        return None
    return {
        "road_name_th": "ถนนพระรามที่ 1",
        "road_name_en": "Rama I Road",
        "low": 400_000,
        "high": 1_000_000,
        "cycle": "2566–2569",
        "source_url": TREASURY_ROAD_TABLE_URL,
        "source_copy_url": ROAD_TABLE_COPY_URL,
        "scope": "published_road_unit_comparator_not_clicked_parcel",
    }
