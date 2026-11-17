"""Bangkok administrative districts, subdistricts, neighborhoods, and landmarks.

Provides reverse-geocoding from (lat, lng) or UTM coordinates to real Bangkok
districts (50 Khets), key subdistricts (Khwaengs), recognized neighborhood names
(e.g., Siam, Thong Lo, Ari, Silom, Sathorn), and nearest major landmarks.
"""
from __future__ import annotations

import math
from typing import TypedDict


class DistrictInfo(TypedDict):
    code: str
    name_th: str
    name_en: str
    center_lat: float
    center_lng: float
    zone: str  # CBD, Inner, Middle, Outer


# 50 Bangkok Districts (Khet) with official centers and zone classifications
BANGKOK_DISTRICTS: list[DistrictInfo] = [
    {"code": "1001", "name_th": "พระนคร", "name_en": "Phra Nakhon", "center_lat": 13.7643, "center_lng": 100.4991, "zone": "Inner"},
    {"code": "1002", "name_th": "ดุสิต", "name_en": "Dusit", "center_lat": 13.7770, "center_lng": 100.5204, "zone": "Inner"},
    {"code": "1003", "name_th": "หนองจอก", "name_en": "Nong Chok", "center_lat": 13.8555, "center_lng": 100.8625, "zone": "Outer"},
    {"code": "1004", "name_th": "บางรัก", "name_en": "Bang Rak", "center_lat": 13.7279, "center_lng": 100.5241, "zone": "CBD"},
    {"code": "1005", "name_th": "บางเขน", "name_en": "Bang Khen", "center_lat": 13.8738, "center_lng": 100.5968, "zone": "Middle"},
    {"code": "1006", "name_th": "บางกะปิ", "name_en": "Bang Kapi", "center_lat": 13.7658, "center_lng": 100.6477, "zone": "Middle"},
    {"code": "1007", "name_th": "ปทุมวัน", "name_en": "Pathum Wan", "center_lat": 13.7447, "center_lng": 100.5346, "zone": "CBD"},
    {"code": "1008", "name_th": "ป้อมปราบศัตรูพ่าย", "name_en": "Pom Prap Sattru Phai", "center_lat": 13.7505, "center_lng": 100.5108, "zone": "Inner"},
    {"code": "1009", "name_th": "พระโขนง", "name_en": "Phra Khanong", "center_lat": 13.7022, "center_lng": 100.6017, "zone": "Middle"},
    {"code": "1010", "name_th": "มีนบุรี", "name_en": "Min Buri", "center_lat": 13.8139, "center_lng": 100.7481, "zone": "Outer"},
    {"code": "1011", "name_th": "ลาดกระบัง", "name_en": "Lat Krabang", "center_lat": 13.7224, "center_lng": 100.7820, "zone": "Outer"},
    {"code": "1012", "name_th": "ยานนาวา", "name_en": "Yan Nawa", "center_lat": 13.7001, "center_lng": 100.5413, "zone": "Inner"},
    {"code": "1013", "name_th": "สัมพันธวงศ์", "name_en": "Samphanthawong", "center_lat": 13.7387, "center_lng": 100.5103, "zone": "Inner"},
    {"code": "1014", "name_th": "พญาไท", "name_en": "Phaya Thai", "center_lat": 13.7800, "center_lng": 100.5428, "zone": "CBD"},
    {"code": "1015", "name_th": "ธนบุรี", "name_en": "Thon Buri", "center_lat": 13.7250, "center_lng": 100.4858, "zone": "Inner"},
    {"code": "1016", "name_th": "บางกอกใหญ่", "name_en": "Bangkok Yai", "center_lat": 13.7329, "center_lng": 100.4740, "zone": "Inner"},
    {"code": "1017", "name_th": "ห้วยขวาง", "name_en": "Huai Khwang", "center_lat": 13.7784, "center_lng": 100.5759, "zone": "Inner"},
    {"code": "1018", "name_th": "คลองสาน", "name_en": "Khlong San", "center_lat": 13.7299, "center_lng": 100.5053, "zone": "Inner"},
    {"code": "1019", "name_th": "ตลิ่งชัน", "name_en": "Taling Chan", "center_lat": 13.7769, "center_lng": 100.4566, "zone": "Middle"},
    {"code": "1020", "name_th": "บางกอกน้อย", "name_en": "Bangkok Noi", "center_lat": 13.7547, "center_lng": 100.4735, "zone": "Inner"},
    {"code": "1021", "name_th": "บางขุนเทียน", "name_en": "Bang Khun Thian", "center_lat": 13.6261, "center_lng": 100.4358, "zone": "Outer"},
    {"code": "1022", "name_th": "ภาษีเจริญ", "name_en": "Phasi Charoen", "center_lat": 13.7147, "center_lng": 100.4357, "zone": "Middle"},
    {"code": "1023", "name_th": "หนองแขม", "name_en": "Nong Khaem", "center_lat": 13.7047, "center_lng": 100.3547, "zone": "Outer"},
    {"code": "1024", "name_th": "ราษฎร์บูรณะ", "name_en": "Rat Burana", "center_lat": 13.6822, "center_lng": 100.5055, "zone": "Middle"},
    {"code": "1025", "name_th": "บางพลัด", "name_en": "Bang Phlat", "center_lat": 13.7939, "center_lng": 100.4939, "zone": "Inner"},
    {"code": "1026", "name_th": "ดินแดง", "name_en": "Din Daeng", "center_lat": 13.7699, "center_lng": 100.5532, "zone": "Inner"},
    {"code": "1027", "name_th": "บึงกุ่ม", "name_en": "Bueng Kum", "center_lat": 13.7853, "center_lng": 100.6694, "zone": "Middle"},
    {"code": "1028", "name_th": "สาทร", "name_en": "Sathorn", "center_lat": 13.7196, "center_lng": 100.5284, "zone": "CBD"},
    {"code": "1029", "name_th": "บางซื่อ", "name_en": "Bang Sue", "center_lat": 13.8099, "center_lng": 100.5372, "zone": "Inner"},
    {"code": "1030", "name_th": "จตุจักร", "name_en": "Chatuchak", "center_lat": 13.8286, "center_lng": 100.5598, "zone": "Inner"},
    {"code": "1031", "name_th": "บางคอแหลม", "name_en": "Bang Kho Laem", "center_lat": 13.6932, "center_lng": 100.5024, "zone": "Inner"},
    {"code": "1032", "name_th": "ประเวศ", "name_en": "Prawet", "center_lat": 13.7169, "center_lng": 100.6947, "zone": "Middle"},
    {"code": "1033", "name_th": "คลองเตย", "name_en": "Khlong Toei", "center_lat": 13.7165, "center_lng": 100.5752, "zone": "CBD"},
    {"code": "1034", "name_th": "สวนหลวง", "name_en": "Suan Luang", "center_lat": 13.7303, "center_lng": 100.6517, "zone": "Middle"},
    {"code": "1035", "name_th": "จอมทอง", "name_en": "Chom Thong", "center_lat": 13.6775, "center_lng": 100.4632, "zone": "Middle"},
    {"code": "1036", "name_th": "ดอนเมือง", "name_en": "Don Mueang", "center_lat": 13.9130, "center_lng": 100.5897, "zone": "Outer"},
    {"code": "1037", "name_th": "ราชเทวี", "name_en": "Ratchathewi", "center_lat": 13.7588, "center_lng": 100.5344, "zone": "CBD"},
    {"code": "1038", "name_th": "ลาดพร้าว", "name_en": "Lat Phrao", "center_lat": 13.8036, "center_lng": 100.6074, "zone": "Middle"},
    {"code": "1039", "name_th": "วัฒนา", "name_en": "Watthana", "center_lat": 13.7422, "center_lng": 100.5855, "zone": "CBD"},
    {"code": "1040", "name_th": "บางแค", "name_en": "Bang Khae", "center_lat": 13.6961, "center_lng": 100.4072, "zone": "Middle"},
    {"code": "1041", "name_th": "หลักสี่", "name_en": "Lak Si", "center_lat": 13.8875, "center_lng": 100.5789, "zone": "Middle"},
    {"code": "1042", "name_th": "สายไหม", "name_en": "Sai Mai", "center_lat": 13.9200, "center_lng": 100.6450, "zone": "Outer"},
    {"code": "1043", "name_th": "คันนายาว", "name_en": "Khan Na Yao", "center_lat": 13.8271, "center_lng": 100.6794, "zone": "Middle"},
    {"code": "1044", "name_th": "สะพานสูง", "name_en": "Saphan Sung", "center_lat": 13.7700, "center_lng": 100.6847, "zone": "Middle"},
    {"code": "1045", "name_th": "วังทองหลาง", "name_en": "Wang Thonglang", "center_lat": 13.7850, "center_lng": 100.6097, "zone": "Middle"},
    {"code": "1046", "name_th": "คลองสามวา", "name_en": "Khlong Sam Wa", "center_lat": 13.8597, "center_lng": 100.7042, "zone": "Outer"},
    {"code": "1047", "name_th": "บางนา", "name_en": "Bang Na", "center_lat": 13.6682, "center_lng": 100.6047, "zone": "Middle"},
    {"code": "1048", "name_th": "ทวีวัฒนา", "name_en": "Thawi Watthana", "center_lat": 13.7886, "center_lng": 100.3547, "zone": "Outer"},
    {"code": "1049", "name_th": "ทุ่งครุ", "name_en": "Thung Khru", "center_lat": 13.6472, "center_lng": 100.4950, "zone": "Outer"},
    {"code": "1050", "name_th": "บางบอน", "name_en": "Bang Bon", "center_lat": 13.6594, "center_lng": 100.3992, "zone": "Outer"},
]

