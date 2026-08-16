# Refactor: everything runs on the live USGS FDSN service

No synthetic data. No hardcoded geography. All generators deleted.

## What changed

| Before | Now |
|---|---|
| `make_global_synth.py`, `make_trig_synth.py` | **deleted** |
| Hardcoded 41-entry `REGION_LABELS` table | region names parsed from the catalog's own `place` field |
| Ad-hoc `read.csv(url)` fetching | `usgs.py` + `usgs_client.py` against the documented service |
| Single train/test split | `backtest.py` walk-forward with strict origin discipline |

## Corrections from the documentation you sent

I had six things wrong. All fixed:

1. **`magnitudetype`** — not a parameter on this service. Removed; filter on `magType` after fetch.
2. **`minradius` / `minradiuskm`** — don't exist here. Only `maxradius` (degrees) and `maxradiuskm`, and they're **mutually exclusive**.
3. **`minnst`** — not documented. Removed.
4. **`/count` doesn't accept CSV** — only plain text (default), geojson, and xml.
5. **Depth range is `[-100, 1000]` km**, not unbounded. Negative depths are valid (above sea level).
6. **Longitude range is `(-360, 360)`** for rectangles — that's what lets a box cross the date line via `minlongitude < -180`.

Also now enforced: `limit` ∈ [1, 20000] with anything above returning HTTP 400, `offset` is **1-based**, `nodata` ∈ {204, 404}, and the documented enums for `orderby`, `reviewstatus`, `alertlevel`, `producttype`, `kmlcolorby`.

## Two data modules

**`usgs.py`** — the everyday interface. `query()`, `live_feed()`, `detail()`, on-disk caching, geojson parsing, `region` derived from `place`.

**`usgs_client.py`** — for large pulls. Strict client-side validation, and `/count` preflight with recursive time bisection.

That bisection matters more than it sounds. A query returning more than 20,000 rows gives **HTTP 400** — but a naive chunking scheme that lands just under the cap returns a valid-looking catalog that's quietly incomplete. The client counts first, splits the window until every chunk fits, then reconciles the retrieved total against `/count` and **raises** if they disagree. Verified against a mock service holding 100,000 events with deliberately uneven density: all 100,000 retrieved, zero lost, 23 count calls and 12 query calls.

## Run this first

```bash
python usgs_client.py --verify
```

I could not reach `earthquake.usgs.gov` from my sandbox, so every assumption in
the client is unverified until this passes. It probes the live service and
checks: reachability, `/count` returning an integer, expected CSV columns,
count-vs-query agreement, the 20,000 cap behaviour, what happens on an unknown
parameter, and the empty-result status code. Any `[FAIL]` means my reading of
the spec was wrong somewhere — fix that before trusting downstream numbers.

## Backtest

```bash
python backtest.py --years 15 --minmag 4.5 --verify
```

At each forecast origin T: the background grid, the ETAS parameters, and the
model coefficients are all derived **only** from events before T. The forecast is
scored on `[T, T+horizon)`, then the origin advances. Nothing after T touches the
model at T.

Three metrics per fold:

- **IG** — information gain per earthquake vs. the smoothed-seismicity baseline. The headline number. Published ETAS-class models reach ~0.2–1.0.
- **N-test** — is the predicted total consistent with what happened? Two-sided Poisson.
- **S-test** — is the *spatial* distribution right, given the observed total? Normalizing out the rate means a model can't pass on volume alone.

N and S are reported separately because a model can nail the count and put it all in the wrong ocean.

## What is still hardcoded, and why

`plate_kinematics.py` carries the NNR-MORVEL56 Euler poles. There is no API for
plate motion — those are published constants. They remain transcribed from
memory and unverified. `validate_against_benchmarks()` scores them against
published boundary rates (8/8 passed), but replace the table with the published
values before research use.

The generic aftershock parameters in `eq_forecast.py` are also constants, but
they're now overridable and can be estimated from real sequences in your own
catalog rather than assumed.

## Verification performed

Everything below was tested offline. Network calls were mocked; **all analysis
code in the path is real**.

- 12/12 invalid-parameter cases rejected client-side (typos, out-of-range values, mutually exclusive combinations, inverted ranges)
- 4/4 valid query shapes build correctly, including a date-line-crossing box
- 100,000-event bisection with zero loss, correct dedup across chunk boundaries
- Truncation guard fires when `/count` disagrees with retrieved rows
- Full pipeline: fetch → normalize → grid → region labels → walk-forward, all folds scoring

On structureless mock data the diagnostics correctly **rejected** the model
(N-test "rate too low", S-test p = 0.0, IG ≈ 0.01). Tests that fail when they
should are the ones worth having.
