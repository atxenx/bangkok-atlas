# Architecture diagram verification

Checked against the current implementation on 7 October 2026. These diagrams show the implemented prototype.

The overview shows logical batch data flow and runtime boundaries. Batch commands persist their outputs between stages: `features` reloads `data/raw/*.parquet`; `quality` reloads `features.parquet`. The file-store-to-API connection represents reads across all stores in that group. The backend diagram's junction line represents API dispatch and results; it is not an additional message broker or a set of independently deployed services. Arrowless connections inside the web client show parts of its implementation, not a sequence of calls.

## Source mapping

| Diagram component | Implementation and verified responsibility |
| --- | --- |
| OSM Overpass / Fetch and Clean | `backend/bangkok_ai/osm_fetcher.py`; CLI `fetch`: queries, deduplicates and saves real OSM layers to GeoJSON and Parquet. |
| 300m Hex Features | `grid.py`, `features.py`, CLI `grid` / `features`: 300 m **hex edge length**, metric joins in EPSG:32647, counts, distances, densities, diversity and land-use shares. |
| 9D Quality Index | `quality.py`, CLI `quality`: deterministic 0–100 dimensions and weighted contributions saved to `dims.parquet`. |
| Raw OSM Layers | `data/raw/`: transit, POIs, roads, land use, greenery and water. |
| Cells and Features | `cells_utm.parquet`, `cells_wgs84.parquet`, `features.parquet`; `store.py` provides file loaders. |
| Scores and Contributions | `dims.parquet` contains dimensions, quality and contributions; positive/negative factors are computed in API responses. |
| Treasury CSV / Appraisal Index | `backend/scripts/build_treasury_index.py`: actual Treasury CSV aggregated to 500 m / 2 km sheets and districts. Treasury sheet coordinates use EPSG:24047; location matching transforms coordinates accordingly. |
| Treasury and Map Data | `treasury_price_index.json`, district GeoJSON, transit line JSON, cached 3D buildings and curated district / neighborhood / landmark data. |
| FastAPI REST Services | `api.py`, startup `_load_data`: loads file snapshots into memory; serves grid, location, recommendations, health, presets, searches, district/station/rail data, buildings and Treasury endpoints. |
| Next js MapLibre App | `frontend/src/app/explore/page.tsx`, `MapView.tsx`, `PreferencesPanel.tsx`, `ResultsList.tsx`, `SearchBar.tsx`, `LocationDetail.tsx`: 3D map, quality overlay, search, input preferences, results and details. |
| Client Ranking Fallback | `frontend/src/lib/api.ts: fallbackRecommendFromGrid`; invoked by the explore page if API recommendations fail. |
| Bundled Map JSON | `frontend/public/data/` and frontend map utilities; static map assets remain available when API map assets cannot be loaded. |
| OSM CARTO Esri Tiles | Frontend basemap configurations: display raster and satellite imagery. |
| Street View Mapillary | External verification links constructed in the location response and shown in the frontend. |
| Context and Comparables | `admin_geo.py`, `recommend.py:comparables`, `api.py:location`: district / neighborhood / station context, dimension breakdown, and nearby comparable cells. |
| Weighted Top K | `recommend.py:top_recommendations`: preference weights, district filters, land-use weight adjustment, exclusion of low-data cells. **Budget does not filter or change rankings.** |
| Area Price Reference | `treasury_reference.py`, `land_price.py`, `official_road_reference.py`: nearby Treasury sheet / district median and P10–P90; optional 500 m live API refresh; labeled model fallback and road-context benchmark. It is an area reference, not an identified parcel appraisal. |
| OSM Street Proxies | `street_visual.py`: mapped greenery, walkability-network and sky-openness proxies plus street typology; computed from OSM features. |
| Rule Based Memo | `memo.py`; `api.py:location` calls it using scores, context, price reference and feature summaries. |
| Map Layers and Search | `api.py`: search, district/station/line data, 3D buildings and building-name lookup; includes local snapshots and relevant upstream fallbacks. |
| Parcel ID Lookup | `official_land_price.py`, `/api/official-land-price`: requires six independently supplied parcel identifiers. Available through the API; the map UI does not automatically identify parcels or present this manual endpoint. |
| In Memory Cache | `app.state` dataframes, `lru_cache` grid / layers / Treasury index, and Treasury live-cache dictionaries. |

## Scope

The current system combines geospatial indicators, appraisal records, 3D map assets and imagery links. The quality index is deterministic; memo generation uses local rules. File storage is Parquet/GeoJSON/JSON. No external LLM or PostGIS is implemented. Street imagery is not ingested or analyzed by a vision model.

Trained visual encoders, multimodal fusion, supervised price training, spatial cross-validation and SHAP are research plans in `docs/RESEARCH.md`; they are not implemented modules and are not shown as deployed components here.
