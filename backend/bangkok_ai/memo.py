"""AI Investment Memo Generator — Bilingual (EN/TH) Local Narrative Engine.

Generates a structured, analyst-style investment memo from existing structured
data (quality dimensions, price valuation, geo context, transit access).
English is the default primary language, with full Thai support.
No external LLM API calls — fully local and offline.
"""
from __future__ import annotations

from typing import Any


def _quality_tier(score: float) -> tuple[str, str, str]:
    """Return (tier_key, tier_en_label, tier_th_label)."""
    if score >= 80:
        return "prime", "Prime Tier (Top Quality)", "ทำเลคุณภาพระดับพรีเมียม (Prime Tier)"
    if score >= 68:
        return "high", "High Quality Neighborhood", "ทำเลคุณภาพสูง (High Quality)"
    if score >= 55:
        return "stable", "Good Standard Area", "ทำเลคุณภาพปานกลาง-ดี (Good Standard)"
    if score >= 40:
        return "cautious", "Developing / Emerging Area", "ทำเลกำลังพัฒนา (Developing)"
    return "limited", "Peripheral / Limited Data", "ทำเลรอบนอก / ข้อมูลจำกัด (Peripheral)"


_YIELD_BY_ZONE: dict[str, tuple[str, str]] = {
    "CBD Core": ("3.8–4.8%", "Premium"),
    "CBD Edge": ("4.2–5.2%", "Premium"),
    "Urban Established": ("4.8–5.8%", "Mid-Market"),
    "Urban Fringe": ("5.5–6.5%", "Mid-Market"),
    "Suburban": ("6.0–7.5%", "Value Play"),
    "Outer Suburban": ("6.5–8.0%", "Value Play"),
}


def _yield_estimate(zone_tier: str | None) -> tuple[str, str]:
    for key, val in _YIELD_BY_ZONE.items():
        if zone_tier and key.lower() in zone_tier.lower():
            return val
    return ("5.5–6.5%", "Mid-Market")


def _transit_sentence(geo_context: dict, dims: dict, lang: str = "en") -> str:
    tw = (geo_context or {}).get("transit_walk") or {}
    station = tw.get("station_name", "")
    dist = tw.get("distance_m")
    walk = tw.get("walk_time_min")
    transit_score = dims.get("transit", 0)

    if lang == "th":
        if dist is not None and dist <= 300:
            return (
                f"ตั้งอยู่ติดสถานี {station} ระยะเดิน {int(dist)} เมตร"
                + (f" (~{int(walk)} นาที)" if walk else "")
                + " — เข้าถึงระบบรถไฟฟ้าได้ทันที"
            )
        if dist is not None and dist <= 600:
            return (
                f"อยู่ใกล้สถานี {station} ระยะ {int(dist)} เมตร"
                + (f" (เดิน ~{int(walk)} นาที)" if walk else "")
                + " — ระยะเดินเท้าที่สะดวก"
            )
        if dist is not None and dist <= 1200:
            return (
                f"ห่างจากสถานี {station} ประมาณ {int(dist)} เมตร"
                + (f" (เดิน ~{int(walk)} นาที)" if walk else "")
            )
        if transit_score >= 50:
            return f"ระบบขนส่งสาธารณะในย่านนี้อยู่ในระดับดี (คะแนน {int(transit_score)}/100)"
        return "ทำเลนี้ยังห่างจากสถานีรถไฟฟ้า — ควรพิจารณาการเดินทางด้วยรถยนต์ส่วนตัว"

    # English default
    if dist is not None and dist <= 300:
        return (
            f"Directly adjacent to {station} ({int(dist)}m walk"
            + (f", ~{int(walk)} mins" if walk else "")
            + ") — immediate rapid transit accessibility."
        )
    if dist is not None and dist <= 600:
        return (
            f"Within walking distance of {station} ({int(dist)}m"
            + (f", ~{int(walk)} mins walk" if walk else "")
            + ") — strong TOD connectivity."
        )
    if dist is not None and dist <= 1200:
        return (
            f"Located ~{int(dist)}m from {station}"
            + (f" (~{int(walk)} mins walk)" if walk else "")
            + "."
        )
    if transit_score >= 50:
        return f"Public transit accessibility is solid ({int(transit_score)}/100 score)."
    return "Further from mass transit lines — private vehicle mobility recommended."


