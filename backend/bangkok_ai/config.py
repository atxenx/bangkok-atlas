"""Central configuration: study area, CRS, paths, quality weights, presets."""
from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------------------
# Study area: Greater Bangkok (WGS84)
# ---------------------------------------------------------------------------
MIN_LON, MIN_LAT, MAX_LON, MAX_LAT = 100.30, 13.55, 100.95, 14.00
BANGKOK_BBOX = (MIN_LON, MIN_LAT, MAX_LON, MAX_LAT)

CRS_WGS84 = "EPSG:4326"
CRS_UTM = "EPSG:32647"  # WGS 84 / UTM zone 47N (Bangkok)

# Default hex edge length in metres (neighbourhood unit). 300 m gives fine
# neighbourhood detail; the quality formulas are density-based (per km2) so
# they are invariant to the grid scale.
HEX_EDGE_M = 300

# ---------------------------------------------------------------------------
# Paths (backend/ lives at <root>/backend)
# ---------------------------------------------------------------------------
BACKEND_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_ROOT.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"

# ---------------------------------------------------------------------------
# Overpass
# ---------------------------------------------------------------------------
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
OVERPASS_UA = "BangkokAtlas/0.2 (university research prototype)"

# ---------------------------------------------------------------------------
# Neighborhood Quality Score: documented initial weights (sum = 1.0).
# ---------------------------------------------------------------------------
QUALITY_WEIGHTS = {
    "transit": 0.28,
    "amenities": 0.14,
    "walkability": 0.12,
    "greenery": 0.10,
    "road_environment": 0.09,
    "commercial": 0.10,
    "residential": 0.07,
    "quietness": 0.05,
    "environmental": 0.05,
}

QUALITY_DIMENSIONS = tuple(QUALITY_WEIGHTS.keys())

# Preset Personas with normalized 0-100 slider values
PRESETS: list[dict] = [
    {
        "id": "golden_location",
        "name_th": "ทำเลทอง",
        "name_en": "Golden Locations",
        "description_th": "สุดยอดทำเลศักยภาพสูง รถไฟฟ้าศูนย์กลางเมือง แหล่งช้อปปิ้ง และศูนย์กลางธุรกิจ",
        "description_en": "Ultimate prime Bangkok locations with supreme transit, commerce, and high growth.",
        "weights": {
            "transit": 100,
            "amenities": 95,
            "walkability": 90,
            "greenery": 50,
            "road_environment": 75,
            "commercial": 95,
            "residential": 45,
            "quietness": 30,
            "environmental": 45,
        },
    },
    {
        "id": "balanced",
        "name_th": "สมดุลทั่วไป",
        "name_en": "Balanced Lifestyle",
        "description_th": "เน้นความสะดวกในการเดินทาง ความอุดมสมบูรณ์ และสภาพแวดล้อมที่น่าอยู่",
        "description_en": "Balanced blend of transit accessibility, amenities, and environment.",
        "weights": {
            "transit": 70,
            "amenities": 60,
            "walkability": 55,
            "greenery": 50,
            "road_environment": 45,
            "commercial": 50,
            "residential": 50,
            "quietness": 40,
            "environmental": 40,
        },
    },
    {
        "id": "transit_commuter",
        "name_th": "เดินทางด้วยรถไฟฟ้า",
        "name_en": "Transit Commuter",
        "description_th": "เน้นใกล้สถานี BTS/MRT ทางเดินเท้าดี เดินทางสะดวก",
        "description_en": "Prioritizes immediate proximity to BTS/MRT stations and high walkability.",
        "weights": {
            "transit": 100,
            "amenities": 70,
            "walkability": 85,
            "greenery": 30,
            "road_environment": 50,
            "commercial": 60,
            "residential": 40,
            "quietness": 25,
            "environmental": 30,
        },
    },
    {
        "id": "green_family",
        "name_th": "ครอบครัว & ธรรมชาติ",
        "name_en": "Family & Green Living",
        "description_th": "เน้นพื้นที่สีเขียว ความเงียบสงบ เป็นย่านที่อยู่อาศัยที่ปลอดภัย",
        "description_en": "Prioritizes parks, green canopy, peace & quiet, and residential comfort.",
        "weights": {
            "transit": 40,
            "amenities": 50,
            "walkability": 60,
            "greenery": 95,
            "road_environment": 40,
            "commercial": 20,
            "residential": 85,
            "quietness": 90,
            "environmental": 85,
        },
    },
    {
        "id": "urban_lifestyle",
        "name_th": "ช้อปปิ้ง & ไลฟ์สไตล์",
        "name_en": "Urban Lifestyle & Dining",
        "description_th": "เน้นคาเฟ่ ร้านอาหาร แหล่งช้อปปิ้ง และกิจกรรมใจกลางเมือง",
        "description_en": "Focuses on high restaurant & retail density, vibrant commercial hubs.",
        "weights": {
            "transit": 80,
            "amenities": 100,
            "walkability": 75,
            "greenery": 30,
            "road_environment": 40,
            "commercial": 90,
            "residential": 30,
            "quietness": 15,
            "environmental": 25,
        },
    },
    {
        "id": "prime_cbd",
        "name_th": "ศูนย์กลางธุรกิจ CBD",
        "name_en": "Prime CBD Business Hub",
        "description_th": "ใจกลางย่านธุรกิจ สาทร สีลม อโศก พระราม 9 การเดินทางและธุรกิจครบครัน",
        "description_en": "Core business districts with supreme commercial density and connectivity.",
        "weights": {
            "transit": 95,
            "amenities": 85,
            "walkability": 70,
            "greenery": 35,
            "road_environment": 70,
            "commercial": 95,
            "residential": 35,
            "quietness": 20,
            "environmental": 30,
        },
    },
    {
        "id": "budget_growth",
        "name_th": "ทำเลคุ้มค่า & เติบโต",
        "name_en": "Budget & High Growth",
        "description_th": "ราคาที่ดินเข้าถึงได้ มีรถไฟฟ้าเชื่อมต่อ เหมาะแก่การอยู่อาศัยระยะยาว",
        "description_en": "Affordable land prices with emerging transit lines and community growth.",
        "weights": {
            "transit": 75,
            "amenities": 55,
            "walkability": 60,
            "greenery": 60,
            "road_environment": 50,
            "commercial": 40,
            "residential": 75,
            "quietness": 65,
            "environmental": 60,
        },
    },
]

