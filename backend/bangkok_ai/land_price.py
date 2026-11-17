"""Bangkok Land Price & Spatial Valuation Model.

Uses district-level baseline values benchmarked to the Treasury Department
appraisal cycle with a transparent Spatial Hedonic Pricing Model. Outputs are
screening estimates, not parcel-specific official appraisals or observed market
transactions.
"""
from __future__ import annotations

import math
from typing import NotRequired, TypedDict


# District-level model baselines in THB/sq.wah, benchmarked to published Treasury
# road-unit tables for the Bangkok appraisal cycle 2566-2569. Official values are
# parcel/road-unit specific; these district summaries must not be presented as an
# official valuation for an individual plot.
DISTRICT_BASE_ASSESSED_PRICES: dict[str, dict] = {
    # Prime CBD (ถนนสีลม, เพลินจิต, วิทยุ, พระราม 1, สาทร)
    "Pathum Wan": {"name_th": "ปทุมวัน", "assessed_base": 750000, "assessed_max": 1000000, "zone_tier": "Super Luxury CBD"},
    "Bang Rak": {"name_th": "บางรัก", "assessed_base": 650000, "assessed_max": 1000000, "zone_tier": "Super Luxury CBD"},
    "Sathorn": {"name_th": "สาทร", "assessed_base": 550000, "assessed_max": 800000, "zone_tier": "Prime CBD"},
    "Watthana": {"name_th": "วัฒนา", "assessed_base": 500000, "assessed_max": 750000, "zone_tier": "Prime Urban Sukhumvit"},
    "Khlong Toei": {"name_th": "คลองเตย", "assessed_base": 450000, "assessed_max": 700000, "zone_tier": "Prime Urban Sukhumvit"},
    "Ratchathewi": {"name_th": "ราชเทวี", "assessed_base": 400000, "assessed_max": 600000, "zone_tier": "Urban Hub"},
    "Phaya Thai": {"name_th": "พญาไท", "assessed_base": 350000, "assessed_max": 500000, "zone_tier": "Urban Hub"},
    "Huai Khwang": {"name_th": "ห้วยขวาง", "assessed_base": 300000, "assessed_max": 450000, "zone_tier": "Urban Commercial (Rama 9)"},
    "Din Daeng": {"name_th": "ดินแดง", "assessed_base": 280000, "assessed_max": 400000, "zone_tier": "Inner Ring"},
    "Chatuchak": {"name_th": "จตุจักร", "assessed_base": 250000, "assessed_max": 380000, "zone_tier": "Northern Hub"},
    "Phra Nakhon": {"name_th": "พระนคร", "assessed_base": 280000, "assessed_max": 450000, "zone_tier": "Historic Center"},
    "Samphanthawong": {"name_th": "สัมพันธวงศ์", "assessed_base": 350000, "assessed_max": 700000, "zone_tier": "Chinatown Commercial"},
    "Pom Prap Sattru Phai": {"name_th": "ป้อมปราบศัตรูพ่าย", "assessed_base": 250000, "assessed_max": 400000, "zone_tier": "Inner Ring"},
    "Dusit": {"name_th": "ดุสิต", "assessed_base": 220000, "assessed_max": 350000, "zone_tier": "Government & Heritage"},
    "Khlong San": {"name_th": "คลองสาน", "assessed_base": 250000, "assessed_max": 450000, "zone_tier": "Riverside Prime"},
    "Thon Buri": {"name_th": "ธนบุรี", "assessed_base": 180000, "assessed_max": 300000, "zone_tier": "Inner Thonburi"},
    "Bangkok Yai": {"name_th": "บางกอกใหญ่", "assessed_base": 150000, "assessed_max": 240000, "zone_tier": "Inner Thonburi"},
    "Bangkok Noi": {"name_th": "บางกอกน้อย", "assessed_base": 160000, "assessed_max": 260000, "zone_tier": "Inner Thonburi"},
    "Bang Phlat": {"name_th": "บางพลัด", "assessed_base": 150000, "assessed_max": 250000, "zone_tier": "Mid Thonburi"},
    "Bang Sue": {"name_th": "บางซื่อ", "assessed_base": 200000, "assessed_max": 320000, "zone_tier": "Grand Station Gateway"},
    "Yan Nawa": {"name_th": "ยานนาวา", "assessed_base": 240000, "assessed_max": 380000, "zone_tier": "Rama 3 Riverside"},
    "Bang Kho Laem": {"name_th": "บางคอแหลม", "assessed_base": 180000, "assessed_max": 300000, "zone_tier": "Charoen Krung South"},
    "Phra Khanong": {"name_th": "พระโขนง", "assessed_base": 200000, "assessed_max": 350000, "zone_tier": "Sukhumvit Outer Hub"},
    "Bang Na": {"name_th": "บางนา", "assessed_base": 160000, "assessed_max": 280000, "zone_tier": "Eastern Gateway"},
    "Suan Luang": {"name_th": "สวนหลวง", "assessed_base": 150000, "assessed_max": 250000, "zone_tier": "Eastern Residential"},
    "Lat Phrao": {"name_th": "ลาดพร้าว", "assessed_base": 160000, "assessed_max": 260000, "zone_tier": "Mid Ring North"},
    "Wang Thonglang": {"name_th": "วังทองหลาง", "assessed_base": 150000, "assessed_max": 240000, "zone_tier": "Mid Ring North"},
    "Bang Kapi": {"name_th": "บางกะปิ", "assessed_base": 140000, "assessed_max": 220000, "zone_tier": "Eastern Transport Hub"},
    "Bueng Kum": {"name_th": "บึงกุ่ม", "assessed_base": 100000, "assessed_max": 180000, "zone_tier": "Suburban East"},
    "Saphan Sung": {"name_th": "สะพานสูง", "assessed_base": 90000, "assessed_max": 160000, "zone_tier": "Suburban East"},
    "Khan Na Yao": {"name_th": "คันนายาว", "assessed_base": 85000, "assessed_max": 150000, "zone_tier": "Suburban East"},
    "Prawet": {"name_th": "ประเวศ", "assessed_base": 110000, "assessed_max": 200000, "zone_tier": "Eastern Growth"},
    "Lak Si": {"name_th": "หลักสี่", "assessed_base": 130000, "assessed_max": 220000, "zone_tier": "Northern Corridor"},
    "Don Mueang": {"name_th": "ดอนเมือง", "assessed_base": 100000, "assessed_max": 170000, "zone_tier": "Airport Corridor"},
    "Sai Mai": {"name_th": "สายไหม", "assessed_base": 70000, "assessed_max": 130000, "zone_tier": "Northern Growth"},
    "Taling Chan": {"name_th": "ตลิ่งชัน", "assessed_base": 90000, "assessed_max": 160000, "zone_tier": "Western Green Residential"},
    "Phasi Charoen": {"name_th": "ภาษีเจริญ", "assessed_base": 120000, "assessed_max": 200000, "zone_tier": "MRT Blue Line West"},
    "Bang Khae": {"name_th": "บางแค", "assessed_base": 90000, "assessed_max": 160000, "zone_tier": "Western Hub"},
    "Chom Thong": {"name_th": "จอมทอง", "assessed_base": 100000, "assessed_max": 180000, "zone_tier": "South-West Ring"},
    "Rat Burana": {"name_th": "ราษฎร์บูรณะ", "assessed_base": 95000, "assessed_max": 170000, "zone_tier": "South Riverside"},
    "Thung Khru": {"name_th": "ทุ่งครุ", "assessed_base": 65000, "assessed_max": 120000, "zone_tier": "Southern Growth"},
    "Bang Khun Thian": {"name_th": "บางขุนเทียน", "assessed_base": 55000, "assessed_max": 110000, "zone_tier": "Southern Coastal"},
    "Bang Bon": {"name_th": "บางบอน", "assessed_base": 60000, "assessed_max": 115000, "zone_tier": "South-West Outer"},
    "Nong Khaem": {"name_th": "หนองแขม", "assessed_base": 55000, "assessed_max": 105000, "zone_tier": "Western Border"},
    "Thawi Watthana": {"name_th": "ทวีวัฒนา", "assessed_base": 60000, "assessed_max": 120000, "zone_tier": "Western Green Border"},
    "Min Buri": {"name_th": "มีนบุรี", "assessed_base": 60000, "assessed_max": 125000, "zone_tier": "Eastern Sub-Center"},
    "Khlong Sam Wa": {"name_th": "คลองสามวา", "assessed_base": 45000, "assessed_max": 95000, "zone_tier": "North-East Outer"},
    "Nong Chok": {"name_th": "หนองจอก", "assessed_base": 30000, "assessed_max": 75000, "zone_tier": "Agricultural & Expansion"},
    "Lat Krabang": {"name_th": "ลาดกระบัง", "assessed_base": 55000, "assessed_max": 120000, "zone_tier": "Airport & Industrial East"},
}