def _price_sentence(price_val: dict, lang: str = "en") -> str:
    if not price_val:
        return ""
    tier = price_val.get("zone_tier", "")
    market = price_val.get("market_price_sqwah")
    if not market:
        return ""
    market_m = round(market / 10000) * 10000

    if price_val.get("market_price_type") == "treasury_area_reference":
        resolution = price_val.get("reference_resolution_m")
        low = price_val.get("market_price_low")
        high = price_val.get("market_price_high")
        road = price_val.get("road_benchmark")
        if lang == "th":
            area = f"ระวางราว {resolution:,} เมตร" if resolution else "เขตนี้"
            sentence = (f"ราคาประเมินกรมธนารักษ์ของระเบียนใน{area} ช่วงร้อยละ 10–90 อยู่ที่ ฿{low:,.0f}–฿{high:,.0f} ต่อ ตร.ว. "
                        f"(ค่ากลาง ฿{market:,.0f})" if low is not None and high is not None
                        else f"ค่ากลางราคาประเมินกรมธนารักษ์ของ{area}คือ ฿{market:,.0f} ต่อ ตร.ว.")
            if road:
                sentence += f" ข้อมูลหน่วยที่ดินบน{road['road_name_th']} ระบุ ฿{road['low']:,.0f}–฿{road['high']:,.0f} ต่อ ตร.ว. เฉพาะบริบทแนวถนน ไม่ใช่ราคาแปลงนี้"
            return sentence + " ช่วงนี้เป็นการกระจายของแปลงอื่น ไม่ใช่ช่วงราคาของแปลงที่เลือกหรือราคาซื้อขาย จึงไม่ใช้ตัดสินงบซื้อ"
        area = f"nearby {resolution:,} m map sheet" if resolution else "district"
        sentence = (f"Treasury appraisal records in the {area} span ฿{low:,.0f}–฿{high:,.0f}/sq.wah at the 10th–90th percentiles "
                    f"(median ฿{market:,.0f})." if low is not None and high is not None
                    else f"Median Treasury appraisal in the {area} is ฿{market:,.0f}/sq.wah.")
        if road:
            sentence += f" The published {road['road_name_en']} road-unit range is ฿{road['low']:,.0f}–฿{road['high']:,.0f}/sq.wah; that road comparator does not identify this parcel."
        return sentence + " The spread describes other parcels, not the selected parcel's price or a sale price; it is not used for purchase-budget screening."

    if lang == "th":
        if "CBD" in tier:
            return f"แบบจำลองระดับย่านให้ค่ากลางราว ฿{market_m:,.0f} ต่อ ตร.ว. แต่ยังไม่ยืนยันกับธุรกรรมหรือแปลงจริง จึงไม่ใช้ตัดสินงบซื้อ"
        if "Urban" in tier:
            return f"แบบจำลองระดับย่านให้ค่ากลางราว ฿{market_m:,.0f} ต่อ ตร.ว. แต่ยังไม่ยืนยันกับธุรกรรมหรือแปลงจริง จึงไม่ใช้ตัดสินงบซื้อ"
        return f"แบบจำลองระดับย่านให้ค่ากลางราว ฿{market_m:,.0f} ต่อ ตร.ว. แต่ยังไม่ยืนยันกับธุรกรรมหรือแปลงจริง จึงไม่ใช้ตัดสินงบซื้อ"

    # English default
    if "CBD" in tier:
        return f"Unvalidated area model: ~฿{market_m:,.0f}/sq.wah. Not a parcel or sale price; not used for budget screening."
    if "Urban" in tier:
        return f"Unvalidated area model: ~฿{market_m:,.0f}/sq.wah. Not a parcel or sale price; not used for budget screening."
    return f"Unvalidated area model: ~฿{market_m:,.0f}/sq.wah. Not a parcel or sale price; not used for budget screening."


