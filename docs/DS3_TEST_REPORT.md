# Bangkok Atlas DS3 Test Report

**Test date** 19 November 2026 (Thailand time)

**Build tested** Local workspace based on commit `218adf9`, including the Flood Analysis feature

**Environment** macOS, headless Chrome with WebGL, Next.js 16.3.0 production build, Node.js 22.18.0, and FastAPI on Python 3.11.4

The tables group **90 passed checks**, including **24 simulated checks**. A simulated check uses controlled inputs or an injected service response. The browser suite also recorded one demonstration failure for Golden Locations with the bundled data (UI-06).

| Test suite | Result |
| --- | --- |
| Backend pytest | 82/82 passed |
| HTTP API integration | 13/13 groups passed |
| Browser end-to-end | 22/23 passed |
| Additional eligibility and flood rule checks | 17/17 passed |
| Frontend lint, production build, and browser smoke test | All passed |

## Part 1 · Landing page, language, and mobile layout

| Checks | Scenario | Expected result | Observed result | Status |
| --- | --- | --- | --- | --- |
| NAV-01–02 | Landing page links and **Open the map** | Navigate to the selected section or open Explore | All three section links worked, and Explore opened with the light basemap (UI-01) | PASS |
| NAV-03–04 | Switch between English and Thai, then reload | Update the interface and retain the language | The map controls switched languages, and Thai persisted after reload (UI-02) | PASS |
| NAV-05 | Open both pages and search for Siam at 390 × 844 px | Fit the mobile viewport and open the analysis | Both pages fit without horizontal overflow, and the analysis opened (UI-21) | PASS |

## Part 2 · 2D map and data layers

| Checks | Scenario | Expected result | Observed result | Status |
| --- | --- | --- | --- | --- |
| MAP-01–03 | Zoom in and switch basemaps | Increase zoom and load each selected style | Zoom increased from 11.5 to 12.5. Light, dark, OpenStreetMap, and Esri satellite basemaps loaded (UI-03) | PASS |
| MAP-04–05 | Toggle the score overlay and open its legend | Show and hide scores and explain cells with limited data | The overlay could be enabled or cleared, and the legend described insufficient OpenStreetMap data (UI-04) | PASS |
| MAP-06–07 | Toggle district boundaries and neighborhood labels | Show and hide each layer independently | Both layers responded. The API returned 50 districts and 37 neighborhoods (UI-04, API-03) | PASS |
| MAP-08–10 | Show rail stations and toggle one or all lines | Display stations and update line visibility | All nine line controls worked. The API returned 256 stations and 11 routes (UI-05, API-03) | PASS |

## Part 3 · 3D buildings and green spaces

| Checks | Scenario | Expected result | Observed result | Status |
| --- | --- | --- | --- | --- |
| VIS-01–03 | Open 3D, jump to Silom, reset the camera, and return to 2D | Render buildings and apply the correct camera settings | The test view rendered 377 building features. The camera reached Silom, reset to 58° pitch, then returned to 0° pitch and bearing in 2D (UI-07, UI-10) | PASS |
| VIS-04–06 | Select a building and validate its geometry | Identify the building, open nearby analysis, and reject invalid footprints | The popup identified Fraser Suites Sukhumvit and opened the cell analysis. The API matched ICONSIAM and returned HTTP 422 for invalid geometry (UI-08, API-05) | PASS |
| VIS-07–08 | Open the parks layer, select Lumphini Park, then hide the layer | Show park locations, boundaries, and illustrative trees | The layer showed 31 park markers and the Lumphini Park boundary. The view rendered 1,032 tree components, and all park markers cleared when the layer was hidden (UI-09) | PASS |

## Part 4 · Search and location analysis

| Checks | Scenario | Expected result | Observed result | Status |
| --- | --- | --- | --- | --- |
| LOC-01–04 | Search for a station, district, neighborhood, and landmark | Return the correct result types, including for a Thai query | Siam, Bang Rak in Thai, Thong Lo, and ICONSIAM returned their expected result types (UI-11, API-04) | PASS |
| LOC-05–08 | Select a result by keyboard or a map click, try an unmatched search, and clear the query | Open the selected cell or show an empty state as appropriate | Keyboard and map selection opened Deep Analysis. An unmatched query displayed “No matching locations found,” and clearing closed the list (UI-10, UI-11, UI-12) | PASS |
| LOC-09–10 | Review the location score and context | Show nine dimension scores, nearby transit, reasoning, and comparable locations | The sample scored 80.8 overall. The dimensions passed range and contribution checks, and the API returned three comparable locations (UI-13, API-07) | PASS |
| LOC-11–12 | Review street-form indices and the Investment Memo | Show the indices, imagery links, and memo | Deep Analysis displayed both sections with Street View and Mapillary links. All 10 memo tests passed (UI-15, API-07, `test_memo.py`) | PASS |

