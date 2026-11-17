import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

type Tree = [number, number, number, number]; // lng, lat, canopy radius m, height m
type Park = { osmId: number };
type Polygon = number[][][];
const SOURCE = "illustrative-park-trees";
const LAYER = "illustrative-park-trees-3d";

function inside(p: number[], ring: number[][]) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}

/** Circle/polygon overlap checks the complete canopy, including polygon holes. */
function overlaps(tree: Tree, rings: Polygon) {
  if (inside(tree, rings[0]) && !rings.slice(1).some(r => inside(tree, r))) return true;
  const sx = 111320 * Math.cos(tree[1] * Math.PI / 180), sy = 111320;
  const radius2 = (tree[2] + 2) ** 2;
  for (const ring of rings) for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - tree[0]) * sx, ay = (ring[i][1] - tree[1]) * sy;
    const dx = (ring[i + 1][0] - ring[i][0]) * sx, dy = (ring[i + 1][1] - ring[i][1]) * sy;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    if ((ax + t * dx) ** 2 + (ay + t * dy) ** 2 <= radius2) return true;
  }
  return false;
}

function treeFeatures(trees: Tree[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  for (const tree of trees) {
    const [lng, lat, radius, height] = tree;
    // Trunk and four crown bands form a rounded, low-poly 3D tree.
    const bands = [
      [0.24, 0, height * .48, "#79563b"],
      [radius * .62, height * .32, height * .46, "#28784a"],
      [radius, height * .46, height * .68, "#318654"],
      [radius * .83, height * .68, height * .87, "#41975e"],
      [radius * .48, height * .87, height, "#58a66c"],
    ] as const;
    for (const [r, base, top, color] of bands) {
      const ring = Array.from({ length: 11 }, (_, i) => {
        const a = i % 10 / 10 * Math.PI * 2;
        return [lng + Math.cos(a) * r / (111320 * Math.cos(lat * Math.PI / 180)), lat + Math.sin(a) * r / 111320];
      });
      features.push({ type: "Feature", properties: { base, top, color }, geometry: { type: "Polygon", coordinates: [ring] } });
    }
  }
  return { type: "FeatureCollection", features };
}

export function installParkTrees(map: MapLibreMap, getPark: () => Park | undefined) {
  let data: Record<string, Tree[]> | undefined;
  let requested = false, disposed = false, lastKey = "", hidden = false;
  const request = new AbortController();
  const clear = () => {
    lastKey = "";
    if (map.getLayer(LAYER)) map.removeLayer(LAYER);
    if (map.getSource(SOURCE)) map.removeSource(SOURCE);
  };
  const refresh = () => {
    if (disposed) return;
    const park = getPark();
    if (!park || !map.getLayer("bkk-3d-buildings")) { clear(); return; }
    if (!data) {
      if (!requested) {
        requested = true;
        fetch("/data/park-trees.json", { signal: request.signal })
          .then(r => { if (!r.ok) throw new Error("Tree data unavailable"); return r.json(); })
          .then((result: Record<string, Tree[]>) => { data = result; refresh(); })
          .catch(() => { if (!disposed) requested = false; });
      }
      return;
    }
    // Wait for building/water tiles before deciding where crowns can fit.
    if (!map.isStyleLoaded() || map.isMoving() || !map.isSourceLoaded("openmaptiles")) return;
    const bounds = map.getBounds();
    const candidates = (data[String(park.osmId)] ?? []).filter(t => bounds.contains([t[0], t[1]]));
    const obstacles: { rings: Polygon; minX: number; maxX: number; minY: number; maxY: number }[] = [];
    for (const sourceLayer of ["building", "water"]) {
      for (const f of map.querySourceFeatures("openmaptiles", { sourceLayer })) {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates]
          : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
        for (const rings of polys) {
          const outer = rings[0];
          obstacles.push({ rings, minX: Math.min(...outer.map(p => p[0])), maxX: Math.max(...outer.map(p => p[0])),
            minY: Math.min(...outer.map(p => p[1])), maxY: Math.max(...outer.map(p => p[1])) });
        }
      }
    }
    const trees = candidates.filter(t => !obstacles.some(o => {
      const dx = (t[2] + 2) / (111320 * Math.cos(t[1] * Math.PI / 180)), dy = (t[2] + 2) / 111320;
      return t[0] + dx >= o.minX && t[0] - dx <= o.maxX && t[1] + dy >= o.minY && t[1] - dy <= o.maxY && overlaps(t, o.rings);
    }));
    const key = `${park.osmId}:${JSON.stringify(trees)}`;
    if (key !== lastKey || !map.getSource(SOURCE)) {
      const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
      if (source) source.setData(treeFeatures(trees));
      else map.addSource(SOURCE, { type: "geojson", data: treeFeatures(trees) });
      if (!map.getLayer(LAYER)) map.addLayer({ id: LAYER, type: "fill-extrusion", source: SOURCE, minzoom: 13,
        paint: { "fill-extrusion-color": ["get", "color"], "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-height": ["get", "top"], "fill-extrusion-opacity": 1, "fill-extrusion-vertical-gradient": true } });
      lastKey = key;
    }
    if (hidden && map.getLayer(LAYER)) { map.setLayoutProperty(LAYER, "visibility", "visible"); hidden = false; }
  };
  const hideWhileMoving = () => {
    if (map.getLayer(LAYER)) { map.setLayoutProperty(LAYER, "visibility", "none"); hidden = true; }
  };
  map.on("idle", refresh);
  map.on("movestart", hideWhileMoving);
  return {
    refresh, clear,
    destroy() {
      disposed = true; request.abort();
      map.off("idle", refresh); map.off("movestart", hideWhileMoving);
      clear();
    },
  };
}
