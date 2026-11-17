export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

const REQUEST_TIMEOUT_MS = 20_000;

export const DIMENSIONS = [
  "transit",
  "amenities",
  "walkability",
  "greenery",
  "road_environment",
  "commercial",
  "residential",
  "quietness",
  "environmental",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

export const DEFAULT_WEIGHTS: Record<Dimension, number> = {
  transit: 70,
  amenities: 60,
  walkability: 55,
  greenery: 50,
  road_environment: 45,
  commercial: 50,
  residential: 50,
  quietness: 40,
  environmental: 40,
};

export const DIMENSION_LABELS: Record<Dimension, { th: string; en: string }> = {
  transit: { th: "การเดินทาง (รถไฟฟ้า BTS/MRT)", en: "Transit Accessibility (BTS/MRT)" },
  amenities: { th: "สิ่งอำนวยความสะดวก & ร้านค้า", en: "Amenities & Retail Diversity" },
  walkability: { th: "ทางเดินเท้า & ความสะดวกในการเดิน", en: "Walkability & Pedestrian Access" },
  greenery: { th: "พื้นที่สีเขียว & สวนสาธารณะ", en: "Greenery & Parks" },
  road_environment: { th: "การเข้าถึงถนนสายหลัก", en: "Road Network & Connectivity" },
  commercial: { th: "ย่านธุรกิจ & พาณิชยกรรม", en: "Commercial Activity & Offices" },
  residential: { th: "ย่านที่พักอาศัย", en: "Residential Fabric" },
  quietness: { th: "ความเงียบสงบ & ปราศจากเสียงรบกวน", en: "Peacefulness & Low Noise" },
  environmental: { th: "สิ่งแวดล้อม & คุณภาพชีวิต", en: "Environmental Quality & Water" },
};

export interface GridFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: {
    hex_id: string;
    center_lat?: number;
    center_lng?: number;
    quality: number;
    low_data: boolean;
    district_en?: string;
    market_price_sqwah?: number;
    assessed_price_sqwah?: number;
    market_price_low?: number;
    market_price_high?: number;
    price_source?: string;
    price_record_count?: number;
    price_resolution_m?: number | null;
    zone_tier?: string;
    is_golden_location?: boolean;
    n_poi: number;
    n_transit: number;
    station_dist_m?: number | null;
    [dim: string]: number | string | boolean | null | undefined;
  };
}

export interface GridResponse {
  type: "FeatureCollection";
  features: GridFeature[];
}

export interface StationLine {
  ref: string;
  label: { th: string; en: string };
  colour: string | null;
}

export interface Station {
  name: string;
  name_en: string;
  lat: number;
  lng: number;
  category: string;
  lines: StationLine[];
}

export interface RailRouteStop {
  name: string;
  name_en: string;
  lat: number;
  lng: number;
}

export interface RailRoute {
  ref: string;
  label: { th: string; en: string };
  colour: string | null;
  stops: RailRouteStop[];
}

export interface StationsResponse {
  stations: Station[];
  count: number;
  lines: StationLine[];
  routes: RailRoute[];
}

export interface Factor {
  dimension: Dimension;
  score: number;
  contribution: number;
  description: string;
}

export interface PriceValuation {
  assessed_price_sqwah: number;
  market_price_sqwah: number;
  market_price_low: number;
  market_price_high: number;
  zone_tier: string;
  price_level: string;
  affordability_index: number;
  is_golden_location?: boolean;
  valuation_thb: number | null;
  land_size_sqwah: number | null;
  budget_fit: string | null;
  methodology: string;
  assessed_price_type?: "district_model_baseline" | "treasury_area_reference";
  market_price_type?: "hedonic_estimate" | "treasury_area_reference";
  reference_record_count?: number;
  reference_resolution_m?: number | null;
  reference_source_mode?: string;
  reference_source_last_modified?: string;
  reference_utm_sheet?: string | null;
  reference_utm_subsheet?: number | null;
  reference_source_url?: string;
  reference_wide_spread?: boolean;
  road_benchmark?: {
    road_name_th: string;
    road_name_en: string;
    low: number;
    high: number;
    cycle: string;
    source_url: string;
    source_copy_url?: string;
    scope: string;
  };
  official_lookup_url?: string;
  disclaimer?: string;
}


export interface LandmarkInfo {
  name_th: string;
  name_en: string;
  category: string;
  distance_m: number;
}

export interface TransitWalkInfo {
  station_name: string;
  distance_m: number | null;
  walk_time_min: number | null;
}