## Part 5 · Land appraisal and Golden Locations

| Checks | Scenario | Expected result | Observed result | Status |
| --- | --- | --- | --- | --- |
| VAL-01–03 | View Siam appraisals and request live sheet data | Show local appraisal statistics, a road-level range, and the official source | The page showed the median, 10th–90th percentile range, and Treasury Department link. The live sample sheet median was THB 400,000 per square wah (UI-14, API-07, API-11) | PASS |
| VAL-04–06 | Submit valid parcel identifiers, incomplete input, and an out-of-range latitude | Return a matching parcel and reject invalid requests | The live service returned one matching parcel. Incomplete input and the invalid latitude returned HTTP 422 (API-11, API-12) | PASS |
| VAL-07 | Receive a record for a different parcel | Reject the mismatch | The service rejected the record (`test_rejects_mismatched_upstream_parcel`) | PASS · Simulated |
| GL-01 | Check eligibility for the bundled dataset | Flag only cells with a median of at least THB 600,000 per square wah | The highest median among 6,594 cells was THB 550,000 per square wah, so zero cells qualified (GL-01) | PASS |
| GL-02–04 | Test values just below, at, and above the eligibility threshold | Include values at and above THB 600,000 per square wah | THB 599,999 was ineligible. THB 600,000 and 600,001 were eligible (GL-02–04) | PASS · Simulated |
| GL-05–06 | Open and close Golden Locations with 20 eligible test cells | Highlight eligible areas and close the status banner when the mode exits | Gold highlights appeared, and the banner closed (UI-23) | PASS · Simulated |
| UI-06 | Demonstrate Golden Locations using the bundled dataset | Show at least one highlighted area | No highlights appeared because no bundled cells met the eligibility threshold | **FAIL** |

## Part 6 · Preferences and location ranking

| Checks | Scenario | Expected result | Observed result | Status |
| --- | --- | --- | --- | --- |
| REC-01–03 | Load presets, select Golden Locations, and adjust a weight | Apply the preset and submit edits to the ranking API | The API returned seven profiles. The selected profile sent nine weights, and the request reflected the adjusted Transit weight (API-06, UI-17, UI-18) | PASS |
| REC-04–05 | Rank locations before and after changing weights | Return 12 results in descending score order and update the ranking | The default order was valid, and the top-ranked cell changed after the weight adjustment (API-06) | PASS |
| REC-06–10 | Set or clear a district, specify land use, and enter a budget and lot size | Apply the selected filters, handle an unknown district, and preserve ranking for budget and lot-size changes alone | Bang Rak returned 12 results and an unknown district returned none. The frontend sent commercial land use and both financial inputs, and the ranking stayed the same when only budget and lot size changed (API-06, UI-18) | PASS |
| REC-11 | Simulate HTTP 503 after the grid loads | Display fallback recommendations | The frontend displayed 12 fallback recommendations (UI-19) | PASS · Simulated |

## Part 7 · Flood analysis

Select a location in **Explore** and open **Deep Analysis → Flood analysis**. The card requests `GET /api/flood/location/{hex_id}` for the selected cell and refreshes every two minutes. The interface supports English and Thai and displays timestamps in Bangkok time.

- **24-hour outlook.** The API totals the next 24 complete hourly intervals from Open-Meteo. Watch starts at 10.1 mm of forecast rain or a fresh local reading of 1 cm. High Watch starts at 90.1 mm, or at 35.1 mm with qualifying multi-year local flood history.
- **20-year history.** The card summarizes available records from GISTDA and the 2026 EOS-RS satellite flood mapping, district-level main-road flood reports, and documented local events. Mapped overlap is measured for the selected hexagonal cell. Road reports and documented events are matched by district.
- **Latest road water depth.** The card displays the maximum fresh reading within 500 m from Bangkok Metropolitan Administration sensors via POPNIX. If none is available, it shows the nearest fresh reference sensor within 2 km. Readings older than 30 minutes are excluded, and capped readings display as a lower bound.

The outlook is a rule-based screen for neighborhood-level street flooding. The forecast, historical records, and sensor readings cover different areas and time periods.

