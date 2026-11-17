"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  AttributionControl,
  Popup,
  setWorkerUrl,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { API_BASE, type DistrictsResponse, type GridResponse, type Neighborhood, type RailRoute, type Station, type StationLine } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import { GREEN_SPACE_BOUNDS, GREEN_SPACE_COUNT, installGreenSpaces } from "@/lib/green-space-layer";
import {
  SparklesIcon,
  LandmarkIcon,
  MapPinIcon,
  LayersIcon,
  TrainIcon,
  BuildingOfficeIcon,
} from "@/components/icons";

// The 3D view extrudes OSM building footprints from the vector basemap.
// Other views keep a flat camera and use their own map styles.
export type BasemapId = "3d" | "osm" | "carto-light" | "carto-dark" | "satellite";

const BASEMAPS: Record<BasemapId, { labelTh: string; labelEn: string; tiles: string[]; attribution: string }> = {
  "3d": {
    labelTh: "อาคาร 3 มิติ",
    labelEn: "3D Buildings",
    tiles: [
      "https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png",
      "https://d.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png",
    ],
    attribution: "© OpenStreetMap contributors · CARTO",
  },
  osm: {
    labelTh: "แผนที่มาตรฐาน",
    labelEn: "Standard Map",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors",
  },
  "carto-light": {
    labelTh: "แผนที่สีอ่อน",
    labelEn: "Light Map",
    tiles: [
      "https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png",
      "https://d.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png",
    ],
    attribution: "© OpenStreetMap contributors · CARTO",
  },
  "carto-dark": {
    labelTh: "แผนที่สีเข้ม",
    labelEn: "Dark Map",
    tiles: [
      "https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
      "https://d.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
    ],
    attribution: "© OpenStreetMap contributors · CARTO",
  },
  satellite: {
    labelTh: "ภาพถ่ายดาวเทียม",
    labelEn: "Satellite Imagery",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    attribution: "Tiles © Esri — Esri, Maxar, Earthstar Geographics",
  },
};

const BANGKOK_SKYLINES = [
  { name_th: "อโศก - สุขุมวิท", name_en: "Asok / Sukhumvit", center: [100.56, 13.74] as [number, number], zoom: 16, pitch: 60, bearing: -25 },
  { name_th: "สีลม - มหานคร", name_en: "Silom / MahaNakhon", center: [100.5284, 13.7236] as [number, number], zoom: 16.2, pitch: 62, bearing: 35 },
  { name_th: "สยาม - เซ็นทรัลเวิลด์", name_en: "Siam / CentralWorld", center: [100.5393, 13.7466] as [number, number], zoom: 16, pitch: 58, bearing: -15 },
  { name_th: "พระราม 9 - G Tower", name_en: "Rama 9 / G Tower", center: [100.5658, 13.7578] as [number, number], zoom: 16, pitch: 60, bearing: 40 },
  { name_th: "ไอคอนสยาม ริมน้ำ", name_en: "ICONSIAM / Riverside", center: [100.5108, 13.7267] as [number, number], zoom: 16, pitch: 58, bearing: -60 },
];

const DEFAULT_BASEMAP: BasemapId = "carto-light";
const BANGKOK_CAMERA = {
  center: [100.5018, 13.7563] as [number, number],
  zoom: 11.5,
  pitch: 0,
  bearing: 0,
};
const THREE_D_CAMERA = {
  center: [100.56, 13.74] as [number, number],
  zoom: 15.8,
  pitch: 58,
  bearing: -24,
};

function rasterStyle(id: BasemapId): StyleSpecification | string {
  if (id === "3d" || id === "carto-light") return "https://tiles.openfreemap.org/styles/positron";
  if (id === "carto-dark") return "https://tiles.openfreemap.org/styles/dark";
  const base = BASEMAPS[id];
  const tiles = base.tiles.length > 0 ? base.tiles : BASEMAPS["carto-light"].tiles;
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles,
        tileSize: 256,
        maxzoom: id === "osm" ? 19 : 20,
        attribution: base.attribution,
      },
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  };
}

type BuildingStatus =
  | { state: "idle"; count: 0 }
  | { state: "loading"; count: 0 }
  | { state: "ready"; count: number; source: "api" | "static" }
  | { state: "error"; count: 0 };

/** Extrude the actual OSM building outlines and building parts in vector tiles. */
function install3dBuildings(
  map: MapLibreMap,
  isCurrentStyle: () => boolean,
  onStatus: (status: BuildingStatus) => void
) {
  if (!isCurrentStyle()) return;
  onStatus({ state: "loading", count: 0 });
  try {
    if (!map.getSource("openmaptiles")) throw new Error("Building tiles unavailable");
    map.setLight({ anchor: "viewport", color: "#fff4df", intensity: 0.45, position: [1.5, 210, 35] });
    if (!map.getLayer("bkk-3d-buildings")) {
      const labels = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
      map.addLayer({
        id: "bkk-3d-buildings",
        source: "openmaptiles",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 13,
        paint: {
          "fill-extrusion-color": ["interpolate", ["linear"],
            ["coalesce", ["get", "render_height"], 3],
            0, "#e8e2d6", 30, "#d5cec1", 100, "#babbb5", 250, "#a2aaa9"],
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 3],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": true,
        },
      }, labels);
    }
    const update = () => {
      if (!isCurrentStyle()) { map.off("sourcedata", update); return; }
      if (map.isSourceLoaded("openmaptiles")) {
        onStatus({ state: "ready", count: 0, source: "api" });
        map.off("sourcedata", update);
      }
    };
    map.on("sourcedata", update);
    update();
  } catch (error) {
    console.warn("[maplibre] 3D buildings unavailable", error);
    onStatus({ state: "error", count: 0 });
  }
}

// Stations with no OSM line relation (e.g. SRT intercity stations).
const NO_LINE_COLOR = "#64748b";

// Lines hidden from the legend/toggles — the map focuses on the metro network
// (BTS/MRT/ARL/Gold). Stations on these lines fall back to the neutral dot.
const EXCLUDED_LINE_REFS = new Set(["SRT Dark Red Line", "SRT Light Red Line"]);

