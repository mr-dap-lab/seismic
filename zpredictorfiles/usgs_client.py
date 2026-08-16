"""
usgs_client.py — USGS FDSN event web service client.

Service: https://earthquake.usgs.gov/fdsnws/event/1/

Parameter names, value ranges, defaults, and mutual exclusions below are taken
from the published service documentation.

Built for real catalog work at scale:
  * /count preflight + recursive time bisection. A result set above 20,000
    returns HTTP 400, so bisection is the only way to pull large spans without
    silently losing events.
  * retry with backoff on 429 / 5xx
  * on-disk caching, so backtests do not re-hammer the service
  * strict client-side validation of names, ranges, and exclusions

Dependencies: requests, pandas, numpy.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from io import StringIO
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import requests

__all__ = [
    "USGSClient", "CatalogQuery", "fetch_catalog", "verify_service",
    "MAX_LIMIT", "list_catalogs", "list_contributors", "validate_params",
]

BASE = "https://earthquake.usgs.gov/fdsnws/event/1"
MAX_LIMIT = 20000                # documented: above this the service returns 400
USER_AGENT = "eq-forecast-research/1.0 (FDSN event client)"

# ---------------------------------------------------------------------------- #
# Parameter spec, transcribed from the service documentation.
# ---------------------------------------------------------------------------- #
NUMERIC_RANGES: Dict[str, tuple] = {
    "minlatitude": (-90, 90), "maxlatitude": (-90, 90),
    "minlongitude": (-360, 360), "maxlongitude": (-360, 360),
    "latitude": (-90, 90), "longitude": (-180, 180),
    "maxradius": (0, 180), "maxradiuskm": (0, 20001.6),
    "mindepth": (-100, 1000), "maxdepth": (-100, 1000),
    "minmagnitude": (None, None), "maxmagnitude": (None, None),
    "limit": (1, MAX_LIMIT), "offset": (1, None),
    "mincdi": (0, 12), "maxcdi": (0, 12),
    "minmmi": (0, 12), "maxmmi": (0, 12),
    "mingap": (0, 360), "maxgap": (0, 360),
    "minsig": (None, None), "maxsig": (None, None),
    "minfelt": (1, None),
}

ENUMS: Dict[str, set] = {
    "format": {"quakeml", "csv", "geojson", "kml", "text", "xml"},
    "orderby": {"time", "time-asc", "magnitude", "magnitude-asc"},
    "reviewstatus": {"all", "automatic", "reviewed"},
    "alertlevel": {"green", "yellow", "orange", "red"},
    "minalertlevel": {"green", "yellow", "orange", "red"},
    "maxalertlevel": {"green", "yellow", "orange", "red"},
    "nodata": {204, 404, "204", "404"},
    "producttype": {"moment-tensor", "focal-mechanism", "shakemap",
                    "losspager", "dyfi"},
    "kmlcolorby": {"age", "depth"},
}

BOOLEANS = {"includeallmagnitudes", "includeallorigins", "includearrivals",
            "includesuperseded", "jsonerror", "kmlanimated"}

STRINGS = {"catalog", "contributor", "eventid", "eventtype", "callback",
           "productcode", "starttime", "endtime", "updatedafter"}

SPECIAL = {"includedeleted"}          # Boolean OR the literal "only"

VALID_PARAMS = set(NUMERIC_RANGES) | set(ENUMS) | BOOLEANS | STRINGS | SPECIAL

# Documented mutual exclusions
EXCLUSIVE_PAIRS = [
    ("maxradius", "maxradiuskm"),
    ("includedeleted", "includesuperseded"),
]


# ============================================================================ #
# Query specification
# ============================================================================ #

@dataclass
class CatalogQuery:
    """An FDSN event query. Omit region parameters for a worldwide search.

    Service defaults if unset: starttime NOW-30d, endtime present time,
    mindepth -100 km, maxdepth 1000 km, rectangle spanning the globe.
    """
    starttime: Any = None
    endtime: Any = None
    updatedafter: Any = None
    minmagnitude: Optional[float] = None
    maxmagnitude: Optional[float] = None
    # rectangle
    minlatitude: Optional[float] = None
    maxlatitude: Optional[float] = None
    minlongitude: Optional[float] = None
    maxlongitude: Optional[float] = None
    # circle — service requires latitude, longitude AND a radius together
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    maxradius: Optional[float] = None
    maxradiuskm: Optional[float] = None
    # depth
    mindepth: Optional[float] = None
    maxdepth: Optional[float] = None
    # provenance / filtering
    catalog: Optional[str] = None
    contributor: Optional[str] = None
    eventid: Optional[str] = None
    eventtype: Optional[str] = "earthquake"    # excludes blasts, explosions etc.
    reviewstatus: Optional[str] = None
    includeallmagnitudes: Optional[bool] = None
    includeallorigins: Optional[bool] = None
    # quality extensions
    minsig: Optional[int] = None
    maxsig: Optional[int] = None
    mingap: Optional[float] = None
    maxgap: Optional[float] = None
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_params(self) -> Dict[str, Any]:
        p: Dict[str, Any] = {}
        for k, v in self.__dict__.items():
            if k == "extra" or v is None:
                continue
            p[k] = v
        for k in ("starttime", "endtime", "updatedafter"):
            if k in p:
                p[k] = _iso(p[k])
        p.update({k: v for k, v in self.extra.items() if v is not None})
        validate_params(p)
        return p

    def replace(self, **kw) -> "CatalogQuery":
        d = {k: v for k, v in self.__dict__.items()}
        d.update(kw)
        return CatalogQuery(**d)


def validate_params(p: Dict[str, Any]) -> None:
    """Reject bad parameters before they reach the service."""
    unknown = set(p) - VALID_PARAMS
    if unknown:
        raise ValueError(f"Unknown FDSN parameter(s): {sorted(unknown)}.\n"
                         f"Valid: {sorted(VALID_PARAMS)}")

    for k, (lo, hi) in NUMERIC_RANGES.items():
        if k not in p:
            continue
        try:
            v = float(p[k])
        except (TypeError, ValueError):
            raise ValueError(f"{k} must be numeric, got {p[k]!r}")
        if lo is not None and v < lo:
            raise ValueError(f"{k}={v} below documented minimum {lo}")
        if hi is not None and v > hi:
            raise ValueError(f"{k}={v} above documented maximum {hi}")

    for k, allowed in ENUMS.items():
        if k in p and p[k] not in allowed:
            raise ValueError(f"{k}={p[k]!r} not in {sorted(map(str, allowed))}")

    for k in BOOLEANS:
        if k in p and not isinstance(p[k], (bool, np.bool_)):
            raise ValueError(f"{k} must be boolean, got {p[k]!r}")

    if "includedeleted" in p and p["includedeleted"] not in (True, False, "only"):
        raise ValueError("includedeleted must be True, False, or 'only'")

    for a, b in EXCLUSIVE_PAIRS:
        if p.get(a) is not None and p.get(b) is not None:
            raise ValueError(f"{a} and {b} are mutually exclusive")

    has_center = ("latitude" in p) or ("longitude" in p)
    has_radius = ("maxradius" in p) or ("maxradiuskm" in p)
    if has_center or has_radius:
        if not ("latitude" in p and "longitude" in p and has_radius):
            raise ValueError("A circle search requires latitude, longitude, and "
                             "one of maxradius / maxradiuskm.")

    if "minlatitude" in p and "maxlatitude" in p:
        if float(p["minlatitude"]) > float(p["maxlatitude"]):
            raise ValueError("minlatitude must not exceed maxlatitude")

    if "starttime" in p and "endtime" in p:
        if pd.Timestamp(p["starttime"]) >= pd.Timestamp(p["endtime"]):
            raise ValueError(f"starttime {p['starttime']} not before "
                             f"endtime {p['endtime']}")


def _iso(t) -> str:
    """ISO8601 UTC. The service assumes UTC when no zone is specified."""
    ts = pd.Timestamp(t)
    ts = ts.tz_localize("UTC") if ts.tzinfo is None else ts.tz_convert("UTC")
    return ts.strftime("%Y-%m-%dT%H:%M:%S")


# ============================================================================ #
# Client
# ============================================================================ #

class USGSClient:
    """FDSN event client with count preflight, time bisection, retry, cache."""

    def __init__(self, base: str = BASE, cache_dir: Optional[str] = ".usgs_cache",
                 min_interval_s: float = 0.2, max_retries: int = 5,
                 timeout_s: int = 180, verbose: bool = True):
        self.base = base.rstrip("/")
        self.cache_dir = cache_dir
        self.min_interval_s = min_interval_s
        self.max_retries = max_retries
        self.timeout_s = timeout_s
        self.verbose = verbose
        self._last = 0.0
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        if cache_dir:
            os.makedirs(cache_dir, exist_ok=True)

    def _throttle(self):
        dt = time.monotonic() - self._last
        if dt < self.min_interval_s:
            time.sleep(self.min_interval_s - dt)
        self._last = time.monotonic()

    def _get(self, method: str, params: Dict[str, Any]) -> requests.Response:
        url = f"{self.base}/{method}"
        for attempt in range(self.max_retries):
            self._throttle()
            try:
                r = self.session.get(url, params=params, timeout=self.timeout_s)
            except requests.RequestException as e:
                if attempt == self.max_retries - 1:
                    raise
                w = 2 ** attempt
                if self.verbose:
                    print(f"    {e.__class__.__name__}; retry in {w}s")
                time.sleep(w)
                continue

            if r.status_code == 204:
                return r
            if r.status_code in (429, 500, 502, 503, 504):
                if attempt == self.max_retries - 1:
                    r.raise_for_status()
                w = 2 ** attempt
                if self.verbose:
                    print(f"    HTTP {r.status_code}; retry in {w}s")
                time.sleep(w)
                continue
            if r.status_code == 400:
                raise RuntimeError(
                    f"HTTP 400 Bad Request.\nURL: {r.url}\nBody: {r.text[:500]}\n"
                    f"Common causes: result set above the {MAX_LIMIT} limit, an "
                    f"inverted time range, or a value outside its documented range.")
            r.raise_for_status()
            return r
        raise RuntimeError("retries exhausted")

    # -- metadata ------------------------------------------------------------ #

    def version(self) -> str:
        return self._get("version", {}).text.strip()

    def application_json(self) -> dict:
        """Enumerated parameter values the service itself advertises."""
        return json.loads(self._get("application.json", {}).text)

    # -- count --------------------------------------------------------------- #

    def count(self, query: CatalogQuery) -> int:
        """Matching event count via /count. Plain text is the documented default
        format and returns a bare integer; geojson is parsed as a fallback."""
        p = query.to_params()
        for k in ("limit", "offset", "orderby", "format"):
            p.pop(k, None)
        r = self._get("count", p)
        if r.status_code == 204 or not r.text.strip():
            return 0
        txt = r.text.strip()
        try:
            return int(txt)
        except ValueError:
            pass
        try:
            return int(json.loads(txt)["count"])
        except (ValueError, KeyError, TypeError) as e:
            raise RuntimeError(f"Unparseable /count response: {txt[:200]!r}") from e

    # -- query --------------------------------------------------------------- #

    def _cache_path(self, params: Dict[str, Any]) -> Optional[str]:
        if not self.cache_dir:
            return None
        key = hashlib.sha256(
            json.dumps(params, sort_keys=True, default=str).encode()).hexdigest()[:24]
        return os.path.join(self.cache_dir, f"{key}.csv")

    def _query_csv(self, params: Dict[str, Any]) -> pd.DataFrame:
        path = self._cache_path(params)
        if path and os.path.exists(path):
            return pd.read_csv(path)
        p = dict(params, format="csv", orderby="time-asc", limit=MAX_LIMIT)
        r = self._get("query", p)
        df = _empty_raw() if (r.status_code == 204 or not r.text.strip()) \
            else pd.read_csv(StringIO(r.text))
        if path:
            df.to_csv(path, index=False)
        return df

    def fetch(self, query: CatalogQuery, max_depth: int = 24) -> pd.DataFrame:
        """Fetch a complete catalog, bisecting the time window as required."""
        n = self.count(query)
        if self.verbose:
            print(f"  /count -> {n:,} events")
        if n == 0:
            return normalize(_empty_raw())

        frames = self._fetch_window(query, n, 0, max_depth)
        cat = normalize(pd.concat(frames, ignore_index=True))
        cat = cat.drop_duplicates(subset="id").sort_values("time").reset_index(drop=True)

        if len(cat) < n * 0.98:
            raise RuntimeError(
                f"Retrieved {len(cat):,} events but /count reported {n:,}. "
                f"Refusing to return a possibly truncated catalog.")
        if self.verbose:
            print(f"  retrieved {len(cat):,} events")
        return cat

    def _fetch_window(self, query: CatalogQuery, n: int, depth: int,
                      max_depth: int) -> List[pd.DataFrame]:
        if n <= MAX_LIMIT:
            return [self._query_csv(query.to_params())]
        if depth >= max_depth:
            raise RuntimeError(
                f"Bisection reached depth {max_depth} with {n:,} events in one "
                f"window. Narrow the region or raise minmagnitude.")

        p = query.to_params()
        t0 = pd.Timestamp(p["starttime"], tz="UTC")
        t1 = pd.Timestamp(p["endtime"], tz="UTC")
        mid = t0 + (t1 - t0) / 2
        if not (t0 < mid < t1):
            raise RuntimeError("window too small to bisect further")

        out: List[pd.DataFrame] = []
        for a, b in ((t0, mid), (mid, t1)):
            sub = query.replace(starttime=a, endtime=b)
            n_sub = self.count(sub)
            if self.verbose and depth < 3:
                print(f"    {'  ' * depth}{a:%Y-%m-%d}..{b:%Y-%m-%d} -> {n_sub:,}")
            if n_sub:
                out += self._fetch_window(sub, n_sub, depth + 1, max_depth)
        return out


def list_catalogs(client: Optional[USGSClient] = None) -> List[str]:
    c = client or USGSClient(cache_dir=None, verbose=False)
    return re.findall(r"<Catalog>(.*?)</Catalog>", c._get("catalogs", {}).text)


def list_contributors(client: Optional[USGSClient] = None) -> List[str]:
    c = client or USGSClient(cache_dir=None, verbose=False)
    return re.findall(r"<Contributor>(.*?)</Contributor>",
                      c._get("contributors", {}).text)


# ============================================================================ #
# Normalization
# ============================================================================ #

RAW_COLUMNS = ["time", "latitude", "longitude", "depth", "mag", "magType",
               "nst", "gap", "dmin", "rms", "net", "id", "updated", "place",
               "type", "horizontalError", "depthError", "magError", "magNst",
               "status", "locationSource", "magSource"]


def _empty_raw() -> pd.DataFrame:
    return pd.DataFrame({c: pd.Series(dtype="object") for c in RAW_COLUMNS})


def normalize(raw: pd.DataFrame) -> pd.DataFrame:
    """FDSN CSV -> the internal schema shared by the forecasting modules.

    Retains place, magType, status, type and gap: `place` drives data-driven
    region labelling, `status` separates automatic from reviewed solutions, and
    `type` lets you confirm the eventtype filter actually applied.
    """
    if len(raw) == 0:
        cols = {"time": "datetime64[ns, UTC]", "lat": float, "lon": float,
                "depth_km": float, "mag": float, "magType": object,
                "place": object, "status": object, "type": object,
                "gap": float, "id": object}
        return pd.DataFrame({k: pd.Series(dtype=v) for k, v in cols.items()})

    out = pd.DataFrame({
        "time": pd.to_datetime(raw["time"], format="ISO8601", utc=True,
                               errors="coerce"),
        "lat": pd.to_numeric(raw["latitude"], errors="coerce"),
        "lon": pd.to_numeric(raw["longitude"], errors="coerce"),
        "depth_km": pd.to_numeric(raw.get("depth"), errors="coerce"),
        "mag": pd.to_numeric(raw["mag"], errors="coerce"),
        "magType": raw.get("magType", pd.Series(index=raw.index, dtype=object)),
        "place": raw.get("place", pd.Series(index=raw.index, dtype=object)),
        "status": raw.get("status", pd.Series(index=raw.index, dtype=object)),
        "type": raw.get("type", pd.Series(index=raw.index, dtype=object)),
        "gap": pd.to_numeric(raw.get("gap"), errors="coerce"),
        "id": raw.get("id", pd.Series(index=raw.index, dtype=object)).astype(str),
    })
    n0 = len(out)
    out = out.dropna(subset=["time", "mag", "lat", "lon"])
    if len(out) < n0:
        print(f"  dropped {n0 - len(out)} rows missing time/mag/location")
    return out.sort_values("time").reset_index(drop=True)


def fetch_catalog(starttime, endtime=None, minmagnitude: float = 4.5,
                  cache_dir: Optional[str] = ".usgs_cache",
                  verbose: bool = True, **kwargs) -> pd.DataFrame:
    """Worldwide unless region parameters are supplied via kwargs."""
    q = CatalogQuery(starttime=starttime, endtime=endtime,
                     minmagnitude=minmagnitude, **kwargs)
    return USGSClient(cache_dir=cache_dir, verbose=verbose).fetch(q)


# ============================================================================ #
# Live verification
# ============================================================================ #

def verify_service(verbose: bool = True) -> Dict[str, Any]:
    """Probe the live service and confirm this client's assumptions hold."""
    results: Dict[str, Any] = {}
    c = USGSClient(cache_dir=None, verbose=False)

    def check(name, fn):
        try:
            results[name] = {"ok": True, "detail": fn()}
            if verbose:
                print(f"  [PASS] {name}: {results[name]['detail']}")
        except Exception as e:                                   # noqa: BLE001
            results[name] = {"ok": False, "detail": f"{e.__class__.__name__}: {e}"}
            if verbose:
                print(f"  [FAIL] {name}: {e.__class__.__name__}: {str(e)[:200]}")

    if verbose:
        print("Verifying against the live FDSN service...\n")

    check("version method", c.version)
    check("catalogs method", lambda: f"{len(list_catalogs(c))} catalogs")
    check("contributors method", lambda: f"{len(list_contributors(c))} contributors")

    q = CatalogQuery(starttime="2024-01-01", endtime="2024-01-08", minmagnitude=5.0)
    check("count returns integer", lambda: c.count(q))

    def csv_cols():
        df = c._query_csv(q.to_params())
        need = ["time", "latitude", "longitude", "depth", "mag", "id",
                "place", "status", "type", "magType"]
        missing = [x for x in need if x not in df.columns]
        if missing:
            raise RuntimeError(f"missing expected CSV columns: {missing}")
        return f"{len(df)} rows, all {len(need)} expected columns present"
    check("CSV schema", csv_cols)

    def count_vs_query():
        n = c.count(q)
        df = c._query_csv(q.to_params())
        if abs(len(df) - n) > max(2, 0.02 * n):
            raise RuntimeError(f"count={n} vs rows={len(df)}")
        return f"count={n}, rows={len(df)}"
    check("count agrees with query", count_vs_query)

    def over_limit():
        p = {"format": "csv", "starttime": "2024-01-01", "endtime": "2024-02-01",
             "limit": MAX_LIMIT + 1}
        r = c.session.get(f"{c.base}/query", params=p, timeout=60)
        if r.status_code != 400:
            raise RuntimeError(f"expected HTTP 400, got {r.status_code}")
        return f"limit>{MAX_LIMIT} -> HTTP 400 as documented"
    check("limit cap enforced", over_limit)

    def nodata_default():
        p = {"format": "csv", "starttime": "1900-01-01", "endtime": "1900-01-02",
             "minmagnitude": 9.9}
        r = c.session.get(f"{c.base}/query", params=p, timeout=60)
        return f"empty result -> HTTP {r.status_code} (204 documented default)"
    check("no-data status", nodata_default)

    def nodata_404():
        p = {"format": "csv", "starttime": "1900-01-01", "endtime": "1900-01-02",
             "minmagnitude": 9.9, "nodata": 404}
        r = c.session.get(f"{c.base}/query", params=p, timeout=60)
        return f"nodata=404 -> HTTP {r.status_code}"
    check("nodata parameter honoured", nodata_404)

    def eventtype_filter():
        p = CatalogQuery(starttime="2024-01-01", endtime="2024-01-15",
                         minmagnitude=2.5, eventtype="earthquake").to_params()
        df = c._query_csv(p)
        kinds = set(df["type"].dropna().unique()) if len(df) else set()
        if kinds - {"earthquake"}:
            raise RuntimeError(f"non-earthquake types returned: {kinds}")
        return f"{len(df)} rows, all type=earthquake"
    check("eventtype filter applies", eventtype_filter)

    n_ok = sum(v["ok"] for v in results.values())
    if verbose:
        print(f"\n{n_ok}/{len(results)} checks passed.")
        if n_ok < len(results):
            print("Resolve the failures above before trusting downstream results.")
    return results


if __name__ == "__main__":
    import sys
    if "--verify" in sys.argv:
        verify_service()
    else:
        print(__doc__)
        print("Run:  python usgs_client.py --verify")
