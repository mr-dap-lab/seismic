# Disclaimer and Methodology Disclosure

**Software:** Probabilistic Seismicity Forecasting Toolkit
**Version documented:** as delivered
**Document date:** 16 August 2026

> **This document is not legal advice.** It was prepared by an AI assistant, not
> an attorney. The technical disclosures in Sections 3–9 are accurate to the
> delivered code. The liability language in Sections 1, 2, and 10 is drafted in
> good faith but **must be reviewed by qualified legal counsel** before being
> relied upon in any commercial, published, or client-facing context. Liability
> limitations are governed by jurisdiction-specific law and consumer-protection
> statutes that may render some provisions unenforceable.

---

## 1. Primary disclaimer

**This software does not predict earthquakes.**

It produces **probabilistic forecasts** — statements of the form *"the estimated
probability of at least one event of magnitude ≥ M within region R over the next
N hours is X%"*. It does not, and cannot, state that an earthquake will occur at
a particular place, at a particular time, or of a particular magnitude.

No method presently known to seismology can do so. The scientific consensus,
including the published position of the United States Geological Survey, is that
**deterministic earthquake prediction is not currently possible**, and it remains
an open question whether it is possible in principle given the nature of fault
rupture.

The outputs are **statistical estimates derived from historical catalog data**.
They carry substantial uncertainty, are conditional on modelling assumptions that
may not hold, and **will be wrong in individual cases**. A low forecast
probability does not mean an earthquake will not occur. A high forecast
probability does not mean one will.

## 2. Non-determinism

Outputs are not deterministic in either of two senses, and both matter:

**Statistically non-deterministic.** Every quantity produced is a probability or
an expected rate under an assumed stochastic process (principally the Poisson and
Omori–Utsu families). The underlying physical system is treated as random because
it is not predictable, not because randomness is a modelling convenience.