// Sequential green quality ramp (matches the UI legend).
const QUALITY_STOPS: [number, string][] = [
  [0, "#e5e7eb"],
  [20, "#a7f3d0"],
  [35, "#6ee7b7"],
  [50, "#34d399"],
  [65, "#10b981"],
  [80, "#047857"],
];

function qualityColor(q: number): string {
  let color = QUALITY_STOPS[0][1];
  for (const [stop, c] of QUALITY_STOPS) {
    if (q >= stop) color = c;
  }
  return color;
}

function pointInRing(x: number, y: number, pts: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    const hit = (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function pointInsideBuilding(ring: number[][], fallback: { lng: number; lat: number }) {
  if (ring.length < 3) return fallback;
  // The arithmetic mean can fall outside a concave footprint. Try the bounding
  // box centre, then find an interior point on its horizontal scan line.
  const lngs = ring.map((point) => point[0]);
  const lats = ring.map((point) => point[1]);
  const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const vertices = ring.map((point) => ({ x: point[0], y: point[1] }));
  if (pointInRing(lng, lat, vertices)) return { lng, lat };
  const crossings: number[] = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j];
    const [x2, y2] = ring[i];
    if ((y1 > lat) !== (y2 > lat)) crossings.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
  }
  crossings.sort((a, b) => a - b);
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const candidate = (crossings[i] + crossings[i + 1]) / 2;
    if (pointInRing(candidate, lat, vertices)) return { lng: candidate, lat };
  }
  return fallback;
}

interface Props {
  grid: GridResponse | null;
  districts?: DistrictsResponse | null;
  selectedDistrict?: string | null;
  stations: Station[];
  stationLines: StationLine[];
  routes: RailRoute[];
  neighborhoods?: Neighborhood[];
  selectedHexId: string | null;
  highlight: { lng: number; lat: number } | null;
  onSelect: (hexId: string) => void;
  onBuildingSelect?: (building: { lat: number; lng: number; name: string | null } | null) => void;
  goldenOnly?: boolean;
  onToggleGoldenOnly?: (val: boolean) => void;
}