# Key Bangkok Neighborhoods / Zones with coordinates and distinct characteristics
BANGKOK_NEIGHBORHOODS = [
    {"name_th": "สยาม - ปทุมวัน", "name_en": "Siam - Pathum Wan", "lat": 13.7456, "lng": 100.5342, "radius_m": 800, "district": "Pathum Wan"},
    {"name_th": "ประตูน้ำ - ราชปรารภ", "name_en": "Pratunam - Ratchaprarop", "lat": 13.7510, "lng": 100.5405, "radius_m": 700, "district": "Ratchathewi"},
    {"name_th": "เพลินจิต - ชิดลม", "name_en": "Ploenchit - Chidlom", "lat": 13.7431, "lng": 100.5447, "radius_m": 700, "district": "Pathum Wan"},
    {"name_th": "สีลม - ศาลาแดง", "name_en": "Silom - Sala Daeng", "lat": 13.7285, "lng": 100.5348, "radius_m": 800, "district": "Bang Rak"},
    {"name_th": "สาทร - ช่องนนทรี", "name_en": "Sathorn - Chong Nonsi", "lat": 13.7236, "lng": 100.5287, "radius_m": 800, "district": "Sathorn"},
    {"name_th": "พร้อมพงษ์ (สุขุมวิท 24-39)", "name_en": "Phrom Phong (Sukhumvit 24-39)", "lat": 13.7303, "lng": 100.5698, "radius_m": 700, "district": "Khlong Toei / Watthana"},
    {"name_th": "ทองหล่อ (สุขุมวิท 55)", "name_en": "Thong Lo (Sukhumvit 55)", "lat": 13.7335, "lng": 100.5840, "radius_m": 900, "district": "Watthana"},
    {"name_th": "เอกมัย (สุขุมวิท 63)", "name_en": "Ekkamai (Sukhumvit 63)", "lat": 13.7280, "lng": 100.5853, "radius_m": 800, "district": "Watthana"},
    {"name_th": "อโศก - สุขุมวิท 21", "name_en": "Asok - Sukhumvit 21", "lat": 13.7372, "lng": 100.5604, "radius_m": 750, "district": "Watthana"},
    {"name_th": "นานา - สุขุมวิทตอนต้น", "name_en": "Nana - Early Sukhumvit", "lat": 13.7405, "lng": 100.5540, "radius_m": 700, "district": "Khlong Toei / Watthana"},
    {"name_th": "พญาไท - อนุสาวรีย์ชัยสมรภูมิ", "name_en": "Phaya Thai - Victory Monument", "lat": 13.7650, "lng": 100.5375, "radius_m": 800, "district": "Ratchathewi"},
    {"name_th": "อารีย์ - สะพานควาย", "name_en": "Ari - Saphan Khwai", "lat": 13.7797, "lng": 100.5448, "radius_m": 900, "district": "Phaya Thai"},
    {"name_th": "พระราม 9 - รัชดาภิเษก", "name_en": "Rama 9 - Ratchadapisek", "lat": 13.7578, "lng": 100.5658, "radius_m": 850, "district": "Huai Khwang / Din Daeng"},
    {"name_th": "ห้วยขวาง - ศูนย์วัฒนธรรม", "name_en": "Huai Khwang - Cultural Centre", "lat": 13.7788, "lng": 100.5744, "radius_m": 800, "district": "Huai Khwang"},
    {"name_th": "สุทธิสาร - รัชดา", "name_en": "Sutthisan - Ratchada", "lat": 13.7895, "lng": 100.5745, "radius_m": 800, "district": "Huai Khwang / Din Daeng"},
    {"name_th": "จตุจักร - หมอชิต - ห้าแยกลาดพร้าว", "name_en": "Chatuchak - Mo Chit - Ha Yaek Lat Phrao", "lat": 13.8130, "lng": 100.5608, "radius_m": 1000, "district": "Chatuchak"},
    {"name_th": "เจริญกรุง - บางรัก", "name_en": "Charoen Krung - Bang Rak", "lat": 13.7225, "lng": 100.5152, "radius_m": 800, "district": "Bang Rak"},
    {"name_th": "คลองสาน - เจริญนคร (ICONSIAM)", "name_en": "Khlong San - Charoen Nakhon (ICONSIAM)", "lat": 13.7267, "lng": 100.5105, "radius_m": 800, "district": "Khlong San"},
    {"name_th": "วงเวียนใหญ่ - ตลาดพลู", "name_en": "Wongwian Yai - Talat Phlu", "lat": 13.7210, "lng": 100.4890, "radius_m": 900, "district": "Thon Buri"},
    {"name_th": "อ่อนนุช - พระโขนง", "name_en": "On Nut - Phra Khanong", "lat": 13.7058, "lng": 100.6012, "radius_m": 850, "district": "Phra Khanong / Khlong Toei"},
    {"name_th": "ปุณณวิถี - บางจาก", "name_en": "Punnawithi - Bang Chak", "lat": 13.6890, "lng": 100.6080, "radius_m": 800, "district": "Phra Khanong"},
    {"name_th": "อุดมสุข - บางนา", "name_en": "Udom Suk - Bang Na", "lat": 13.6798, "lng": 100.6095, "radius_m": 900, "district": "Bang Na"},
    {"name_th": "แบริ่ง - ลาซาล", "name_en": "Bearing - Lasalle", "lat": 13.6600, "lng": 100.6020, "radius_m": 900, "district": "Bang Na"},
    {"name_th": "รัชโยธิน - ม.เกษตรศาสตร์", "name_en": "Ratchayothin - Kasetsart", "lat": 13.8298, "lng": 100.5701, "radius_m": 900, "district": "Chatuchak"},
    {"name_th": "บางซื่อ - เตาปูน", "name_en": "Bang Sue - Tao Poon", "lat": 13.8062, "lng": 100.5305, "radius_m": 850, "district": "Bang Sue"},
    {"name_th": "บางโพ - เกียกกาย", "name_en": "Bang Pho - Kiak Kai", "lat": 13.8050, "lng": 100.5200, "radius_m": 800, "district": "Bang Sue"},
    {"name_th": "เยาวราช - สัมพันธวงศ์", "name_en": "Chinatown / Yaowarat", "lat": 13.7412, "lng": 100.5085, "radius_m": 700, "district": "Samphanthawong"},
    {"name_th": "เกาะรัตนโกสินทร์ - ท่าเตียน", "name_en": "Rattanakosin Island - Tha Tien", "lat": 13.7500, "lng": 100.4930, "radius_m": 800, "district": "Phra Nakhon"},
    {"name_th": "ปิ่นเกล้า - บรมราชชนนี", "name_en": "Pinklao - Borommaratchachonnani", "lat": 13.7780, "lng": 100.4780, "radius_m": 900, "district": "Bangkok Noi"},
    {"name_th": "ศิริราช - วังหลัง", "name_en": "Siriraj - Wang Lang", "lat": 13.7565, "lng": 100.4850, "radius_m": 700, "district": "Bangkok Noi"},
    {"name_th": "ท่าพระ - บางไผ่", "name_en": "Tha Phra - Bang Phai", "lat": 13.7290, "lng": 100.4735, "radius_m": 800, "district": "Bangkok Yai"},
    {"name_th": "บางหว้า - เพชรเกษม", "name_en": "Bang Wa - Phet Kasem", "lat": 13.7205, "lng": 100.4578, "radius_m": 800, "district": "Phasi Charoen"},
    {"name_th": "พระราม 3 - สาธุประดิษฐ์", "name_en": "Rama 3 - Sathu Pradit", "lat": 13.6920, "lng": 100.5350, "radius_m": 1200, "district": "Yan Nawa"},
    {"name_th": "คลองตัน - พัฒนาการ", "name_en": "Khlong Tan - Phatthanakan", "lat": 13.7400, "lng": 100.6000, "radius_m": 900, "district": "Suan Luang"},
    {"name_th": "รามคำแหง - หัวหมาก", "name_en": "Ramkhamhaeng - Hua Mak", "lat": 13.7550, "lng": 100.6150, "radius_m": 1000, "district": "Bang Kapi"},
    {"name_th": "ลาดพร้าว - โชคชัย 4", "name_en": "Lat Phrao - Chok Chai 4", "lat": 13.7960, "lng": 100.5980, "radius_m": 1000, "district": "Lat Phrao"},
    {"name_th": "เลียบด่วนรามอินทรา (ประดิษฐ์มนูธรรม)", "name_en": "Pradit Manutham (CDC / Central Eastville)", "lat": 13.8050, "lng": 100.6200, "radius_m": 1200, "district": "Lat Phrao / Wang Thonglang"},
]

