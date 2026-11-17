# Research Design

## Research questions

- **RQ1 — Neighborhood quality.** To what extent can open geospatial data (OpenStreetMap)
  explain variation in neighborhood quality across Bangkok, and how well do the resulting
  scores agree with human judgments?
- **RQ2 — Multimodality.** Do street-level and satellite visual signals add predictive value
  for neighborhood quality and land price *beyond* geographic + POI features (ablation:
  geo-only → +POI → +visual → full multimodal)?
- **RQ3 — Land price.** Can an explainable gradient-boosted model estimate price per square
  wah in Bangkok with useful accuracy and honest uncertainty (prediction intervals,
  coverage), given a real land/listing dataset?
- **RQ4 — Recommendation.** Does weighted preference modeling with explainable ranking
  produce location recommendations users judge more relevant than baseline heuristics
  (e.g., top-overall-quality ranking)?

## Hypotheses

- **H1.** Transit accessibility and POI density/diversity are the strongest explainers of
  perceived neighborhood quality in Bangkok (expected top SHAP / top weighted dimensions).
- **H2.** Adding visual features reduces land-price error (MAE/RMSE) versus the
  geographic/POI-only baseline — the core multimodal claim, tested by ablation.
- **H3.** Random k-fold splits overstate performance on spatially correlated data; spatial
  block cross-validation (cluster CV over hex cells) yields materially lower, honest metrics.
- **H4.** Explanations (SHAP, per-dimension quality breakdowns, comparable-location
  analysis) align with domain priors: transit corridors and commercial land use drive price;
  greenery drives perceived quality.

## Baselines

- **Land price:** (a) median/mean price per district (intercept-style), (b) geographic-only
  GBM (distances to CBD/BTS, land-use shares), (c) geo+POI GBM, (d) geo+visual, (e) full
  multimodal model.
- **Neighborhood quality:** (a) the deterministic index from Phase 1 (documented formulas,
  fixed weights) as the baseline, (b) a model trained to predict human annotations, compared
  on held-out cells.
- **Recommendation:** (a) top-overall-quality ranking, (b) hard-filter baseline, (c) weighted
  preference model with explanations.

## Evaluation

- **Land price:** MAE, RMSE, R², MAPE (all in THB / sq. wah and log-transformed space),
  plus prediction-interval coverage and width. R² alone is never relied on.
- **Recommendation:** Precision@K and NDCG@K where ground truth exists (user-chosen
  favorites in a small user study); otherwise ranking-quality proxies (diversity of top-K,
  preference-satisfaction via held-out preference weighting).
- **Neighborhood quality:** correlation / agreement (Pearson, Spearman, Kendall τ, ICC)
  between system scores and human annotations on a labeled subset; per-dimension agreement.
- **Multimodal ablation:** ΔMAE/ΔRMSE per modality stack with significance testing
  (paired bootstrap or Diebold-Mariano-style comparison on spatial folds).

## Data leakage control (mandatory)

- **Temporal:** prediction date is fixed and documented. No feature may use information that
  only becomes available after that date (e.g., new transit lines, POIs opened later). OSM
  element `timestamp` fields are used to filter features to the prediction date.
- **Spatial:** no random split of spatially correlated cells. Use **spatial block CV**
  (grouped by hex-cell cluster / district) and **time-aware validation** when listings carry
  dates. Train/test separated at the cell or cluster level, never by random rows.
- **Leakage audit:** a checklist in the model-training pipeline rejects features derived
  from the target (e.g., price-adjacent listing text) and enforces that test cells never
  contribute to feature statistics used in training (fit scalers/encoders on train folds only).

## Explainability plan

- **Land price:** SHAP (TreeSHAP) per prediction + global importance; comparable-location
  analysis (nearest cells in feature space with known prices); prediction intervals
  (quantile regression / conformal) instead of fabricated confidence.
- **Neighborhood quality:** every dimension is a published deterministic formula; the
  aggregate score is a documented weighted sum — contributions per dimension are shown
  rather than post-hoc rationalized.
- **Recommendation:** the match score is decomposed into per-preference contributions;
  positive/negative factors are the actual signed contributions, never invented.

## Limitations (to be documented in the final report)

- OSM completeness is uneven (denser, fresher in central Bangkok); completeness bias is a
  threat to validity and is quantified where possible.
- No bundled land-price data yet; listing/assessed-price sources have self-selection and
  coverage biases. `docs/DATA.md` details the price-type distinction.
- Imagery coverage is uneven; visual models will be evaluated only where imagery exists.
- Cross-sectional design: correlations are not causal; no claim of price prediction as
  appraisal advice.