def _build_strengths(dims: dict, geo_context: dict, price_val: dict, lang: str = "en") -> list[str]:
    strengths: list[str] = []
    tw = (geo_context or {}).get("transit_walk") or {}
    station = tw.get("station_name", "")
    dist = tw.get("distance_m")
    landmark = (geo_context or {}).get("nearest_landmark") or {}
    lm_name = landmark.get("name_en", "") if lang == "en" else landmark.get("name_th", "")
    if not lm_name and lang == "en":
        lm_name = landmark.get("name_th", "")
    lm_dist = landmark.get("distance_m")

    transit = dims.get("transit", 0)
    amenities = dims.get("amenities", 0)
    commercial = dims.get("commercial", 0)
    walkability = dims.get("walkability", 0)
    greenery = dims.get("greenery", 0)
    quietness = dims.get("quietness", 0)
    road = dims.get("road_environment", 0)
    residential = dims.get("residential", 0)
    is_golden = (price_val or {}).get("is_golden_location", False)

    if lang == "th":
        if is_golden:
            strengths.append("🥇 ทำเลทอง — ผลลัพธ์ตัดสินจากทำเลพรีเมียมระดับกรุงเทพ")
        if transit >= 85 and dist is not None and dist <= 600:
            strengths.append(f"🚆 ติดสถานี {station} ระยะเดิน {int(dist)} เมตร — เข้าถึงรถไฟฟ้าสะดวกสูงสุด เพิ่ม Rental Premium ได้ทันที")
        elif transit >= 70:
            strengths.append(f"🚆 ระบบขนส่งสาธารณะดี (คะแนน {int(transit)}/100){' — ' + station if station else ''}")
        if amenities >= 75:
            strengths.append("🛒 สิ่งอำนวยความสะดวกรอบด้านครบถ้วน — ร้านค้า ซูเปอร์มาร์เก็ต คลินิก และบริการต่างๆ ใน 5–10 นาทีเดิน")
        elif amenities >= 55:
            strengths.append(f"🛒 สิ่งอำนวยความสะดวกระดับดี (คะแนน {int(amenities)}/100)")
        if commercial >= 75:
            strengths.append("🏢 ย่านธุรกิจและพาณิชยกรรมคึกคัก — ศักยภาพรายได้ค่าเช่าและการเติบโตทางธุรกิจสูง")
        elif commercial >= 58:
            strengths.append(f"🏢 กิจกรรมพาณิชยกรรมดี (คะแนน {int(commercial)}/100)")
        if walkability >= 70:
            strengths.append("🚶 โครงสร้างพื้นฐานทางเท้าดีเยี่ยม — เป็น Pedestrian-Friendly Zone เหมาะสำหรับ Live-Work-Play")
        if greenery >= 60:
            strengths.append("🌳 มีพื้นที่สีเขียวใกล้เคียง — เหมาะสำหรับครอบครัว และยกระดับคุณภาพชีวิตในระยะยาว")
        if quietness >= 65:
            strengths.append("😌 บรรยากาศเงียบสงบ — เหมาะสำหรับที่พักอาศัยและที่ทำงาน")
        if road >= 70:
            strengths.append(f"🛣️ เชื่อมต่อถนนสายหลักดี (คะแนน {int(road)}/100) — เดินทางด้วยรถยนต์สะดวก")
        if lm_name and lm_dist and lm_dist <= 800:
            strengths.append(f"📍 ใกล้ {lm_name} (ห่าง {int(lm_dist)} เมตร) — จุด Anchor สำคัญที่เพิ่มมูลค่าทำเล")
        if residential >= 70:
            strengths.append(f"🏡 ย่านที่อยู่อาศัยคุณภาพ (คะแนน {int(residential)}/100) — ชุมชนมีความสมดุลและน่าอยู่")
        return strengths[:5]

    # English default
    if is_golden:
        strengths.append("🥇 Bangkok Prime Golden Location — top-tier real estate corridor.")
    if transit >= 85 and dist is not None and dist <= 600:
        strengths.append(f"🚆 Adjacent to {station} ({int(dist)}m walk) — prime TOD accessibility supporting rental premium.")
    elif transit >= 70:
        strengths.append(f"🚆 High transit accessibility score ({int(transit)}/100){' near ' + station if station else ''}.")
    if amenities >= 75:
        strengths.append("🛒 Exceptional amenity density — supermarkets, cafes, and daily services within 5–10 mins walk.")
    elif amenities >= 55:
        strengths.append(f"🛒 Good amenity & retail diversity ({int(amenities)}/100 score).")
    if commercial >= 75:
        strengths.append("🏢 Vibrant commercial hub — strong business activities and high office/retail footfall.")
    elif commercial >= 58:
        strengths.append(f"🏢 Active commercial & retail presence ({int(commercial)}/100 score).")
    if walkability >= 70:
        strengths.append("🚶 High pedestrian walkability — excellent footpath connectivity for Live-Work-Play lifestyle.")
    if greenery >= 60:
        strengths.append("🌳 Ample nearby parks & green canopy — elevated living quality and family appeal.")
    if quietness >= 65:
        strengths.append("😌 Peaceful residential atmosphere with low urban noise levels.")
    if road >= 70:
        strengths.append(f"🛣️ Excellent major road connectivity ({int(road)}/100 score) — easy expressway/arterial access.")
    if lm_name and lm_dist and lm_dist <= 800:
        strengths.append(f"📍 Close to {lm_name} ({int(lm_dist)}m) — major anchor landmark driving neighborhood value.")
    if residential >= 70:
        strengths.append(f"🏡 Established residential fabric ({int(residential)}/100 score) — balanced community environment.")
    return strengths[:5]


