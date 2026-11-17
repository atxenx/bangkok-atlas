# Architecture

## System overview

```
┌───────────────────────────┐      ┌──────────────────────────────────┐
│  Next.js + TypeScript     │ HTTP │  FastAPI (Python)                │
│  MapLibre GL dashboard    │─────▶│  /health  /api/grid              │
│  (Tailwind; SVG/DOM       │      │  /api/location/{hex}             │
│   charts, no heavy deps)  │      │  /api/recommend  (POST)          │
└───────────────────────────┘      └───────────────┬──────────────────┘
                                                   │
                                    ┌──────────────▼───────────────┐
                                    │  bangkok_ai package          │
                                    │  quality.py  recommend.py    │
                                    │  features.py grid.py         │
                                    │  osm_fetcher.py config.py    │
                                    └──────────────┬───────────────┘
                                                   │ reads
                                    ┌──────────────▼───────────────┐
                                    │  data/processed/*.parquet    │
                                    │  data/raw/*.geojson          │
                                    └──────────────────────────────┘
```

## Modules

| Module | Responsibility |
|--------|----------------|
| `osm_fetcher.py` | Overpass queries per layer; dedupe on `(osm_type, osm_id)`; write GeoJSON + Parquet to `data/raw/` |
| `grid.py` | Hex grid (default 300 m edge) in EPSG:32647 over the Bangkok bbox; stable hex ids |
| `features.py` | Spatial joins (points-in-polygon, line intersection lengths, polygon area share via STRtree) → per-cell feature table |
| `quality.py` | 9 dimension indices (0–100, deterministic published formulas) + weighted aggregate score with per-dimension contributions |
| `recommend.py` | Weighted preference ranking over cells; per-preference contribution breakdown; top-K with positive/negative factors |
| `api.py` | FastAPI app serving grid/location/recommend; honest `data_status` fields |
| `cli.py` | `fetch` / `grid` / `features` / `quality` / `serve` commands |

## Neighborhood Quality Score (Phase 1 definition)

Each cell receives 9 dimension scores, each a deterministic 0–100 index built from real
features (full formulas in `backend/bangkok_ai/quality.py`; saturation curves of the form
`100·(1 − e^(−k·x))`, distance-decay `100·e^(−d/τ)`, and capped share terms):

1. **transit** — stop count within 1 km + proximity to nearest stop
2. **amenities** — POI density (saturated) blended with category diversity (Shannon)
3. **walkability** — minor-road density + total road density
4. **greenery** — green-area share (capped) blended with proximity to nearest green space
5. **road_environment** — inverted-U on distance to major roads (access vs. noise trade-off)
6. **commercial** — commercial/retail land-use share + retail POI density
7. **residential** — residential land-use share (+ planned building density in Phase 2)
8. **quietness** — inverse of major-road density and proximity (noise proxy)
9. **environmental** — water share + greenery share + penalty for industrial land use

**Aggregate** = weighted sum with documented initial weights (0.18 transit, 0.15 amenities,
0.14 walkability, 0.12 greenery, 0.10 road_environment, 0.10 commercial, 0.08 residential,
0.08 quietness, 0.05 environmental). Weights are parameters, not hidden magic; a later phase
learns them from human annotations. Cells with no data are flagged `low_data`, not scored as
if observed.

**Explainability contract:** any API response containing a quality score must include the
per-dimension breakdown so the number can be decomposed, and must not include a score for
`low_data` cells.

## API contract (Phase 1)

- `GET /health` → `{status, data_status: {land_price, street_imagery, satellite, human_labels}}`
- `GET /api/grid` → GeoJSON FeatureCollection of hex cells; properties = quality, 9 dimensions, feature counts
- `GET /api/location/{hex_id}` → features, dimensions, quality, positive/negative factors,
  comparable locations, a district baseline, and a labelled hedonic screening estimate
- `POST /api/recommend` → body = preferences (weights, budget, land size, land-use type);
  response = ranked cells with `match_score`, per-dimension contribution, positive/negative
  factors and neighborhood quality. Budget filtering requires an explicit land size.

## Decisions & tradeoffs

- **No PostGIS in Phase 1.** A local Parquet/GeoJSON store + GeoPandas covers a laptop-scale
  research prototype; the data model (hex cell keys, CRS discipline, provenance columns) is
  designed so a PostGIS backend can replace the store without changing the API. PostGIS
  becomes the store if dataset size or concurrent use demands it.
- **Deterministic quality index first, learned model later.** The index gives the project a
  working, explainable baseline (like Walk Score) before ML weights are introduced — ML on
  top of an unexplained number would violate the "no arbitrary scores" rule.
- **No false price labels.** District baselines and hedonic outputs are labelled as model
  estimates; parcel-specific official appraisal and transaction data remain unavailable.
- **Frontend kept light:** MapLibre GL + Tailwind + hand-rolled SVG charts; no chart
  framework, to keep the demo reproducible on a student machine.
- **Hex overlay rendered on a 2D canvas over the map** (main-thread, `map.project()`
  + screen-space hit-testing) instead of a MapLibre GeoJSON layer. Rationale: some
  embedded webviews break worker `ArrayBuffer` transfers, which silently kills
  MapLibre's vector/GeoJSON pipeline; the canvas overlay renders identically in any
  environment and is also cheaper for dense hex grids. The basemap uses CARTO raster
  tiles for the same reason.