# Major Bangkok Landmarks for proximity & context (Curated Iconic Primary Hubs)
BANGKOK_LANDMARKS = [
    # Core Retail & Lifestyle Hubs
    {"name_th": "ทรู ดิจิทัล พาร์ค (True Digital Park)", "name_en": "True Digital Park (101 TDPK)", "lat": 13.6857, "lng": 100.6111, "category": "tech_hub"},
    {"name_th": "สยามพารากอน (Siam Paragon)", "name_en": "Siam Paragon", "lat": 13.7460, "lng": 100.5348, "category": "shopping"},
    {"name_th": "เซ็นทรัลเวิลด์ (CentralWorld)", "name_en": "CentralWorld", "lat": 13.7466, "lng": 100.5393, "category": "shopping"},
    {"name_th": "ไอคอนสยาม (ICONSIAM)", "name_en": "ICONSIAM", "lat": 13.7267, "lng": 100.5108, "category": "shopping"},
    {"name_th": "เอ็มดิสทริค (EmQuartier & EmSphere)", "name_en": "EmDistrict (EmQuartier / EmSphere)", "lat": 13.7315, "lng": 100.5695, "category": "shopping"},
    {"name_th": "เซ็นทรัล ลาดพร้าว & ยูเนี่ยนมอลล์", "name_en": "Central Ladprao & Union Mall", "lat": 13.8166, "lng": 100.5612, "category": "shopping"},
    {"name_th": "เซ็นทรัล พระราม 9 (Central Rama 9)", "name_en": "Central Rama 9", "lat": 13.7578, "lng": 100.5658, "category": "shopping"},
    {"name_th": "เทอร์มินอล 21 อโศก (Terminal 21)", "name_en": "Terminal 21 Asok", "lat": 13.7377, "lng": 100.5603, "category": "shopping"},
    {"name_th": "เซ็นทรัล บางนา (Central Bangna)", "name_en": "Central Bangna", "lat": 13.6687, "lng": 100.6346, "category": "shopping"},
    {"name_th": "เมกาบางนา & อิเกีย (Mega Bangna)", "name_en": "Mega Bangna & IKEA", "lat": 13.6465, "lng": 100.6802, "category": "shopping"},
    {"name_th": "เซ็นทรัล ปิ่นเกล้า (Central Pinklao)", "name_en": "Central Pinklao", "lat": 13.7780, "lng": 100.4770, "category": "shopping"},
    {"name_th": "เซ็นทรัล พระราม 3 (Central Rama 3)", "name_en": "Central Rama 3", "lat": 13.6968, "lng": 100.5385, "category": "shopping"},
    {"name_th": "เซ็นทรัล อีสต์วิลล์ (Central Eastville)", "name_en": "Central Eastville", "lat": 13.8035, "lng": 100.6150, "category": "shopping"},
    {"name_th": "เซ็นทรัล เอ็มบาสซี (Central Embassy)", "name_en": "Central Embassy", "lat": 13.7438, "lng": 100.5462, "category": "shopping"},
    {"name_th": "เดอะมอลล์ไลฟ์สโตร์ บางกะปิ", "name_en": "The Mall Lifestore Bangkapi", "lat": 13.7660, "lng": 100.6430, "category": "shopping"},
    {"name_th": "เดอะมอลล์ไลฟ์สโตร์ ท่าพระ", "name_en": "The Mall Lifestore Tha Phra", "lat": 13.7130, "lng": 100.4785, "category": "shopping"},
    {"name_th": "เดอะมอลล์ไลฟ์สโตร์ บางแค", "name_en": "The Mall Lifestore Bangkhae", "lat": 13.7118, "lng": 100.4072, "category": "shopping"},
    {"name_th": "ซีคอนสแควร์ ศรีนครินทร์ (Seacon Square)", "name_en": "Seacon Square Srinakarin", "lat": 13.6948, "lng": 100.6480, "category": "shopping"},
    {"name_th": "แพลทินัม แฟชั่นมอลล์ ประตูน้ำ", "name_en": "The Platinum Fashion Mall", "lat": 13.7503, "lng": 100.5398, "category": "shopping"},
    {"name_th": "ลา วิลล่า อารีย์ (La Villa Ari)", "name_en": "La Villa Ari", "lat": 13.7797, "lng": 100.5448, "category": "lifestyle"},
    {"name_th": "เจ อเวนิว & เดอะคอมมอนส์ ทองหล่อ", "name_en": "J Avenue & The Commons Thonglor", "lat": 13.7348, "lng": 100.5838, "category": "lifestyle"},
    {"name_th": "เมเจอร์ ซีนีเพล็กซ์ รัชโยธิน", "name_en": "Major Cineplex Ratchayothin", "lat": 13.8302, "lng": 100.5705, "category": "lifestyle"},
    {"name_th": "เอเชียทีค เดอะ ริเวอร์ฟร้อนท์", "name_en": "Asiatique The Riverfront", "lat": 13.7042, "lng": 100.5032, "category": "lifestyle"},
    {"name_th": "เดอะ สตรีท รัชดา (The Street Ratchada)", "name_en": "The Street Ratchada", "lat": 13.7712, "lng": 100.5724, "category": "shopping"},
    {"name_th": "เทอร์มินอล 21 พระราม 3", "name_en": "Terminal 21 Rama 3", "lat": 13.6958, "lng": 100.5050, "category": "shopping"},

    # Major Towers & Mixed-Use Hubs
    {"name_th": "ตึกมหานคร (King Power Mahanakhon)", "name_en": "Mahanakhon Tower", "lat": 13.7236, "lng": 100.5284, "category": "landmark"},
    {"name_th": "วัน แบงค็อก (One Bangkok)", "name_en": "One Bangkok", "lat": 13.7262, "lng": 100.5468, "category": "landmark"},
    {"name_th": "ดุสิต เซ็นทรัล พาร์ค (Dusit Central Park)", "name_en": "Dusit Central Park", "lat": 13.7289, "lng": 100.5372, "category": "landmark"},
    {"name_th": "สีลม คอมเพล็กซ์ (Silom Complex)", "name_en": "Silom Complex", "lat": 13.7284, "lng": 100.5350, "category": "shopping"},
    {"name_th": "ไบเทค บางนา (BITEC Bangna)", "name_en": "BITEC Bangna", "lat": 13.6698, "lng": 100.6052, "category": "convention"},
    {"name_th": "ศูนย์การประชุมแห่งชาติสิริกิติ์ (QSNCC)", "name_en": "Queen Sirikit National Convention Center", "lat": 13.7238, "lng": 100.5592, "category": "convention"},
    {"name_th": "อนุสาวรีย์ชัยสมรภูมิ", "name_en": "Victory Monument", "lat": 13.7650, "lng": 100.5375, "category": "landmark"},
    {"name_th": "วงเวียนใหญ่ (Wongwian Yai)", "name_en": "Wongwian Yai Monument", "lat": 13.7210, "lng": 100.4890, "category": "landmark"},

    # Major Parks & Green Spaces
    {"name_th": "สวนลุมพินี (Lumphini Park)", "name_en": "Lumphini Park", "lat": 13.7314, "lng": 100.5414, "category": "park"},
    {"name_th": "สวนเบญจกิติ (Benchakitti Forest Park)", "name_en": "Benchakitti Forest Park", "lat": 13.7288, "lng": 100.5583, "category": "park"},
    {"name_th": "สวนจตุจักร & สวนรถไฟ (Chatuchak Park)", "name_en": "Chatuchak & Wachirabenchathat Park", "lat": 13.8038, "lng": 100.5539, "category": "park"},
    {"name_th": "สวนหลวง ร.9 (Suan Luang Rama IX)", "name_en": "Suan Luang Rama IX", "lat": 13.6875, "lng": 100.6630, "category": "park"},

    # Major Hospitals
    {"name_th": "โรงพยาบาลศิริราช (Siriraj Hospital)", "name_en": "Siriraj Hospital", "lat": 13.7578, "lng": 100.4858, "category": "health"},
    {"name_th": "โรงพยาบาลจุฬาลงกรณ์ (King Chulalongkorn Hospital)", "name_en": "King Chulalongkorn Memorial Hospital", "lat": 13.7325, "lng": 100.5365, "category": "health"},
    {"name_th": "โรงพยาบาลสมิติเวช สุขุมวิท", "name_en": "Samitivej Sukhumvit Hospital", "lat": 13.7366, "lng": 100.5786, "category": "health"},
    {"name_th": "โรงพยาบาลบำรุงราษฎร์ (Bumrungrad)", "name_en": "Bumrungrad International Hospital", "lat": 13.7460, "lng": 100.5531, "category": "health"},
    {"name_th": "โรงพยาบาลรามาธิบดี (Ramathibodi)", "name_en": "Ramathibodi Hospital", "lat": 13.7670, "lng": 100.5265, "category": "health"},
    {"name_th": "โรงพยาบาลพญาไท 2 (Phyathai 2)", "name_en": "Phyathai 2 International Hospital", "lat": 13.7712, "lng": 100.5402, "category": "health"},

    # Top Universities & Education
    {"name_th": "จุฬาลงกรณ์มหาวิทยาลัย (Chulalongkorn Univ)", "name_en": "Chulalongkorn University", "lat": 13.7380, "lng": 100.5320, "category": "education"},
    {"name_th": "มหาวิทยาลัยเกษตรศาสตร์ (Kasetsart Univ)", "name_en": "Kasetsart University", "lat": 13.8476, "lng": 100.5724, "category": "education"},
    {"name_th": "มหาวิทยาลัยรามคำแหง (Ramkhamhaeng Univ)", "name_en": "Ramkhamhaeng University", "lat": 13.7555, "lng": 100.6225, "category": "education"},
    {"name_th": "มหาวิทยาลัยธรรมศาสตร์ ท่าพระจันทร์", "name_en": "Thammasat University Tha Prachan", "lat": 13.7563, "lng": 100.4908, "category": "education"},

    # Transport Terminals
    {"name_th": "สถานีกลางกรุงเทพอภิวัฒน์ (Central Terminal)", "name_en": "Krung Thep Aphiwat Central Terminal", "lat": 13.8038, "lng": 100.5401, "category": "transport"},
    {"name_th": "สนามบินดอนเมือง (Don Mueang Airport)", "name_en": "Don Mueang International Airport", "lat": 13.9133, "lng": 100.6042, "category": "transport"},
    {"name_th": "สนามบินสุวรรณภูมิ (Suvarnabhumi Airport)", "name_en": "Suvarnabhumi Airport", "lat": 13.6900, "lng": 100.7501, "category": "transport"},
]


