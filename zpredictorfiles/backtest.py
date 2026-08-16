"""
backtest.py — Prospective walk-forward evaluation on real USGS data.

THE DISCIPLINE
--------------
At each forecast origin T:
  * the background grid is built ONLY from events before T
  * ETAS parameters are derived ONLY from events before T
  * model coefficients are fit ONLY on events before T
  * the forecast is scored on [T, T + horizon), which the model never saw

Then the origin advances and the whole thing repeats. Nothing after T touches
the model at T. This is what separates a backtest from an in-sample fit that
looks impressive and forecasts nothing.

METRICS
-------
  IG      information gain per earthquake vs. the smoothed-seismicity baseline
          (Kagan, 2009). The headline number.
  N-test  is the total predicted count consistent with what happened?
          Two-sided Poisson tail probability (Zechar et al., 2010).
  S-test  is the SPATIAL distribution right, given the observed total? Removes
          rate calibration so a model cannot pass on volume alone.

A model can nail the total and place it all in the wrong ocean. That is why
N and S are reported separately rather than as one score.

Dependencies: numpy, pandas, scipy.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Dict, List, Optional, Sequence

import numpy as np
import pandas as pd
from scipy import stats

__all__ = ["walk_forward", "n_test", "s_test", "summarize_backtest"]


# ============================================================================ #
# CSEP-style consistency tests
# ============================================================================ #

def n_test(forecast_counts: np.ndarray, n_observed: int) -> dict:
    """N-test: is the observed total consistent with the forecast total?

    Under the model the total is Poisson with mean = sum of cell forecasts.
    Returns the two-sided tail probability. Small values mean the model's
    overall RATE is wrong (too high or too low), independent of where it put
    the events.
    """
    lam = float(np.sum(forecast_counts))
    if lam <= 0:
        return {"expected": lam, "observed": n_observed, "p_value": np.nan,
                "verdict": "no forecast rate"}
    lower = float(stats.poisson.cdf(n_observed, lam))
    upper = float(stats.poisson.sf(n_observed - 1, lam))
    p = 2 * min(lower, upper)
    return {"expected": lam, "observed": int(n_observed),
            "p_value": float(min(p, 1.0)),
            "verdict": ("rate too low" if n_observed > lam else "rate too high")
                       if p < 0.05 else "consistent"}


def s_test(forecast_counts: np.ndarray, observed_counts: np.ndarray,
           n_sim: int = 1000, seed: int = 0) -> dict:
    """S-test: is the SPATIAL distribution consistent, given the observed total?

    Normalizes the forecast to the observed number of events, so a model cannot
    pass by getting the total right while placing events in the wrong cells.
    Compares the observed spatial log-likelihood against simulated catalogs
    drawn from the normalized forecast.
    """
    rng = np.random.default_rng(seed)
    f = np.asarray(forecast_counts, dtype=float).ravel()
    obs = np.asarray(observed_counts, dtype=float).ravel()
    n_obs = int(obs.sum())
    total = f.sum()
    if n_obs == 0 or total <= 0:
        return {"p_value": np.nan, "verdict": "no events to test"}

    p_cell = f / total
    with np.errstate(divide="ignore"):
        logp = np.where(p_cell > 0, np.log(p_cell), -np.inf)

    ll_obs = float(np.sum(obs * np.where(np.isfinite(logp), logp, -50.0)))

    sims = rng.multinomial(n_obs, p_cell, size=n_sim)
    ll_sim = sims @ np.where(np.isfinite(logp), logp, -50.0)

    p = float((ll_sim <= ll_obs).mean())
    return {"p_value": p, "ll_observed": ll_obs,
            "ll_sim_median": float(np.median(ll_sim)),
            "verdict": "spatial distribution rejected" if p < 0.05
                       else "consistent"}


# ============================================================================ #
# Walk-forward driver
# ============================================================================ #

def walk_forward(cat: pd.DataFrame,
                 mc: float,
                 m_target: Optional[float] = None,
                 train_years: float = 10.0,
                 horizon_days: float = 30.0,
                 step_days: Optional[float] = None,
                 start_after: Optional[pd.Timestamp] = None,
                 cell_deg: float = 2.5,
                 components: Sequence[str] = ("trigger", "tide", "season", "deficit"),
                 max_folds: Optional[int] = None,
                 verbose: bool = True) -> pd.DataFrame:
    """Roll a forecast origin forward through the catalog, scoring each fold.

    Parameters
    ----------
    cat          : normalized USGS catalog (from usgs.query)
    mc           : magnitude of completeness
    m_target     : magnitude to forecast (defaults to mc)
    train_years  : length of the training window preceding each origin
    horizon_days : forecast window scored at each origin
    step_days    : origin advance (defaults to horizon_days, i.e. no overlap)
    components   : hybrid model covariates to include

    Returns one row per fold with IG, N-test, and S-test results.
    """
    from global_forecast import smoothed_seismicity
    from hybrid_model import (_build_design, _poisson_nll, derive_etas_params,
                              fit_hybrid, information_gain)

    m_target = mc if m_target is None else m_target
    step_days = horizon_days if step_days is None else step_days

    cat = cat.sort_values("time").reset_index(drop=True)
    t_min, t_max = cat["time"].min(), cat["time"].max()
    first_origin = (pd.Timestamp(start_after) if start_after is not None
                    else t_min + timedelta(days=365.25 * train_years))
    if first_origin >= t_max:
        raise ValueError(
            f"catalog spans {(t_max-t_min).days/365.25:.1f} yr but train_years="
            f"{train_years} leaves no room to test. Fetch more history or "
            f"reduce train_years.")

    origins, T = [], first_origin
    while T + timedelta(days=horizon_days) <= t_max:
        origins.append(T)
        T += timedelta(days=step_days)
    if max_folds:
        origins = origins[:max_folds]
    if verbose:
        print(f"Walk-forward: {len(origins)} folds | train {train_years} yr | "
              f"horizon {horizon_days} d | step {step_days} d")

    rows = []
    for k, T in enumerate(origins, 1):
        train = cat[(cat["time"] >= T - timedelta(days=365.25 * train_years))
                    & (cat["time"] < T)]
        test = cat[(cat["time"] >= T) & (cat["time"] < T + timedelta(days=horizon_days))]
        n_obs = int((test["mag"] >= m_target).sum())

        if len(train) < 500:
            rows.append({"origin": T, "note": f"only {len(train)} training events"})
            continue

        try:
            # --- everything below uses TRAINING data only
            grid = smoothed_seismicity(train, m_target=m_target, mc=mc,
                                       cell_deg=cell_deg, decluster=True,
                                       verbose=False)
            etas = (derive_etas_params(train, mc, verbose=False)
                    if "trigger" in components else None)

            # fit coefficients on the training window
            model, tr_design, _ = fit_hybrid(train, grid, mc, train_frac=0.999,
                                             use=components, etas_params=etas,
                                             verbose=False)

            # build the design for the FORECAST window using data up to T
            epoch = train["time"].min().normalize()
            d0 = int((T - epoch).total_seconds() // 86400)
            d1 = d0 + int(horizon_days)
            hist = cat[cat["time"] < T]                     # no leakage past T
            fc = _build_design(hist, grid, d0, d1, epoch, mc, components, etas)

            # observed counts in the same binning
            obs_design = _build_design(
                cat[cat["time"] < T + timedelta(days=horizon_days)],
                grid, d0, d1, epoch, mc, components, etas)
            y_obs = obs_design["y"]

            eta = fc["offset"] + (fc["X"] @ model.beta if fc["X"].shape[1] else 0.0)
            lam_model = np.exp(np.clip(eta, -50, 20))
            lam_base = np.exp(np.clip(fc["offset"], -50, 20))

            n_res = n_test(lam_model, int(y_obs.sum()))
            s_res = s_test(lam_model, y_obs)

            if y_obs.sum() > 0:
                ll_m = -_poisson_nll(model.beta, fc["X"], y_obs, fc["offset"])
                ll_b = -_poisson_nll(np.zeros(fc["X"].shape[1]), fc["X"],
                                     y_obs, fc["offset"])
                ig = (ll_m - ll_b) / y_obs.sum()
            else:
                ig = np.nan

            rows.append({
                "origin": T, "n_train": len(train),
                "n_observed": int(y_obs.sum()),
                "expected_model": float(lam_model.sum()),
                "expected_baseline": float(lam_base.sum()),
                "IG_per_earthquake": float(ig),
                "N_test_p": n_res["p_value"], "N_verdict": n_res["verdict"],
                "S_test_p": s_res["p_value"],
                "beta": np.round(model.beta, 4).tolist(),
            })
            if verbose:
                print(f"  fold {k:3d}/{len(origins)}  {T:%Y-%m-%d}  "
                      f"obs={int(y_obs.sum()):4d}  exp={lam_model.sum():7.1f}  "
                      f"IG={ig:+.4f}  N-p={n_res['p_value']:.3f}  "
                      f"S-p={s_res['p_value']:.3f}")
        except Exception as e:                               # noqa: BLE001
            rows.append({"origin": T, "note": f"{type(e).__name__}: {e}"[:120]})
            if verbose:
                print(f"  fold {k:3d}/{len(origins)}  {T:%Y-%m-%d}  FAILED: "
                      f"{type(e).__name__}: {e}"[:110])

    return pd.DataFrame(rows)


def summarize_backtest(df: pd.DataFrame, verbose: bool = True) -> dict:
    """Aggregate walk-forward folds into a verdict."""
    ok = df[df["IG_per_earthquake"].notna()] if "IG_per_earthquake" in df else df.iloc[:0]
    if ok.empty:
        if verbose:
            print("No scoreable folds.")
        return {}

    ig = ok["IG_per_earthquake"].to_numpy()
    # Paired test: is mean IG different from zero across folds?
    t_stat, t_p = stats.ttest_1samp(ig, 0.0) if len(ig) > 1 else (np.nan, np.nan)

    out = {
        "n_folds": int(len(ok)),
        "total_events_scored": int(ok["n_observed"].sum()),
        "mean_IG": float(np.mean(ig)),
        "median_IG": float(np.median(ig)),
        "IG_std": float(np.std(ig, ddof=1)) if len(ig) > 1 else np.nan,
        "folds_with_positive_IG_pct": float(100 * np.mean(ig > 0)),
        "t_stat_vs_zero": float(t_stat), "p_value_vs_zero": float(t_p),
        "N_test_pass_pct": float(100 * (ok["N_test_p"] > 0.05).mean()),
        "S_test_pass_pct": float(100 * (ok["S_test_p"] > 0.05).mean()),
    }
    if verbose:
        print("\n================= WALK-FORWARD BACKTEST SUMMARY =================")
        print(f"Folds scored:            {out['n_folds']}")
        print(f"Earthquakes scored:      {out['total_events_scored']}")
        print(f"Mean IG / earthquake:    {out['mean_IG']:+.4f} "
              f"(median {out['median_IG']:+.4f}, sd {out['IG_std']:.4f})")
        print(f"Folds beating baseline:  {out['folds_with_positive_IG_pct']:.1f}%")
        print(f"t-test vs IG=0:          t={out['t_stat_vs_zero']:.2f}, "
              f"p={out['p_value_vs_zero']:.4g}")
        print(f"N-test pass rate:        {out['N_test_pass_pct']:.1f}% "
              "(expect ~95% if rate is calibrated)")
        print(f"S-test pass rate:        {out['S_test_pass_pct']:.1f}% "
              "(expect ~95% if spatial distribution is right)")
        print("\nMean IG is the headline. If it is not clearly positive with")
        print("p < 0.05, the model does not beat smoothed seismicity, and the")
        print("honest conclusion is to report that.")
        print("=================================================================")
    return out
