"""Bangkok urban rail line membership, from real OSM route relations.

Each BTS/MRT/ARL/SRT line is an OSM relation with a `colour` tag (e.g. BTS
Sukhumvit #65B724, MRT Blue #1E398D) and members listing the station nodes.
This module fetches those relations once (Overpass), joins member node ids
with the fetched transit layer (data/raw/transit.parquet), and persists a
compact station -> lines map plus per-line station ordering to
 data/raw/lines.json.

The API loads lines.json at startup and attaches `lines` (ref, label, colour)
to every station in /api/stations, and exposes `routes` (ref, label, colour,
ordered stops) so the frontend can draw each line as a polyline through the
stations in the order they appear in the OSM route relation. Colours come from
OSM; short display labels are curated constants (documented below) because
relation names include long route suffixes.
"""
from __future__ import annotations

import json
from collections import defaultdict

import geopandas as gpd
import requests

from .config import (
    BANGKOK_BBOX,
    DATA_RAW,
    OVERPASS_MIRRORS,
    OVERPASS_UA,
)

LINES_JSON = DATA_RAW / "lines.json"

# Operational Bangkok urban lines to keep. Keyed by OSM relation `ref`.
# Display labels are curated; colours come from OSM's `colour` tag.
LINE_LABELS: dict[str, dict[str, str]] = {
    "สุขุมวิท":        {"th": "BTS สายสุขุมวิท",        "en": "BTS Sukhumvit Line"},
    "สีลม":            {"th": "BTS สายสีลม",            "en": "BTS Silom Line"},
    "MRT-BL":          {"th": "MRT สายสีน้ำเงิน",        "en": "MRT Blue Line"},
    "MRT Purple":      {"th": "MRT สายสีม่วง",           "en": "MRT Purple Line"},
    "MRT Yellow":      {"th": "MRT สายสีเหลือง",         "en": "MRT Yellow Line"},
    "MRT Pink":        {"th": "MRT สายสีชมพู",           "en": "MRT Pink Line"},
    "IMPACT Link":     {"th": "MRT สายสีชมพู (อิมแพ็ค)", "en": "Pink Line (IMPACT Link)"},
    "APM Gold Line":   {"th": "รถไฟฟ้าสายสีทอง",         "en": "Gold Line"},
    "AERA1 City":      {"th": "แอร์พอร์ต เรล ลิงก์",      "en": "Airport Rail Link"},
    "SRT Dark Red Line": {"th": "สายสีแดงเข้ม (SRT)",     "en": "SRT Dark Red Line"},
    "SRT Light Red Line": {"th": "สายสีแดงอ่อน (SRT)",    "en": "SRT Light Red Line"},
}

# Display order in the legend.
LINE_ORDER = [
    "สุขุมวิท", "สีลม", "MRT-BL", "MRT Purple", "MRT Yellow",
    "MRT Pink", "IMPACT Link", "APM Gold Line", "AERA1 City",
    "SRT Dark Red Line", "SRT Light Red Line",
]


def build_routes(relations: list[dict], id_name: dict[int, str],
                 station_lines: dict[str, list[str]]) -> dict[str, list[str]]:
    """Ordered station names per line ref, from route relation member order.

    Relations come in pairs (one per direction) plus route_master relations;
    for each ref we keep the relation with the most named station members and
    walk its node members in order, resolving node ids to station names via the
    transit layer. Consecutive duplicate nodes for the same station are
    collapsed. Only names already known as stations of that line are kept, so
    waypoints and platform nodes never leak into the drawn route.
    """
    line_stops: dict[str, list[str]] = {}
    for el in relations:
        ref = el.get("tags", {}).get("ref", "")
        if ref not in LINE_LABELS:
            continue
        names: list[str] = []
        for m in el.get("members", []):
            if m.get("type") != "node":
                continue
            name = id_name.get(m["ref"], "")
            if not name:
                continue
            if names and names[-1] == name:
                continue  # same station mapped by several nodes
            names.append(name)
        # Prefer the longest relation (main direction; reversed pair is shorter
        # or equal — either draws the same polyline).
        if len(names) > len(line_stops.get(ref, [])):
            line_stops[ref] = names

    # station_lines is name -> [ref, ...]; invert for the known-name filter.
    known = {ref: set() for ref in line_stops}
    for name, refs in station_lines.items():
        for ref in refs:
            if ref in known:
                known[ref].add(name)
    return {
        ref: [n for n in names if n in known[ref]]
        for ref, names in line_stops.items()
    }