def _build_considerations(dims: dict, feat_summary: dict, lang: str = "en") -> list[str]:
    considerations: list[str] = []
    transit = dims.get("transit", 0)
    amenities = dims.get("amenities", 0)
    greenery = dims.get("greenery", 0)
    quietness = dims.get("quietness", 0)
    walkability = dims.get("walkability", 0)
    commercial = dims.get("commercial", 0)
    industrial_share = (feat_summary or {}).get("industrial_share", 0) or 0

    if lang == "th":
        if transit < 35:
            considerations.append("🚌 ระยะห่างจากสถานีรถไฟฟ้ามาก — ผู้เช่า/ผู้ซื้อส่วนใหญ่ต้องพึ่งรถยนต์ส่วนตัว อาจส่งผลต่อ Rental Yield")
        elif transit < 55:
            considerations.append(f"🚌 การเดินทางด้วยระบบรางอยู่ในระดับปานกลาง (คะแนน {int(transit)}/100)")
        if amenities < 30:
            considerations.append("🛒 สิ่งอำนวยความสะดวกในย่านยังจำกัด — ผู้อยู่อาศัยอาจต้องเดินทางออกนอกพื้นที่เพื่อชอปปิ้งหรือทำธุระ")
        if walkability < 30:
            considerations.append("🚶 ทางเท้าและโครงสร้างพื้นฐานสำหรับคนเดินยังน้อย — ลดความน่าดึงดูดสำหรับกลุ่ม Young Professional")
        if greenery < 25:
            considerations.append("🌳 พื้นที่สีเขียวและสวนสาธารณะในย่านน้อย — ควรพิจารณาสำหรับโครงการที่เน้นคุณภาพชีวิตและครอบครัว")
        if quietness < 30:
            considerations.append("🔊 ย่านนี้มีระดับกิจกรรมและความคึกคักสูง — เสียงและการจราจรอาจส่งผลกับโครงการที่พักอาศัยระดับบน")
        if industrial_share > 0.15:
            considerations.append(f"🏭 มีพื้นที่อุตสาหกรรมในบริเวณใกล้เคียง ({int(industrial_share*100)}%) — ควรตรวจสอบผังเมืองและระเบียบข้อบังคับในพื้นที่")
        if commercial < 25:
            considerations.append("🏢 กิจกรรมพาณิชยกรรมในย่านยังน้อย — อาจจำกัดศักยภาพค่าเช่าสำหรับพื้นที่ค้าปลีก")
        return considerations[:4]

    # English default
    if transit < 35:
        considerations.append("🚌 Distance to rapid transit station is high — tenants will rely on private vehicles or feeders.")
    elif transit < 55:
        considerations.append(f"🚌 Mass transit access is moderate ({int(transit)}/100 score).")
    if amenities < 30:
        considerations.append("🛒 Daily retail and services in immediate walking radius are limited.")
    if walkability < 30:
        considerations.append("🚶 Footpath and pedestrian infrastructure is scarce — car-dependent area.")
    if greenery < 25:
        considerations.append("🌳 Limited green canopy or public park spaces nearby.")
    if quietness < 30:
        considerations.append("🔊 High ambient noise and urban traffic density — consider acoustic insulation.")
    if industrial_share > 0.15:
        considerations.append(f"🏭 Noticeable industrial share ({int(industrial_share*100)}%) in neighborhood — review zoning.")
    if commercial < 25:
        considerations.append("🏢 Low commercial concentration — limited ground-floor retail rental yields.")
    return considerations[:4]


