"""
hybrid_model.py — A testbed for "does this parameter actually help?"

MODEL
-----
Discretized space-time Poisson intensity on a global grid:

    lambda(cell, day) = mu_bg(cell) * exp( beta . X(cell, day) )

  mu_bg   smoothed-seismicity background (the CSEP-standard baseline)
  X       covariates, each one of the physical parameters we discussed:
            x1  log1p(ETAS triggering intensity from prior events)
            x2  fortnightly tidal amplitude envelope
            x3  annual cycle (cos, sin of day-of-year)
            x4  moment deficit: time since last large event / implied recurrence
            x5  plate-loading moment rate for the cell

beta is fit by Poisson maximum likelihood on a TRAINING period, then evaluated
on a HELD-OUT period the model never saw.

EVALUATION
----------
Information gain per earthquake (Kagan, 2009; the CSEP standard):

    IG = (1/N) * [ logL(model) - logL(baseline) ]

IG is in natural log units per event. IG = 0 means the model is worth exactly
nothing beyond the baseline. IG = 0.5 means each earthquake is e^0.5 ~ 1.6x
better predicted. Published time-dependent (ETAS-class) models achieve IG of
roughly 0.2-1.0 over a smoothed-seismicity baseline, essentially all of it from
aftershock clustering.

Ablation reports each covariate's marginal contribution, so a parameter that
does nothing is REPORTED as doing nothing rather than quietly inflating the
model. That is the point of this module: it is designed to be able to tell you
"no".

HONEST EXPECTATION
------------------
The triggering term will help, substantially, in the days after large events.
Tidal, seasonal, and moment-deficit terms are expected to contribute near zero.
If they surprise us, the held-out IG is what would establish it — not a
plausible mechanism story.

Dependencies: numpy, pandas, scipy.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence

import numpy as np
import pandas as pd
from scipy import optimize

__all__ = ["HybridForecast", "fit_hybrid", "information_gain", "ablation_study",
           "marginal_ablation", "derive_etas_params", "ETAS_FALLBACK"]

R_EARTH_KM = 6371.0088

# ETAS-family parameters used to BUILD the triggering covariate.
# These are DERIVED FROM THE CATALOG by derive_etas_params(); the values here
# are only fallbacks used when a catalog is too small to fit them, and every
# function that uses them accepts an override.
ETAS_FALLBACK = {
    "alpha": 0.8,     # productivity scaling with magnitude
    "c": 0.05,        # Omori offset, days
    "p": 1.1,         # Omori decay
    "q": 1.5,         # spatial kernel decay
    "d0": 5.0,        # spatial scale at m = mc, km
    "gamma": 0.4,     # rupture-length scaling of the spatial kernel
}


def derive_etas_params(cat: pd.DataFrame, mc: float,
                       mainshock_delta: float = 1.5,
                       window_days: float = 30.0,
                       verbose: bool = True) -> dict:
    """Estimate ETAS parameters from the catalog instead of assuming them.

    - p, c   : Omori-Utsu MLE on the STACKED aftershock sequences of all
               mainshocks (stacking is what makes short individual sequences
               usable).
    - alpha  : regression of log10(aftershock count) on mainshock magnitude
               (the productivity relation).
    - d0,gamma: regression of log10(median aftershock distance) on mainshock
               magnitude (rupture-length scaling of the spatial kernel).

    Anything that cannot be estimated falls back to ETAS_FALLBACK, and the
    returned dict records which values were fitted vs. fallen back on.
    """
    from eq_forecast import fit_omori

    out = dict(ETAS_FALLBACK)
    out["source"] = {k: "fallback" for k in ETAS_FALLBACK}

    ev = cat[cat["mag"] >= mc].sort_values("time").reset_index(drop=True)
    if len(ev) < 200:
        if verbose:
            print(f"derive_etas_params: only {len(ev)} events >= Mc; using fallbacks")
        return out

    t = (ev["time"] - ev["time"].min()).dt.total_seconds().to_numpy() / 86400
    lat, lon, mag = (ev["lat"].to_numpy(), ev["lon"].to_numpy(),
                     ev["mag"].to_numpy())
    xyz = _to_xyz(lat, lon)

    ms_idx = np.where(mag >= mc + mainshock_delta)[0]
    stacked_dt, counts, med_dist, ms_mags = [], [], [], []

    from scipy.spatial import cKDTree
    tree = cKDTree(xyz)
    for i in ms_idx:
        radius = 3.0 * 10 ** (0.5 * mag[i] - 1.8)          # ~3 rupture lengths, km
        radius = float(np.clip(radius, 20, 800))
        near = np.asarray(tree.query_ball_point(xyz[i], radius))
        if near.size == 0:
            continue
        dt = t[near] - t[i]
        sel = near[(dt > 0) & (dt <= window_days) & (mag[near] < mag[i])]
        if sel.size < 5:
            continue
        d = np.linalg.norm(xyz[sel] - xyz[i], axis=1)
        stacked_dt.append(t[sel] - t[i])
        counts.append(sel.size)
        med_dist.append(np.median(d))
        ms_mags.append(mag[i])

    if len(counts) >= 5:
        ms_mags = np.asarray(ms_mags, float)
        # productivity: log10(N) = alpha*(M - mc) + const
        A = np.polyfit(ms_mags - mc, np.log10(np.asarray(counts, float)), 1)
        if 0.1 < A[0] < 2.0:
            out["alpha"] = float(A[0]); out["source"]["alpha"] = "fitted"
        # spatial scaling: log10(d_med) = gamma*(M - mc) + log10(d0)
        B = np.polyfit(ms_mags - mc, np.log10(np.maximum(med_dist, 1.0)), 1)
        if 0.05 < B[0] < 1.5:
            out["gamma"] = float(B[0]); out["source"]["gamma"] = "fitted"
            out["d0"] = float(np.clip(10 ** B[1], 1.0, 100.0))
            out["source"]["d0"] = "fitted"

    if stacked_dt:
        allt = np.concatenate(stacked_dt)
        of = fit_omori(allt, t1=1e-4, t2=window_days, fix_c=ETAS_FALLBACK["c"])
        if of.converged and 0.5 < of.p < 2.5:
            out["p"] = float(of.p); out["source"]["p"] = "fitted"
        of2 = fit_omori(allt, t1=1e-4, t2=window_days)
        if of2.converged and 1e-4 < of2.c < 1.0 and 0.5 < of2.p < 2.5:
            out["c"] = float(of2.c); out["source"]["c"] = "fitted"

    out["n_mainshocks_used"] = len(counts)
    if verbose:
        fitted = [k for k, v in out["source"].items() if v == "fitted"]
        print(f"derive_etas_params: {len(counts)} mainshocks stacked | "
              f"fitted {fitted or 'nothing'} | "
              f"alpha={out['alpha']:.2f} p={out['p']:.2f} c={out['c']:.4f} "
              f"d0={out['d0']:.1f} gamma={out['gamma']:.2f}")
    return out


# ============================================================================ #
# Feature construction
# ============================================================================ #

def _to_xyz(lat, lon):
    la, lo = np.radians(np.asarray(lat)), np.radians(np.asarray(lon))
    return np.column_stack([np.cos(la) * np.cos(lo),
                            np.cos(la) * np.sin(lo),
                            np.sin(la)]) * R_EARTH_KM


def _triggering_intensity(cell_xyz: np.ndarray, day_index: np.ndarray,
                          ev_xyz: np.ndarray, ev_day: np.ndarray,
                          ev_mag: np.ndarray, mc: float,
                          max_days: float = 365.0,
                          max_km: float = 1500.0,
                          params: Optional[dict] = None) -> np.ndarray:
    """ETAS-style triggering rate at each (cell, day), from all prior events.

    nu = sum_j 10^(alpha(m_j - mc)) * (dt + c)^-p * (q-1)/(pi d_j^2)
         * (1 + r^2/d_j^2)^-q

    Only events within max_days and max_km contribute (the kernel is negligible
    beyond). Returned as a flat array matching the (cell, day) ordering.
    """
    from scipy.spatial import cKDTree

    P = dict(ETAS_FALLBACK if params is None else params)
    n_cells, n_days = cell_xyz.shape[0], day_index.size
    out = np.zeros((n_cells, n_days))
    if ev_xyz.shape[0] == 0:
        return out.ravel()

    tree = cKDTree(cell_xyz)
    day0 = day_index[0]

    for j in range(ev_xyz.shape[0]):
        idx = tree.query_ball_point(ev_xyz[j], max_km)
        if not idx:
            continue
        idx = np.asarray(idx)
        r2 = ((cell_xyz[idx] - ev_xyz[j]) ** 2).sum(axis=1)

        d_j = P["d0"] * 10 ** (P["gamma"] * (ev_mag[j] - mc))
        spatial = ((P["q"] - 1) / (np.pi * d_j ** 2)
                   * (1 + r2 / d_j ** 2) ** (-P["q"]))
        prod = 10 ** (P["alpha"] * (ev_mag[j] - mc))

        # days after the event, within the modelled window
        start = max(int(np.floor(ev_day[j])) - day0, 0)
        if start >= n_days:
            continue
        stop = min(start + int(max_days), n_days)
        if stop <= start:
            continue
        dt = day_index[start:stop] - ev_day[j]
        ok = dt >= 0
        if not ok.any():
            continue
        temporal = np.zeros(stop - start)
        temporal[ok] = (dt[ok] + P["c"]) ** (-P["p"])

        out[np.ix_(idx, np.arange(start, stop))] += (
            prod * spatial[:, None] * temporal[None, :])

    return out.ravel()


def _tidal_envelope(day_index: np.ndarray, epoch: pd.Timestamp,
                    lat: float = 0.0, lon: float = 0.0) -> np.ndarray:
    """Fortnightly (spring-neap) tidal amplitude, normalized to zero mean.

    Daily bins average out the semidiurnal tide entirely, so the only tidal
    signal that survives daily binning is the spring-neap envelope. Using the
    semidiurnal phase here would be a modelling error.
    """
    from geophysics import tidal_potential

    amps = []
    for d in day_index:
        t = epoch + pd.Timedelta(days=float(d))
        # sample within the day to capture the day's tidal range
        vals = [tidal_potential(t + pd.Timedelta(hours=h), lat, lon)["V_total"]
                for h in (0, 6, 12, 18)]
        amps.append(max(vals) - min(vals))
    a = np.asarray(amps)
    return (a - a.mean()) / (a.std() + 1e-30)


@dataclass
class HybridForecast:
    beta: np.ndarray
    feature_names: List[str]
    mc: float
    b: float
    cell_lat: np.ndarray
    cell_lon: np.ndarray
    bg_rate: np.ndarray
    train_ll: float
    n_train_events: int
    converged: bool
    note: str = ""

    def coefficients(self) -> pd.DataFrame:
        return pd.DataFrame({"feature": self.feature_names,
                             "beta": self.beta,
                             "multiplier_per_1sd": np.exp(self.beta)})


# ============================================================================ #
# Fitting
# ============================================================================ #

def _z(v):
    """Standardize a covariate. Keeps coefficients interpretable as the
    multiplicative effect of a one-standard-deviation change, and prevents the
    runaway coefficients you get from covariates with near-zero scale."""
    v = np.asarray(v, dtype=float)
    return (v - v.mean()) / (v.std() + 1e-30)


def _build_design(cat: pd.DataFrame, grid, day_start: int, day_end: int,
                  epoch: pd.Timestamp, mc: float,
                  use: Sequence[str], etas_params: Optional[dict] = None) -> Dict:
    """Assemble the (cell, day) design matrix, counts, and background offset."""
    # Active cells only — most of the globe has negligible background rate.
    rate = grid.rate
    thresh = np.percentile(rate[rate > 0], 50)
    ii, jj = np.where(rate >= thresh)
    cell_lat = grid.lat_centers[ii]
    cell_lon = grid.lon_centers[jj]
    bg = rate[ii, jj]                                  # events/day >= m_target
    n_cells = len(bg)

    days = np.arange(day_start, day_end)
    n_days = len(days)

    # --- event counts per (cell, day)
    ev = cat[cat["mag"] >= mc].copy()
    ev_day = ((ev["time"] - epoch).dt.total_seconds() / 86400).to_numpy()
    ev_xyz = _to_xyz(ev["lat"].to_numpy(), ev["lon"].to_numpy())
    cell_xyz = _to_xyz(cell_lat, cell_lon)

    from scipy.spatial import cKDTree
    ctree = cKDTree(cell_xyz)
    dist_to_cell, nearest = ctree.query(ev_xyz, k=1)
    # Events far from every active cell are outside the modelled domain; counting
    # them against a distant cell would inflate that cell's rate.
    max_assign_km = 1.5 * grid.cell_deg * 111.0
    in_win = ((ev_day >= day_start) & (ev_day < day_end)
              & (dist_to_cell <= max_assign_km))
    counts = np.zeros((n_cells, n_days))
    for c, d in zip(nearest[in_win], ev_day[in_win].astype(int)):
        counts[c, d - day_start] += 1

    # --- offset: log expected background count per cell-day
    offset = np.log(np.maximum(np.repeat(bg[:, None], n_days, axis=1), 1e-12)).ravel()

    # --- covariates
    X, names = [], []
    if "trigger" in use:
        prior = (ev_day < day_end)
        nu = _triggering_intensity(cell_xyz, days, ev_xyz[prior], ev_day[prior],
                                   ev["mag"].to_numpy()[prior], mc,
                                   params=etas_params)
        v = np.log(nu + np.percentile(nu[nu > 0], 5) if (nu > 0).any() else nu + 1e-12)
        X.append(_z(v)); names.append("log_ETAS_trigger")
    if "tide" in use:
        te = _tidal_envelope(days, epoch)
        X.append(_z(np.tile(te, (n_cells, 1)).ravel())); names.append("tidal_envelope")
    if "season" in use:
        doy = ((epoch + pd.to_timedelta(days, "D")).dayofyear.to_numpy())
        X.append(_z(np.tile(np.cos(2 * np.pi * doy / 365.25), (n_cells, 1)).ravel()))
        X.append(_z(np.tile(np.sin(2 * np.pi * doy / 365.25), (n_cells, 1)).ravel()))
        names += ["season_cos", "season_sin"]
    if "deficit" in use:
        # time since last M>=mc+1 event in each cell, scaled — a "gap" proxy
        big = ev[ev["mag"] >= mc + 1.0]
        last = np.full(n_cells, -9999.0)
        if len(big):
            bxyz = _to_xyz(big["lat"].to_numpy(), big["lon"].to_numpy())
            bday = ((big["time"] - epoch).dt.total_seconds() / 86400).to_numpy()
            _, bn = ctree.query(bxyz, k=1)
            for c, d in zip(bn, bday):
                if d < day_end:
                    last[c] = max(last[c], d)
        elapsed = days[None, :] - last[:, None]
        z = np.log1p(np.maximum(elapsed, 0))
        X.append(_z(z.ravel()))
        names.append("log_time_since_last_large")

    Xm = np.column_stack(X) if X else np.zeros((n_cells * n_days, 0))
    return {"X": Xm, "names": names, "y": counts.ravel(), "offset": offset,
            "cell_lat": cell_lat, "cell_lon": cell_lon, "bg": bg,
            "n_cells": n_cells, "n_days": n_days}


def _poisson_nll(beta, X, y, offset):
    eta = offset + (X @ beta if X.shape[1] else 0.0)
    eta = np.clip(eta, -50, 20)
    lam = np.exp(eta)
    return float(lam.sum() - (y * eta).sum())


def _poisson_grad(beta, X, y, offset):
    if X.shape[1] == 0:
        return np.zeros(0)
    eta = np.clip(offset + X @ beta, -50, 20)
    return X.T @ (np.exp(eta) - y)


def fit_hybrid(cat: pd.DataFrame, grid, mc: float,
               train_frac: float = 0.8,
               use: Sequence[str] = ("trigger", "tide", "season", "deficit"),
               etas_params: Optional[dict] = None,
               verbose: bool = True):
    """Fit the hybrid model on a training period; return model + test design.

    etas_params defaults to values DERIVED FROM THE TRAINING CATALOG via
    derive_etas_params(). Nothing about the triggering kernel is assumed.
    """
    epoch = cat["time"].min().normalize()
    total_days = int((cat["time"].max() - epoch).total_seconds() // 86400)
    split = int(total_days * train_frac)

    if verbose:
        print(f"Train: days 0-{split} | Test: days {split}-{total_days} "
              f"({total_days-split} d held out)")

    if etas_params is None and "trigger" in use:
        train_cat = cat[cat["time"] < epoch + pd.Timedelta(days=split)]
        etas_params = derive_etas_params(train_cat, mc, verbose=verbose)

    tr = _build_design(cat, grid, 0, split, epoch, mc, use, etas_params)
    te = _build_design(cat, grid, split, total_days, epoch, mc, use, etas_params)

    k = tr["X"].shape[1]
    res = optimize.minimize(_poisson_nll, np.zeros(k),
                            args=(tr["X"], tr["y"], tr["offset"]),
                            jac=_poisson_grad, method="L-BFGS-B",
                            options={"maxiter": 500})
    model = HybridForecast(
        beta=res.x, feature_names=tr["names"], mc=mc, b=grid.b,
        cell_lat=tr["cell_lat"], cell_lon=tr["cell_lon"], bg_rate=tr["bg"],
        train_ll=float(-res.fun), n_train_events=int(tr["y"].sum()),
        converged=bool(res.success),
        note="Poisson MLE on discretized space-time bins")
    if verbose:
        print(f"Converged: {res.success} | train events: {int(tr['y'].sum())} | "
              f"test events: {int(te['y'].sum())}")
    return model, tr, te


# ============================================================================ #
# Evaluation
# ============================================================================ #

def information_gain(beta, design, baseline_beta=None) -> dict:
    """Information gain per earthquake vs. the background-only baseline.

    IG = (1/N) * [logL(model) - logL(baseline)], in natural log units.
    Positive = the model beats the smoothed-seismicity baseline on data it
    never saw. Zero or negative = it does not.
    """
    X, y, off = design["X"], design["y"], design["offset"]
    n = y.sum()
    if n == 0:
        return {"n_events": 0, "IG": np.nan}

    ll_model = -_poisson_nll(beta, X, y, off)
    zero = np.zeros(X.shape[1]) if baseline_beta is None else baseline_beta
    ll_base = -_poisson_nll(zero, X, y, off)
    ig = (ll_model - ll_base) / n
    return {"n_events": int(n), "logL_model": ll_model, "logL_baseline": ll_base,
            "IG_per_earthquake": float(ig),
            "prob_gain_factor": float(np.exp(ig))}


def marginal_ablation(cat: pd.DataFrame, grid, mc: float, train_frac: float = 0.8,
                      components: Sequence[str] = ("trigger", "tide", "season", "deficit"),
                      verbose: bool = True) -> pd.DataFrame:
    """Leave-one-out: what does each component add BEYOND all the others?

    "Component alone" ablation flatters covariates that merely proxy the same
    underlying signal. A moment-deficit term that is really just measuring
    recency will score well alone, because recency is aftershock clustering.
    The question that matters is the MARGINAL one: with triggering already in
    the model, does this parameter still buy anything?
    """
    comps = list(components)
    full_model, _, full_te = fit_hybrid(cat, grid, mc, train_frac, comps, verbose=False)
    ig_full = information_gain(full_model.beta, full_te)["IG_per_earthquake"]

    rows = [{"dropped": "(none — full model)", "IG": ig_full, "marginal_loss": 0.0}]
    for c in comps:
        rest = [x for x in comps if x != c]
        if not rest:
            continue
        m, _, te = fit_hybrid(cat, grid, mc, train_frac, rest, verbose=False)
        ig = information_gain(m.beta, te)["IG_per_earthquake"]
        rows.append({"dropped": c, "IG": ig, "marginal_loss": ig_full - ig})
    df = pd.DataFrame(rows)
    if verbose:
        print("\n=== MARGINAL CONTRIBUTION (leave-one-out, held out) ===")
        print(df.to_string(index=False, float_format=lambda v: f"{v:.4f}"))
        print("\nmarginal_loss = how much held-out skill is lost by removing that")
        print("component from the full model. Near zero means the parameter adds")
        print("nothing the other components were not already capturing.")
    return df


def ablation_study(cat: pd.DataFrame, grid, mc: float, train_frac: float = 0.8,
                   components: Sequence[str] = ("trigger", "tide", "season", "deficit"),
                   verbose: bool = True) -> pd.DataFrame:
    """Fit with each component alone, and with all, and report held-out IG.

    This is the honest arbiter. A component that adds nothing shows IG ~ 0 and
    is reported as such.
    """
    rows = []
    for comp in list(components) + [tuple(components)]:
        use = (comp,) if isinstance(comp, str) else comp
        label = comp if isinstance(comp, str) else "ALL COMBINED"
        try:
            model, tr, te = fit_hybrid(cat, grid, mc, train_frac, use, verbose=False)
            ig = information_gain(model.beta, te)
            rows.append({"component": label,
                         "n_test_events": ig["n_events"],
                         "IG_per_earthquake": ig["IG_per_earthquake"],
                         "prob_gain_factor": ig["prob_gain_factor"],
                         "beta": np.round(model.beta, 4).tolist()})
        except Exception as e:                                   # noqa: BLE001
            rows.append({"component": label, "error": str(e)[:60]})
    df = pd.DataFrame(rows)
    if verbose:
        print("\n=== HELD-OUT INFORMATION GAIN vs smoothed-seismicity baseline ===")
        print(df.to_string(index=False, float_format=lambda v: f"{v:.4f}"))
        print("\nIG is natural-log units per earthquake. IG=0 means the component")
        print("is worth nothing beyond the baseline. Published ETAS-class models")
        print("reach roughly 0.2-1.0, essentially all from aftershock clustering.")
    return df
