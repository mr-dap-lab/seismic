# Predictor integration audit

## Reusable foundation

- `global_forecast.py` provides the correct product concept: a gridded probability/rate surface, not a claim about the exact next earthquake.
- `hybrid_model.py` provides the reusable ETAS-family triggering kernel, Gutenberg–Richter scaling context, Poisson likelihood, held-out information gain, and component ablation.
- `backtest.py` uses the right evaluation discipline: every forecast origin is trained only on earlier events and scored on unseen events with information gain, N-tests, and S-tests.
- `usgs.py` and `usgs_client.py` contain useful USGS normalization, caching, validation, request splitting, and truncation safeguards.

## Blocking gaps in the supplied Python package

The files compile syntactically, but the scientific pipeline cannot run end-to-end from this folder because it imports modules that are not included:

- `eq_forecast` (`estimate_mc`, `estimate_b`, `fit_omori`)
- `geophysics` (`decluster_gardner_knopoff`, `tidal_potential`)
- `plate_kinematics` is discussed in `API_REFACTOR.md` but is absent.

The code also requires Python packages that are not part of the deployed Next.js/Vercel runtime: NumPy, pandas, SciPy, and requests.

## Scientific constraints applied to the web feature

- The interface uses the term **probabilistic forecast**, never deterministic prediction.
- Smoothed historical seismicity is the primary spatial baseline.
- Target-magnitude rates use Gutenberg–Richter scaling.
- Recent local clustering uses an ETAS-family time/space kernel.
- Per-cell probabilities use a Poisson occurrence model.
- Remote dynamic triggering is exposed only as an experimental, capped proxy. It is disabled by default.
- Gravity/tidal modulation is exposed only as an experimental, capped proxy. It is disabled by default.
- Earth rotation and revolution are explicitly shown with zero forecast weight because no reliable global predictive skill has been established.
- Experimental factors should enter the production ranking only after prospective or strict walk-forward testing demonstrates positive information gain beyond the smoothed-seismicity baseline.

## Web implementation mapping

| Python foundation | Web implementation |
|---|---|
| `usgs_client.py` count-safe historical catalog | Cached Next.js `/api/forecast-catalog` endpoint using the official USGS FDSN service |
| `smoothed_seismicity()` | Normalized global grid with distance-kernel smoothing |
| Gutenberg–Richter target scaling | Global rate scaled from catalog completeness magnitude to selected target magnitude |
| `_triggering_intensity()` | Client-side ETAS-family recent-event kernel |
| `GlobalGrid.probability()` | `1 - exp(-rate × horizon)` per grid cell |
| tidal envelope | Optional spring–neap diagnostic capped at ±1% |
| remote plate/continent interaction request | Optional recent M7+ dynamic-stress proxy capped to 3% of spatial weighting |
| `walk_forward()` and ablation | Preserved as the required validation gate; not misrepresented as completed prospective validation |

## Required next research step

Before calling any experimental component operational, restore the missing Python modules, pin a reproducible environment, fetch a sufficiently long USGS catalog, and run multi-fold walk-forward tests. Publish the mean information gain, uncertainty, N-test/S-test pass rates, and leave-one-component-out ablation. A visually compelling map is not evidence of predictive skill.