def _build_use_cases(dims: dict, price_val: dict, lang: str = "en") -> list[str]:
    use_cases: list[str] = []
    quality = dims.get("quality", 0)
    transit = dims.get("transit", 0)
    commercial = dims.get("commercial", 0)
    amenities = dims.get("amenities", 0)
    greenery = dims.get("greenery", 0)
    quietness = dims.get("quietness", 0)
    residential = dims.get("residential", 0)
    walkability = dims.get("walkability", 0)
    is_golden = (price_val or {}).get("is_golden_location", False)
    zone_tier = (price_val or {}).get("zone_tier", "")

    if lang == "th":
        if is_golden or ("CBD" in zone_tier and quality >= 70):
            use_cases.append("🏙️ คอนโดมิเนียม Luxury / High-Rise")
            use_cases.append("🏢 สำนักงาน Grade-A / Mixed-Use Tower")
        if transit >= 75 and (commercial >= 60 or amenities >= 60):
            if "Luxury" not in " ".join(use_cases):
                use_cases.append("🏙️ คอนโดมิเนียม High-Rise / TOD Development")
        if commercial >= 70 and amenities >= 65:
            use_cases.append("🛍️ Retail Mixed-Use / ศูนย์การค้า Neighborhood")
        if transit >= 65 and amenities >= 55:
            use_cases.append("🏨 Service Apartment / Boutique Hotel")
        if greenery >= 60 and quietness >= 55 and residential >= 60:
            use_cases.append("🏡 บ้านเดี่ยว / Low-Rise Residence")
            use_cases.append("🏘️ ทาวน์เฮ้าส์ / Home Office")
        if walkability >= 65 and commercial >= 55:
            use_cases.append("☕ Co-Working Space / ร้านอาหาร Street-Level")
        if not use_cases:
            if transit >= 50:
                use_cases.append("🏙️ โครงการที่อยู่อาศัยระดับกลาง")
            use_cases.append("🏘️ ที่อยู่อาศัยชุมชน / ทาวน์เฮ้าส์")
        return use_cases[:4]

    # English default
    if is_golden or ("CBD" in zone_tier and quality >= 70):
        use_cases.append("🏙️ Luxury High-Rise Condominium")
        use_cases.append("🏢 Grade-A Office / Mixed-Use Tower")
    if transit >= 75 and (commercial >= 60 or amenities >= 60):
        if "Luxury" not in " ".join(use_cases):
            use_cases.append("🏙️ High-Rise Condominium / TOD Project")
    if commercial >= 70 and amenities >= 65:
        use_cases.append("🛍️ Retail Mixed-Use / Lifestyle Mall")
    if transit >= 65 and amenities >= 55:
        use_cases.append("🏨 Serviced Apartment / Boutique Hotel")
    if greenery >= 60 and quietness >= 55 and residential >= 60:
        use_cases.append("🏡 Low-Rise Housing / Single-Detached Home")
        use_cases.append("🏘️ Modern Townhome / Home Office")
    if walkability >= 65 and commercial >= 55:
        use_cases.append("☕ Co-Working Cafe / Street-Level Retail")
    if not use_cases:
        if transit >= 50:
            use_cases.append("🏙️ Mid-Market Residential Development")
        use_cases.append("🏘️ Townhome / Community Residential")
    return use_cases[:4]


