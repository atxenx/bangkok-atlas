"""Unit tests for the AI Investment Memo generator."""
import pytest
from bangkok_ai.memo import generate_investment_memo

VALID_OUTLOOK_KEYS = {"prime", "high", "stable", "cautious", "limited"}

def _dims(quality: float, **overrides) -> dict:
    base = {
        "quality": quality,
        "transit": quality,
        "amenities": quality * 0.8,
        "walkability": quality * 0.9,
        "greenery": quality * 0.6,
        "road_environment": quality * 0.7,
        "commercial": quality * 0.75,
        "residential": quality * 0.85,
        "quietness": quality * 0.5,
        "environmental": quality * 0.65,
    }
    base.update(overrides)
    return base


def _ctx(station="BTS อ่อนนุช", dist_m=280, walk=4, district="Phra Khanong"):
    return {
        "district_th": "พระโขนง",
        "district_en": district,
        "transit_walk": {
            "station_name": station,
            "distance_m": dist_m,
            "walk_time_min": walk,
        },
        "nearest_landmark": {
            "name_th": "ทรู ดิจิทัล พาร์ค",
            "name_en": "True Digital Park",
            "distance_m": 450,
        },
    }


def _price(zone="Urban Established", market=120000, is_golden=False):
    return {
        "zone_tier": zone,
        "market_price_sqwah": market,
        "assessed_price_sqwah": market * 0.7,
        "is_golden_location": is_golden,
    }


class TestMemoGeneration:
    def test_returns_required_keys(self):
        memo = generate_investment_memo(_dims(70), _ctx(), _price())
        required = {
            "executive_summary", "strengths", "considerations",
            "use_cases", "investment_outlook", "outlook_label",
            "outlook_color", "yield_estimate", "cap_rate_tier",
            "quality_tier", "quality_tier_label",
        }
        assert required.issubset(memo.keys())

    def test_executive_summary_nonempty(self):
        memo = generate_investment_memo(_dims(65), _ctx(), _price())
        assert isinstance(memo["executive_summary"], str)
        assert len(memo["executive_summary"]) > 20

    def test_use_cases_at_least_one(self):
        for quality in [20, 45, 65, 85]:
            memo = generate_investment_memo(_dims(quality), _ctx(), _price())
            assert len(memo["use_cases"]) >= 1, f"No use cases for quality={quality}"

    def test_investment_outlook_valid_enum(self):
        for quality in [10, 38, 52, 65, 80]:
            memo = generate_investment_memo(_dims(quality), _ctx(), _price())
            assert memo["investment_outlook"] in VALID_OUTLOOK_KEYS

    def test_prime_tier_for_high_quality(self):
        memo = generate_investment_memo(_dims(85), _ctx(), _price("CBD Core", 500000, True))
        assert memo["investment_outlook"] == "prime"
        assert "🥇" in " ".join(memo["strengths"])

    def test_cautious_tier_for_low_quality(self):
        memo = generate_investment_memo(_dims(35), _ctx("BTS คูคต", 3000, 40), _price("Outer Suburban", 30000))
        assert memo["investment_outlook"] in {"cautious", "limited"}

    def test_strengths_list_bounded(self):
        memo = generate_investment_memo(_dims(90), _ctx(), _price("CBD Core", 600000, True))
        assert len(memo["strengths"]) <= 5

    def test_considerations_list_bounded(self):
        memo = generate_investment_memo(_dims(20, transit=5, amenities=5, walkability=5), _ctx("", 9000, None), _price())
        assert len(memo["considerations"]) <= 4

    def test_yield_estimate_format(self):
        memo = generate_investment_memo(_dims(70), _ctx(), _price("CBD Core"))
        assert "%" in memo["yield_estimate"]
        assert "–" in memo["yield_estimate"] or "-" in memo["yield_estimate"]

    def test_no_station_nearby(self):
        """Cells far from transit still get a valid memo."""
        memo = generate_investment_memo(
            _dims(40, transit=15),
            {"district_th": "ลาดกระบัง", "district_en": "Lat Krabang",
             "transit_walk": {"station_name": "", "distance_m": 8000, "walk_time_min": None},
             "nearest_landmark": None},
            _price("Suburban", 40000),
        )
        assert memo["investment_outlook"] in VALID_OUTLOOK_KEYS
        assert len(memo["use_cases"]) >= 1
