// Curated destinations, not every OSM garden (which can be private).
// Names/geometry: data/raw/greenery.geojson, © OpenStreetMap contributors, ODbL.
// BMA park reference: https://greenoffice.bangkok.go.th/loikrathong/
// Run from frontend: node scripts/export-green-spaces.mjs (JSON to stdout).
import { readFileSync } from "node:fs";

const names = [
  "สวนลุมพินี", "สวนสราญรมย์", "สวนจตุจักร", "อุทยานเบญจสิริ",
  "สวนสมเด็จพระนางเจ้าสิริกิติ์ฯ", "สวนวชิรเบญจทัศ", "สวนธนบุรีรมย์",
  "สวนหลวง ร.๙", "สวน 50 พรรษา มหาจักรีสิรินธร", "สวนเสรีไทย",
  "สวนพระนคร", "สวนวนธรรม", "สวน 60 พรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินีนาถ",
  "สวนสันติภาพ", "สวนหนองจอก", "สวนรมณีย์ทุ่งสีกัน", "สวนสันติชัยปราการ",
  "สวนสาธารณะเฉลิมพระเกียรติ 6 รอบ พระชนมพรรษา", "สวนหลวงพระราม 8",
  "สวนนวมินทร์ภิรมย์", "สวนพรรณภิรมย์", "สวนสาธารณะเพชรกาญจนารมย์",
  "อุทยาน 100 ปี จุฬาลงกรณ์มหาวิทยาลัย", "สวนปทุมวนานุรักษ์",
  "สวนวัดหัวลำโพงรุกขนิเวศน์", "สวนลอยฟ้าเจ้าพระยา", "สวนเบญจกิติ",
  "สวนเทียนทะเลพัฒนาพฤกษาภิรมย์", "สวนบางแคภิรมย์", "สวนบึงน้ำลาดพร้าว 71",
  "สวนพระยาภิรมย์",
];
const data = JSON.parse(readFileSync(new URL("../../data/raw/greenery.geojson", import.meta.url), "utf8"));
// Spherical polygon area in square metres, subtracting interior rings.
function ringArea(ring) {
  const rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    sum += (b[0] - a[0]) * rad * (Math.sin(a[1] * rad) + Math.sin(b[1] * rad));
  }
  return Math.abs(sum) * 6371008.8 ** 2 / 2;
}
// Prefer the area centroid; concave parks need an interior label point.
function inside([x, y], ring) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result;
  }
  return result;
}
function interiorCenter(rings) {
  const ring = rings[0];
  let left = Math.min(...ring.map(p => p[0])), right = Math.max(...ring.map(p => p[0]));
  let bottom = Math.min(...ring.map(p => p[1])), top = Math.max(...ring.map(p => p[1]));
  const scale = Math.cos((bottom + top) / 2 * Math.PI / 180);
  let best, clearance = -1;
  // Refine an interior point with the greatest distance from all boundaries,
  // including holes. Never place a label on the first boundary vertex.
  for (let pass = 0; pass < 5; pass++) {
    const dx = (right - left) / 32, dy = (top - bottom) / 32;
    for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) {
      const p = [left + (i + .5) * dx, bottom + (j + .5) * dy];
      if (!inside(p, ring) || rings.slice(1).some(h => inside(p, h))) continue;
      let distance = Infinity;
      for (const boundary of rings) for (let k = 0; k < boundary.length - 1; k++) {
        const ax = (boundary[k][0] - p[0]) * scale, ay = boundary[k][1] - p[1];
        const vx = (boundary[k + 1][0] - boundary[k][0]) * scale;
        const vy = boundary[k + 1][1] - boundary[k][1];
        const t = Math.max(0, Math.min(1, -(ax * vx + ay * vy) / (vx * vx + vy * vy || 1)));
        distance = Math.min(distance, (ax + t * vx) ** 2 + (ay + t * vy) ** 2);
      }
      if (distance > clearance) { clearance = distance; best = p; }
    }
    if (!best) throw new Error("No interior park label position found");
    left = best[0] - dx; right = best[0] + dx;
    bottom = best[1] - dy; top = best[1] + dy;
  }
  return best;
}
const parks = names.map((name) => {
  const f = data.features.find(f => f.properties.name === name);
  if (!f || f.geometry.type !== "Polygon") throw new Error(`Missing park polygon: ${name}`);
  const ring = f.geometry.coordinates[0];
  const [ox, oy] = ring[0];
  let area = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = ring[i][0] - ox, ay = ring[i][1] - oy;
    const bx = ring[i + 1][0] - ox, by = ring[i + 1][1] - oy;
    const cross = ax * by - bx * ay;
    area += cross; x += (ax + bx) * cross; y += (ay + by) * cross;
  }
  let point = area ? [ox + x / (3 * area), oy + y / (3 * area)] : ring[0];
  if (!inside(point, ring) || f.geometry.coordinates.slice(1).some(h => inside(point, h))) point = interiorCenter(f.geometry.coordinates);
  return { name, lng: +point[0].toFixed(6), lat: +point[1].toFixed(6),
    osmType: f.properties.osm_type, osmId: f.properties.osm_id,
    geometry: f.geometry,
    areaM2: Math.round(ringArea(ring) - f.geometry.coordinates.slice(1).reduce((sum, hole) => sum + ringArea(hole), 0)),
  };
}).sort((a, b) => b.areaM2 - a.areaM2);
console.log(JSON.stringify(parks, null, 2));