def _investment_outlook(quality: float) -> tuple[str, str, str, str]:
    """Return (outlook_key, label_en, label_th, color_class)."""
    if quality >= 78:
        return "prime", "🌟 Prime Investment", "🌟 ทำเลระดับพรีเมียม (Prime)", "emerald"
    if quality >= 65:
        return "high", "📈 Strong Screening Profile", "📈 โปรไฟล์คัดกรองโดดเด่น", "teal"
    if quality >= 52:
        return "stable", "📊 Stable Income", "📊 รายได้ค่าเช่าสม่ำเสมอ (Stable)", "sky"
    if quality >= 38:
        return "cautious", "⚠️ Cautious / Value Play", "⚠️ เน้นความคุ้มค่า / เติบโตระยะยาว", "amber"
    return "limited", "📉 Limited / Long-term Hold", "📉 ถือครองระยะยาว / พื้นที่รอบนอก", "zinc"


def generate_investment_memo(
    dims: dict[str, float],
    geo_context: dict[str, Any],
    price_val: dict[str, Any],
    feat_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generate a structured AI Investment Memo with bilingual (EN/TH) narratives."""
    quality = dims.get("quality", 0)
    tier_key, tier_label_en, tier_label_th = _quality_tier(quality)
    outlook_key, outlook_label_en, outlook_label_th, outlook_color = _investment_outlook(quality)

    zone_tier = (price_val or {}).get("zone_tier")
    yield_est, cap_tier = _yield_estimate(zone_tier)

    district_th = (geo_context or {}).get("district_th", "")
    district_en = (geo_context or {}).get("district_en", "")

    # Build English narrative
    area_en = f"{district_en} District" if district_en else "This location"
    transit_sent_en = _transit_sentence(geo_context, dims, lang="en")
    price_sent_en = _price_sentence(price_val, lang="en")
    summary_en = (
        f"{area_en} achieves a quality score of {quality:.0f}/100, positioned in {tier_label_en}. "
        f"{transit_sent_en} {price_sent_en}"
    ).strip()

    # Build Thai narrative
    area_th = f"เขต{district_th}" if district_th else (district_en or "ย่านนี้")
    transit_sent_th = _transit_sentence(geo_context, dims, lang="th")
    price_sent_th = _price_sentence(price_val, lang="th")
    summary_th = (
        f"{area_th}ได้คะแนนคุณภาพย่าน {quality:.0f}/100 อยู่ใน{tier_label_th} "
        f"{transit_sent_th} {price_sent_th}"
    ).strip()

    strengths_en = _build_strengths(dims, geo_context, price_val, lang="en")
    strengths_th = _build_strengths(dims, geo_context, price_val, lang="th")
    considerations_en = _build_considerations(dims, feat_summary or {}, lang="en")
    considerations_th = _build_considerations(dims, feat_summary or {}, lang="th")
    use_cases_en = _build_use_cases(dims, price_val, lang="en")
    use_cases_th = _build_use_cases(dims, price_val, lang="th")

    return {
        # Default English fields
        "executive_summary": summary_en,
        "strengths": strengths_en,
        "considerations": considerations_en,
        "use_cases": use_cases_en,
        "outlook_label": outlook_label_en,
        "quality_tier_label": tier_label_en,
        # Explicit Bilingual fields
        "executive_summary_en": summary_en,
        "executive_summary_th": summary_th,
        "strengths_en": strengths_en,
        "strengths_th": strengths_th,
        "considerations_en": considerations_en,
        "considerations_th": considerations_th,
        "use_cases_en": use_cases_en,
        "use_cases_th": use_cases_th,
        "outlook_label_en": outlook_label_en,
        "outlook_label_th": outlook_label_th,
        "quality_tier_label_en": tier_label_en,
        "quality_tier_label_th": tier_label_th,
        # Common attributes
        "investment_outlook": outlook_key,
        "outlook_color": outlook_color,
        "yield_estimate": yield_est,
        "cap_rate_tier": cap_tier,
        "quality_tier": tier_key,
    }