export default function MapView({
  grid,
  districts = null,
  selectedDistrict = null,
  stations,
  stationLines,
  routes,
  neighborhoods = [],
  selectedHexId,
  highlight,
  onSelect,
  onBuildingSelect,
  goldenOnly: externalGoldenOnly,
  onToggleGoldenOnly,
}: Props) {
  const { isTh } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const gridRef = useRef(grid);
  const districtsRef = useRef(districts);
  const selectedDistrictRef = useRef(selectedDistrict);
  const stationsRef = useRef(stations);
  const routesRef = useRef(routes);
  const neighborhoodsRef = useRef(neighborhoods);
  const selectedRef = useRef(selectedHexId);
  const onSelectRef = useRef(onSelect);
  const onBuildingSelectRef = useRef(onBuildingSelect);
  const basemapAppliedRef = useRef<BasemapId>(DEFAULT_BASEMAP);
  const currentLoadedStyleRef = useRef<BasemapId>(DEFAULT_BASEMAP);
  const basemapRef = useRef<BasemapId>(DEFAULT_BASEMAP);
  const last2dCameraRef = useRef({ center: BANGKOK_CAMERA.center, zoom: BANGKOK_CAMERA.zoom });
  const showHexesRef = useRef(false);
  const showDistrictsRef = useRef(false);
  const showStationsRef = useRef(false);
  const showGreenSpacesRef = useRef(false);
  const showNeighborhoodsRef = useRef(false);
  const hiddenLinesRef = useRef<Set<string>>(new Set());
  const goldenOnlyRef = useRef(false);
  const [basemap, setBasemap] = useState<BasemapId>(DEFAULT_BASEMAP);
  const [showHexes, setShowHexes] = useState(false);
  const [showDistricts, setShowDistricts] = useState(false);
  const [showStations, setShowStations] = useState(false);
  const [showGreenSpaces, setShowGreenSpaces] = useState(false);
  const [showNeighborhoods, setShowNeighborhoods] = useState(false);
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());
  const [internalGoldenOnly, setInternalGoldenOnly] = useState(false);
  const [buildingStatus, setBuildingStatus] = useState<BuildingStatus>({
    state: "idle",
    count: 0,
  });

  const goldenOnly = externalGoldenOnly !== undefined ? externalGoldenOnly : internalGoldenOnly;
  const setGoldenOnly = useCallback((val: boolean) => {
    setInternalGoldenOnly(val);
    onToggleGoldenOnly?.(val);
  }, [onToggleGoldenOnly]);

  // Metro network only: drop the excluded (SRT) lines from both the legend
  // list, the stations' memberships, and the route polylines so those
  // stations/lines render neutral gray.
  const metroLines = useMemo(
    () => stationLines.filter((line) => !EXCLUDED_LINE_REFS.has(line.ref)),
    [stationLines]
  );
  const metroStations = useMemo(() => stations.map((s) => ({
    ...s,
    lines: s.lines.filter((l) => !EXCLUDED_LINE_REFS.has(l.ref)),
  })), [stations]);
  const metroRoutes = useMemo(
    () => routes.filter((route) => !EXCLUDED_LINE_REFS.has(route.ref)),
    [routes]
  );

  useEffect(() => {
    goldenOnlyRef.current = goldenOnly;
    gridRef.current = grid;
    districtsRef.current = districts;
    selectedDistrictRef.current = selectedDistrict;
    neighborhoodsRef.current = neighborhoods;
    showNeighborhoodsRef.current = showNeighborhoods;
    showDistrictsRef.current = showDistricts;
    stationsRef.current = metroStations;
    routesRef.current = metroRoutes;
    selectedRef.current = selectedHexId;
    onSelectRef.current = onSelect;
    onBuildingSelectRef.current = onBuildingSelect;
    showHexesRef.current = showHexes;
    showStationsRef.current = showStations;
    showGreenSpacesRef.current = showGreenSpaces;
    hiddenLinesRef.current = hiddenLines;
  }, [
    districts,
    goldenOnly,
    grid,
    hiddenLines,
    metroRoutes,
    metroStations,
    neighborhoods,
    onSelect,
    onBuildingSelect,
    selectedDistrict,
    selectedHexId,
    showDistricts,
    showHexes,
    showNeighborhoods,
    showStations,
    showGreenSpaces,
  ]);

  // Draw the hex overlay on the 2D canvas (no MapLibre vector rendering).
  const drawOverlay = useCallback(() => {
    const map = mapRef.current;
    const canvas = overlayRef.current;
    const container = containerRef.current;
    if (!map || !canvas || !container) return;
    // Reconcile the MapLibre canvas with its container (it can stay stuck at
    // its initial size if the layout reflows after mount).
    if (Math.abs(map.getCanvas().clientHeight - container.clientHeight) > 1 ||
        Math.abs(map.getCanvas().clientWidth - container.clientWidth) > 1) {
      map.resize();
    }
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const data = gridRef.current;
    if (!data) return;
    const bounds = map.getBounds();
    const margin = 50;
    const showAll = showHexesRef.current;
    const is3dMode = basemapAppliedRef.current === "3d";

    for (const f of data.features) {
      const props = f.properties;
      const isSel = props.hex_id === selectedRef.current;
      // Keep the analysis grid interactive, but never paint hexes over 3D buildings.
      if (is3dMode || (!showAll && !isSel)) continue;
      // The map payload includes cell centres specifically for this fast
      // viewport reject. It avoids recomputing/projecting all 15k polygons on
      // every animation frame at street-level zoom.
      if (typeof props.center_lng === "number" && typeof props.center_lat === "number") {
        const padding = 0.01;
        if (props.center_lng < bounds.getWest() - padding ||
            props.center_lng > bounds.getEast() + padding ||
            props.center_lat < bounds.getSouth() - padding ||
            props.center_lat > bounds.getNorth() + padding) continue;
      }
      const ring = f.geometry.coordinates[0] as [number, number][];
      if (ring.length < 3) continue;
      // crude lat/lng bbox reject against current view
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      if (maxLng < bounds.getWest() || minLng > bounds.getEast() ||
          maxLat < bounds.getSouth() || minLat > bounds.getNorth()) continue;

      const pts = ring.map(([lng, lat]) => map.project([lng, lat]));
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      if (maxX < -margin || minX > w + margin || maxY < -margin || minY > h + margin) continue;

      const isGolden = Boolean(props.is_golden_location);

      if (goldenOnlyRef.current) {
        if (!isGolden && !isSel) continue;
      }

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();

      if (goldenOnlyRef.current) {
        ctx.fillStyle = isGolden ? "#D97706" : qualityColor(typeof props.quality === "number" ? props.quality : 0);
        ctx.globalAlpha = isGolden ? (is3dMode ? 0.34 : 0.78) : (is3dMode ? 0.12 : 0.40);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = isSel ? "#09090b" : isGolden ? "#78350F" : (is3dMode ? "rgba(203, 213, 225, 0.25)" : "#cbd5e1");
        ctx.lineWidth = isSel ? 2.5 : isGolden ? 1.5 : 0.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = qualityColor(typeof props.quality === "number" ? props.quality : 0);
        ctx.globalAlpha = isSel ? 0.38 : props.low_data ? (is3dMode ? 0.025 : 0.16) : (is3dMode ? 0.055 : 0.68);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = isSel ? "#09090b" : (is3dMode ? "rgba(148, 163, 184, 0.18)" : "#94a3b8");
        ctx.lineWidth = isSel ? 2.5 : 0.5;
        ctx.stroke();
      }
    }

    // --- Route polylines (BTS/MRT/ARL), coloured per line, in the order the
    // stations appear in the OSM route relation ---------------------------
    if (showStationsRef.current && !is3dMode) {
      const routes = routesRef.current;
      const hidden = hiddenLinesRef.current;
      const bounds = map.getBounds();
      const lw = Math.max(2.5, Math.min(4.5, map.getZoom() * 0.4));
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const r of routes) {
        if (hidden.has(r.ref) || !r.colour || r.stops.length < 2) continue;
        // bbox reject against current view
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        for (const s of r.stops) {
          if (s.lng < minLng) minLng = s.lng;
          if (s.lng > maxLng) maxLng = s.lng;
          if (s.lat < minLat) minLat = s.lat;
          if (s.lat > maxLat) maxLat = s.lat;
        }
        if (maxLng < bounds.getWest() || minLng > bounds.getEast() ||
            maxLat < bounds.getSouth() || minLat > bounds.getNorth()) continue;
        const pts = r.stops.map((s) => map.project([s.lng, s.lat]));
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        // white casing so the line reads over hexes/basemap, then the colour
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = lw + 2.5;
        ctx.stroke();
        ctx.strokeStyle = r.colour;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    }

    // --- Stations (BTS/MRT/ARL/SRT) colored by real line -----------------
    if (showStationsRef.current) {
      const stations = stationsRef.current;
      const hidden = hiddenLinesRef.current;
      const zoom = map.getZoom();
      const showLabels = zoom >= 10;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (const s of stations) {
        // Skip stations with no metro line (regular/SRT rail) — not part of
        // the BTS/MRT/ARL network this map shows.
        if (s.lines.length === 0) continue;
        // visible lines = line memberships minus unchecked lines
        const visible = s.lines.filter((l) => !hidden.has(l.ref));
        if (visible.length === 0) continue;
        const color = visible[0].colour ?? NO_LINE_COLOR;
        const secondary = visible.length > 1 ? visible[1].colour : null;
        const p = map.project([s.lng, s.lat]);
        if (p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40) continue;
        // white halo + line-colored dot (interchange: inner dot in 2nd line)
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (secondary) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.9, 0, Math.PI * 2);
          ctx.fillStyle = secondary;
          ctx.fill();
        }
        if (!showLabels) continue;
        const labelX = p.x + 8, labelY = p.y - 1;
        ctx.font = "600 11px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.fillText(s.name, labelX, labelY);
        if (s.name_en) {
          ctx.font = "500 9px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = "rgba(71, 85, 105, 0.85)";
          ctx.fillText(s.name_en, labelX, labelY + 12);
        }
      }
    }

    // --- Neighborhood Labels (ชื่อย่านทำเล Bangkok Hubs) ------------------
    if (showNeighborhoodsRef.current) {
      const neighborhoods = neighborhoodsRef.current;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const nb of neighborhoods) {
        const p = map.project([nb.lng, nb.lat]);
        if (p.x < -100 || p.x > w + 100 || p.y < -50 || p.y > h + 50) continue;

        const title = nb.name_th.split(" (")[0].split(" - ")[0];
        const sub = nb.name_en.split(" (")[0].split(" - ")[0];

        // Measure text size
        ctx.font = "bold 10.5px system-ui, -apple-system, sans-serif";
        const wTitle = ctx.measureText(title).width;
        ctx.font = "500 8.5px system-ui, -apple-system, sans-serif";
        const wSub = ctx.measureText(sub).width;
        const boxW = Math.max(wTitle, wSub) + 24;
        const boxH = 26;
        const boxX = p.x - boxW / 2;
        const boxY = p.y - boxH / 2;

        // Pin badge shadow and background
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 13);
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1;
        ctx.fill();
        ctx.shadowColor = "transparent";

        // Pin badge border
        ctx.strokeStyle = "rgba(15, 23, 42, 0.18)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Pin dot / icon accent on the left
        ctx.beginPath();
        ctx.arc(boxX + 9, p.y, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = "#10b981";
        ctx.fill();

        // Thai Title
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 10.5px system-ui, -apple-system, sans-serif";
        ctx.fillText(title, p.x + 4, p.y - 4);

        // English Subtitle
        ctx.fillStyle = "#64748b";
        ctx.font = "500 8.5px system-ui, -apple-system, sans-serif";
        ctx.fillText(sub, p.x + 4, p.y + 6.5);
      }
    }

    // --- Bangkok 50 Administrative District Boundaries -----------------
    if (showDistrictsRef.current && districtsRef.current && !is3dMode) {
      const dists = districtsRef.current.features;
      const selDist = selectedDistrictRef.current;
      const zoom = map.getZoom();

      for (const dist of dists) {
        const isDistSel = Boolean(
          selDist && (
            dist.properties.name_en.toLowerCase() === selDist.toLowerCase() ||
            dist.properties.name_th === selDist ||
            dist.properties.code === selDist
          )
        );

        const geomType = dist.geometry.type;
        const polyRings = geomType === "Polygon"
          ? [dist.geometry.coordinates as number[][][]]
          : (dist.geometry.coordinates as number[][][][]);

        for (const poly of polyRings) {
          const outerRing = poly[0];
          if (!outerRing || outerRing.length < 3) continue;

          const pts = outerRing.map(([lng, lat]) => map.project([lng, lat]));

          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();

          if (isDistSel) {
            ctx.fillStyle = "rgba(99, 102, 241, 0.10)";
            ctx.fill();
            ctx.strokeStyle = "#4f46e5";
            ctx.lineWidth = 2.8;
            ctx.stroke();
          } else {
            ctx.strokeStyle = "rgba(99, 102, 241, 0.42)";
            ctx.lineWidth = 1.3;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // District Center Badge Label (only when zoomed or selected)
        if (zoom >= 10.2 || isDistSel) {
          const p = map.project([dist.properties.center_lng, dist.properties.center_lat]);
          if (p.x < -80 || p.x > w + 80 || p.y < -40 || p.y > h + 40) continue;

          const dName = `เขต${dist.properties.name_th}`;
          const dSub = dist.properties.name_en;

          ctx.font = "bold 10.5px system-ui, -apple-system, sans-serif";
          const wDName = ctx.measureText(dName).width;
          ctx.font = "500 8px system-ui, -apple-system, sans-serif";
          const wDSub = ctx.measureText(dSub).width;
          const boxW = Math.max(wDName, wDSub) + 18;
          const boxH = 24;
          const boxX = p.x - boxW / 2;
          const boxY = p.y - boxH / 2;

          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 6);
          ctx.fillStyle = isDistSel ? "#4f46e5" : "rgba(248, 250, 252, 0.94)";
          ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
          ctx.shadowBlur = 3;
          ctx.shadowOffsetY = 1;
          ctx.fill();
          ctx.shadowColor = "transparent";

          ctx.strokeStyle = isDistSel ? "#3730a3" : "rgba(99, 102, 241, 0.30)";
          ctx.lineWidth = isDistSel ? 1.5 : 1;
          ctx.stroke();

          ctx.fillStyle = isDistSel ? "#ffffff" : "#1e1b4b";
          ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(dName, p.x, p.y - 3.5);

          ctx.fillStyle = isDistSel ? "#c7d2fe" : "#6366f1";
          ctx.font = "600 8px system-ui, -apple-system, sans-serif";
          ctx.fillText(dSub, p.x, p.y + 6.5);
        }
      }
    }
  }, []);

  // Style changes remove the custom building extrusion, so reinstall it
  // when entering 3D and restore the previous flat view when leaving.
  const applyBasemap = useCallback((id: BasemapId, previousId: BasemapId) => {
    const map = mapRef.current;
    if (!map) return;

    if (id === "3d") {
      last2dCameraRef.current = {
        center: map.getCenter().toArray() as [number, number],
        zoom: map.getZoom(),
      };
      const setup3d = () => {
        void install3dBuildings(
          map,
          () => basemapRef.current === "3d",
          setBuildingStatus
        );
        map.easeTo({ ...THREE_D_CAMERA,
          ...(showGreenSpacesRef.current ? last2dCameraRef.current : {}), duration: 900 });
        drawOverlay();
      };

      // If already on carto-light base style and map is loaded, install directly right now!
      if (currentLoadedStyleRef.current === "carto-light" && map.isStyleLoaded()) {
        setup3d();
      } else {
        currentLoadedStyleRef.current = "carto-light";
        map.once("style.load", setup3d);
        map.setStyle(rasterStyle("carto-light"), { diff: false });
      }
      return;
    }

    const flatCamera = previousId === "3d" ? last2dCameraRef.current : null;

    // Resetting to 2D Carto Light
    if (id === "carto-light") {
      setBuildingStatus({ state: "idle", count: 0 });
      if (map.getLayer("bkk-3d-buildings")) map.removeLayer("bkk-3d-buildings");
      if (map.getSource("bkk-real-buildings")) map.removeSource("bkk-real-buildings");

      if (currentLoadedStyleRef.current === "carto-light" && map.isStyleLoaded()) {
        map.easeTo({ ...flatCamera, pitch: 0, bearing: 0, duration: 600 });
        drawOverlay();
      } else {
        currentLoadedStyleRef.current = "carto-light";
        map.jumpTo({ ...flatCamera, pitch: 0, bearing: 0 });
        map.once("style.load", () => {
          map.jumpTo({ ...flatCamera, pitch: 0, bearing: 0 });
          drawOverlay();
        });
        map.setStyle(rasterStyle("carto-light"), { diff: false });
      }
      return;
    }

    // Other 2D styles (osm, carto-dark, satellite)
    setBuildingStatus({ state: "idle", count: 0 });
    if (map.getLayer("bkk-3d-buildings")) map.removeLayer("bkk-3d-buildings");
    if (map.getSource("bkk-real-buildings")) map.removeSource("bkk-real-buildings");

    currentLoadedStyleRef.current = id;
    map.jumpTo({ ...flatCamera, pitch: 0, bearing: 0 });
    map.once("style.load", () => {
      map.jumpTo({ ...flatCamera, pitch: 0, bearing: 0 });
      drawOverlay();
    });
    map.setStyle(rasterStyle(id), { diff: false });
  }, [drawOverlay]);

  useEffect(() => {
    basemapRef.current = basemap;
    if (basemap === basemapAppliedRef.current) return;
    const previousId = basemapAppliedRef.current;
    basemapAppliedRef.current = basemap;
    applyBasemap(basemap, previousId);
  }, [basemap, applyBasemap]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Bundling v6 rewrites import.meta.url, so its implicit worker URL points
    // at the page instead of JavaScript. Serve the matching worker explicitly.
    setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
    const map = new MapLibreMap({
      container: containerRef.current,
      style: rasterStyle("carto-light"),
      ...BANGKOK_CAMERA,
      maxPitch: 75,
      attributionControl: false,
      canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true },
    });
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new NavigationControl({ showCompass: true }), "bottom-right");
    map.on("error", (e) => console.error("[maplibre]", e.error));
    map.once("load", () => map.jumpTo(BANGKOK_CAMERA));

    // Redraw overlay on any camera change (throttled via rAF).
    let raf = 0;
    const scheduleDraw = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; drawOverlay(); });
    };
    map.on("move", scheduleDraw);
    map.on("moveend", scheduleDraw);
    map.on("zoom", scheduleDraw);
    map.on("load", scheduleDraw);
    map.on("style.load", scheduleDraw);

    // Building interactive click popup
    const popup = new Popup({ offset: 12, closeButton: true, maxWidth: "280px" });
    let nameRequest: AbortController | null = null;
    const handleBuildingClick = (e: MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;
      const feat = e.features[0];
      const props = feat.properties || {};
      nameRequest?.abort();
      const request = new AbortController();
      nameRequest = request;
      const rawName = typeof props.name === "string" ? props.name.trim() : "";
      const name = rawName && !/^(bangkok building|building|อาคาร)$/i.test(rawName) ? rawName : null;
      const height = props.height_m
        ? Math.round(Number(props.height_m))
        : (props.render_height ? Math.round(Number(props.render_height)) : null);
      const bType = props.type || (props.class ? String(props.class) : "Building");
      const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));

      const renderPopup = (
        resolvedName: string | null,
        note: string,
        nearbyPlaces: { name: string; distance_m: number }[] = [],
      ) => popup.setHTML(`
          <div style="font-family: system-ui, sans-serif; padding: 4px;">
            <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 3px;">🏢 ${resolvedName ? escapeHtml(resolvedName) : "ไม่พบชื่ออาคารใน OSM"}</div>
            ${height ? `<div style="font-size: 11px; color: #57534e; font-weight: 600;">ความสูงที่ใช้แสดงผล: ${height} เมตร</div>` : ""}
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">ประเภท: ${escapeHtml(bType)}</div>
            ${!resolvedName && nearbyPlaces.length ? `<div style="font-size: 10px; color: #475569; margin-top: 6px;">สถานที่ใกล้เคียง (ไม่ใช่ชื่ออาคาร):<br>${nearbyPlaces.map((place) => `${escapeHtml(place.name)} · ${Math.round(place.distance_m)} ม.`).join("<br>")}</div>` : ""}
            <div style="font-size: 10px; color: #78716c; margin-top: 6px;">${escapeHtml(note)} · ความสูงอาจเป็นค่าประมาณ</div>
          </div>
        `);
      popup.setLngLat(e.lngLat).addTo(map);
      const ring = feat.geometry?.type === "Polygon"
        ? feat.geometry.coordinates[0]
        : feat.geometry?.type === "MultiPolygon" ? feat.geometry.coordinates[0]?.[0] : null;
      const { lng, lat } = ring?.length
        ? pointInsideBuilding(ring, e.lngLat)
        : { lng: e.lngLat.lng, lat: e.lngLat.lat };
      // A building click must select its analysis cell as well as open a popup.
      // The generic map click deliberately skips buildings, so dispatch here.
      const cell = gridRef.current?.features.find((feature) =>
        pointInRing(lng, lat, feature.geometry.coordinates[0].map(([x, y]) => ({ x, y }))));
      if (cell) onSelectRef.current(cell.properties.hex_id);
      onBuildingSelectRef.current?.({ lat, lng, name });
      if (name) {
        renderPopup(name, "ชื่อจากชั้นอาคาร OSM");
        return;
      }
      renderPopup("กำลังค้นชื่ออาคาร…", "กำลังตรวจข้อมูล OSM");
      fetch(`${API_BASE}/api/building-name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, footprint: ring ? { type: "Polygon", coordinates: [ring] } : null }),
        signal: request.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json() as Promise<{ name: string | null; status: string; nearby_places?: { name: string; distance_m: number }[] }>;
        })
        .then((result) => {
          if (request.signal.aborted) return;
          onBuildingSelectRef.current?.({ lat, lng, name: result.name });
          renderPopup(result.name, result.status === "matched_poi"
            ? "ชื่อสถานที่ OSM ภายในรูปอาคารที่เลือก"
            : result.status === "matched" ? "ชื่อจากรูปอาคาร OSM"
            : result.status === "unavailable" ? "บริการค้นชื่อไม่พร้อมใช้งาน" : "OSM ยังไม่ระบุชื่ออาคารนี้", result.nearby_places);
        })
        .catch(() => {
          if (!request.signal.aborted) renderPopup(null, "ตรวจชื่ออาคารไม่ได้ในขณะนี้");
        });
    };

    map.on("click", "bkk-3d-buildings", handleBuildingClick);
    map.on("mouseenter", "bkk-3d-buildings", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "bkk-3d-buildings", () => { map.getCanvas().style.cursor = ""; });

    // Click → hit-test hexes in screen space.
    map.on("click", (e) => {
      if (map.getLayer("bkk-3d-buildings")) {
        const bldgs = map.queryRenderedFeatures(e.point, { layers: ["bkk-3d-buildings"] });
        if (bldgs && bldgs.length > 0) return; // handled by building click
      }
      const data = gridRef.current;
      if (!data) return;
      const x = e.point.x, y = e.point.y;
      for (const f of data.features) {
        const ring = f.geometry.coordinates[0] as [number, number][];
        const pts = ring.map(([lng, lat]) => map.project([lng, lat]));
        if (pointInRing(x, y, pts)) {
          onBuildingSelectRef.current?.(null);
          onSelectRef.current(f.properties.hex_id);
          return;
        }
      }
    });

    mapRef.current = map;
    // Expose for debugging/verification from the Preview tools.
    (window as unknown as { __bkkMap: MapLibreMap }).__bkkMap = map;
    scheduleDraw();

    const ro = new ResizeObserver(() => {
      map.resize();
      scheduleDraw();
    });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      nameRequest?.abort();
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
    };
  }, [drawOverlay]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showGreenSpaces) return;
    return installGreenSpaces(map, isTh);
  }, [showGreenSpaces, isTh]);

  // Redraw when data, selection, or layer visibility changes.
  useEffect(() => {
    drawOverlay();
  }, [
    drawOverlay,
    grid,
    districts,
    selectedDistrict,
    metroStations,
    metroRoutes,
    neighborhoods,
    selectedHexId,
    showHexes,
    showDistricts,
    showStations,
    showNeighborhoods,
    hiddenLines,
    goldenOnly,
  ]);

  // Fly to a recommendation.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !highlight) return;
    const is3dMode = basemap === "3d";
    map.flyTo({
      center: [highlight.lng, highlight.lat],
      zoom: is3dMode ? 15.2 : 13.5,
      pitch: is3dMode ? THREE_D_CAMERA.pitch : 0,
      bearing: is3dMode ? THREE_D_CAMERA.bearing : 0,
      duration: 1200,
    });
  }, [basemap, highlight]);

  const is3dMode = basemap === "3d";

  return (
    <div className="relative h-full w-full">
      {/* Normal-flow sizing: maplibre-gl.css sets .maplibregl-map{position:relative},
          which overrides Tailwind's `absolute` utility — so absolute inset-0 collapses
          the container to 0px. h-full w-full cannot collapse. */}
      <div ref={containerRef} className="h-full w-full" />
      <canvas
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Floating Golden Mode Banner */}
      {goldenOnly && (
        <div className="absolute inset-x-3 bottom-16 z-20 mx-auto flex w-fit max-w-[calc(100%-24px)] items-center gap-2 rounded-full border border-[#ead7a7] bg-[#fffaf0]/95 px-3.5 py-2 text-xs font-medium text-[#655126] shadow-[0_8px_24px_rgba(51,56,36,0.12)] backdrop-blur-xl">
          <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span>โหมดทำเลทอง: แสดงเฉพาะพื้นที่ระดับ CBD &amp; Transit Hubs</span>
          <button
            type="button"
            onClick={() => setGoldenOnly(false)}
            className="ml-1 rounded-full bg-[#f4e8c8] px-2 py-1 text-[10px] font-semibold text-[#67542a] transition-colors hover:bg-[#ecdcae]"
          >
            ปิด ✕
          </button>
        </div>
      )}

      {/* Basemap style selector */}
      <div className="absolute right-3 top-3 z-20">
        <label className="flex max-w-[min(55vw,260px)] items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 py-2.5 shadow-[0_8px_25px_rgba(28,50,38,0.13)] backdrop-blur-xl">
          <span className="hidden shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[#617266] sm:inline">
            {isTh ? "มุมมอง" : "View"}
          </span>
          <select
            value={basemap}
            onChange={(e) => setBasemap(e.target.value as BasemapId)}
            aria-label={isTh ? "รูปแบบแผนที่" : "Map style"}
            className="w-[min(47vw,175px)] min-w-0 bg-transparent text-xs font-semibold text-[#2c4737] focus:outline-none sm:w-auto"
          >
            {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
              <option key={id} value={id}>
                {isTh ? BASEMAPS[id].labelTh : BASEMAPS[id].labelEn}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Legend + hex-overlay toggle */}
      <div className="absolute left-3 top-14 z-20 w-[min(300px,calc(100%-24px))] sm:top-3">
        <details className="group overflow-hidden rounded-[20px] border border-white/80 bg-white/90 shadow-[0_8px_25px_rgba(28,50,38,0.13)] backdrop-blur-xl">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-[#2c4737] [&::-webkit-details-marker]:hidden">
            <LayersIcon className="h-4 w-4" />
            <span>{isTh ? "ชั้นข้อมูลแผนที่" : "Map layers"}</span>
            <span aria-hidden="true" className="ml-auto text-[#849688] transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="flex max-h-[min(27dvh,230px)] flex-col gap-1.5 overflow-y-auto border-t border-[#e8eee6] p-2 sm:max-h-[min(64dvh,560px)]">
        {!is3dMode && (
        <button
          type="button"
          onClick={() => setGoldenOnly(!goldenOnly)}
          aria-pressed={goldenOnly}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
            goldenOnly
              ? "border-[#dfc682] bg-[#fbf3dd] text-[#6d5425]"
              : "border-[#dce7da] bg-white text-[#3e5546] hover:bg-[#f3f7f1]"
          }`}
        >
          <SparklesIcon className={`w-3.5 h-3.5 ${goldenOnly ? "text-amber-700" : "text-amber-500"}`} />
          <span>{goldenOnly ? (isTh ? "โหมดทำเลทอง (เปิดอยู่)" : "Golden Locations (Active)") : (isTh ? "แสดงเฉพาะทำเลทอง" : "Golden Locations Only")}</span>
        </button>
        )}

        {is3dMode && (
          <div className="rounded-xl border border-[#d4e3dc] bg-[#f1f7f2] px-3 py-3 text-[11px] leading-relaxed text-[#355545]">
            <div className="flex items-center gap-1.5 font-semibold">
              <BuildingOfficeIcon className="w-3.5 h-3.5 text-[#548465]" />
              <span>{isTh ? "อาคาร 3 มิติ" : "3D Buildings"}</span>
            </div>
            <div className="mt-1 text-[#5b7562]">
              {buildingStatus.state === "loading"
                ? (isTh ? "กำลังโหลดชั้นอาคาร…" : "Loading building layer…")
                : buildingStatus.state === "ready"
                  ? (isTh ? "คลิกอาคารเพื่อดูรายละเอียด · ความสูงบางส่วนเป็นค่าประมาณ" : "Click a building for details · some heights are estimated")
                  : buildingStatus.state === "error"
                    ? (isTh ? "โหลดอาคารไม่สำเร็จ กรุณาตรวจการเชื่อมต่อ" : "Building layer failed. Check your connection.")
                    : (isTh ? "กำลังเตรียมโหมด 3D…" : "Preparing 3D mode…")}
            </div>

            {/* Bangkok Skylines Quick Jump */}
            <div className="mt-3 flex flex-col gap-1.5 border-t border-[#dbe9dc] pt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#4b7052]">
                {isTh ? "จุดชมวิวสกายไลน์" : "Bangkok Skylines"}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {BANGKOK_SKYLINES.map((sky) => (
                  <button
                    key={sky.name_en}
                    type="button"
                    onClick={() => {
                      mapRef.current?.flyTo({
                        center: sky.center,
                        zoom: sky.zoom,
                        pitch: sky.pitch,
                        bearing: sky.bearing,
                        duration: 1400,
                      });
                    }}
                    className="truncate rounded-lg border border-[#d5e3d5] bg-white px-2.5 py-1.5 text-left text-[10px] font-medium text-[#355545] transition-colors hover:border-[#a8c6ac] hover:bg-[#fbfdf9]"
                    title={isTh ? sky.name_th : sky.name_en}
                  >
                    {isTh ? sky.name_th.split(" - ")[0] : sky.name_en.split(" / ")[0]}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => mapRef.current?.easeTo({ ...THREE_D_CAMERA, duration: 700 })}
              className="mt-2 w-full rounded-lg bg-[#315540] px-2 py-2 text-center font-semibold text-white transition-colors hover:bg-[#426b50]"
            >
              {isTh ? "กลับสู่มุมมอง 3D" : "Reset 3D View"}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowDistricts((v) => !v)}
          aria-pressed={showDistricts}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
            showDistricts
              ? "border-[#cbded1] bg-[#edf5ed] text-[#315540] hover:bg-[#e6f0e6] font-semibold"
              : "border-[#dce7da] bg-white text-[#3e5546] hover:bg-[#f3f7f1]"
          }`}
        >
          <LandmarkIcon className={`w-3.5 h-3.5 ${showDistricts ? "text-[#548465]" : "text-[#738679]"}`} />
          <span>{showDistricts ? (isTh ? "ซ่อนเส้นแบ่ง 50 เขต" : "Hide 50 Districts") : (isTh ? "แสดงเส้นแบ่ง 50 เขต" : "Show 50 Districts")}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowNeighborhoods((v) => !v)}
          aria-pressed={showNeighborhoods}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
            showNeighborhoods
              ? "border-[#cbded1] bg-[#edf5ed] text-[#315540] hover:bg-[#e6f0e6] font-semibold"
              : "border-[#dce7da] bg-white text-[#3e5546] hover:bg-[#f3f7f1]"
          }`}
        >
          <MapPinIcon className={`w-3.5 h-3.5 ${showNeighborhoods ? "text-[#548465]" : "text-[#738679]"}`} />
          <span>{showNeighborhoods ? (isTh ? "ซ่อนชื่อย่านทำเล" : "Hide Neighborhood Labels") : (isTh ? "แสดงชื่อย่านทำเล" : "Show Neighborhood Labels")}</span>
        </button>
        {!is3dMode && (
          <button
            type="button"
            onClick={() => setShowHexes((v) => !v)}
            aria-pressed={showHexes}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
              showHexes
                ? "border-[#cbded1] bg-[#edf5ed] font-semibold text-[#315540] hover:bg-[#e6f0e6]"
                : "border-[#dce7da] bg-white text-[#3e5546] hover:bg-[#f3f7f1]"
            }`}
          >
            <LayersIcon className={`w-3.5 h-3.5 ${showHexes ? "text-[#548465]" : "text-[#738679]"}`} />
            <span>{showHexes ? (isTh ? "ซ่อนตารางคะแนน Hex" : "Hide Hex Overlay") : (isTh ? "แสดงตารางคะแนน Hex" : "Show Hex Overlay")}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowStations((v) => !v)}
          aria-pressed={showStations}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
            showStations
              ? "border-[#cbded1] bg-[#edf5ed] text-[#315540] hover:bg-[#e6f0e6]"
              : "border-[#dce7da] bg-white text-[#3e5546] hover:bg-[#f3f7f1]"
          }`}
        >
          <TrainIcon className={`w-3.5 h-3.5 ${showStations ? "text-[#548465]" : "text-[#738679]"}`} />
          <span>{showStations ? (isTh ? "ซ่อนชื่อสถานีรถไฟฟ้า" : "Hide Station Labels") : (isTh ? "แสดงชื่อสถานีรถไฟฟ้า" : "Show Station Labels")}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowGreenSpaces((visible) => !visible)}
          aria-pressed={showGreenSpaces}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
            showGreenSpaces
              ? "border-[#b8d7c2] bg-[#eaf5ed] text-[#24573d] hover:bg-[#dfeee3]"
              : "border-[#dce7da] bg-white text-[#3e5546] hover:bg-[#f3f7f1]"
          }`}
        >
          <span aria-hidden="true">🌳</span>
          <span>{showGreenSpaces
            ? (isTh ? "ซ่อนพื้นที่สีเขียว" : "Hide green spaces")
            : (isTh ? "แสดงพื้นที่สีเขียว" : "Show green spaces")}</span>
          <span className="ml-auto text-[10px] opacity-70">{GREEN_SPACE_COUNT}</span>
        </button>
        {showGreenSpaces && <div className="px-2 text-[10px] leading-relaxed text-[#617569]">
          <button
            type="button"
            className="mb-1 rounded-md py-1 font-semibold text-[#24573d] underline underline-offset-2 focus-visible:outline-2"
            onClick={() => mapRef.current?.fitBounds(GREEN_SPACE_BOUNDS, { padding: 60, duration: 800, maxZoom: 12 })}
          >{isTh ? "ดูสวนทั้งหมดบนแผนที่" : "View all parks on map"}</button>
          <p>
          {isTh
            ? "สวนสำคัญทั่วกรุงเทพฯ · กดต้นไม้เพื่อดูรายละเอียด ซูมเข้าเพื่อดูชื่อเพิ่มเติม · © OpenStreetMap"
            : "Selected parks across Bangkok · Select a tree for details; zoom for more names · © OpenStreetMap"}
          </p>
        </div>}
        {!is3dMode && <details className="rounded-xl border border-[#dce7da] bg-white text-[11px]">
          <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2.5 font-medium text-[#3e5546] hover:bg-[#f3f7f1]">
            <span className="flex items-center gap-1">
              {QUALITY_STOPS.slice(0, -1).map((_, i) => (
                <span
                  key={i}
                  className="inline-block h-2.5 w-4 rounded-sm"
                  style={{ background: QUALITY_STOPS[i + 1][1] }}
                />
              ))}
            </span>
            {isTh ? "คุณภาพย่าน (0-100)" : "Neighborhood Quality (0-100)"}
          </summary>
          <div className="space-y-1 border-t border-zinc-100 px-3 py-2">
            <div className="flex items-center gap-1">
              {QUALITY_STOPS.slice(0, -1).map(([v], i) => (
                <div key={v} className="flex items-center gap-1">
                  <div
                    className="h-2.5 w-6 rounded-sm"
                    style={{ background: QUALITY_STOPS[i + 1][1] }}
                  />
                  <span className="text-zinc-600">{v}</span>
                  {i < QUALITY_STOPS.length - 2 && <span className="text-zinc-300">–</span>}
                </div>
              ))}
            </div>
            <div className="text-zinc-400">
              {isTh ? "เซลล์สีเทาจาง: ข้อมูลจำกัดจาก OSM" : "Faded cells: insufficient OSM data"}
            </div>
          </div>
        </details>}
        <details className="rounded-xl border border-[#dce7da] bg-white text-[11px]">
          <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2.5 font-medium text-[#3e5546] hover:bg-[#f3f7f1]">
            <span className="flex items-center gap-0.5">
              {metroLines.slice(0, 9).map((ln) => (
                <span
                  key={ln.ref}
                  className="inline-block h-2.5 w-2.5 rounded-full border border-black/10"
                  style={{ background: ln.colour ?? NO_LINE_COLOR }}
                />
              ))}
            </span>
            {isTh ? "เส้นทางรถไฟฟ้า" : "Rail lines"}
          </summary>
          <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-zinc-400">
              {hiddenLines.size === 0
                ? (isTh ? "แสดงทุกเส้น" : "all lines on")
                : hiddenLines.size === metroLines.length
                  ? (isTh ? "ซ่อนทุกเส้น" : "all lines off")
                  : `${metroLines.length - hiddenLines.size}/${metroLines.length} ${isTh ? "เส้นที่แสดง" : "on"}`}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setHiddenLines(new Set())}
                disabled={hiddenLines.size === 0}
                className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
              >
                {isTh ? "เลือกทั้งหมด" : "Select all"}
              </button>
              <button
                onClick={() => setHiddenLines(new Set(metroLines.map((l) => l.ref)))}
                disabled={hiddenLines.size === metroLines.length}
                className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
              >
                {isTh ? "ล้างทั้งหมด" : "Deselect all"}
              </button>
            </div>
          </div>
          <div className="max-h-52 space-y-1 overflow-y-auto border-t border-zinc-100 px-3 py-2 pr-2">
            {metroLines.map((ln) => {
              const checked = !hiddenLines.has(ln.ref);
              return (
                <label
                  key={ln.ref}
                  className="flex cursor-pointer items-center gap-2 text-zinc-700 hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setHiddenLines((prev) => {
                        const next = new Set(prev);
                        if (next.has(ln.ref)) next.delete(ln.ref);
                        else next.add(ln.ref);
                        return next;
                      })
                    }
                    className="h-3 w-3 accent-zinc-700"
                  />
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/10"
                    style={{ background: ln.colour ?? NO_LINE_COLOR }}
                  />
                  <span className="truncate">{ln.label.th}</span>
                </label>
              );
            })}
          </div>
        </details>
          </div>
        </details>
        {is3dMode && (
          <div role="status" className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-[#d4e3dc] bg-white/90 px-3 py-2 text-[11px] font-medium text-[#355545] shadow-sm backdrop-blur-xl">
            <BuildingOfficeIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{buildingStatus.state === "ready" ? (isTh ? "อาคาร 3D พร้อมแสดง" : "3D buildings ready") : buildingStatus.state === "error" ? (isTh ? "โหลดอาคารไม่สำเร็จ" : "3D buildings unavailable") : (isTh ? "กำลังโหลดอาคาร 3D" : "Loading 3D buildings")}</span>
          </div>
        )}
      </div>

    </div>
  );
}