| Checks | Scenario | Expected result | Observed result | Status |
| --- | --- | --- | --- | --- |
| FL-01–02 | Open the flood card and request a live forecast | Show the outlook, flood history, and latest depth | All three sections appeared. The sample forecast showed 0 mm and Low signal through 13:00 on 20 November, Thailand time (UI-16, API-10) | PASS |
| FL-03–06 | Check flood maps, road reports, and documented events | Return historical overlap by year along with local records | The API found 4,228 overlapping cells for 2011. Cell `300m-r17-c29` had 11.831% overlap in 2011 and 18.113% in 2026. The Pathum Wan road reports showed 10–30 cm, and Don Mueang's 2011 event included its source (API-08, API-13, UI-16) | PASS |
| FL-07–08 | Request live water-level data and open a location | Distinguish recent readings and display depth with a timestamp | The feed reported recent readings from 237 of 248 sensors. Siam displayed a timestamped reading of 0 cm (API-09, UI-16) | PASS |
| FL-09 | Submit complete and incomplete hourly rainfall series | Sum the next 24 hours and reject missing values | The complete series totaled 12 mm at 0.5 mm/h. The incomplete series returned `null` (`test_rain_window_sums_24_future_hours`) | PASS · Simulated |
| FL-10–14 | Test sensor depth categories and the measurement cap | Apply the expected depth classifications | 0 cm returned Dry, 1 cm Light, 11 cm Moderate, and 25 cm Heavy. A capped 20 cm reading returned At least Moderate (FL-10–14) | PASS · Simulated |
| FL-15–16 | Submit missing, stale, or offline readings | Exclude invalid readings and use the nearest valid reference sensor when needed | Invalid readings were marked unknown. A valid reference sensor returned 12 cm while the local reading remained unset (`test_live_road_depth_separates_zero_capped_and_missing`, `test_only_nearest_fresh_sensor_is_used_as_an_adjacent_reference`) | PASS · Simulated |
| FL-17 | Simulate HTTP 503 from the flood API | Show a service message and keep the location analysis visible | The service message appeared and the location score remained visible (UI-20) | PASS · Simulated |
| FL-18–25 | Test rainfall thresholds, local sensor readings, and missing forecasts | Apply the outlook rules at each boundary | Results changed from Low to Watch at 10.1 mm, and from Watch to High at 35.1 mm with recurring flood history or 90.1 mm without it. A fresh local reading of 1 cm triggered Watch, and a missing forecast returned `null` (FL-18–25) | PASS · Simulated |

## Part 8 · Data processing and system readiness

| Checks | Scenario | Expected result | Observed result | Status |
| --- | --- | --- | --- | --- |
| SYS-01–03 | Check API health and docs, request both grid formats, and use an unknown cell ID | Confirm readiness and return the correct data or error | The API reported 6,594 cells, 256 stations, and 2,531 buildings. Both grid formats returned the same cells, only the full grid included component scores, and invalid cell IDs returned HTTP 404 (API-01, API-02, API-07, API-08) | PASS |
| SYS-04–05 | Rebuild from separate road files and validate the resulting scores | Combine the road data, generate features, and keep all scores within 0–100 | The CLI generated 6,594 cells and 42 feature columns. It detected roads in 6,343 cells, and all scores were in range (CLI run) | PASS |
| SYS-06 | Check Chrome for uncaught exceptions | Complete the browser suite without uncaught exceptions | Chrome reported zero uncaught exceptions (UI-22) | PASS |

## Scope and evidence

Testing covered desktop Chrome at 1440 × 960 px, an emulated mobile viewport at 390 × 844 px, HTTP APIs, local data processing, and live services called by the app. Imagery checks covered URLs and coordinates. Physical devices and full citywide source downloads were outside the scope.

The original test run fixed road-file merging, park boundary rendering during map load, and smoke-test handling of appraisal labels.

- [Test results and controlled inputs (JSON)](ds3-evidence/test-evidence.json)
- [3D map test screenshot](ds3-evidence/map-3d.png)
- [Flood analysis test screenshot](ds3-evidence/flood-analysis.png)
- [Road-file merging](../backend/bangkok_ai/cli.py), [park boundary rendering](../frontend/src/lib/green-space-layer.ts), [browser smoke test](../frontend/scripts/browser-smoke.mjs), and [Golden Locations eligibility rule](../backend/bangkok_ai/land_price.py)
