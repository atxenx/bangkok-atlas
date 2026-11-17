"""Pipeline CLI: fetch → grid → features → quality → serve."""
from __future__ import annotations

import argparse
import logging

from .config import DATA_PROCESSED, DATA_RAW, HEX_EDGE_M

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("cli")


def cmd_fetch(_args) -> None:
    from . import osm_fetcher
    frames = osm_fetcher.fetch_all()
    for name, gdf in frames.items():
        log.info("%-12s %6d features", name, len(gdf))


def cmd_grid(_args) -> None:
    from . import grid
    cells_utm = grid.build_grid(edge=HEX_EDGE_M)
    cells_wgs = grid.to_wgs84(cells_utm)
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    cells_utm.to_parquet(DATA_PROCESSED / "cells_utm.parquet")
    cells_wgs.to_parquet(DATA_PROCESSED / "cells_wgs84.parquet")
    log.info("Grid: %d cells, edge %dm", len(cells_utm), HEX_EDGE_M)


def cmd_features(_args) -> None:
    import geopandas as gpd
    from . import features
    from .config import CRS_UTM

    cells_utm = gpd.read_parquet(DATA_PROCESSED / "cells_utm.parquet")
    raw = {}
    for layer in ["transit", "poi", "landuse", "greenery", "water"]:
        path = DATA_RAW / f"{layer}.parquet"
        raw[layer] = gpd.read_parquet(path) if path.exists() else gpd.GeoDataFrame(
            geometry=[], crs="EPSG:4326")
    roads_path = DATA_RAW / "roads.parquet"
    if roads_path.exists():
        raw["roads"] = gpd.read_parquet(roads_path)
    else:
        majors = gpd.read_parquet(DATA_RAW / "roads_major.parquet") if (
            DATA_RAW / "roads_major.parquet").exists() else None
        minors = gpd.read_parquet(DATA_RAW / "roads_minor.parquet") if (
            DATA_RAW / "roads_minor.parquet").exists() else None
        raw["roads"] = gpd.GeoDataFrame(pd.concat(
            [m for m in (majors, minors) if m is not None],
            ignore_index=True), geometry="geometry", crs="EPSG:4326")

    feat = features.build_features(cells_utm, raw)
    feat.to_parquet(DATA_PROCESSED / "features.parquet")
    log.info("Features: %d cells x %d cols", len(feat), len(feat.columns))


def cmd_quality(_args) -> None:
    from .quality import aggregate, compute_dimensions
    from .store import load_features

    feat = load_features()
    dims = compute_dimensions(feat)
    agg = aggregate(dims)
    merged = dims.join(agg)
    merged["hex_id"] = feat["hex_id"].values
    merged.to_parquet(DATA_PROCESSED / "dims.parquet")
    n_low = int(feat["low_data"].sum())
    log.info("Quality: %d cells scored (%d flagged low_data)",
             len(merged), n_low)


def cmd_serve(args) -> None:
    import uvicorn
    uvicorn.run("bangkok_ai.api:app", host=args.host, port=args.port, reload=False)


def main() -> None:
    parser = argparse.ArgumentParser(prog="bangkok_ai")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("fetch", help="Download Bangkok OSM layers from Overpass")
    sub.add_parser("grid", help="Build the hex grid")
    sub.add_parser("features", help="Spatial feature engineering")
    sub.add_parser("quality", help="Explainable quality scores")
    serve = sub.add_parser("serve", help="Run the FastAPI server")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    sub.add_parser("all", help="Run fetch + grid + features + quality")

    args = parser.parse_args()
    if args.cmd == "all":
        for c in ("fetch", "grid", "features", "quality"):
            globals()[f"cmd_{c}"](args)
    else:
        globals()[f"cmd_{args.cmd}"](args)


if __name__ == "__main__":
    main()