**Computationally non-reproducible in part.** Several components use
pseudo-random simulation (the S-test's simulated catalogs, bootstrap procedures)
and iterative numerical optimization that may converge to different local optima
depending on starting values, library version, or platform. **Two runs on
identical data may produce different numbers.** A concrete instance is documented
in Section 8.3. Seeds are exposed where simulation is used, but reproducibility
is not guaranteed across environments.

Additionally, the underlying USGS catalog is **revised continuously**. Magnitudes
are refined, locations relocated, and events added or deleted. The same query run
on two dates may return different data. Outputs are valid only with respect to
the catalog state at the time of retrieval.

## 3. Prohibited and inappropriate uses

This software is provided for **research and educational purposes**. It is
**not** validated, certified, or fit for:

- Life-safety decisions, evacuation orders, or emergency management
- Public warning or alerting of any kind
- Building code determination, structural design, or engineering certification
- Insurance underwriting, pricing, catastrophe bonds, or risk transfer
- Financial instruments or investment decisions
- Regulatory filings or compliance attestation
- Any application where error could cause death, injury, or property loss

For official hazard information, consult the USGS, your national seismological
agency, or the Global Earthquake Model (GEM) Foundation. For engineering design,
use the applicable national seismic hazard model and a licensed engineer.

## 4. Methods and statistical approaches

| Method | Purpose | Primary reference |
|---|---|---|
| Gutenberg–Richter frequency–magnitude relation | magnitude scaling of rates | Gutenberg & Richter (1944) |
| Aki maximum-likelihood *b*-value | slope of the FMD | Aki (1965) |
| Shi & Bolt standard error for *b* | uncertainty on *b* | Shi & Bolt (1982) |
| Maximum-curvature completeness (MAXC), +0.2 correction | magnitude of completeness Mc | Wiemer & Wyss (2000) |
| Omori–Utsu modified aftershock decay law | temporal aftershock rate | Utsu (1961); Ogata (1983) |
| Ogata maximum-likelihood estimation of *K*, *c*, *p* | sequence-specific fitting | Ogata (1983) |
| Reasenberg–Jones aftershock forecasting | short-term post-mainshock probability | Reasenberg & Jones (1989, 1994) |
| Generic-prior fallback for sparse sequences | small-*n* stability | Page et al. (2016) |
| Homogeneous Poisson process | background/swarm rate, P = 1 − e^(−N) | standard |
| Poisson rate-anomaly test | recent activity vs. background | standard |
| ETAS (Epidemic-Type Aftershock Sequence) | space–time triggering | Ogata (1988, 1998) |
| Adaptive-kernel smoothed seismicity | spatial background rate | Kagan & Jackson (1994); Helmstetter et al. (2007) |
| Gardner–Knopoff window declustering | aftershock removal | Gardner & Knopoff (1974) |
| Schuster walk test | phase correlation (tidal, seasonal) | Schuster (1897) |
| Solid-Earth degree-2 tidal potential | tidal stress proxy | standard tidal theory |
| Euler pole rigid-plate kinematics | plate relative motion | Euler's rotation theorem |
| NNR-MORVEL56 plate motion model | angular velocities | Argus, Gordon & DeMets (2011); DeMets et al. (2010) |
| Seismic moment–magnitude relation | M₀ = 10^(1.5M + 9.05) N·m | Hanks & Kanamori (1979) |
| Tectonic moment budget, Ṁ₀ = μ·A·v·coupling | loading-rate prior on long-term rate | Brune (1968); Molnar (1979) |
| Poisson generalized linear model (log link) | hybrid covariate model | standard GLM |
| Information gain per earthquake | forecast skill metric | Kagan (2009) |
| N-test (number consistency) | total-count calibration | Zechar et al. (2010) |
| S-test (spatial consistency) | spatial distribution | Zechar et al. (2010) |
| Walk-forward (prospective) cross-validation | out-of-sample evaluation | standard |
| Haversine great-circle distance | spherical geometry | standard |

**Citation caveat:** these references were compiled without database access to
verify them. Author lists, years, volumes, and page numbers **must be checked
against the primary literature** before use in any publication or filing.

## 5. Software inventory

### Python

| Library | Role |
|---|---|
| `numpy` | numerical arrays, linear algebra |
| `pandas` | catalog data frames, time handling |
| `scipy.optimize` | `minimize` (L-BFGS-B, Nelder–Mead), `minimize_scalar` (bounded Brent) |
| `scipy.stats` | `poisson` (sf/cdf/logsf), `spearmanr` |
| `scipy.spatial` | `cKDTree` for neighbour search and kernel cutoffs |
| `requests` | FDSN HTTP client |
| `matplotlib` | plotting (optional) |
| `etas` | full spatiotemporal ETAS inversion (optional) |
| `pycsep` | CSEP forecast evaluation (optional, recommended) |
| `obspy` | alternative multi-network FDSN client (optional) |

**Modules delivered:** `usgs.py`, `usgs_client.py`, `eq_forecast.py`,
`global_forecast.py`, `geophysics.py`, `plate_kinematics.py`, `hybrid_model.py`,
`backtest.py`.

**Key classes:** `USGSClient`, `CatalogQuery`, `ForecastResult`, `GlobalGrid`,
`HybridForecast`, `EulerPole`, `OmoriFit`, `BValue`, `SchusterResult`.

### R

| Package | Role |
|---|---|
| base R only (core) | all statistics: `optim`, `hist`, `read.csv` |
| `ETAS` | ETAS model fitting (optional) |
| `bayesianETAS` | Bayesian ETAS (optional) |
| `PtProcess`, `etasFLP` | alternative point-process fitting (optional) |
| `spatstat` | spatial point-pattern analysis (optional) |
| `evd` / `extRemes` | extreme-value analysis (optional) |
| `ggplot2` | plotting (optional) |

**Files:** `eq_forecast.R`, `run_forecast_example.R`.

**Key functions:** `fetch_usgs`, `normalize_catalog`, `estimate_mc`,
`estimate_b`, `fit_omori`, `rj_forecast`, `poisson_forecast`, `rate_anomaly`,
`run_forecast`, `export_forecast`, `plot_sequence`, `fit_etas`.

## 6. Variables and parameters

### 6.1 Input variables

| Variable | Units | Source |
|---|---|---|
| `time` | UTC, ISO 8601 | USGS FDSN |
| `lat`, `lon` | decimal degrees, WGS84 | USGS FDSN |
| `depth_km` | km below sea level (range −100 to 1000) | USGS FDSN |
| `mag` | moment or local magnitude | USGS FDSN |
| `magType` | magnitude scale identifier | USGS FDSN |
| `place`, `status`, `id` | region text, review status, event ID | USGS FDSN |

### 6.2 Estimated parameters

| Parameter | Meaning | Estimator |
|---|---|---|
| `Mc` | magnitude of completeness | MAXC + 0.2 |
| `b` | Gutenberg–Richter slope | Aki MLE, σ via Shi & Bolt |
| `K`, `c`, `p` | Omori–Utsu productivity, offset, decay | Ogata MLE (K profiled analytically) |
| `a` | Reasenberg–Jones productivity | log₁₀(K) − b·(Mm − Mc) |
| `α, q, d₀, γ` | ETAS productivity and spatial kernel | derived from catalog via `derive_etas_params()` |
| `β` | hybrid GLM coefficients | Poisson MLE, L-BFGS-B |
| `d_i` | adaptive kernel bandwidth | distance to k-th nearest neighbour |

### 6.3 Fixed defaults and rationale

| Parameter | Default | Rationale |
|---|---|---|
| `MAG_BIN` | 0.1 | standard catalog magnitude reporting resolution |
| Mc correction | +0.2 | empirical bias correction for MAXC (Wiemer & Wyss) |
| `GENERIC` (a, b, p, c) | −1.76, 1.00, 1.07, 0.05 | USGS global generic aftershock sequence |
| `GENERIC_CALIFORNIA` | −1.67, 0.91, 1.08, 0.05 | Reasenberg–Jones California generic |
| Omori `c` | fixed at 0.05 d | c and p trade off severely in short windows; free fitting is unstable |
| Min events for sequence-specific fit | 15 | below this, generic priors are used instead |
| `mainshock_mag_min` | M4.5 | threshold for switching on the aftershock engine |
| `lookbacks_h` | 12, 24, 48, 60, 72 | user-specified rate-estimation and fitting windows |
| `horizons_h` | 24, 72, 168 | 1 day, 3 days, 1 week |
| `background_days` | 365 | span for b-value and background rate |
| `ETAS_FALLBACK` α, c, p, q, d₀, γ | 0.8, 0.05, 1.1, 1.5, 5.0 km, 0.4 | fallbacks only; used when the catalog is too small to fit |
| `k_neighbors` | 6 | adaptive bandwidth neighbour count |
| bandwidth clamp | 30–500 km | prevents degenerate kernels in dense/isolated regions |
| kernel `power` | 1.5 | power-law smoothing exponent |
| `cell_deg` | 1.0 (map), 2.0–2.5 (backtest) | resolution vs. computational cost |
| `μ` (rigidity) | 3.0 × 10¹⁰ Pa | typical crustal value |
| `coupling` | user-supplied, 0.5 typical | seismic coupling coefficient; highly uncertain |
| `train_years` | 10 | training window preceding each backtest origin |
| `horizon_days` | 30 | scored forecast window |
| `MAX_LIMIT` | 20000 | documented FDSN response cap |
| Declustering | ON by default | required for valid Schuster tests and unbiased background |

Every value above is overridable. Defaults are **choices, not measurements**, and
different reasonable choices will produce different forecasts.

## 7. Rationale

The design rests on four positions:

**Probabilistic, not deterministic.** Deterministic prediction has no accepted
scientific basis. Probabilistic forecasting does, and is operationally deployed.

**Baseline-relative evaluation.** Skill is meaningless in the absolute. Every
model is scored by information gain against a smoothed-seismicity baseline, which
is among the hardest baselines to beat in CSEP evaluation.

**Out-of-sample or nothing.** In-sample fit is not evidence. All headline metrics
come from walk-forward evaluation where the model saw only prior data.

**Designed to return a negative result.** Each physical covariate is tested by
ablation and reported honestly when it contributes nothing. This property is why
positive results should carry any weight.

## 8. Known limitations and documented failure modes

### 8.1 Structural limitations

- **Catalog completeness collapses after large events** — the mainshock coda masks small aftershocks, raising Mc temporarily and biasing early forecasts low. No time-dependent Mc is implemented.
- **Magnitude extrapolation** — forecasting M≥6 from a catalog complete to M2 extrapolates Gutenberg–Richter across four decades of magnitude; uncertainty far exceeds the point estimate.
- **Rigid-plate assumption fails** across roughly 15% of Earth's surface (diffuse deforming zones such as Tibet, Iran, the western US).
- **Poisson stationarity is violated during aftershock sequences**; the Poisson engine over-forecasts there and emits a warning.
- **No spatial modelling in the two short-term engines** — rates are aggregated over the query radius.
- **Magnitude type heterogeneity** — `magType` is not homogenized across the catalog.

### 8.2 Unverified components

- **Euler pole table** (`POLES_NNR_MORVEL56`) is transcribed from memory, not from the published source. It passed 8/8 boundary-rate benchmarks but **must be replaced with published values** before research use.
- **FDSN client assumptions** were written without network access to the service. `python usgs_client.py --verify` must pass before results are trusted.
- **Tidal stress amplitudes** are order-of-magnitude only (factor ~2). Rigorous work requires SPOTL or ETERNA/PREDICT with ocean loading.

### 8.3 Defects found during development, and their significance

These are disclosed because each produced plausible, confident, wrong output:

**Tidal phase definition bias.** Defining phase as `arctan2(−dV/dt/ω, V)` yields
non-uniform phases under the null because the degree-2 potential contains a
permanent component. On uniformly random event times this produced significance
in **20 of 20 trials — a 100% false-positive rate.** Corrected to the
local-maxima method; null rate is now 0/20. The biased function is retained,
deprecated, so the failure mode remains documented.

**Undeclustered Schuster tests manufacture significance.** A single aftershock
sequence contributed hundreds of dependent events and produced an apparent annual
cycle at **p = 2 × 10⁻¹⁴** that was purely one 30-hour burst. Gardner–Knopoff
declustering is now on by default.

**Cross-language optimizer divergence.** R's `optim(method="Brent")` and Python's
Nelder–Mead converged to different optima on the same 1-D Omori fit, giving
forecast probabilities differing by up to **8 percentage points**. Neither
errored. Corrected via `minimize_scalar(method="bounded")`; the two
implementations now agree to 6.6 × 10⁻⁷ across all 90 comparison rows.

**Overfitting is detectable and was detected.** In ablation, a seasonal covariate
attracted a substantial fitted coefficient (β = 0.377) on training data while
scoring **negative held-out information gain (−0.042)**. Reporting the
coefficient without out-of-sample scoring would have presented noise as signal.

**Covariate masquerade.** A "moment deficit / seismic gap" covariate scored well
in isolation (IG 0.363) but carried a **negative** coefficient — meaning shorter
time since the last large event predicted higher rate, the opposite of a gap
model. It was proxying aftershock clustering, not new physics.

## 9. Validation status

**Validated:** Omori parameter recovery against simulation (p = 1.080 recovered
from true 1.08); b-value recovery (0.902 vs. true 0.91); R↔Python agreement to
6.6 × 10⁻⁷ across 90 rows; astronomical periods (M2 = 12.406 h vs. 12.4206;
spring–neap 15.01 d vs. 14.77); moment budget against paleoseismic recurrence
(San Andreas M8 at 142 yr vs. published ~150–200); Schuster null calibration
(0/20 false positives) and power (5% injected signal detected at p = 0.002);
FDSN parameter validation (12/12 invalid cases rejected); catalog bisection
(100,000 events, zero loss).

**Not validated:** any result against the live USGS catalog. **No component of
this toolkit has been run on real data.** All validation used simulation or
mocked HTTP responses. Skill on real seismicity is **unknown** and must be
established by the user through `backtest.py` before any reliance.

**Not performed:** formal CSEP prospective testing; peer review; comparison
against operational forecasts (USGS OEF, ETAS implementations); sensitivity
analysis across the parameter space in Section 6.3.

## 10. Limitation of liability

*Subject to legal review — see the notice at the head of this document.*

THE SOFTWARE AND ITS OUTPUTS ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND
NON-INFRINGEMENT.

The author makes no representation that the forecasts are accurate, complete,
calibrated, or suitable for any purpose. No component has been validated against
real observational data. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY CLAIM,
DAMAGES, OR OTHER LIABILITY, WHETHER IN CONTRACT, TORT, OR OTHERWISE, ARISING
FROM OR IN CONNECTION WITH THE SOFTWARE, ITS OUTPUTS, OR ANY DECISION TAKEN IN
RELIANCE ON THEM.

**The user bears sole responsibility** for validating outputs, for determining
fitness for any intended use, and for all consequences of use. Any party relying
on these outputs for consequential decisions does so entirely at their own risk
and against the express guidance of this document.

## 11. Data attribution

Earthquake data are obtained from the **United States Geological Survey**
Earthquake Hazards Program via the FDSN event web service
(`https://earthquake.usgs.gov/fdsnws/event/1/`). USGS data are generally in the
public domain; users should consult current USGS citation and usage policy.
**The USGS does not endorse this software** and bears no responsibility for it or
for any product derived from it.

Catalog contents are preliminary and subject to revision. Automatic solutions may
be superseded by reviewed solutions.

## 12. References

Aki, K. (1965). Maximum likelihood estimate of b in the formula log N = a − bM. *Bulletin of the Earthquake Research Institute, 43*, 237–239.

Argus, D. F., Gordon, R. G., & DeMets, C. (2011). Geologically current motion of 56 plates relative to the no-net-rotation reference frame. *Geochemistry, Geophysics, Geosystems, 12*(11).

DeMets, C., Gordon, R. G., & Argus, D. F. (2010). Geologically current plate motions. *Geophysical Journal International, 181*(1), 1–80.

Gardner, J. K., & Knopoff, L. (1974). Is the sequence of earthquakes in southern California, with aftershocks removed, Poissonian? *Bulletin of the Seismological Society of America, 64*(5), 1363–1367.

Gutenberg, B., & Richter, C. F. (1944). Frequency of earthquakes in California. *Bulletin of the Seismological Society of America, 34*(4), 185–188.

Hanks, T. C., & Kanamori, H. (1979). A moment magnitude scale. *Journal of Geophysical Research, 84*(B5), 2348–2350.

Helmstetter, A., Kagan, Y. Y., & Jackson, D. D. (2007). High-resolution time-independent grid-based forecast for M ≥ 5 earthquakes in California. *Seismological Research Letters, 78*(1), 78–86.

Kagan, Y. Y. (2009). Testing long-term earthquake forecasts: likelihood methods and error diagrams. *Geophysical Journal International, 177*(2), 532–542.

Kagan, Y. Y., & Jackson, D. D. (1994). Long-term probabilistic forecasting of earthquakes. *Journal of Geophysical Research, 99*(B7), 13685–13700.

Ogata, Y. (1983). Estimation of the parameters in the modified Omori formula for aftershock frequencies by the maximum likelihood procedure. *Journal of Physics of the Earth, 31*(2), 115–124.

Ogata, Y. (1988). Statistical models for earthquake occurrences and residual analysis for point processes. *Journal of the American Statistical Association, 83*(401), 9–27.

Ogata, Y. (1998). Space-time point-process models for earthquake occurrences. *Annals of the Institute of Statistical Mathematics, 50*(2), 379–402.

Page, M. T., van der Elst, N., Hardebeck, J., Felzer, K., & Michael, A. J. (2016). Three ingredients for improved global aftershock forecasts. *Bulletin of the Seismological Society of America, 106*(5), 2290–2301.

Reasenberg, P. A., & Jones, L. M. (1989). Earthquake hazard after a mainshock in California. *Science, 243*(4895), 1173–1176.

Schuster, A. (1897). On lunar and solar periodicity of earthquakes. *Proceedings of the Royal Society of London, 61*, 455–465.

Shi, Y., & Bolt, B. A. (1982). The standard error of the magnitude-frequency b value. *Bulletin of the Seismological Society of America, 72*(5), 1677–1687.

Utsu, T. (1961). A statistical study on the occurrence of aftershocks. *Geophysical Magazine, 30*, 521–605.

Wiemer, S., & Wyss, M. (2000). Minimum magnitude of completeness in earthquake catalogs. *Bulletin of the Seismological Society of America, 90*(4), 859–869.

Zechar, J. D., Gerstenberger, M. C., & Rhoades, D. A. (2010). Likelihood-based tests for evaluating space-rate-magnitude earthquake forecasts. *Bulletin of the Seismological Society of America, 100*(3), 1184–1195.

*References compiled without database access. Verify all citation details against the primary literature before publication or filing.*
