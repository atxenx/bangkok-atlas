import { Marker, Popup, type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import parks from "./green-spaces.json";
import { installParkTrees } from "./park-trees";

export const GREEN_SPACE_COUNT = parks.length;
export const GREEN_SPACE_BOUNDS: [[number, number], [number, number]] = [
  [Math.min(...parks.map(p => p.lng)), Math.min(...parks.map(p => p.lat))],
  [Math.max(...parks.map(p => p.lng)), Math.max(...parks.map(p => p.lat))],
];

/** DOM markers survive basemap style replacement and work independently of grid/API data. */
export function installGreenSpaces(map: MapLibreMap, isTh: boolean) {
  let popup: Popup | undefined;
  let selected: (typeof parks)[number] | undefined;
  const trees = installParkTrees(map, () => selected);
  const sourceId = "selected-green-space";
  const fillId = "selected-green-space-fill";
  const lineId = "selected-green-space-outline";
  const clearBoundary = () => {
    selected = undefined;
    trees.clear();
    if (map.getLayer(lineId)) map.removeLayer(lineId);
    if (map.getLayer(fillId)) map.removeLayer(fillId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  };
  const drawBoundary = () => {
    if (!selected || !map.isStyleLoaded()) return;
    const data: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: "Feature", properties: { name: selected.name },
      geometry: { type: "Polygon", coordinates: selected.geometry.coordinates },
    };
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (source) source.setData(data);
    else map.addSource(sourceId, { type: "geojson", data });
    if (!map.getLayer(fillId)) map.addLayer({ id: fillId, type: "fill", source: sourceId,
      paint: { "fill-color": "#36b86c", "fill-opacity": 0.2 } });
    if (!map.getLayer(lineId)) map.addLayer({ id: lineId, type: "line", source: sourceId,
      paint: { "line-color": "#168347", "line-width": 3, "line-opacity": 1 } });
  };
  map.on("style.load", drawBoundary);
  const entries = parks.map((park) => {
    const element = document.createElement("div");
    element.className = "green-space-marker";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "green-space-button";
    button.setAttribute("aria-label", `${isTh ? "ดูสวน" : "View park"}: ${park.name}`);
    button.title = park.name;
    const label = document.createElement("span");
    label.className = "green-space-label";
    label.textContent = park.name;
    label.setAttribute("aria-hidden", "true");
    const icon = document.createElement("span");
    icon.className = "green-space-tree";
    icon.innerHTML = '<svg viewBox="0 0 32 36" width="27" height="30" aria-hidden="true"><path d="M16 23v10" stroke="#855e3f" stroke-width="4" stroke-linecap="round"/><path d="M16 3C10 3 8 7 8 10 3 11 2 15 4 19c-3 6 4 10 9 7 2 2 5 2 7 0 6 3 12-2 8-7 2-5-1-8-5-9 0-4-3-7-7-7Z" fill="#268657" stroke="white" stroke-width="2"/><path d="m16 23-5-6m5 3 5-5" stroke="#b6e3bb" stroke-width="1.5" stroke-linecap="round"/></svg>';
    button.append(label, icon);
    element.append(button);
    const marker = new Marker({ element, anchor: "center" })
      .setLngLat([park.lng, park.lat]).addTo(map);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      popup?.remove();
      selected = park;
      drawBoundary();
      trees.refresh();
      const content = document.createElement("div");
      content.className = "green-space-popup";
      const title = document.createElement("strong");
      title.textContent = park.name;
      const area = document.createElement("p");
      area.style.fontWeight = "600";
      area.style.color = "#168347";
      const locale = isTh ? "th-TH" : "en-US";
      const squareMetres = park.areaM2.toLocaleString(locale);
      const rai = (park.areaM2 / 1600).toLocaleString(locale, { maximumFractionDigits: 2 });
      area.textContent = isTh
        ? `พื้นที่ประมาณ ${squareMetres} ตร.ม. (${rai} ไร่)`
        : `Approx. area: ${squareMetres} m² (${rai} rai)`;
      const note = document.createElement("p");
      note.textContent = isTh
        ? "ขอบเขตตาม OpenStreetMap · พื้นที่ประมาณจากรูปแปลง · ต้นไม้ในโหมด 3D เป็นภาพจำลอง"
        : "Boundary from OpenStreetMap · Approximate mapped area · Trees in 3D are illustrative.";
      const source = document.createElement("a");
      source.href = `https://www.openstreetmap.org/${park.osmType}/${park.osmId}`;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = isTh ? "ดูข้อมูลสถานที่ ↗" : "View place information ↗";
      content.append(title, area, note, source);
      popup = new Popup({ offset: 34, maxWidth: "280px" })
        .setLngLat([park.lng, park.lat]).setDOMContent(content).addTo(map);
      popup.on("close", clearBoundary);
      const ring = park.geometry.coordinates[0];
      map.fitBounds([
        [Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1]))],
        [Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))],
      ], { padding: 65, maxZoom: 16, duration: 650 });
    });
    return { park, marker, label, button };
  });

  // Prioritize larger parks when labels collide; all tree buttons remain available.
  const layout = () => {
    const boxes: { x: number; y: number; w: number }[] = [];
    const { clientWidth: width, clientHeight: height } = map.getContainer();
    for (const { park, label, button } of entries) {
      const point = map.project([park.lng, park.lat]);
      const w = label.offsetWidth || 160;
      const box = { x: point.x - w / 2, y: point.y - 53, w };
      const visible = point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
      const overlaps = boxes.some(b => box.x < b.x + b.w + 8 && box.x + w + 8 > b.x && Math.abs(box.y - b.y) < 30);
      label.dataset.collapsed = String(!visible || overlaps);
      button.tabIndex = visible ? 0 : -1;
      if (visible && !overlaps) boxes.push(box);
    }
  };
  map.on("move", layout);
  map.on("resize", layout);
  const frame = requestAnimationFrame(layout);
  return () => {
    cancelAnimationFrame(frame);
    map.off("move", layout);
    map.off("resize", layout);
    map.off("style.load", drawBoundary);
    popup?.remove();
    clearBoundary();
    trees.destroy();
    entries.forEach(({ marker }) => marker.remove());
  };
}