# Cells with less OSM evidence than this are flagged low_data instead of
# receiving a pretend score (never impute silently, see docs/DATA.md).
# Thresholds are tuned for the 300 m grid.
LOW_DATA_MIN_POIS_TRANSIT = 2
LOW_DATA_MIN_ROAD_M = 400.0

# ---------------------------------------------------------------------------
# Data status (honest availability reporting)
# ---------------------------------------------------------------------------
DATA_STATUS = {
    "osm": {
        "status": "available",
        "description": (
            "Bundled OpenStreetMap snapshot for Bangkok transit, POIs, land use, "
            "greenery, water, roads, and explicit-height 3D buildings."
        ),
        "source": "OpenStreetMap via Overpass API",
        "license": "ODbL",
    },
    "land_price": {
        "status": "official_area_reference",
        "description": (
            "Median and 10th-90th percentiles of actual Treasury Department "
            "appraisal records in the selected 500 m map sheet, or a 2 km sheet "
            "or district where sample size is insufficient. Selected 500 m sheets "
            "are refreshed from the public API when available. Not the official "
            "value of the clicked parcel or a verified sale price."
        ),
        "as_of": "Bangkok public CSV last modified 2026-05-08; appraisal cycle 2566-2569",
        "official_lookup": "https://assessprice.treasury.go.th/",
    },
    "satellite": {
        "status": "visualization_only",
        "description": "Esri World Imagery basemap tiles for visual context; not used as an analytical feature.",
    },
    "street_imagery": {
        "status": "links_and_proxies",
        "description": "Coordinate links to Street View/Mapillary plus OSM-derived proxy indices; imagery is not ingested.",
    },
    "admin_boundaries": {
        "status": "available",
        "description": "Bundled Bangkok 50-district boundaries with a curated neighborhood and landmark catalog.",
    },
}
