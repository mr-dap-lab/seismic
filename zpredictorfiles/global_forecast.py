"""
global_forecast.py — Worldwide gridded seismicity forecast.

WHAT THIS DOES
--------------
Produces a global map of the RATE of M>=m earthquakes per cell per unit time,
by adaptive kernel smoothing of past epicenters (Kagan & Jackson, 1994;
Helmstetter, Kagan & Jackson, 2007). Smoothed-seismicity models of this family
are consistently among the hardest baselines to beat in CSEP forecast
evaluations — "where it has happened is where it will happen" is a strong model.

WHAT THIS DOES NOT DO
---------------------
It does NOT predict where the next earthquake will be. It gives a stationary
probability field. The highest-probability cells are Tonga, Indonesia, Japan,
Chile, the Aleutians — every time, for everyone, all year. That is the correct
answer, and its information content is low precisely because the physics is
nearly stationary on human timescales.

Critically: recent global activity barely moves this map. Use
forecast_stability() to measure that yourself rather than take my word for it.

Dependencies: numpy, pandas, scipy. Optional: matplotlib, requests.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Optional, Sequence, Tuple

import numpy as np
import pandas as pd
from scipy import stats
from scipy.spatial import cKDTree

__all__ = [
    "fetch_global", "GlobalGrid", "smoothed_seismicity",
    "forecast_stability", "successor_distance_test", "top_regions",
]

R_EARTH_KM = 6371.0088


# ============================================================================ #
# Data
# ============================================================================ #

def fetch_global(start_utc, end_utc=None, minmag: float = 5.0,
                 maxdepth_km: Optional[float] = None,
                 cache_dir: Optional[str] = ".usgs_cache",
                 verbose: bool = True) -> pd.DataFrame:
    """Worldwide catalog from the USGS FDSN event service.

    Delegates to usgs_client, which does a /count preflight and bisects the
    time window recursively, so the 20,000-row cap cannot silently truncate the
    catalog. Preserves the `place` field that drives region labelling.
    """
    from usgs_client import CatalogQuery, USGSClient

    q = CatalogQuery(starttime=start_utc, endtime=end_utc, minmagnitude=minmag,
                     maxdepth=maxdepth_km, eventtype="earthquake")
    return USGSClient(cache_dir=cache_dir, verbose=verbose).fetch(q)


# ============================================================================ #
# Grid + smoothing
# ============================================================================ #

def _to_xyz(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    return np.column_stack([np.cos(la) * np.cos(lo),
                            np.cos(la) * np.sin(lo),
                            np.sin(la)]) * R_EARTH_KM


@dataclass
class GlobalGrid:
    """A global forecast: rate of M>=m_target per cell per day."""
    lat_centers: np.ndarray
    lon_centers: np.ndarray
    rate: np.ndarray                # shape (nlat, nlon), events/day >= m_target
    m_target: float
    b: float
    cell_deg: float
    n_events_used: int
    span_days: float
    ref_lat: np.ndarray = field(default_factory=lambda: np.array([]))
    ref_lon: np.ndarray = field(default_factory=lambda: np.array([]))
    ref_region: np.ndarray = field(default_factory=lambda: np.array([]))
    note: str = ""

    def probability(self, horizon_days: float) -> np.ndarray:
        """P(at least one event >= m_target per cell) over the horizon."""
        return 1 - np.exp(-self.rate * horizon_days)

    def top_cells(self, n: int = 20, horizon_days: float = 30) -> pd.DataFrame:
        P = self.probability(horizon_days)
        flat = np.argsort(P, axis=None)[::-1][:n]
        ii, jj = np.unravel_index(flat, P.shape)
        return pd.DataFrame({
            "rank": np.arange(1, len(ii) + 1),
            "lat": self.lat_centers[ii],
            "lon": self.lon_centers[jj],
            "region": _label_cells(self.lat_centers[ii], self.lon_centers[jj],
                                   self.ref_lat, self.ref_lon, self.ref_region),
            "rate_per_day": self.rate[ii, jj],
            f"P_{horizon_days:g}d_pct": 100 * P[ii, jj],
        })

    def global_probability(self, horizon_days: float) -> float:
        """P(at least one event >= m_target ANYWHERE) over the horizon."""
        total = self.rate.sum() * horizon_days
        return float(1 - np.exp(-total))


def smoothed_seismicity(cat: pd.DataFrame,
                        m_target: float = 6.0,
                        mc: Optional[float] = None,
                        cell_deg: float = 1.0,
                        k_neighbors: int = 6,
                        min_bandwidth_km: float = 30.0,
                        max_bandwidth_km: float = 500.0,
                        power: float = 1.5,
                        b: Optional[float] = None,
                        decluster: bool = True,
                        verbose: bool = True) -> GlobalGrid:
    """Adaptive-kernel smoothed seismicity forecast on a global grid.

    Each past epicenter contributes a kernel

        K_i(r) proportional to  1 / (r^2 + d_i^2)^power

    where d_i is the distance to that event's k-th nearest neighbour. Dense
    clusters get narrow kernels, isolated events get broad ones. Kernel sums
    are normalized so total rate reproduces the observed rate, then scaled to
    the target magnitude with Gutenberg-Richter.

    Declustering is ON by default: aftershocks would otherwise pile rate onto
    wherever the most recent large sequence happened, which is exactly the bias
    you do not want in a stationary forecast.
    """
    from eq_forecast import estimate_mc, estimate_b

    if mc is None:
        mc = estimate_mc(cat["mag"].to_numpy())
    work = cat[cat["mag"] >= mc].copy()

    if decluster:
        from geophysics import decluster_gardner_knopoff
        n0 = len(work)
        work = decluster_gardner_knopoff(work)
        if verbose:
            print(f"Declustered: {n0} -> {len(work)} events "
                  f"({100*(n0-len(work))/max(n0,1):.0f}% removed)")

    if len(work) < 50:
        raise ValueError(f"only {len(work)} events above Mc={mc}; need >= 50")

    if b is None:
        bf = estimate_b(work["mag"].to_numpy(), mc)
        b = bf.b if np.isfinite(bf.b) else 1.0

    span_days = (work["time"].max() - work["time"].min()).total_seconds() / 86400
    if span_days <= 0:
        raise ValueError("catalog spans no time")

    # --- adaptive bandwidths from k-th nearest neighbour distance
    ev_xyz = _to_xyz(work["lat"].to_numpy(), work["lon"].to_numpy())
    tree_ev = cKDTree(ev_xyz)
    kk = min(k_neighbors + 1, len(work))
    dists, _ = tree_ev.query(ev_xyz, k=kk)
    d_i = dists[:, -1]                                    # chord distance, km
    d_i = np.clip(d_i, min_bandwidth_km, max_bandwidth_km)

    # --- grid
    lat_edges = np.arange(-90, 90 + cell_deg, cell_deg)
    lon_edges = np.arange(-180, 180 + cell_deg, cell_deg)
    lat_c = (lat_edges[:-1] + lat_edges[1:]) / 2
    lon_c = (lon_edges[:-1] + lon_edges[1:]) / 2
    LON, LAT = np.meshgrid(lon_c, lat_c)
    grid_xyz = _to_xyz(LAT.ravel(), LON.ravel())

    # --- accumulate kernels, using a cutoff for tractability
    dens = np.zeros(grid_xyz.shape[0])
    tree_grid = cKDTree(grid_xyz)
    for i in range(len(work)):
        d = d_i[i]
        cutoff = min(8 * d, 3000.0)
        idx = tree_grid.query_ball_point(ev_xyz[i], cutoff)
        if not idx:
            continue
        idx = np.asarray(idx)
        r2 = ((grid_xyz[idx] - ev_xyz[i]) ** 2).sum(axis=1)
        k = 1.0 / (r2 + d ** 2) ** power
        s = k.sum()
        if s > 0:
            dens[idx] += k / s                            # each event weight 1

    if dens.sum() <= 0:
        raise ValueError("kernel accumulation produced zero density")

    # --- normalize to observed rate, then scale to target magnitude via G-R
    rate_mc_per_day = len(work) / span_days
    frac = dens / dens.sum()
    rate_mc_grid = frac.reshape(LAT.shape) * rate_mc_per_day
    rate_target = rate_mc_grid * 10 ** (-b * (m_target - mc))

    if verbose:
        print(f"Grid {len(lat_c)}x{len(lon_c)} at {cell_deg} deg | Mc={mc} "
              f"b={b:.2f} | {len(work)} events over {span_days/365.25:.1f} yr")

    reg = _regions_from_place(work)
    return GlobalGrid(lat_c, lon_c, rate_target, m_target, b, cell_deg,
                      len(work), span_days,
                      ref_lat=work["lat"].to_numpy(), ref_lon=work["lon"].to_numpy(),
                      ref_region=reg,
                      note="adaptive-kernel smoothed seismicity")


# ============================================================================ #
# THE ACTUAL QUESTION: does recent activity change the map?
# ============================================================================ #

def forecast_stability(cat: pd.DataFrame, m_target: float = 6.0,
                       cutoffs_days: Sequence[float] = (7, 30, 90, 365),
                       top_n: int = 50, verbose: bool = True,
                       **kwargs) -> pd.DataFrame:
    """Test how much the forecast map depends on RECENT seismicity.

    Rebuilds the map with the most recent N days withheld and compares the
    ranking of the top cells against the full-catalog map.

    This is the empirical answer to "can the last earthquake tell me where the
    next one will be?" If withholding the last 90 days barely changes the
    ranking, then recent activity carries almost no information about where the
    next large event goes — the map is dominated by decades of accumulated
    seismicity, not by last week.
    """
    full = smoothed_seismicity(cat, m_target=m_target, verbose=False, **kwargs)
    P_full = full.rate.ravel()
    top_idx = np.argsort(P_full)[::-1][:top_n]

    t_end = cat["time"].max()
    rows = []
    for cut in cutoffs_days:
        sub = cat[cat["time"] <= t_end - timedelta(days=float(cut))]
        try:
            g = smoothed_seismicity(sub, m_target=m_target, verbose=False, **kwargs)
        except ValueError as e:
            rows.append({"withheld_days": cut, "note": str(e)})
            continue
        P_cut = g.rate.ravel()
        rho = stats.spearmanr(P_full[top_idx], P_cut[top_idx]).statistic
        top_cut = set(np.argsort(P_cut)[::-1][:top_n])
        overlap = len(set(top_idx) & top_cut) / top_n
        rows.append({
            "withheld_days": cut,
            "n_events_used": g.n_events_used,
            "top_cell_overlap_pct": 100 * overlap,
            "rank_correlation": rho,
            "max_cell_rate_change_pct":
                100 * np.max(np.abs(P_cut[top_idx] - P_full[top_idx])
                             / np.maximum(P_full[top_idx], 1e-30)),
        })
    df = pd.DataFrame(rows)
    if verbose:
        print("\n--- Does withholding recent data change the forecast? ---")
        print(df.to_string(index=False, float_format=lambda v: f"{v:.2f}"))
        if "top_cell_overlap_pct" in df and (df["top_cell_overlap_pct"] > 90).all():
            print("\nWithholding recent activity leaves the map essentially "
                  "unchanged.\nRecent seismicity carries almost no information "
                  "about WHERE the\nnext large earthquake will occur.")
    return df


def successor_distance_test(cat: pd.DataFrame, m_large: float = 6.5,
                            n_null: int = 2000, seed: int = 0,
                            verbose: bool = True) -> dict:
    """Does the location of one large earthquake predict the NEXT one's location?

    Direct test of the hypothesis. For every consecutive pair of M>=m_large
    events, measure the great-circle distance between them. Compare that
    observed distribution against a null built by shuffling which large events
    follow which — preserving the set of locations but destroying any ordering
    information.

    Interpretation:
      - Observed median MUCH smaller than null  -> successors cluster near
        predecessors. In practice this means AFTERSHOCKS, not global prediction:
        check whether the short distances are also short in TIME.
      - Observed indistinguishable from null    -> the previous large earthquake
        carries no information about where the next one occurs.

    NOTE: I could only validate the mechanics of this function offline, on a
    synthetic catalog built WITHOUT triggering — so it trivially shows no
    relation there, which proves nothing. Run it on the real USGS catalog; that
    is the test that means something.
    """
    rng = np.random.default_rng(seed)
    big = cat[cat["mag"] >= m_large].sort_values("time").reset_index(drop=True)
    n = len(big)
    if n < 30:
        return {"error": f"only {n} events >= M{m_large}; need >= 30"}

    lat, lon = big["lat"].to_numpy(), big["lon"].to_numpy()

    def gcd(i, j):
        dlat = np.radians(lat[j] - lat[i])
        dlon = np.radians(lon[j] - lon[i])
        a = (np.sin(dlat / 2) ** 2 + np.cos(np.radians(lat[i]))
             * np.cos(np.radians(lat[j])) * np.sin(dlon / 2) ** 2)
        return 2 * R_EARTH_KM * np.arcsin(np.minimum(1, np.sqrt(a)))

    i = np.arange(n - 1)
    obs = gcd(i, i + 1)
    dt_days = (big["time"].diff().dt.total_seconds().to_numpy()[1:]) / 86400

    null_medians = []
    for _ in range(n_null):
        perm = rng.permutation(n)
        null_medians.append(np.median(gcd(perm[:-1], perm[1:])))
    null_medians = np.array(null_medians)

    obs_med = float(np.median(obs))
    p = float((null_medians <= obs_med).mean())

    # Separate likely-aftershock pairs (close in space AND time)
    aft = (obs < 300) & (dt_days < 30)
    obs_med_noaft = float(np.median(obs[~aft])) if (~aft).any() else np.nan

    out = {
        "n_pairs": int(n - 1),
        "observed_median_km": obs_med,
        "null_median_km": float(np.median(null_medians)),
        "p_value_closer_than_null": p,
        "pct_pairs_within_300km_30days": float(100 * aft.mean()),
        "observed_median_excluding_aftershocks_km": obs_med_noaft,
    }
    if verbose:
        print(f"\n--- Does the last M>={m_large} predict the next one's location? ---")
        print(f"  consecutive pairs:              {out['n_pairs']}")
        print(f"  observed median separation:     {obs_med:,.0f} km")
        print(f"  null (shuffled) median:         {out['null_median_km']:,.0f} km")
        print(f"  p(observed closer than null):   {p:.4f}")
        print(f"  pairs within 300 km AND 30 d:   "
              f"{out['pct_pairs_within_300km_30days']:.1f}%  (aftershocks)")
        print(f"  median excluding those pairs:   {obs_med_noaft:,.0f} km")
        if obs_med_noaft > 0.8 * out["null_median_km"]:
            print("\n  Once aftershocks are removed, successor locations are")
            print("  indistinguishable from random draws. The previous large")
            print("  earthquake carries no usable information about WHERE the")
            print("  next one will occur.")
    return out


# ============================================================================ #
# Region labelling (coarse, for readability of top-cell tables)
# ============================================================================ #

def _regions_from_place(cat: pd.DataFrame) -> np.ndarray:
    """Region names parsed from USGS's own `place` field.

    `place` looks like "75 km NE of Bali, Indonesia" or "South Sandwich Islands
    region". The text after the final comma is the region; when there is no
    comma the whole string is used, with any leading distance phrase stripped.
    Nothing here is a hardcoded gazetteer — the names come from the catalog.
    """
    if "place" not in cat.columns:
        raise KeyError(
            "Catalog has no `place` column. Fetch through usgs_client, which "
            "preserves it — region names are read from the data, not a built-in "
            "table.")

    pat = re.compile(r"^\s*\d+\s*km\s+[NSEW]{1,3}\s+of\s+", re.IGNORECASE)

    def one(v: object) -> str:
        if not isinstance(v, str) or not v.strip():
            return "unlabelled"
        s = v.split(",")[-1].strip() if "," in v else pat.sub("", v).strip()
        return s or "unlabelled"

    return cat["place"].map(one).to_numpy(dtype=object)


def _label_cells(cell_lat, cell_lon, ref_lat, ref_lon, ref_region):
    """Label grid cells using the region of the nearest observed event.

    Labels come from USGS's own `place` field in the catalog — no hardcoded
    geography. Cells with no event within ~1000 km are left unlabelled rather
    than assigned a distant region.
    """
    from scipy.spatial import cKDTree
    if len(ref_lat) == 0:
        return np.array(["unlabelled"] * len(cell_lat), dtype=object)
    tree = cKDTree(_to_xyz(ref_lat, ref_lon))
    d, idx = tree.query(_to_xyz(cell_lat, cell_lon), k=1)
    lab = np.asarray(ref_region, dtype=object)[idx]
    lab[d > 1000.0] = "unlabelled"
    return lab


def top_regions(grid: GlobalGrid, horizon_days: float = 30,
                n_cells: int = 500) -> pd.DataFrame:
    """Aggregate cell rates into coarse regions and rank them."""
    P = grid.rate
    flat = np.argsort(P, axis=None)[::-1][:n_cells]
    ii, jj = np.unravel_index(flat, P.shape)
    labels = _label_cells(grid.lat_centers[ii], grid.lon_centers[jj],
                          grid.ref_lat, grid.ref_lon, grid.ref_region)
    recs = {}
    for key, r in zip(labels, P[ii, jj]):
        recs[key] = recs.get(key, 0.0) + r
    df = pd.DataFrame([{"region": k, "rate_per_day": v} for k, v in recs.items()])
    df["expected_count"] = df["rate_per_day"] * horizon_days
    df[f"P_{horizon_days:g}d_pct"] = 100 * (1 - np.exp(-df["expected_count"]))
    return df.sort_values("rate_per_day", ascending=False).reset_index(drop=True)


def plot_global(grid: GlobalGrid, horizon_days: float = 30,
                file: Optional[str] = None, log_scale: bool = True):
    """Quick global map. Uses matplotlib only — no basemap dependency."""
    import matplotlib
    if file:
        matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    P = grid.probability(horizon_days) * 100
    fig, ax = plt.subplots(figsize=(14, 7), dpi=110)
    data = np.log10(np.maximum(P, 1e-6)) if log_scale else P
    im = ax.imshow(data, origin="lower", aspect="auto",
                   extent=[-180, 180, -90, 90], cmap="inferno")
    cb = fig.colorbar(im, ax=ax, shrink=0.8)
    cb.set_label(f"log10 P(M>={grid.m_target}) in {horizon_days:g} d, %"
                 if log_scale else f"P(M>={grid.m_target}) %")
    ax.set_xlabel("Longitude"); ax.set_ylabel("Latitude")
    ax.set_title(f"Global smoothed-seismicity forecast, M>={grid.m_target}, "
                 f"{horizon_days:g}-day horizon")
    fig.tight_layout()
    if file:
        fig.savefig(file); print("Wrote", file); plt.close(fig)
    return fig