class PriceValuation(TypedDict):
    assessed_price_sqwah: float
    market_price_sqwah: float
    market_price_low: float
    market_price_high: float
    zone_tier: str
    price_level: str  # High, Medium-High, Medium, Budget
    affordability_index: float  # 0-100 (higher means more accessible/affordable)
    valuation_thb: float | None
    land_size_sqwah: float | None
    budget_fit: str | None  # "Within Budget", "Over Budget", None
    methodology: str
    assessed_price_type: str
    market_price_type: str
    official_lookup_url: str
    disclaimer: str
    reference_record_count: NotRequired[int]
    reference_resolution_m: NotRequired[int | None]
    reference_source_mode: NotRequired[str]
    reference_source_last_modified: NotRequired[str]
    reference_utm_sheet: NotRequired[str | None]
    reference_utm_subsheet: NotRequired[int | None]
    reference_source_url: NotRequired[str]
    reference_wide_spread: NotRequired[bool]
    road_benchmark: NotRequired[dict]


def estimate_land_price(
    district_en: str,
    station_dist_m: float | None = None,
    poi_density: float = 0.0,
    commercial_share: float = 0.0,
    major_dist_m: float | None = None,
    green_share: float = 0.0,
    industrial_share: float = 0.0,
    land_size_sqwah: float | None = None,
    budget_thb: float | None = None,
    reference: dict | None = None,
) -> PriceValuation:
    """Prefer a real Treasury sheet summary; use the legacy model only if absent."""
    canonical_district = next(
        (name for name in DISTRICT_BASE_ASSESSED_PRICES if district_en == name or district_en.startswith(f"{name} ")),
        district_en,
    )
    info = DISTRICT_BASE_ASSESSED_PRICES.get(
        canonical_district,
        {"name_th": district_en, "assessed_base": 120000, "assessed_max": 200000, "zone_tier": "Metropolitan Zone"},
    )
    base_assessed = float(info["assessed_base"])
    max_assessed = float(info["assessed_max"])

    if reference is not None:
        # These are actual *recorded appraisals* in a nearby map sheet. The
        # median is not the appraisal of the selected parcel, and no market
        # premium is applied without transaction evidence.
        median = int(reference["median"])
        low = int(reference["p10"])
        high = int(reference["p90"])
        wide_spread = high >= 3 * median
        if median >= 600000:
            price_level = "Ultra-Luxury CBD"
        elif median >= 350000:
            price_level = "Prime Urban"
        elif median >= 180000:
            price_level = "Urban Mid-Tier"
        elif median >= 90000:
            price_level = "Suburban Growth"
        else:
            price_level = "Budget Accessible"
        affordability = max(0.0, min(100.0, 100.0 * (1.0 - math.log10(max(1.0, median / 25000.0)) / math.log10(1000000.0 / 25000.0))))
        # A sheet statistic never identifies the selected parcel, even when
        # its distribution is narrow. Do not turn it into a total or a
        # purchase-budget verdict without a matched parcel/transaction.
        valuation_thb = None
        budget_fit = None
        resolution = reference.get("resolution_m")
        count = int(reference["n"])
        area_label = f"{resolution:,} m UTM map sheet" if resolution else "district"
        return {
            "assessed_price_sqwah": median,
            "market_price_sqwah": median,  # Legacy wire key; UI labels it as a sheet reference.
            "market_price_low": low,
            "market_price_high": high,
            "zone_tier": info["zone_tier"],
            "price_level": price_level,
            "is_golden_location": median >= 600000,
            "affordability_index": round(affordability, 1),
            "valuation_thb": valuation_thb,
            "land_size_sqwah": land_size_sqwah,
            "budget_fit": budget_fit,
            "methodology": f"Median and observed 10th–90th percentiles of {count:,} Treasury appraisal records in the nearby {area_label}. These are area statistics, not a parcel or market price; no land-size valuation or purchase-budget screening is performed.",
            "assessed_price_type": "treasury_area_reference",
            "market_price_type": "treasury_area_reference",
            "official_lookup_url": "https://assessprice.treasury.go.th/",
            "disclaimer": "Official data aggregated by map sheet, not an appraisal for the selected parcel or a verified sale price. Map-sheet datum is not recorded in the price CSV; boundaries may be offset.",
            "reference_record_count": count,
            "reference_resolution_m": resolution,
            "reference_source_mode": reference["source_mode"],
            "reference_source_last_modified": reference["source_last_modified"],
            "reference_utm_sheet": reference["utm_sheet"],
            "reference_utm_subsheet": reference["utm_subsheet"],
            "reference_source_url": reference["source_url"],
            "reference_wide_spread": wide_spread,
        }

    # --- Spatial Hedonic Multipliers ---
    # 1. Transit Proximity Multiplier (0.0 to +0.80)
    # Proximity to BTS/MRT station heavily drives Bangkok land value
    transit_mult = 0.0
    if station_dist_m is not None and not math.isnan(station_dist_m):
        if station_dist_m <= 300:
            transit_mult = 0.75
        elif station_dist_m <= 600:
            transit_mult = 0.50 * math.exp(-(station_dist_m - 300) / 400.0)
        elif station_dist_m <= 1200:
            transit_mult = 0.25 * math.exp(-(station_dist_m - 600) / 600.0)
        else:
            transit_mult = 0.05

    # 2. Commercial & POI Vibrancy Multiplier (0.0 to +0.40)
    poi_mult = min(0.30, (poi_density / 100.0) * 0.25)
    comm_mult = min(0.20, (commercial_share / 0.3) * 0.20)

    # 3. Major Road Accessibility Multiplier (0.0 to +0.15)
    road_mult = 0.0
    if major_dist_m is not None and not math.isnan(major_dist_m):
        if major_dist_m <= 500:
            road_mult = 0.15
        elif major_dist_m <= 1000:
            road_mult = 0.08

    # 4. Greenery vs Industrial Adjustments
    green_mult = min(0.10, (green_share / 0.2) * 0.10)
    ind_penalty = min(0.35, (industrial_share / 0.25) * 0.35)

    # Total model premium over the district baseline.
    market_premium = 1.20 + transit_mult + poi_mult + comm_mult + road_mult + green_mult - ind_penalty
    market_premium = max(1.05, min(2.50, market_premium))

    assessed_price = round(base_assessed + (max_assessed - base_assessed) * min(1.0, (transit_mult + comm_mult + poi_mult) / 1.0), -2)
    market_price = round(assessed_price * market_premium, -2)

    # Heuristic fallback only: a wide band acknowledges that this model has
    # not been validated against parcel-level transactions.
    price_low = round(market_price * 0.65, -2)
    price_high = round(market_price * 1.35, -2)

    # Price Tier classification
    if market_price >= 600000:
        price_level = "Ultra-Luxury CBD"
    elif market_price >= 350000:
        price_level = "Prime Urban"
    elif market_price >= 180000:
        price_level = "Urban Mid-Tier"
    elif market_price >= 90000:
        price_level = "Suburban Growth"
    else:
        price_level = "Budget Accessible"

    # Affordability Index (100 = highly affordable, 0 = super luxury / high capital requirement)
    affordability = max(0.0, min(100.0, 100.0 * (1.0 - math.log10(max(1.0, market_price / 25000.0)) / math.log10(1000000.0 / 25000.0))))

    # The unvalidated fallback has no transaction evidence either. Retain its
    # unit-price screening estimate, but do not present a purchase verdict.
    valuation_thb = None
    budget_fit = None

    methodology = (
        "District model baseline benchmarked to the Treasury appraisal cycle 2566-2569 "
        "+ transparent hedonic multipliers (rail proximity, commercial share, road "
        "access, greenery, and industrial-use penalty)."
    )

    # True "ทำเลทอง" is the elite prime tier: >= 900k in CBD or >= 650k within 400m of BTS/MRT
    is_golden = (
        (market_price >= 900000 and "CBD" in info["zone_tier"])
        or (market_price >= 650000 and (station_dist_m is not None and station_dist_m <= 400))
    )

    return {
        "assessed_price_sqwah": assessed_price,
        "market_price_sqwah": market_price,
        "market_price_low": price_low,
        "market_price_high": price_high,
        "zone_tier": info["zone_tier"],
        "price_level": price_level,
        "is_golden_location": bool(is_golden),
        "affordability_index": round(affordability, 1),
        "valuation_thb": valuation_thb,
        "land_size_sqwah": land_size_sqwah,
        "budget_fit": budget_fit,
        "methodology": methodology,
        "assessed_price_type": "district_model_baseline",
        "market_price_type": "hedonic_estimate",
        "official_lookup_url": "https://assessprice.treasury.go.th/",
        "disclaimer": (
            "Screening estimate only. Verify the parcel-specific official appraisal "
            "with the Treasury Department and obtain independent transaction evidence."
        ),
    }
