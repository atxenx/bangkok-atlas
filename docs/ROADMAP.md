# Roadmap

Incremental phases. Each phase: goal → inspect → dependencies → implement → test → report →
next step. **Nothing is faked; missing data is listed as missing.**

## Phase 1 — Foundation ✅ complete

Real OSM data, explainable neighborhood quality, interactive map.

- [x] Environment & network recon; dataset inventory (none local; OSM available)
- [x] Repo scaffolding + RESEARCH / DATA / ARCHITECTURE docs
- [x] OSM fetch pipeline (transit, POIs, landuse, greenery, water, roads)
- [x] Hex grid + spatial feature engineering + quality scoring (tests)
- [x] FastAPI backend: grid / location / recommend
- [x] Next.js + MapLibre dashboard with preference-based "Find Best Areas"

## Phase 2 — Land-price machine learning (needs real data first)

1. Acquire land-price data (DOL assessed tables or documented manual listing collection)
   with as-of dates and price-type tags → `docs/DATA.md` updated.
2. Building density fetch (area-divided Overpass) + remaining features.
3. GBM baselines (geo-only → geo+POI) with **spatial block CV**; report MAE/RMSE/R²/MAPE.
4. Uncertainty: quantile/conformal prediction intervals with coverage reporting.
5. SHAP explainability + comparable-location analysis; wire into `/api/location`.
6. Recommendation upgrades: budget/land-size/land-use become real filters on price surface.

## Phase 3 — Multimodal imagery

1. Mapillary street imagery (free API; coverage census per cell); Sentinel-2 NDVI/land-cover
   (free tier).
2. Vision encoders (pretrained CNN / ViT) for street scenes → cell-level visual features.
3. Ablation study (geo → +POI → +visual → full) with the Phase 2 pipeline; significance
   testing per RESEARCH.md.

## Phase 4 — Human annotation & quality learning

1. Annotation rubric + collection (50–100 cells, ≥3 raters); ICC.
2. Learn quality weights from labels; compare learned vs. fixed-index scores on held-out
   cells (Pearson/Spearman/Kendall-τ).
3. User study for recommendation evaluation (Precision@K / NDCG@K where ground truth exists).

## Phase 5 — Hardening & thesis write-up

- Leakage audit checklist execution; error analysis (residual maps by district);
- PostGIS migration if needed; deployment for demo; final report.

## Open risks

- Land-price acquisition is the critical path (worst case: documented pilot set of a few
  hundred soi-level observations).
- Imagery coverage gaps may restrict the visual analysis to a subset of cells.
- OSM completeness bias — quantify and disclose.
