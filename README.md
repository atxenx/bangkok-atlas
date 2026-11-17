# Bangkok Atlas

Bangkok Atlas is an interactive map for exploring and comparing neighborhoods across Bangkok. It brings together rail access, everyday amenities, green space, 3D buildings, and published land appraisal context in one place. Select a location to see its neighborhood score, the factors that contribute to it, and the evidence behind the price information.

The repository includes a working demo snapshot with 6,594 neighborhood cells, 50 district outlines, 256 mapped stations, and 2,531 building footprints with recorded heights. You can start the demo immediately after installing dependencies.

[Run locally](#run-locally) · [Explore the map](#explore-the-map) · [Scoring method](#neighborhood-scoring) · [Data and sources](#data-and-sources) · [API](#api) · [Testing](#testing)

## Run locally

### Requirements

- [Git](https://git-scm.com/) to clone the repository.
- [Python 3.11](https://www.python.org/downloads/) for the backend. The Python packages in `backend/requirements.txt` are pinned to the versions used for the demo.
- [Node.js](https://nodejs.org/) 20.9 or newer with npm. Node.js 22 is the tested version. The frontend install uses `package-lock.json`.
- A modern browser with WebGL support for the interactive map and 3D view.
- Internet access to install packages and load map tiles. The local setup needs no API keys.

### 1. Get the project

```bash
git clone https://github.com/atxenx/bangkok-atlas.git
cd bangkok-atlas
```

### 2. Start the backend

On macOS or Linux, run the following from the repository root.

```bash
cd backend
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m bangkok_ai.cli serve --host 127.0.0.1 --port 8000
```

On Windows, use PowerShell and the Python launcher.

```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m bangkok_ai.cli serve --host 127.0.0.1 --port 8000
```

Leave this terminal running. Open [API health](http://127.0.0.1:8000/api/health) and check for `"status": "ok"`. The response also reports the loaded cell, station, and building counts.

### 3. Start the frontend

Open another terminal at the repository root.

```bash
cd frontend
npm ci
npm run dev
```

Open [Bangkok Atlas](http://localhost:3000) or go straight to the [interactive map](http://localhost:3000/explore). The frontend sends API requests to `http://127.0.0.1:8000` by default. The startup script copies the MapLibre worker from the installed npm package into the frontend's served assets.

### Optional configuration

If the backend uses a different port or host, set the following in `frontend/.env.local` and restart the frontend. Use a URL that the user's browser can reach.

```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8010
```

For a production frontend build, run `npm run build` and then `npm start` from `frontend/`. Set `NEXT_PUBLIC_API_URL` before building if you need a different API URL, since Next.js includes the public setting in browser code at build time. Keep the backend running independently.

## Explore the map

1. Search for a rail station, district, neighborhood, or landmark. Try **Siam**, **Bang Rak**, or **ICONSIAM**.
2. Turn on the layers you want to compare, such as neighborhood scores, district outlines, rail lines, or 3D buildings.
3. Select a map cell to read its nine scores, strongest contributors, nearby transport, and area appraisal context. Select an available building footprint to inspect its name and surroundings.
4. Adjust the recommendation sliders or start with a preset to rank neighborhoods against your priorities. The map interface supports English and Thai.

Budget and land size can be entered for context. The recommendation ranking uses neighborhood scores and user preferences. A reliable parcel-level value requires independent parcel evidence.

## Neighborhood scoring

Bangkok Atlas divides its study area into hexagons with **300 m edges**. The feature pipeline uses a metric projection (WGS 84 / UTM zone 47N, EPSG:32647) for distance and area calculations. The API returns map geometry in WGS 84 (EPSG:4326).

Each dimension is scored from 0 to 100 using explicit formulas. The overall neighborhood score is the weighted sum of the nine dimensions. Recommendation weights can differ from the defaults.

| Dimension | Default weight | Example inputs |
| --- | ---: | --- |
| Transit access | 28% | Distance to rail stations and nearby transit stops |
| Daily amenities | 14% | Density and diversity of mapped places |
| Walkability | 12% | Minor-road and road-network density, plus station proximity |
| Green space | 10% | Mapped green-area share and distance to green space |
| Road access | 9% | Distance to major roads and overall road density |
| Commercial activity | 10% | Commercial land use, shops, and station proximity |
| Residential balance | 7% | Mapped residential, commercial, and industrial land use |
| Quietness | 5% | Major-road exposure and commercial intensity |
| Environmental context | 5% | Mapped greenery, water, and industrial and road exposure |

Low-data cells are flagged. Walkability, canopy, and other street-level indicators are **proxies** computed from mapped features. The map links to external street imagery for inspection. Place summaries are generated by local rules. See the [feature pipeline](backend/bangkok_ai/features.py) and [scoring formulas](backend/bangkok_ai/quality.py) for implementation details.

### Reading appraisal figures

The app summarizes published Thai Treasury Department land appraisals in **THB per square wah**. An area reference can come from a 500 m tile, a 2 km sheet, or the district, depending on coverage. The app identifies the source and shows the available sample context. One square wah equals four square meters.

Area references describe nearby appraisal records. A click on the map selects a location cell and carries no legal parcel identifier. The models and road benchmarks are labeled separately in the location details. Use the [Treasury Department's official lookup](https://assessprice.treasury.go.th/) for a specific parcel or an official figure.

## Data and sources

| Snapshot | Used for |
| --- | --- |
| `data/processed/cells_wgs84.parquet`, `features.parquet`, `dims.parquet` | Backend startup, grid geometry, feature values, and quality scores |
| `data/processed/districts.geojson`, `buildings_3d.geojson` | District overlay and cached 3D footprints |
| `data/processed/treasury_price_index.json` | Aggregated Treasury tile, sheet, and district references |
| `data/raw/transit.parquet`, `lines.json` | Station locations, route geometry, and rail line memberships |
| `data/raw/poi.geojson` | Local lookup for named buildings and nearby places |
| `data/raw/bangkok_boundary.geojson` | Bangkok boundary used when generating the grid |
| `frontend/public/data/`, `frontend/src/lib/green-spaces.json` | Frontend map assets and green-space layer data |

The snapshot is sufficient to start the demo. Full Overpass downloads, intermediate spatial files, virtual environments, and build caches are created locally when needed. Basemaps and live Treasury lookups use external services, so their availability and current values can vary.

- **OpenStreetMap data** © OpenStreetMap contributors. The OSM extracts and OSM-derived database contents are distributed under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). See [OpenStreetMap attribution and licensing](https://www.openstreetmap.org/copyright).
- **Treasury appraisals** come from the [Thai Government Open Data catalog](https://data.go.th/dataset/land-valuation). The repository ships aggregate summaries. Source version and processing metadata are embedded in the index.
- **Map services** include [OpenFreeMap](https://openfreemap.org/), [OpenMapTiles](https://openmaptiles.org/), [CARTO](https://carto.com/), OpenStreetMap, and [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9). Provider credits are displayed in the map.
- **Park trees** are illustrative 3D points generated within mapped green-space polygons. See [green-space sources and maintenance](docs/GREEN_SPACES.md).

### Rebuild the neighborhood snapshot

The normal installation uses the committed snapshot. To refresh the neighborhood data from OpenStreetMap, run these commands from `backend/` with the virtual environment activated.

```bash
python -m bangkok_ai.cli fetch
python -m bangkok_ai.cli grid
python -m bangkok_ai.cli features
python -m bangkok_ai.cli quality
python -m bangkok_ai.lines
```

The fetch is substantially larger than the demo snapshot and depends on public Overpass capacity. A refresh can change cell statistics, scores, and available map names. Restart the API after updating any snapshot file.

To regenerate the Treasury reference index, obtain the Bangkok appraisal CSV from the source catalog. The command below runs from the repository root with the backend environment active. Replace the CSV path and the sample source date with those of your downloaded resource.

```bash
python backend/scripts/build_treasury_index.py \
  /path/to/land_10_bangkok.csv \
  data/processed/treasury_price_index.json \
  --source-modified YYYY-MM-DD \
  --districts data/processed/districts.geojson
```

## API

The running backend provides [interactive API documentation](http://127.0.0.1:8000/docs).

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/health` | Service status and loaded snapshot counts |
| GET | `/api/grid` | Neighborhood GeoJSON with score values |
| GET | `/api/location/{hex_id}` | Scores, factors, price references, and context for one cell |
| GET | `/api/search?q=Siam` | Search for stations, districts, neighborhoods, and landmarks |
| GET | `/api/stations` | Rapid transit stations, lines, and routes |
| GET | `/api/districts` | District boundary features and area summaries |
| GET | `/api/buildings-3d` | Cached building footprints with explicit OSM heights |
| GET | `/api/presets` | Recommendation weight presets |
| POST | `/api/recommend` | Ranked neighborhood matches for the supplied preferences |
| GET | `/api/treasury-sheet-price` | Optional live reference for a nearby Treasury sheet |
| GET | `/api/official-land-price` | Treasury lookup using all six required parcel identifiers |

Example requests from a terminal with `curl` installed.

```bash
curl -fsS http://127.0.0.1:8000/api/health
curl -fsS 'http://127.0.0.1:8000/api/search?q=Siam'
curl -fsS http://127.0.0.1:8000/api/recommend \
  -H 'Content-Type: application/json' \
  -d '{"k": 5, "weights": {"transit": 90, "greenery": 70}}'
```

## Architecture

```text
OpenStreetMap extracts → Spatial features → Neighborhood scores
                                               ↓
Treasury summaries and cached map layers → FastAPI → Next.js and MapLibre
```

- [`backend/bangkok_ai/`](backend/bangkok_ai/) contains the FastAPI routes, spatial pipeline, scoring logic, and recommendation engine. GeoPandas, Shapely, and PyArrow handle the spatial inputs and snapshot files.
- [`frontend/`](frontend/) contains the Next.js App Router interface, TypeScript API client, and MapLibre map.
- [`backend/tests/`](backend/tests/) covers the grid, scoring, API behavior, appraisal parsing, and recommendations.
- [`docs/`](docs/) includes [architecture notes](docs/diagrams/ARCHITECTURE_NOTES.md), [data documentation](docs/DATA.md), and the [research design](docs/RESEARCH.md).

## Testing

Run the backend suite from `backend/`. On Windows, substitute `.venv\Scripts\python.exe` for `.venv/bin/python`.

```bash
.venv/bin/python -m pytest
```

From `frontend/`, install dependencies with `npm ci` first, then check lint and the production build.

```bash
npm run lint
npm run build
```

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Backend reports `Processed data missing` | Check that all three required Parquet files listed above are present under `data/processed/`. Clone or extract the complete repository. |
| Python reports a missing Parquet engine | Run the requirements install using the same virtual environment interpreter that starts FastAPI. `pyarrow` is included. |
| The dashboard cannot load neighborhood data | Open the health URL directly. Check that `NEXT_PUBLIC_API_URL` matches the running API and restart the frontend after changing it. |
| The frontend build reports an unsupported Node.js version | Check `node --version` and use Node.js 20.9 or newer. |
| The 3D view or background tiles fail to load | Confirm WebGL is enabled and your network can reach the map providers. Try another basemap in the layer control. |
| A live appraisal request is unavailable | The local area index is still available when it has coverage. Use the official Treasury lookup to confirm a specific parcel. |

## License

The original software is distributed under the [MIT License](LICENSE). See [Data and sources](#data-and-sources) for dataset licensing and attribution.
