# Data Inventory, Sources, and Assumptions

> Status: **Phase 1** — no land-price, imagery, or human-label datasets are bundled. Nothing
> below is invented; where data is missing it is listed as missing with proposed alternatives.

## Study area

Greater Bangkok bounding box (WGS84, EPSG:4326):

```
min_lon = 100.30, min_lat = 13.55, max_lon = 100.95, max_lat = 14.00
```

- **Exchange CRS:** EPSG:4326 (WGS84) for all stored GeoJSON and API output.
- **Computation CRS:** EPSG:32647 (WGS 84 / UTM zone 47N) for metric distances, areas, and
  hex-grid generation. All spatial joins are performed in UTM and reprojected for output.
- **Geographic key:** hex cell id (`<edge>m-r<row>-c<col>`) is the primary analysis unit.
  OSM elements keep their native `osm_id`/`osm_type` for provenance.

## Dataset inventory

| # | Dataset | Source | Format | Status |
|---|---------|--------|--------|--------|
| 1 | OSM transit stops (BTS/MRT/ARL/trains) | Overpass API | GeoJSON/Parquet | ✅ bundled via pipeline |
| 2 | OSM POIs (food, retail, services, education, health, culture, lodging) | Overpass API | GeoJSON/Parquet | ✅ bundled via pipeline |
| 3 | OSM land use polygons | Overpass API | GeoJSON/Parquet | ✅ bundled via pipeline |
| 4 | OSM greenery & water polygons | Overpass API | GeoJSON/Parquet | ✅ bundled via pipeline |
| 5 | OSM road network (major + minor) | Overpass API | GeoJSON/Parquet | ✅ bundled via pipeline |
| 6 | OSM building footprints + explicit height values | Overpass API (OpenStreetMap) | bundled GeoJSON | ✅ 2,531 features shown in 3D |
| 7 | Parcel appraisal / verified transaction data | **none** | — | ❌ missing; UI uses a labelled district-level model |
| 8 | Street-level imagery | external links only | — | ⚠️ not ingested; UI indices are OSM proxies |
| 9 | Satellite imagery | Esri basemap tiles | raster tiles | ⚠️ visualization only |
| 10 | Human neighborhood-quality annotations | **none** | — | ❌ to be created |

## Missing datasets — stated explicitly

### 6. Cached 3D building map

The dashboard renders the bundled buildings_3d.geojson snapshot: 2,531 Bangkok
footprints with explicit OSM height values. No height is inferred from floor counts.
The frontend first requests the API and falls back to the bundled static JSON, so 3D does
not depend on a vector-style provider. If the snapshot is missing, the API network fallback
is deliberately limited to a Silom–Sathorn preview window.

### 7. Land price / property data (critical for Functions 3 & 5)

No parcel geometry, title-deed-number index, listing, rent, or verified transaction
dataset exists in the workspace. The map therefore exposes a clearly typed district
model baseline and hedonic estimate for neighborhood screening. It must not present
those values as official parcel appraisals or transacted prices.