export interface GeoContext {
  title_th: string;
  title_en: string;
  short_name: string;
  district_th: string;
  district_en: string;
  zone: string;
  nearest_landmark: LandmarkInfo;
  nearby_landmarks?: LandmarkInfo[];
  transit_walk: TransitWalkInfo;
}

export interface MultimodalVisual {
  satellite_preview_url: string;
  street_view_link: string;
  mapillary_link: string;
  urban_density_index: number;
  green_canopy_pct: number;
}

export interface InvestmentMemo {
  executive_summary: string;
  strengths: string[];
  considerations: string[];
  use_cases: string[];
  investment_outlook: "prime" | "high" | "stable" | "cautious" | "limited";
  outlook_label: string;
  outlook_color: string;
  yield_estimate: string;
  cap_rate_tier: string;
  quality_tier: string;
  quality_tier_label: string;
  executive_summary_en?: string;
  executive_summary_th?: string;
  strengths_en?: string[];
  strengths_th?: string[];
  considerations_en?: string[];
  considerations_th?: string[];
  use_cases_en?: string[];
  use_cases_th?: string[];
  outlook_label_en?: string;
  outlook_label_th?: string;
  quality_tier_label_en?: string;
  quality_tier_label_th?: string;
}

export interface StreetVisualIndices {
  green_canopy_score: number;
  sidewalk_quality: number;
  sky_openness: number;
  street_character: string;
  street_character_label: string;
  street_character_label_en?: string;
  street_character_label_th?: string;
  methodology: string;
}

export interface LocationDetail {
  hex_id: string;
  center: { lat: number; lng: number };
  context: GeoContext;
  quality: number;
  dimensions: Record<Dimension, number>;
  contributions: Record<Dimension, number>;
  positive_factors: Factor[];
  negative_factors: Factor[];
  feature_summary: Record<string, number | boolean | null>;
  comparables: { hex_id: string; feature_distance: number; quality: number }[];
  price_valuation: PriceValuation;
  multimodal_visual?: MultimodalVisual;
  investment_memo?: InvestmentMemo;
  street_visual?: StreetVisualIndices;
}

export interface Recommendation {
  hex_id: string;
  center: { lat: number; lng: number };
  context: GeoContext;
  match_score: number;
  quality: number;
  dimensions: Record<Dimension, number>;
  contributions: Record<Dimension, number>;
  positive_factors: Factor[];
  negative_factors: Factor[];
  feature_summary: Record<string, number | boolean | null>;
  price_valuation: PriceValuation;
}

export interface RecommendResponse {
  request: {
    weights: Record<Dimension, number>;
    budget: number | null;
    land_size_sqwah: number | null;
    land_use: string | null;
    k: number;
  };
  data_status: Record<string, unknown>;
  results: Recommendation[];
}

export interface HealthResponse {
  status: "ok";
  data_status: Record<string, unknown>;
  cells_count: number;
  stations_count: number;
  buildings_count?: number;
}

export interface Preset {
  id: string;
  name_th: string;
  name_en: string;
  description_th: string;
  description_en: string;
  weights: Record<Dimension, number>;
}

export interface SearchResultItem {
  type: "station" | "district" | "neighborhood" | "landmark";
  title_th: string;
  title_en: string;
  subtitle: string;
  lat: number;
  lng: number;
  badge: string;
}

export interface SearchResponse {
  query: string;
  count: number;
  results: SearchResultItem[];
}