def _fetch_relations() -> list[dict]:
    """Query Overpass for urban rail route relations in the Bangkok bbox."""
    min_lon, min_lat, max_lon, max_lat = BANGKOK_BBOX
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    query = f"""[out:json][timeout:240];
(
  relation["route"~"^(subway|light_rail|monorail|train)$"]({bbox});
  relation["route_master"~"^(subway|light_rail|monorail|train)$"]({bbox});
);
out body;
"""
    last_err: Exception | None = None
    for url in OVERPASS_MIRRORS:
        try:
            resp = requests.post(url, data={"data": query},
                                 headers={"User-Agent": OVERPASS_UA}, timeout=300)
            resp.raise_for_status()
            return resp.json().get("elements", [])
        except requests.RequestException as exc:
            last_err = exc
    raise RuntimeError(f"Overpass line-relation query failed: {last_err}")


def fetch_and_save(out_path=LINES_JSON) -> dict:
    """Fetch line relations, join with transit layer, persist lines.json."""
    relations = _fetch_relations()

    # relation id -> line info
    line_of: dict[int, dict] = {}
    for el in relations:
        tags = el.get("tags", {})
        ref = tags.get("ref", "")
        if ref not in LINE_LABELS:
            continue
        colour = tags.get("colour", "").strip().lstrip("#")
        if len(colour) != 6:
            colour = ""  # malformed: fall back to a default per line later
        line_of[el["id"]] = {
            "ref": ref,
            "label": LINE_LABELS[ref],
            "colour": f"#{colour}" if colour else None,
        }

    # station node id -> set of line refs
    node_lines: dict[int, set[str]] = defaultdict(set)
    for el in relations:
        info = line_of.get(el["id"])
        if info is None:
            continue
        for m in el.get("members", []):
            if m.get("type") == "node":
                node_lines[m["ref"]].add(info["ref"])

    # join with the fetched transit layer to resolve names
    transit = gpd.read_parquet(DATA_RAW / "transit.parquet")
    id_name: dict[int, str] = {}
    for _, row in transit.iterrows():
        if row["osm_type"] == "node":
            id_name[int(row["osm_id"])] = str(row["name"] or "")

    # station (Thai name) -> ordered list of line refs
    station_lines: dict[str, list[str]] = defaultdict(list)
    for node_id, refs in node_lines.items():
        name = id_name.get(node_id, "")
        if not name:
            continue
        for ref in sorted(refs, key=lambda r: LINE_ORDER.index(r) if r in LINE_ORDER else 99):
            if ref not in station_lines[name]:
                station_lines[name].append(ref)

    lines_meta = [
        {"ref": ref, "label": LINE_LABELS[ref], "colour": None}
        for ref in LINE_ORDER
    ]
    # fill in colours from the relations (all directions share the same colour)
    colour_of: dict[str, str] = {}
    for info in line_of.values():
        if info["colour"]:
            colour_of[info["ref"]] = info["colour"]
    for ln in lines_meta:
        if ln["ref"] in colour_of:
            ln["colour"] = colour_of[ln["ref"]]

    routes = build_routes(relations, id_name, dict(station_lines))
    payload = {"lines": lines_meta, "stations": dict(station_lines), "routes": routes}
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    return payload


def load_lines(out_path=LINES_JSON) -> tuple[list[dict], dict[str, list[str]], dict[str, list[str]]]:
    """Return (lines_meta, station_name -> [ref, ...], ref -> ordered stops)."""
    if not out_path.exists():
        return [], {}, {}
    payload = json.loads(out_path.read_text(encoding="utf-8"))
    return (
        payload.get("lines", []),
        payload.get("stations", {}),
        payload.get("routes", {}),
    )


if __name__ == "__main__":
    payload = fetch_and_save()
    print("lines:", len(payload["lines"]))
    print("stations with line info:", len(payload["stations"]))
    for ln in payload["lines"]:
        n = sum(1 for refs in payload["stations"].values() if ln["ref"] in refs)
        print(f"  {ln['ref']:<20} {ln['colour']}  {n} stations")
