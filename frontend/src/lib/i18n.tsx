"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Dimension } from "./api";

export type Language = "en" | "th";

interface I18nContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string, fallback?: string) => string;
  isEn: boolean;
  isTh: boolean;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Top Bar
    "app.title": "Bangkok Atlas",
    "app.subtitle": "Street-Level Neighborhood Quality & Real-Estate Context Intelligence",
    "btn.golden_location": "Golden Locations",
    "btn.golden_on": "(Active)",
    "btn.golden_tooltip_on": "Disable Golden Locations mode to show all neighborhoods",
    "btn.golden_tooltip_off": "Show top Bangkok Golden Locations on map",
    "status.live": "OSM snapshot & 3D: Ready",
    "status.appraisal": "Prices: Treasury area data",

    // Search
    "search.placeholder": "Search BTS/MRT station, district, landmark...",
    "search.empty": "No matching locations found",
    "search.recent": "Quick Search",
    "search.stations": "Rail Stations",
    "search.districts": "Districts",
    "search.landmarks": "Landmarks",
    "search.neighborhoods": "Neighborhoods",

    // Tabs
    "tab.preferences": "Preferences",
    "tab.results": "Top Locations",
    "tab.detail": "Deep Analysis",

    // Preferences Panel
    "pref.title": "Search Criteria & Weights",
    "pref.badge": "Explainable AI",
    "pref.desc": "Choose a persona preset or customize the 9-dimension weights to find your ideal Bangkok location.",
    "pref.presets": "Quick Persona Presets",
    "pref.district_filter": "Filter by District (50 Districts)",
    "pref.all_districts": "All 50 Bangkok Districts",
    "pref.budget": "Total Budget (THB)",
    "pref.budget_placeholder": "e.g. 15,000,000",
    "pref.land_size": "Land Size (Sq. Wah)",
    "pref.land_size_placeholder": "e.g. 50 (1 sq.wah = 4 sq.m)",
    "pref.land_use": "Intended Land Use",
    "pref.land_use_all": "All Land Use Types",
    "pref.land_use_res": "Residential (Condo / Housing)",
    "pref.land_use_comm": "Commercial & Retail",
    "pref.land_use_office": "Office & Mixed-Use",
    "pref.sliders_toggle_show": "Show 9 Dimension Sliders",
    "pref.sliders_toggle_hide": "Hide 9 Dimension Sliders",
    "pref.sliders_title": "9 Quality Dimension Weights",
    "pref.btn_recommend": "Find Matching Locations",
    "pref.btn_recommending": "Computing Multimodal Ranks...",

    // Presets
    "preset.balanced.name": "Balanced Livability",
    "preset.balanced.desc": "Even balance across transit, daily amenities, and environment.",
    "preset.transit_first.name": "Transit-First (TOD)",
    "preset.transit_first.desc": "Maximizes direct BTS/MRT accessibility and walkability.",
    "preset.green_haven.name": "Green & Quiet Haven",
    "preset.green_haven.desc": "Focuses on parks, low noise, and family-friendly living.",
    "preset.commercial_hub.name": "Commercial & Retail Hub",
    "preset.commercial_hub.desc": "Prime office corridors, active retail, and high foot traffic.",
    "preset.walkable_urban.name": "Walkable City",
    "preset.walkable_urban.desc": "High pedestrian road density and diverse daily services.",
    "preset.golden_location.name": "Golden Locations",
    "preset.golden_location.desc": "Top-tier Bangkok prime real estate zones and CBD hubs.",

    // Results List
    "results.title": "Top Recommended Locations",
    "results.count": "locations match your criteria",
    "results.empty": "No recommendations found. Try adjusting your budget or weights.",
    "results.match_score": "Match Score",
    "results.quality": "Quality",
    "results.est_market_price": "Hedonic Estimate",

    // Location Detail
    "detail.quality_title": "Neighborhood Quality Score",
    "detail.quality_desc": "Computed from 9-dimension explainable spatial AI model referencing real OpenStreetMap & transit infrastructure.",
    "detail.valuation_title": "Land Value Screening Estimate",
    "detail.market_price": "Hedonic Estimate",
    "detail.treasury_price": "District Model Baseline",
    "detail.treasury_cycle": "Treasury Appraisal 2023-2026",
    "detail.total_valuation": "Estimated Plot Valuation",
    "detail.budget_within": "Within Budget",
    "detail.budget_exceeded": "Over Budget",
    "detail.nearest_transit": "Nearest Rapid Transit",
    "detail.nearest_landmark": "Primary Neighborhood Hub",
    "detail.other_landmarks": "Notable Nearby Landmarks:",
    "detail.walk_approx": "walk ~",
    "detail.mins": "mins",
    "detail.no_station_near": "No rail station in immediate walk range",
    "detail.dimensions_title": "9 Quality Dimensions Breakdown",
    "detail.strengths_title": "Key Advantages (Positive Factors)",
    "detail.cautions_title": "Risk Considerations (Areas for Caution)",
    "detail.no_strengths": "No dimension scored above 50 points",
    "detail.no_cautions": "No significant drawbacks detected",
    "detail.adds_score": "contributes",
    "detail.points": "pts",
    "detail.below_par": "Below average baseline",
    "detail.comparables_title": "Similar Comparable Neighborhoods",
    "detail.similarity": "Similarity",

    // AI Investment Memo
    "memo.title": "AI Investment Memo",
    "memo.local_tag": "Local AI · Offline · Zero Data Leaks",
    "memo.strengths_title": "Key Investment Strengths",
    "memo.cautions_title": "Risk Considerations",
    "memo.use_cases_title": "Recommended Development & Use Cases",
    "memo.gross_yield": "Illustrative Gross-Yield Scenario",
    "memo.cap_rate": "Scenario Tier",

    // Street Level Visual Card
    "street.title": "Street-Form Proxy Indices",
    "street.osm_tag": "OSM proxies",
    "street.canopy_label": "Mapped Green-Space Proxy",
    "street.canopy_sub": "Mapped green/water share and park proximity",
    "street.canopy_low": "Dense Urban / No Greenery",
    "street.canopy_high": "Parks / Lush Forest",
    "street.sidewalk_label": "Walkability-Network Proxy",
    "street.sidewalk_sub": "Minor-road density, network density, and rail access",
    "street.sidewalk_low": "Car-Dependent / Narrow",
    "street.sidewalk_high": "Walkable CBD / Skywalk",
    "street.sky_label": "Sky-Openness Proxy",
    "street.sky_sub": "Inverse mapped urban-form density; not image-derived",
    "street.sky_low": "Urban Canyon / High-Rise",
    "street.sky_high": "Open Sky / Low-Rise",
    "street.btn_streetview": "Verify with Google Street View ↗",
    "street.btn_mapillary": "Mapillary Visual ↗",
    "street.methodology": "OSM-derived proxies only; no street imagery or physical sidewalk-condition survey is used.",

    // Map Controls
    "map.districts_toggle": "Show/Hide 50 Districts",
    "map.stations_toggle": "Rail Stations",
    "map.lines_toggle": "Rail Network",
    "map.buildings_toggle": "3D Buildings",
    "map.legend_high": "High Quality (75-100)",
    "map.legend_med": "Medium (50-74)",
    "map.legend_low": "Developing (0-49)",
    "map.legend_golden": "Golden Location",

    // Landing Page
    "landing.nav_features": "Features",
    "landing.nav_methodology": "Methodology",
    "landing.nav_dimensions": "9 Dimensions",
    "landing.nav_districts": "50 Districts",
    "landing.btn_launch_app": "Launch Interactive Map",
    "landing.btn_explore_golden": "Explore Golden Locations",
    "landing.hero_badge": "Explainable Spatial AI · 100% Local & Private",
    "landing.hero_title_1": "Next-Gen Spatial AI for",
    "landing.hero_title_highlight": "Neighborhood Quality",
    "landing.hero_title_2": "& Real Estate Intelligence",
    "landing.hero_subtitle": "Synthesizing OpenStreetMap 3D urban morphology, official Treasury land appraisals, BTS/MRT walkability catchments, and institutional-grade AI investment memos for all 50 Bangkok districts.",
    "landing.stat_districts": "50",
    "landing.stat_districts_label": "Bangkok Districts",
    "landing.stat_dimensions": "9",
    "landing.stat_dimensions_label": "Spatial Quality Dimensions",
    "landing.stat_appraisal": "2023-26",
    "landing.stat_appraisal_label": "Official Treasury Cycle",
    "landing.stat_privacy": "100%",
    "landing.stat_privacy_label": "Local analysis / limited API lookup",

    "landing.pillars_title": "Four Pillars of Spatial Intelligence",
    "landing.pillars_subtitle": "A unified platform transforming complex urban morphology into actionable real-estate decisions.",
    "landing.pillar_1_title": "Local AI Investment Memo",
    "landing.pillar_1_desc": "Generates executive summaries, investment strengths, risk considerations, and cap rate estimates instantly without sending data to third-party clouds.",
    "landing.pillar_2_title": "Street-Level Visual Indices",
    "landing.pillar_2_desc": "Computes transparent green-space, walkability-network, and urban-form proxies from mapped OpenStreetMap features.",
    "landing.pillar_3_title": "Treasury Area Appraisal Data",
    "landing.pillar_3_desc": "Summarizes official land appraisal records by nearby map sheet, with sample size and observed price spread.",
    "landing.pillar_4_title": "50 Administrative Districts",
    "landing.pillar_4_desc": "Explore official boundary polygons, zone tier classifications, and aggregated district quality metrics with smooth fly-to camera controls.",

    "landing.dims_title": "9 Dimensions of Neighborhood Livability",
    "landing.dims_subtitle": "Every 300-meter hexagon across Bangkok is scored across 9 explainable environmental and urban dimensions.",
    "landing.dim_transit_desc": "BTS/MRT station proximity, pedestrian walk time, and transit network redundancy.",
    "landing.dim_amenities_desc": "Convenience stores, markets, pharmacies, and daily essential services within walking radius.",
    "landing.dim_walkability_desc": "Footway connectivity, pedestrian path density, and safe pedestrian-friendly streets.",
    "landing.dim_greenery_desc": "Urban parks, tree canopy coverage, water bodies, and public recreation access.",
    "landing.dim_road_desc": "Primary thoroughfare connectivity, expressway access, and secondary road permeability.",
    "landing.dim_commercial_desc": "Retail malls, office towers, mixed-use complexes, and active street-front commerce.",
    "landing.dim_residential_desc": "Community cohesion, residential density balance, and neighborhood livability.",
    "landing.dim_quietness_desc": "Buffer from high-traffic motorways and industrial noise corridors.",
    "landing.dim_environmental_desc": "Natural drainage, flood-resilient elevation, and separation from polluting infrastructure.",

    "landing.pipeline_title": "How the Engine Works",
    "landing.pipeline_subtitle": "From raw geospatial datasets to explainable real estate intelligence in milliseconds.",
    "landing.step_1_title": "1. Multi-Source Ingestion",
    "landing.step_1_desc": "Ingests OpenStreetMap 3D building footprints, transit networks, and official Treasury Department valuation tables.",
    "landing.step_2_title": "2. TOD Catchment Modeling",
    "landing.step_2_desc": "Calculates Gaussian pedestrian decay curves and transit catchment scores across 300m hexagonal spatial cells.",
    "landing.step_3_title": "3. Official Sheet Price Summary",
    "landing.step_3_desc": "Uses the median and 10th–90th percentile of real Treasury appraisals within nearby map sheets.",
    "landing.step_4_title": "4. Multimodal AI Synthesis",
    "landing.step_4_desc": "Generates narrative investment memos, rental yield tiers, and visual street character typologies.",

    "landing.cta_title": "Ready to Discover Bangkok's Prime Locations?",
    "landing.cta_desc": "Search across BTS/MRT stations, filter by 50 districts, customize 9-dimension weights, or inspect high-potential Golden Locations now.",
    "landing.footer_desc": "Local Multimodal AI Platform for Bangkok Street-Level Neighborhood Quality & Real-Estate Context Analysis.",
    "landing.footer_copyright": "Open-source spatial analysis platform for Bangkok urban planning & property evaluation.",

    // Units & Formatting
    "unit.sqwah": "sq.wah",
    "unit.thb": "THB",
    "unit.per_sqwah": "/ sq.wah",
  },
  th: {
    // Top Bar
    "app.title": "Bangkok Atlas",
    "app.subtitle": "วิเคราะห์คุณภาพย่านและประเมินมูลค่าที่ดินกรุงเทพมหานคร",
    "btn.golden_location": "ทำเลทอง",
    "btn.golden_on": "(เปิดอยู่)",
    "btn.golden_tooltip_on": "ปิดโหมดทำเลทอง เพื่อแสดงทุกย่าน",
    "btn.golden_tooltip_off": "แสดงเฉพาะสุดยอดทำเลทองของกรุงเทพฯ บนแผนที่",
    "status.live": "ชุดข้อมูล OSM & 3D: พร้อม",
    "status.appraisal": "ราคา: ข้อมูลกรมธนารักษ์ระดับพื้นที่",

    // Search
    "search.placeholder": "ค้นหาสถานี BTS/MRT, เขต, สถานที่สำคัญ...",
    "search.empty": "ไม่พบสถานที่ที่ตรงกับการค้นหา",
    "search.recent": "ค้นหาด่วน",
    "search.stations": "สถานีรถไฟฟ้า",
    "search.districts": "เขตกรุงเทพฯ",
    "search.landmarks": "สถานที่สำคัญ",
    "search.neighborhoods": "ย่านสำคัญ",

    // Tabs
    "tab.preferences": "ตั้งค่าค้นหา",
    "tab.results": "อันดับทำเล",
    "tab.detail": "วิเคราะห์เจาะลึก",

    // Preferences Panel
    "pref.title": "เกณฑ์การค้นหา & ค่าน้ำหนัก",
    "pref.badge": "Explainable AI",
    "pref.desc": "เลือกโปรไฟล์เป้าหมาย หรือปรับน้ำหนัก 9 มิติเพื่อค้นหาทำเลคุณภาพที่ตอบโจทย์เฉพาะคุณ",
    "pref.presets": "โปรไฟล์เป้าหมาย",
    "pref.district_filter": "กรองตามเขต (50 เขต)",
    "pref.all_districts": "ทุกเขตทั่วกรุงเทพมหานคร",
    "pref.budget": "งบประมาณรวม (บาท)",
    "pref.budget_placeholder": "เช่น 15,000,000",
    "pref.land_size": "ขนาดที่ดิน (ตารางวา)",
    "pref.land_size_placeholder": "เช่น 50 (1 ตร.ว. = 4 ตร.ม.)",
    "pref.land_use": "วัตถุประสงค์การใช้ประโยชน์ที่ดิน",
    "pref.land_use_all": "ทุกประเภทการใช้งาน",
    "pref.land_use_res": "ที่อยู่อาศัย (คอนโด / บ้าน)",
    "pref.land_use_comm": "พาณิชยกรรม / ค้าปลีก",
    "pref.land_use_office": "สำนักงาน / อาคารพาณิชย์",
    "pref.sliders_toggle_show": "แสดงแถบปรับ 9 มิติ",
    "pref.sliders_toggle_hide": "ซ่อนแถบปรับ 9 มิติ",
    "pref.sliders_title": "น้ำหนัก 9 มิติคุณภาพย่าน",
    "pref.btn_recommend": "ค้นหาทำเลที่เหมาะสมที่สุด",
    "pref.btn_recommending": "กำลังประมวลผล Multimodal...",

    // Presets
    "preset.balanced.name": "สมดุลทั่วไป",
    "preset.balanced.desc": "เน้นความสมดุลระหว่างการเดินทาง สิ่งอำนวยความสะดวก และสิ่งแวดล้อม",
    "preset.transit_first.name": "เดินทางด้วยรถไฟฟ้า",
    "preset.transit_first.desc": "เน้นใกล้สถานี BTS/MRT เดินทางสะดวก เข้าถึงง่าย",
    "preset.green_haven.name": "ครอบครัว & ธรรมชาติ",
    "preset.green_haven.desc": "เน้นพื้นที่สีเขียว ใกล้สวนสาธารณะ เสียงรบกวนน้อย",
    "preset.commercial_hub.name": "ช้อปปิ้ง & ไลฟ์สไตล์",
    "preset.commercial_hub.desc": "เน้นย่านอาคารสำนักงาน แหล่งช็อปปิ้ง และร้านค้าคึกคัก",
    "preset.walkable_urban.name": "เมืองเดินเท้าสะดวก",
    "preset.walkable_urban.desc": "เน้นโครงข่ายทางเท้า ทางเดินเท้าเข้าถึงสิ่งอำนวยความสะดวกครบ",
    "preset.golden_location.name": "ทำเลทอง",
    "preset.golden_location.desc": "ย่านศูนย์กลางเศรษฐกิจและทำเลพรีเมียมราคาประเมินสูงของ กทม.",

    // Results List
    "results.title": "ทำเลที่แนะนำสูงสุด",
    "results.count": "ทำเลที่ตรงกับเกณฑ์ของคุณ",
    "results.empty": "ไม่พบทำเลที่ตรงกับเงื่อนไข ลองปรับงบประมาณหรือค่าน้ำหนักใหม่",
    "results.match_score": "คะแนนความเข้ากัน",
    "results.quality": "คุณภาพย่าน",
    "results.est_market_price": "ค่าประมาณจากแบบจำลอง",

    // Location Detail
    "detail.quality_title": "คะแนนคุณภาพย่าน",
    "detail.quality_desc": "คำนวณจากแบบจำลองความน่าอยู่ 9 มิติ อ้างอิงข้อมูลจริงจาก OpenStreetMap และโครงข่ายคมนาคม",
    "detail.valuation_title": "ค่าประมาณเพื่อคัดกรองมูลค่าที่ดิน",
    "detail.market_price": "ค่าประมาณจากแบบจำลอง",
    "detail.treasury_price": "ค่าฐานแบบจำลองระดับเขต",
    "detail.treasury_cycle": "รอบบัญชีกรมธนารักษ์ 2566-2569",
    "detail.total_valuation": "มูลค่ารวมแปลงที่ดิน",
    "detail.budget_within": "อยู่ในงบประมาณ",
    "detail.budget_exceeded": "เกินงบประมาณ",
    "detail.nearest_transit": "รถไฟฟ้าที่ใกล้ที่สุด",
    "detail.nearest_landmark": "สถานที่สำคัญหลักในย่าน",
    "detail.other_landmarks": "แลนด์มาร์กสำคัญอื่นๆ ในย่าน:",
    "detail.walk_approx": "เดินประมาณ",
    "detail.mins": "นาที",
    "detail.no_station_near": "ไม่มีสถานีในระยะใกล้",
    "detail.dimensions_title": "รายละเอียด 9 มิติคุณภาพ",
    "detail.strengths_title": "จุดเด่นสำคัญ",
    "detail.cautions_title": "จุดที่ควรพิจารณา",
    "detail.no_strengths": "ไม่มีมิติที่เกิน 50 คะแนน",
    "detail.no_cautions": "ไม่มีจุดด้อยรุนแรง",
    "detail.adds_score": "ช่วยเพิ่มคะแนน",
    "detail.points": "แต้ม",
    "detail.below_par": "คะแนนต่ำกว่าเกณฑ์",
    "detail.comparables_title": "ทำเลใกล้เคียงที่มีลักษณะคล้ายกัน",
    "detail.similarity": "ความคล้ายคลึง",

    // AI Investment Memo
    "memo.title": "AI Investment Memo",
    "memo.local_tag": "Local AI · ไม่ส่งข้อมูลภายนอก",
    "memo.strengths_title": "จุดเด่นสำหรับการลงทุน",
    "memo.cautions_title": "ข้อควรพิจารณา",
    "memo.use_cases_title": "เหมาะสำหรับการพัฒนา",
    "memo.gross_yield": "ฉากทัศน์ผลตอบแทนค่าเช่าเบื้องต้น",
    "memo.cap_rate": "ระดับฉากทัศน์",

    // Street Level Visual Card
    "street.title": "ดัชนีตัวแทนรูปแบบถนน",
    "street.osm_tag": "ตัวแทนจาก OSM",
    "street.canopy_label": "ตัวแทนพื้นที่สีเขียวที่มีการทำแผนที่",
    "street.canopy_sub": "สัดส่วนพื้นที่เขียว/น้ำและระยะถึงสวนจาก OSM",
    "street.canopy_low": "เมืองหนาแน่น / ไร้ต้นไม้",
    "street.canopy_high": "สวนสาธารณะ / พื้นที่สีเขียว",
    "street.sidewalk_label": "ตัวแทนโครงข่ายที่เอื้อต่อการเดิน",
    "street.sidewalk_sub": "ความหนาแน่นถนนย่อย โครงข่ายถนน และการเข้าถึงรถไฟฟ้า",
    "street.sidewalk_low": "ต้องใช้รถยนต์เป็นหลัก",
    "street.sidewalk_high": "ทางเท้าดีเยี่ยม / Skywalk",
    "street.sky_label": "ตัวแทนความเปิดโล่งของท้องฟ้า",
    "street.sky_sub": "คำนวณย้อนจากความหนาแน่นเมือง ไม่ได้วิเคราะห์จากภาพ",
    "street.sky_low": "ตึกสูงหนาแน่นบดบัง",
    "street.sky_high": "ท้องฟ้าโปร่งโล่งสบาย",
    "street.btn_streetview": "ยืนยันด้วย Google Street View ↗",
    "street.btn_mapillary": "Mapillary Visual ↗",
    "street.methodology": "เป็นค่าตัวแทนจาก OpenStreetMap เท่านั้น ไม่ได้ใช้ภาพถนนหรือผลสำรวจสภาพทางเท้าจริง",

    // Map Controls
    "map.districts_toggle": "แสดง/ซ่อนเส้นแบ่ง 50 เขต",
    "map.stations_toggle": "สถานีรถไฟฟ้า",
    "map.lines_toggle": "โครงข่ายราง",
    "map.buildings_toggle": "อาคาร 3D",
    "map.legend_high": "คุณภาพสูง (75-100)",
    "map.legend_med": "ปานกลาง (50-74)",
    "map.legend_low": "กำลังพัฒนา (0-49)",
    "map.legend_golden": "ทำเลทอง",

    // Landing Page
    "landing.nav_features": "ฟีเจอร์เด่น",
    "landing.nav_methodology": "ระเบียบวิธีวิเคราะห์",
    "landing.nav_dimensions": "9 มิติคุณภาพ",
    "landing.nav_districts": "50 เขต กทม.",
    "landing.btn_launch_app": "เปิดใช้งานแผนที่วิเคราะห์สด",
    "landing.btn_explore_golden": "สำรวจทำเลทองของ กทม.",
    "landing.hero_badge": "AI เชิงพื้นที่ที่อธิบายได้ · ทำงานแบบ Local ปลอดภัย 100%",
    "landing.hero_title_1": "ปัญญาประดิษฐ์เชิงพื้นที่ วิเคราะห์",
    "landing.hero_title_highlight": "คุณภาพย่านระดับถนน",
    "landing.hero_title_2": "& ประเมินราคาอสังหาริมทรัพย์กรุงเทพฯ",
    "landing.hero_subtitle": "บูรณาการข้อมูลอาคาร 3D จาก OpenStreetMap, ราคาประเมินที่ดินราชการรอบบัญชี 2566–2569, รัศมีการเดินเท้าสถานีรถไฟฟ้า BTS/MRT และสรุปบทวิเคราะห์การลงทุนด้วย AI ครอบคลุมทั้ง 50 เขตกรุงเทพฯ",
    "landing.stat_districts": "50",
    "landing.stat_districts_label": "เขตกรุงเทพมหานคร",
    "landing.stat_dimensions": "9",
    "landing.stat_dimensions_label": "มิติคุณภาพความน่าอยู่",
    "landing.stat_appraisal": "2566-69",
    "landing.stat_appraisal_label": "รอบบัญชีกรมธนารักษ์",
    "landing.stat_privacy": "100%",
    "landing.stat_privacy_label": "ประมวลผลในเครื่อง ตรวจระวางผ่าน API เฉพาะเมื่อเลือก",

    "landing.pillars_title": "4 เสาหลักของแพลตฟอร์มปัญญาประดิษฐ์เชิงพื้นที่",
    "landing.pillars_subtitle": "เปลี่ยนข้อมูลกายภาพและภูมิศาสตร์ที่ซับซ้อน ให้กลายเป็นการตัดสินใจลงทุนอสังหาริมทรัพย์ที่แม่นยำ",
    "landing.pillar_1_title": "AI Investment Memo แบบ Local",
    "landing.pillar_1_desc": "สรุปบทวิเคราะห์ระดับสถาบัน จุดเด่น ความเสี่ยง และประมาณการอัตราผลตอบแทนค่าเช่า (Cap Rate) ทันทีโดยไม่ต้องส่งข้อมูลออกภายนอก",
    "landing.pillar_2_title": "Street-Level Visual Indices",
    "landing.pillar_2_desc": "คำนวณค่าตัวแทนพื้นที่สีเขียว โครงข่ายที่เอื้อต่อการเดิน และรูปแบบความหนาแน่นเมืองจากข้อมูล OpenStreetMap",
    "landing.pillar_3_title": "ราคาประเมินจริงระดับพื้นที่",
    "landing.pillar_3_desc": "สรุปค่ากลางและการกระจายจากระเบียนกรมธนารักษ์ในระวางใกล้เคียง พร้อมแสดงจำนวนข้อมูล",
    "landing.pillar_4_title": "ระบบวิเคราะห์ 50 เขต กทม.",
    "landing.pillar_4_desc": "แสดงเส้นขอบเขตการปกครองจริง ระดับโซนความเจริญ และสถิติคุณภาพเฉลี่ยรายเขต พร้อมระบบเลื่อนมุมมองแบบ 3D",

    "landing.dims_title": "9 มิติประเมินคุณภาพความน่าอยู่ของย่าน",
    "landing.dims_subtitle": "วิเคราะห์ทุกเซลล์ตารางหกเหลี่ยม 300 เมตรทั่วกรุงเทพฯ ด้วยแบบจำลองที่ตรวจสอบและอธิบายได้",
    "landing.dim_transit_desc": "ระยะห่างสถานี BTS/MRT, เวลาเดินจริง และความสะดวกในการเข้าถึงระบบราง",
    "landing.dim_amenities_desc": "ร้านสะดวกซื้อ ตลาดสด ร้านขายยา และสิ่งอำนวยความสะดวกในระยะเดินเท้า",
    "landing.dim_walkability_desc": "ความต่อเนื่องของทางเท้า ทางเดินเท้าปลอดภัย และความสะดวกในการเดิน",
    "landing.dim_greenery_desc": "สวนสาธารณะ ร่มเงาต้นไม้ พื้นที่ริมน้ำ และพื้นที่พักผ่อนหย่อนใจ",
    "landing.dim_road_desc": "การเชื่อมต่อถนนสายหลัก ทางด่วน และความสามารถในการระบายการจราจร",
    "landing.dim_commercial_desc": "ศูนย์การค้า อาคารสำนักงาน แหล่งช้อปปิ้ง และความคึกคักทางธุรกิจ",
    "landing.dim_residential_desc": "ความหนาแน่นที่อยู่อาศัย ความปลอดภัย และความสมดุลของชุมชน",
    "landing.dim_quietness_desc": "ระยะห่างจากถนนใหญ่ที่มีมลพิษทางเสียง และย่านอุตสาหกรรม",
    "landing.dim_environmental_desc": "การระบายน้ำ ความเสี่ยงน้ำท่วม และคุณภาพสิ่งแวดล้อมโดยรวม",

    "landing.pipeline_title": "ขั้นตอนการประมวลผลของระบบ (Pipeline)",
    "landing.pipeline_subtitle": "จากข้อมูลดิบ OpenStreetMap สู่บทวิเคราะห์อัจฉริยะในเสี้ยววินาที",
    "landing.step_1_title": "1. Multi-Source Ingestion",
    "landing.step_1_desc": "ดึงข้อมูลรูปทรงอาคาร 3D, โครงข่ายคมนาคม และตารางราคาประเมินที่ดินกรมธนารักษ์",
    "landing.step_2_title": "2. TOD Catchment Modeling",
    "landing.step_2_desc": "คำนวณกราฟความสะดวกการเดินเท้า (Gaussian Decay) และคะแนน 9 มิติในแต่ละเซลล์ Hex",
    "landing.step_3_title": "3. สรุปราคาประเมินตามระวาง",
    "landing.step_3_desc": "คำนวณค่ากลางและช่วงร้อยละ 10–90 จากราคาประเมินจริงในระวางแผนที่ใกล้เคียง",
    "landing.step_4_title": "4. Multimodal AI Synthesis",
    "landing.step_4_desc": "สร้างบทวิเคราะห์การลงทุน สรุปผลตอบแทนค่าเช่า และจัดกลุ่ม Street Typology อัตโนมัติ",

    "landing.cta_title": "พร้อมค้นหาทำเลศักยภาพสูงสุดในกรุงเทพฯ หรือยัง?",
    "landing.cta_desc": "ค้นหาสถานีรถไฟฟ้า กรองตามเขต 50 เขต ปรับแต่งค่าน้ำหนักตามความต้องการ หรือดูทำเลทองได้ทันที",
    "landing.footer_desc": "แพลตฟอร์มปัญญาประดิษฐ์เชิงพื้นที่เพื่อการวิเคราะห์คุณภาพย่านระดับถนนและประเมินมูลค่าอสังหาริมทรัพย์กรุงเทพฯ",
    "landing.footer_copyright": "ระบบวิเคราะห์ข้อมูลเชิงพื้นที่สำหรับวางแผนเมืองและประเมินอสังหาริมทรัพย์",

    // Units & Formatting
    "unit.sqwah": "ตร.ว.",
    "unit.thb": "บาท",
    "unit.per_sqwah": "/ ตร.ว.",
  },
};

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key: string, fallback?: string) => fallback || key,
  isEn: true,
  isTh: false,
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  // Default language is English ("en") as requested
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    let frame = 0;
    try {
      const saved = localStorage.getItem("bangkok_ai_lang") as Language | null;
      if (saved === "en" || saved === "th") {
        frame = window.requestAnimationFrame(() => setLangState(saved));
      }
    } catch {
      // ignore SSR/storage error
    }
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem("bangkok_ai_lang", newLang);
    } catch {
      // ignore
    }
  };

  const t = (key: string, fallback?: string): string => {
    return translations[lang]?.[key] ?? translations.en[key] ?? fallback ?? key;
  };

  return (
    <I18nContext.Provider
      value={{
        lang,
        setLang,
        t,
        isEn: lang === "en",
        isTh: lang === "th",
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useLanguage = () => useContext(I18nContext);

/**
 * Format THB currency with bilingual abbreviation (e.g. ฿15.00M in EN vs ฿15.00 ล้าน in TH)
 */
export function formatCurrency(amount: number | null | undefined, lang: Language = "en"): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  if (amount >= 1_000_000) {
    const m = (amount / 1_000_000).toFixed(2);
    return lang === "th" ? `฿${m} ล้าน` : `฿${m}M`;
  }
  return `฿${amount.toLocaleString("en-US")}`;
}

/**
 * Format Price per Sq. Wah with bilingual unit
 */
export function formatPricePerSqWah(price: number | null | undefined, lang: Language = "en"): string {
  if (price == null || Number.isNaN(price)) return "—";
  const formatted = Math.round(price).toLocaleString("en-US");
  return lang === "th" ? `฿${formatted} / ตร.ว.` : `฿${formatted} / sq.w.`;
}

/**
 * Format Distance
 */
export function formatDist(m: number | null | undefined, lang: Language = "en"): string {
  if (m == null || Number.isNaN(m)) return "—";
  if (m >= 1000) {
    const km = (m / 1000).toFixed(1);
    return lang === "th" ? `${km} กม.` : `${km} km`;
  }
  return lang === "th" ? `${Math.round(m)} ม.` : `${Math.round(m)} m`;
}

/**
 * Quality Badge Helper
 */
export function getQualityBadgeInfo(score: number, lang: Language = "en"): { label: string; bg: string; text: string } {
  if (score >= 80) {
    return {
      label: lang === "th" ? "🌟 ทำเลคุณภาพยอดเยี่ยม (Prime Tier)" : "🌟 Prime Tier (Top Quality)",
      bg: "bg-emerald-100",
      text: "text-emerald-800",
    };
  }
  if (score >= 65) {
    return {
      label: lang === "th" ? "✨ ทำเลคุณภาพสูง (High Quality)" : "✨ High Quality Neighborhood",
      bg: "bg-teal-100",
      text: "text-teal-800",
    };
  }
  if (score >= 50) {
    return {
      label: lang === "th" ? "👍 คุณภาพปานกลาง-ดี (Good Standard)" : "👍 Good Standard Area",
      bg: "bg-sky-100",
      text: "text-sky-800",
    };
  }
  if (score >= 35) {
    return {
      label: lang === "th" ? "⚠️ กำลังพัฒนา (Developing Area)" : "⚠️ Developing / Emerging Area",
      bg: "bg-amber-100",
      text: "text-amber-800",
    };
  }
  return {
    label: lang === "th" ? "📉 พื้นที่รอบนอก / ข้อมูลจำกัด" : "📉 Outer Ring / Limited Data",
    bg: "bg-zinc-100",
    text: "text-zinc-700",
  };
}

/**
 * Helper to get bilingual dimension label
 */
export function getDimLabel(dim: Dimension, lang: Language = "en"): string {
  const DIM_MAP: Record<Dimension, { en: string; th: string }> = {
    transit: { en: "Transit Accessibility (BTS/MRT)", th: "การเดินทาง (รถไฟฟ้า BTS/MRT)" },
    amenities: { en: "Amenities & Retail Diversity", th: "สิ่งอำนวยความสะดวก & ร้านค้า" },
    walkability: { en: "Walkability & Pedestrian Access", th: "ทางเดินเท้า & ความสะดวกในการเดิน" },
    greenery: { en: "Greenery & Parks", th: "พื้นที่สีเขียว & สวนสาธารณะ" },
    road_environment: { en: "Road Network & Connectivity", th: "การเข้าถึงถนนสายหลัก" },
    commercial: { en: "Commercial Activity & Offices", th: "ย่านธุรกิจ & พาณิชยกรรม" },
    residential: { en: "Residential Fabric", th: "ย่านที่พักอาศัย" },
    quietness: { en: "Peacefulness & Low Noise", th: "ความเงียบสงบ & ปราศจากเสียงรบกวน" },
    environmental: { en: "Environmental Quality & Water", th: "สิ่งแวดล้อม & คุณภาพชีวิต" },
  };
  return DIM_MAP[dim]?.[lang] ?? dim;
}