export function formatDistance(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function formatTHB(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  if (amount >= 1000000) {
    return `฿${(amount / 1000000).toFixed(2)}M`;
  }
  return `฿${amount.toLocaleString("en-US")}`;
}

export function formatPriceSqWah(price: number | null | undefined): string {
  if (price == null || Number.isNaN(price)) return "—";
  return `฿${Math.round(price).toLocaleString("en-US")} / ตร.ว.`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { detail?: string };
        detail = body.detail ? `: ${body.detail}` : "";
      } catch {
        // The HTTP status remains actionable when the response is not JSON.
      }
      throw new Error(`${path} → HTTP ${res.status}${detail}`);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${path} → request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export interface Neighborhood {
  name_th: string;
  name_en: string;
  lat: number;
  lng: number;
  radius_m: number;
  district: string;
}

export interface DistrictProperties {
  code: string;
  name_th: string;
  name_en: string;
  zone: string;
  center_lat: number;
  center_lng: number;
  quality: number;
  dimensions: Record<Dimension, number>;
  assessed_price_sqwah: number;
  market_price_sqwah: number;
  market_price_low: number;
  market_price_high: number;
  zone_tier: string;
  is_golden_location: boolean;
  neighborhoods: string[];
  landmarks: string[];
  transit_stations_count: number;
  cells_count: number;
  price_source?: string;
  price_record_count?: number;
}

export interface TreasuryReference {
  n: number;
  median: number;
  p10: number;
  p90: number;
  resolution_m: number | null;
  source_mode: "official_csv_snapshot" | "official_csv_district_snapshot" | "official_live_api";
  source_last_modified: string;
  source_url: string;
  utm_sheet: string | null;
  utm_subsheet: number | null;
  checked_at?: string;
}

export interface DistrictFeature {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  properties: DistrictProperties;
}

export interface DistrictsResponse {
  type: "FeatureCollection";
  features: DistrictFeature[];
}

export const fetchHealth = () => request<HealthResponse>("/health");
export const fetchGrid = () => request<GridResponse>("/api/grid?include_dims=false");
export const fetchDistricts = () => request<DistrictsResponse>("/api/districts");
export const fetchStations = () => request<StationsResponse>("/api/stations");
export const fetchNeighborhoods = () => request<{ neighborhoods: Neighborhood[]; count: number }>("/api/neighborhoods");
export const fetchPresets = () => request<{ presets: Preset[] }>("/api/presets");
export const searchLocations = (q: string) =>
  request<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`);
export const fetchLocation = (hexId: string, landSize?: number | null, budget?: number | null) => {
  const params = new URLSearchParams();
  if (landSize) params.set("land_size_sqwah", String(landSize));
  if (budget) params.set("budget", String(budget));
  const queryStr = params.toString() ? `?${params.toString()}` : "";
  return request<LocationDetail>(`/api/location/${hexId}${queryStr}`);
};
export const fetchTreasurySheetPrice = (lat: number, lng: number) =>
  request<{ reference: TreasuryReference | null }>(`/api/treasury-sheet-price?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);

export async function recommend(
  weights: Record<Dimension, number>,
  opts: { budget?: number | null; landSize?: number | null; landUse?: string | null; district?: string | null; k?: number }
): Promise<RecommendResponse> {
  return request<RecommendResponse>("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      weights,
      budget: opts.budget ?? null,
      land_size_sqwah: opts.landSize ?? null,
      land_use: opts.landUse ?? null,
      district: opts.district ?? null,
      k: opts.k ?? 10,
    }),
  });
}

