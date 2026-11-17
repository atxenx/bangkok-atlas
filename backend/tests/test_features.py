import geopandas as gpd
from shapely.geometry import LineString, Point, Polygon

from bangkok_ai.config import CRS_UTM
from bangkok_ai.features import build_features
from bangkok_ai.grid import build_grid

BBOX = (100.40, 13.60, 100.42, 13.62)
EDGE = 200.0


def _cells():
    return build_grid(edge=EDGE, bbox_wgs84=BBOX)


def _empty(layer="poi"):
    return gpd.GeoDataFrame(columns=["geometry"], geometry="geometry", crs=CRS_UTM)


def test_poi_counts_and_diversity():
    cells = _cells()
    c = cells.iloc[0].geometry.centroid
    poi = gpd.GeoDataFrame(
        [
            {"group": "food", "category": "restaurant", "name": "a",
             "geometry": Point(c.x, c.y)},
            {"group": "food", "category": "cafe", "name": "b",
             "geometry": Point(c.x, c.y)},
            {"group": "retail", "category": "supermarket", "name": "c",
             "geometry": Point(c.x, c.y)},
        ],
        geometry="geometry", crs=CRS_UTM)
    raw = {k: _empty(k) for k in
           ["transit", "poi", "landuse", "greenery", "water", "roads"]}
    raw["poi"] = poi
    feat = build_features(cells, raw)
    row = feat.iloc[0]
    assert row["n_poi"] == 3
    assert row["n_food"] == 2
    assert row["n_retail"] == 1
    assert row["poi_diversity"] > 0  # two distinct categories


def test_landuse_share_sums_within_cell():
    cells = _cells()
    c0 = cells.iloc[0].geometry
    # carve a square inside the cell
    interior = c0.intersection(
        Polygon([(c0.bounds[0] + 10, c0.bounds[1] + 10),
                 (c0.bounds[2] - 10, c0.bounds[1] + 10),
                 (c0.bounds[2] - 10, c0.bounds[3] - 10),
                 (c0.bounds[0] + 10, c0.bounds[3] - 10)]))
    lu = gpd.GeoDataFrame(
        [{"category": "residential", "group": "landuse", "geometry": interior}],
        geometry="geometry", crs=CRS_UTM)
    raw = {k: _empty(k) for k in
           ["transit", "poi", "landuse", "greenery", "water", "roads"]}
    raw["landuse"] = lu
    feat = build_features(cells, raw)
    assert 0.7 < feat.iloc[0]["residential_share"] <= 1.0


def test_road_length_nonzero():
    cells = _cells()
    c = cells.iloc[0].geometry
    (minx, miny, maxx, maxy) = c.bounds
    road = gpd.GeoDataFrame(
        [{"group": "minor", "category": "residential", "lanes": "",
          "oneway": "", "name": "", "geometry":
          LineString([(minx, (miny + maxy) / 2), (maxx, (miny + maxy) / 2)])}],
        geometry="geometry", crs=CRS_UTM)
    raw = {k: _empty(k) for k in
           ["transit", "poi", "landuse", "greenery", "water", "roads"]}
    raw["roads"] = road
    feat = build_features(cells, raw)
    assert feat.iloc[0]["road_len_m"] > 0
    assert feat.iloc[0]["minor_density"] > 0


def test_road_length_crossing_cells():
    # a road along the shared edge should register in both cells
    cells = _cells()
    a, b = cells.iloc[0].geometry, cells.iloc[1].geometry
    xmid = (a.bounds[0] + a.bounds[2]) / 2
    ylo = min(a.bounds[1], b.bounds[1])
    yhi = max(a.bounds[3], b.bounds[3])
    road = gpd.GeoDataFrame(
        [{"group": "minor", "category": "residential", "geometry":
          LineString([(xmid, ylo), (xmid, yhi)])}],
        geometry="geometry", crs=CRS_UTM)
    raw = {k: _empty(k) for k in
           ["transit", "poi", "landuse", "greenery", "water", "roads"]}
    raw["roads"] = road
    feat = build_features(cells, raw)
    assert (feat["road_len_m"] > 0).sum() >= 2
