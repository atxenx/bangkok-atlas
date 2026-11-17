"""Emit deterministic illustrative tree positions, excluding mapped water/buildings.

Run with the backend virtualenv. Stdout is frontend/public/data/park-trees.json.
All spacing and canopy exclusion tests use metres in EPSG:32647.
"""
import json
import random
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
forward = Transformer.from_crs(4326, 32647, always_xy=True).transform
reverse = Transformer.from_crs(32647, 4326, always_xy=True).transform
parks = json.loads((ROOT / "frontend/src/lib/green-spaces.json").read_text())
obstacles = []
for filename in ["data/raw/water.geojson", "data/processed/buildings_3d.geojson"]:
    for f in json.loads((ROOT / filename).read_text())["features"]:
        if f.get("geometry"):
            g = transform(forward, shape(f["geometry"]))
            if not g.is_valid:
                g = g.buffer(0)
            if not g.is_empty:
                obstacles.append(g)
index = STRtree(obstacles)
result = {}
for park in parks:
    polygon = transform(forward, shape(park["geometry"]))
    if not polygon.is_valid:
        polygon = polygon.buffer(0)
    blocked = unary_union([obstacles[i] for i in index.query(polygon.buffer(10))])
    rng = random.Random(park["osmId"])
    target = min(360, max(5, int(polygon.area / 300)))
    left, bottom, right, top = polygon.bounds
    trees = []
    centres = []
    for _ in range(target * 100):
        x, y = rng.uniform(left, right), rng.uniform(bottom, top)
        radius = rng.uniform(2.2, 3.6)
        # Extra 2 metres beyond the entire canopy protects shores and walls.
        footprint = Point(x, y).buffer(radius + 2)
        if not polygon.contains(footprint) or blocked.intersects(footprint):
            continue
        if any((x - a) ** 2 + (y - b) ** 2 < 10 ** 2 for a, b in centres):
            continue
        lng, lat = reverse(x, y)
        trees.append([round(lng, 7), round(lat, 7), round(radius, 2), round(rng.uniform(7, 12), 2)])
        centres.append((x, y))
        if len(trees) >= target:
            break
    result[str(park["osmId"])] = trees
print(json.dumps(result, separators=(",", ":")))