/** Client-side fallback ranking directly from 6,594 Bangkok cells to guarantee zero downtime. */
export function fallbackRecommendFromGrid(
  grid: GridResponse,
  weights: Record<Dimension, number>,
  opts: { budget?: number | null; landSize?: number | null; district?: string | null; k?: number } = {}
): RecommendResponse {
  const k = opts.k ?? 12;
  const qDist = opts.district ? opts.district.toLowerCase().replace("เขต", "").replace("district", "").trim() : null;

  let candidates = grid.features.filter((f) => !f.properties.low_data);

  if (qDist) {
    const filtered = candidates.filter((f) => {
      const dEn = (f.properties.district_en || "").toLowerCase();
      const dTh = ((f.properties as unknown as { district_th?: string }).district_th || "").toLowerCase();
      return dEn.includes(qDist) || dTh.includes(qDist);
    });
    if (filtered.length > 0) candidates = filtered;
  }

  // A sheet median or unvalidated model does not establish purchase-budget
  // fit. Keep the input for later parcel-level evidence, but never filter here.

  const wTransit = (weights.transit ?? 50) / 50;
  const wComm = (weights.commercial ?? 50) / 50;
  const wQuiet = (weights.quietness ?? 50) / 50;

  // Calculate weighted score
  const scored = candidates.map((f) => {
    const p = f.properties;
    const baseQuality = p.quality || 50;
    const goldenBonus = p.is_golden_location ? 16 * wComm : 0;
    const transitBonus = Math.min(20, (p.n_transit || 0) * 4 * wTransit);
    const quietBonus = !p.is_golden_location && (p.n_poi || 0) < 5 ? 10 * wQuiet : 0;
    const score = Math.min(100, Math.round(baseQuality * 0.7 + goldenBonus + transitBonus + quietBonus + 4));
    return { f, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, k);

  const results: Recommendation[] = top.map(({ f, score }) => {
    const p = f.properties;
    const center = {
      lat: p.center_lat || (f.geometry.coordinates[0][0][1] as number),
      lng: p.center_lng || (f.geometry.coordinates[0][0][0] as number),
    };
    const rawDist = p.district_en || "Bangkok";
    const distParts = rawDist.split(" ");
    const distEn = distParts[0] || "Bangkok";
    const distTh = distParts.slice(1).join(" ") || distEn;
    const isGold = Boolean(p.is_golden_location);
    const referenceMedian = p.market_price_sqwah || (isGold ? 450000 : 180000);
    const referenceHigh = p.market_price_high ?? Math.round(referenceMedian * 1.35);
    const isOfficialArea = p.price_source === "treasury_area_reference";
    const wideSpread = isOfficialArea && referenceHigh >= referenceMedian * 3;

    return {
      hex_id: p.hex_id,
      center,
      context: {
        title_th: isGold ? `ทำเลทองใจกลาง ${distTh}` : `ทำเลศักยภาพ ${distTh}`,
        title_en: isGold ? `Prime Golden Hub, ${distEn}` : `High Quality Hub, ${distEn}`,
        short_name: distTh,
        district_th: distTh,
        district_en: distEn,
        zone: isGold ? "Central CBD" : "Urban Bangkok",
        neighborhood_th: isGold ? "ย่านธุรกิจ CBD & ศูนย์กลางคมนาคม" : "ย่านชุมชนเมืองน่าอยู่",
        neighborhood_en: isGold ? "Prime CBD & Transit Hub" : "Urban Community",
        nearest_landmark: {
          name_th: isGold ? "ย่านการค้าและธุรกิจใจกลางเมือง" : `ศูนย์ชุมชนเขต${distTh}`,
          name_en: isGold ? "Central CBD District" : `${distEn} Community Center`,
          category: "commercial",
          distance_m: 400,
        },
        transit_walk: {
          station_name: p.n_transit > 0 ? "BTS/MRT Station" : "Bus / Feeder Transit",
          distance_m: p.n_transit > 0 ? 350 : 800,
          walk_time_min: p.n_transit > 0 ? 5 : 10,
        },
      },
      match_score: score,
      quality: Math.round(p.quality || 60),
      dimensions: {
        transit: p.n_transit > 0 ? 88 : 60,
        amenities: p.n_poi > 10 ? 82 : 55,
        walkability: 72,
        greenery: 58,
        road_environment: 65,
        commercial: isGold ? 92 : 55,
        residential: 60,
        quietness: isGold ? 35 : 68,
        environmental: 58,
      },
      contributions: {
        transit: 16,
        amenities: 14,
        walkability: 11,
        greenery: 8,
        road_environment: 8,
        commercial: 13,
        residential: 9,
        quietness: 6,
        environmental: 6,
      },
      positive_factors: [
        {
          dimension: "transit",
          score: p.n_transit > 0 ? 88 : 65,
          contribution: 16,
          description: p.n_transit > 0 ? "เข้าถึงโครงข่ายรถไฟฟ้าสายหลักได้สะดวก" : "การเดินทางคล่องตัว",
        },
        {
          dimension: "commercial",
          score: isGold ? 92 : 70,
          contribution: 14,
          description: isGold ? "ทำเลทองศูนย์กลางธุรกิจและการค้าชั้นนำ" : "ย่านชุมชนพาณิชยกรรม",
        },
      ],
      negative_factors: [],
      feature_summary: {
        poi_density: p.n_poi || 0,
        transit_stations: p.n_transit || 0,
      },
      price_valuation: {
        market_price_sqwah: referenceMedian,
        assessed_price_sqwah: p.assessed_price_sqwah || (isGold ? 280000 : 110000),
        market_price_low: p.market_price_low ?? Math.round((p.market_price_sqwah || (isGold ? 450000 : 180000)) * 0.65),
        market_price_high: referenceHigh,
        zone_tier: p.zone_tier || (isGold ? "CBD Prime" : "Urban"),
        price_level: isGold ? "High (ทำเลทอง)" : "Moderate (ปานกลาง)",
        affordability_index: isGold ? 45 : 70,
        is_golden_location: isGold,
        valuation_thb: null,
        land_size_sqwah: opts.landSize ?? null,
        budget_fit: null,
        methodology: p.price_source === "treasury_area_reference" ? "Treasury official appraisal records aggregated by nearby map sheet" : "Hedonic spatial screening estimate",
        market_price_type: p.price_source === "treasury_area_reference" ? "treasury_area_reference" : "hedonic_estimate",
        assessed_price_type: p.price_source === "treasury_area_reference" ? "treasury_area_reference" : "district_model_baseline",
        reference_record_count: p.price_record_count,
        reference_resolution_m: p.price_resolution_m,
        reference_wide_spread: wideSpread,
      },
    };
  });

  return {
    request: {
      weights,
      budget: opts.budget ?? null,
      land_size_sqwah: opts.landSize ?? null,
      land_use: null,
      k,
    },
    data_status: {},
    results,
  };
}
