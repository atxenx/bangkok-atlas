import math

import pyproj
from shapely.geometry import Point

from bangkok_ai.grid import build_grid, to_wgs84

BBOX = (100.40, 13.60, 100.44, 13.64)
EDGE = 300.0
NOMINAL_AREA = (3 * math.sqrt(3) / 2) * EDGE ** 2  # pointy-top hex area

_TRANSFORM = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:32647", always_xy=True)


def _bbox_utm():
    minx, miny = _TRANSFORM.transform(BBOX[0], BBOX[1])
    maxx, maxy = _TRANSFORM.transform(BBOX[2], BBOX[3])
    return minx, miny, maxx, maxy


def test_grid_nonempty_and_covers_bbox():
    g = build_grid(edge=EDGE, bbox_wgs84=BBOX)
    assert len(g) > 0
    minx, miny, maxx, maxy = _bbox_utm()
    bounds = g.total_bounds
    assert bounds[0] <= minx + 1e-3
    assert bounds[1] <= miny + 1e-3
    assert bounds[2] >= maxx - 1e-3
    assert bounds[3] >= maxy - 1e-3


def test_hex_ids_unique():
    g = build_grid(edge=EDGE, bbox_wgs84=BBOX)
    assert g["hex_id"].is_unique


def test_cell_areas_within_nominal():
    g = build_grid(edge=EDGE, bbox_wgs84=BBOX)
    assert g["cell_area_m2"].max() <= NOMINAL_AREA + 1e-6
    # interior cells should be (near) full hexagons
    assert (g["cell_area_m2"] > NOMINAL_AREA * 0.9).sum() >= 1


def test_wgs84_conversion():
    g = build_grid(edge=EDGE, bbox_wgs84=BBOX)
    w = to_wgs84(g)
    assert str(w.crs) == "EPSG:4326"
    assert w["center_lat"].between(13.59, 13.65).all()
    assert w["center_lng"].between(100.39, 100.45).all()