An **exact parcel lookup** is available through the backend endpoint, which queries the Treasury Department's
[public Bangkok land-valuation resource](https://catalog.treasury.go.th/dataset/f5072145-2f1a-4500-bf60-d122b866ac2f/resource/00da1ca3-2c41-436d-a426-d0c06f8cae03)
through its CKAN datastore API. The user must supply all six identifiers from the land
document: `LAND_NO`, `UTMMAP1`, `UTMMAP2`, `UTMMAP3`, `UTMMAP4`, and `UTMSCALE`.
The response's `EVAPRICE` is the official appraised land price in THB/sq.wah. The
resource has no coordinates, so a map click cannot identify a parcel. An absent or
ambiguous datastore match is **not** replaced with a model value; the user is directed
to the [official parcel-search service](https://assessprice.treasury.go.th/). The
catalog indicates its datastore may not contain every record from the source CSV.
The map UI does **not** present this manual lookup. Automatic parcel matching from a
map click is blocked until an authorized cadastral geometry/parcel-identifier API is
available. The Department of Lands publishes an [API access process](https://data.go.th/th/dataset/mapland-parcel)
requiring a written request and issued Consumer Key/Secret; the Treasury ArcGIS parcel
layer currently responds with `Token Required` to unauthenticated requests.

Additional sources for a future market-price model:

1. **Listings data** — scraping DDproperty / Hipflat / FazWaz violates their ToS and will
   **not** be done in this project. Using an official listings API or a purchased dataset is
   acceptable if the team obtains permission.
2. **Manual pilot collection** — the team hand-collects a small labeled set (e.g., 200–500
   soi-level price-per-square-wah observations with source URLs and as-of dates) from public
   listings, clearly labeled *listing price*, for a pilot model. This is a legitimate,
   citation-tracked fallback and is the recommended path if DOL tabulation is infeasible.

**Price-type distinction (mandatory):** the final model must tag every label as
`assessed` (Treasury), `listing` (agent/owner ask), or `market` (transacted). Listing prices
are biased upward; assessed prices lag the market. The target variable is documented as
**price per square wah (THB)** at a fixed **prediction date**; total value is derived
(price × land size) and marked as derived, not predicted directly.

### 8. Street-level imagery

Google Street View requires an API key and ToS compliance (metadata use only, no storing
imagery). The realistic free alternative is **Mapillary** (crowd-sourced street imagery,
free API, Bangkok coverage exists in tourist/commercial corridors but is uneven). A later
phase evaluates coverage per hex cell and restricts visual analysis to cells with imagery.

### 9. Satellite imagery

Free options: **Sentinel-2** via Copernicus Data Space / Sentinel Hub free tier (10 m
bands — NDVI, built-up proxies) and **ESA WorldCover** (10 m land-cover). Account
registration required; until then the map dashboard can display free raster basemaps
(CARTO/OSM) for visualization only, not analysis.

### 10. Human annotations

A small labeled dataset (e.g., 50–100 Bangkok cells, 3+ raters each) following a written
rubric (dimensions 1–9, 1–5 Likert) will be created in a later phase for RQ1/H1
validation. Protocol and inter-rater reliability (ICC) will be reported.

## OSM layer definitions (what is fetched, and why)

| Layer | Overpass tags | Geometry | Used for |
|-------|---------------|----------|----------|
| `transit` | `railway=station\|halt\|tram_stop\|subway_entrance\|stop` or `station=subway\|light_rail\|monorail` | points (way centroids) | transit accessibility |
| `poi` | `amenity`, `shop`, `tourism`, `office` in curated lists | points | amenities, commercial activity |
| `landuse` | `landuse=residential\|commercial\|retail\|industrial\|mixed_use\|institutional\|education\|religious\|cemetery\|construction` | polygons | land-use character |
| `greenery` | `leisure=park\|garden\|nature_reserve` or `landuse=forest\|grass\|meadow\|orchard\|recreation_ground` or `natural=wood\|scrub\|grassland\|wetland` | polygons | greenery score |
| `water` | `natural=water`, `landuse=reservoir` | polygons | environmental score |
| `roads` | `highway=motorway\|trunk\|primary\|secondary\|tertiary\|residential\|unclassified\|living_street` | lines | walkability, road environment, quietness |

Only the 2,531 explicitly height-tagged building footprints are bundled for rendering.
Building density is still not used as an analytical feature; full-building extraction
requires an area-divided fetch or a local OSM extract.

## Known quality caveats (documented, not hidden)

- OSM completeness is higher in central Bangkok; suburban cells may undercount POIs.
  Feature stats are reported per-cell with their raw counts so users can judge data support.
- Way-based POIs are collapsed to centroids; large land-use relations are skipped in Phase 1
  (only nodes and ways are fetched) — a small area loss, noted per layer.
- OSM timestamps are preserved; a future `as_of` filter enforces the leakage rule
  (no feature dated after the prediction date).
- Duplicate handling: Overpass can return the same element once per query; the fetcher
  deduplicates on `(osm_type, osm_id)` and drops elements outside the bbox (Overpass bbox
  filter is approximate).

## Assumptions

1. Price per square wah is the primary target; total value is derived and clearly marked.
2. A 300 m hex cell is the current grid (600 m in earlier builds); it is a reasonable operationalization of "neighborhood" (documented; a
   sensitivity analysis over 300/600/900 m is planned).
3. Neighborhood-quality dimensions are operationalized from OSM proxies (e.g., road density
   stands in for walkability) until direct sidewalk/crossing data is added.
4. OSM data as of the fetch date reflects the prediction-date environment unless timestamps
   indicate otherwise.
5. Missing data is never imputed silently: cells with no OSM features at all are flagged
   `low_data` rather than scored as if observed.