def haversine_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate great-circle distance in meters between two lat/lng points."""
    r = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def find_nearest_district(lat: float, lng: float) -> DistrictInfo:
    """Find the closest Bangkok District (Khet) for a coordinate."""
    best = BANGKOK_DISTRICTS[0]
    min_dist = float("inf")
    for d in BANGKOK_DISTRICTS:
        dist = haversine_distance_m(lat, lng, d["center_lat"], d["center_lng"])
        if dist < min_dist:
            min_dist = dist
            best = d
    return best


def find_neighborhood(lat: float, lng: float) -> tuple[str, str] | None:
    """Find if coordinate falls within a recognized neighborhood hub."""
    for n in BANGKOK_NEIGHBORHOODS:
        dist = haversine_distance_m(lat, lng, n["lat"], n["lng"])
        if dist <= n["radius_m"]:
            return n["name_th"], n["name_en"]
    return None


def find_nearest_landmark(lat: float, lng: float) -> tuple[dict, float]:
    """Find the nearest major Bangkok landmark and its distance in meters."""
    best = BANGKOK_LANDMARKS[0]
    min_dist = float("inf")
    for lm in BANGKOK_LANDMARKS:
        dist = haversine_distance_m(lat, lng, lm["lat"], lm["lng"])
        if dist < min_dist:
            min_dist = dist
            best = lm
    return best, min_dist


def find_nearby_landmarks(lat: float, lng: float, top_k: int = 3) -> list[dict]:
    """Find top prominent landmarks within proximity."""
    scored = []
    for lm in BANGKOK_LANDMARKS:
        dist = haversine_distance_m(lat, lng, lm["lat"], lm["lng"])
        scored.append({
            "name_th": lm["name_th"],
            "name_en": lm["name_en"],
            "category": lm["category"],
            "distance_m": round(dist),
        })
    scored.sort(key=lambda x: x["distance_m"])
    return scored[:top_k]


def enrich_location_context(lat: float, lng: float, station_name: str = "", station_dist_m: float | None = None) -> dict:
    """Enrich a coordinate with complete Bangkok administrative and neighborhood names."""
    district = find_nearest_district(lat, lng)
    nb = find_neighborhood(lat, lng)
    lm, lm_dist = find_nearest_landmark(lat, lng)

    if nb:
        name_th = f"{nb[0]}, {district['name_th']}"
        name_en = f"{nb[1]}, {district['name_en']}"
        short_name = nb[1]
    elif station_name and station_dist_m is not None and station_dist_m <= 1000:
        name_th = f"ย่านใกล้สถานี {station_name} ({district['name_th']})"
        name_en = f"Near {station_name} Station ({district['name_en']})"
        short_name = f"{station_name} Area"
    else:
        name_th = f"เขต{district['name_th']}"
        name_en = f"{district['name_en']} District"
        short_name = district["name_en"]

    walk_time_min = None
    if station_dist_m is not None and not math.isnan(station_dist_m):
        # average walking speed ~ 80 m/min (4.8 km/h)
        walk_time_min = max(1, round(station_dist_m / 80.0))

    nearby_lms = find_nearby_landmarks(lat, lng, top_k=3)

    return {
        "title_th": name_th,
        "title_en": name_en,
        "short_name": short_name,
        "district_th": district["name_th"],
        "district_en": district["name_en"],
        "zone": district["zone"],
        "nearest_landmark": {
            "name_th": lm["name_th"],
            "name_en": lm["name_en"],
            "category": lm["category"],
            "distance_m": round(lm_dist),
        },
        "nearby_landmarks": nearby_lms,
        "transit_walk": {
            "station_name": station_name,
            "distance_m": round(station_dist_m) if station_dist_m is not None else None,
            "walk_time_min": walk_time_min,
        },
    }
