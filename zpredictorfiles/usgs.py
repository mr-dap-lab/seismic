"""
usgs.py — Client for USGS earthquake data.

Covers both halves of https://earthquake.usgs.gov/earthquakes/feed/

  1. REAL-TIME SUMMARY FEEDS (GeoJSON), for monitoring / current state:
       https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{level}_{period}.geojson
       level  in {significant, 4.5, 2.5, 1.0, all}
       period in {hour, day, week, month}

  2. FDSN EVENT SERVICE, for arbitrary historical windows / backtesting:
       https://earthquake.usgs.gov/fdsnws/event/1/query

The FDSN service caps a single response at 20,000 events, so `query()` splits
long spans automatically and stitches the pieces together.

Everything is cached to disk. A walk-forward backtest re-reads the same decades
of catalog on every fold; without caching you would re-download gigabytes and
get rate-limited. Cache keys are a hash of the query parameters.

All timestamps are UTC. Coordinates are WGS84.

Dependencies: requests, pandas, numpy.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import timedelta
from typing import Iterable, List, Optional

import numpy as np
import pandas as pd
import requests

__all__ = [
    "FEED_LEVELS", "FEED_PERIODS", "live_feed", "query", "detail",
    "CACHE_DIR", "set_cache_dir", "clear_cache", "COLUMNS",
]

FEED_BASE = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary"
FDSN_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"
FDSN_COUNT_URL = "https://earthquake.usgs.gov/fdsnws/event/1/count"

FEED_LEVELS = ("significant", "4.5", "2.5", "1.0", "all")
FEED_PERIODS = ("hour", "day", "week", "month")

# Canonical internal schema. Everything downstream expects these names.
COLUMNS = ["time", "lat", "lon", "depth_km", "mag", "magType", "place",
           "region", "id", "net", "status", "tsunami", "sig", "rms", "gap",
           "dmin", "nst", "type", "updated", "url"]

CACHE_DIR = os.path.expanduser("~/.cache/usgs_quakes")
_MAX_EVENTS_PER_REQUEST = 20000
_USER_AGENT = "eq-forecast-toolkit (python-requests)"


def set_cache_dir(path: str) -> None:
    global CACHE_DIR
    CACHE_DIR = os.path.expanduser(path)
    os.makedirs(CACHE_DIR, exist_ok=True)


def clear_cache() -> int:
    """Delete all cached responses. Returns the number of files removed."""
    if not os.path.isdir(CACHE_DIR):
        return 0
    n = 0
    for f in os.listdir(CACHE_DIR):
        if f.endswith(".parquet") or f.endswith(".csv.gz"):
            os.remove(os.path.join(CACHE_DIR, f))
            n += 1
    return n


def _cache_path(key: dict) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    h = hashlib.sha256(json.dumps(key, sort_keys=True,
                                  default=str).encode()).hexdigest()[:20]
    return os.path.join(CACHE_DIR, f"usgs_{h}.parquet")


def _read_cache(path: str) -> Optional[pd.DataFrame]:
    if not os.path.exists(path):
        return None
    try:
        return pd.read_parquet(path)
    except Exception:                                        # noqa: BLE001
        try:
            return pd.read_csv(path.replace(".parquet", ".csv.gz"),
                               parse_dates=["time", "updated"])
        except Exception:                                    # noqa: BLE001
            return None


def _write_cache(df: pd.DataFrame, path: str) -> None:
    try:
        df.to_parquet(path, index=False)
    except Exception:                                        # noqa: BLE001
        df.to_csv(path.replace(".parquet", ".csv.gz"), index=False,
                  compression="gzip")


# ============================================================================ #
# Parsing
# ============================================================================ #

def _region_from_place(place) -> str:
    """Derive a region label from the USGS `place` string.

    USGS place strings look like:
        "100 km SSE of Ōsaka, Japan"     -> "Japan"
        "South Sandwich Islands region"  -> "South Sandwich Islands region"
        "off the coast of Chile"         -> "off the coast of Chile"

    Taking the text after the final comma yields the country or region for the
    majority of events. This is USGS's own labelling, derived from the data —
    no hardcoded geography.
    """
    if not isinstance(place, str) or not place:
        return "unknown"
    return place.rsplit(",", 1)[-1].strip() if "," in place else place.strip()


def _parse_geojson(payload: dict) -> pd.DataFrame:
    """GeoJSON FeatureCollection -> canonical DataFrame."""
    feats = payload.get("features", []) or []
    if not feats:
        return pd.DataFrame(columns=COLUMNS)

    rows = []
    for f in feats:
        p = f.get("properties") or {}
        g = (f.get("geometry") or {}).get("coordinates") or [None, None, None]
        rows.append({
            "time": p.get("time"), "updated": p.get("updated"),
            "lon": g[0], "lat": g[1],
            "depth_km": g[2] if len(g) > 2 else np.nan,
            "mag": p.get("mag"), "magType": p.get("magType"),
            "place": p.get("place"), "id": f.get("id"), "net": p.get("net"),
            "status": p.get("status"), "tsunami": p.get("tsunami"),
            "sig": p.get("sig"), "rms": p.get("rms"), "gap": p.get("gap"),
            "dmin": p.get("dmin"), "nst": p.get("nst"),
            "type": p.get("type"), "url": p.get("url"),
        })
    df = pd.DataFrame(rows)
    # USGS times are epoch milliseconds, UTC
    df["time"] = pd.to_datetime(df["time"], unit="ms", utc=True)
    df["updated"] = pd.to_datetime(df["updated"], unit="ms", utc=True,
                                   errors="coerce")
    for c in ("lat", "lon", "depth_km", "mag", "rms", "gap", "dmin", "sig", "nst"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["region"] = df["place"].map(_region_from_place)
    df = df.dropna(subset=["time", "mag", "lat", "lon"])
    return df.reindex(columns=COLUMNS).sort_values("time").reset_index(drop=True)


def _get(url: str, params: Optional[dict] = None, timeout: int = 120,
         retries: int = 4) -> dict:
    """GET with exponential backoff. USGS rate-limits aggressive clients."""
    last = None
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, timeout=timeout,
                             headers={"User-Agent": _USER_AGENT})
            if r.status_code == 200:
                return r.json()
            if r.status_code in (429, 500, 502, 503, 504):
                last = f"HTTP {r.status_code}"
                time.sleep(2 ** attempt * 2)
                continue
            r.raise_for_status()
        except requests.RequestException as e:
            last = str(e)
            time.sleep(2 ** attempt * 2)
    raise RuntimeError(f"USGS request failed after {retries} attempts: {last}\n"
                       f"URL: {url}\nParams: {params}")


# ============================================================================ #
# Real-time summary feeds
# ============================================================================ #

def live_feed(level: str = "4.5", period: str = "day",
              use_cache: bool = False, verbose: bool = True) -> pd.DataFrame:
    """Fetch a real-time summary feed.

    These are the feeds intended for monitoring current activity. They are
    regenerated every minute, so caching is OFF by default — a cached
    "current state" is a contradiction.

    For backtesting or any historical window, use query() instead.
    """
    if level not in FEED_LEVELS:
        raise ValueError(f"level must be one of {FEED_LEVELS}")
    if period not in FEED_PERIODS:
        raise ValueError(f"period must be one of {FEED_PERIODS}")

    url = f"{FEED_BASE}/{level}_{period}.geojson"
    path = _cache_path({"feed": url})
    if use_cache:
        cached = _read_cache(path)
        if cached is not None:
            return cached

    if verbose:
        print(f"GET {url}")
    df = _parse_geojson(_get(url))
    if use_cache:
        _write_cache(df, path)
    if verbose:
        print(f"  {len(df)} events"
              + (f", M{df['mag'].min():.1f}-{df['mag'].max():.1f}" if len(df) else ""))
    return df


# ============================================================================ #
# Historical / arbitrary queries (FDSN)
# ============================================================================ #

def _count(params: dict) -> int:
    """Ask the FDSN count endpoint how many events a query would return."""
    p = dict(params); p["format"] = "geojson"
    try:
        return int(_get(FDSN_COUNT_URL, p).get("count", 0))
    except Exception:                                        # noqa: BLE001
        return -1


def query(start_utc, end_utc=None, minmag: Optional[float] = None,
          maxmag: Optional[float] = None,
          minlat: Optional[float] = None, maxlat: Optional[float] = None,
          minlon: Optional[float] = None, maxlon: Optional[float] = None,
          lat: Optional[float] = None, lon: Optional[float] = None,
          radius_km: Optional[float] = None,
          mindepth_km: Optional[float] = None, maxdepth_km: Optional[float] = None,
          event_type: str = "earthquake",
          use_cache: bool = True, verbose: bool = True,
          initial_chunk_days: float = 365.0) -> pd.DataFrame:
    """Fetch an arbitrary historical window from the FDSN event service.

    Region is optional (omit for worldwide), and may be given as a bounding box
    or as a circle (lat, lon, radius_km).

    Long spans are split automatically: the function asks the count endpoint how
    many events a chunk holds and halves the window until it fits under the
    20,000-event response cap. This is what makes multi-decade global pulls work
    without silent truncation — a plain request for 20 years of M4.5+ would come
    back capped at 20,000 and you would never be told.
    """
    end_utc = pd.Timestamp(end_utc or pd.Timestamp.utcnow())
    start_utc = pd.Timestamp(start_utc)
    if start_utc.tzinfo is None:
        start_utc = start_utc.tz_localize("UTC")
    if end_utc.tzinfo is None:
        end_utc = end_utc.tz_localize("UTC")

    base = {"format": "geojson", "orderby": "time-asc", "eventtype": event_type}
    if minmag is not None:
        base["minmagnitude"] = minmag
    if maxmag is not None:
        base["maxmagnitude"] = maxmag
    if radius_km is not None:
        if lat is None or lon is None:
            raise ValueError("radius_km requires lat and lon")
        base.update(latitude=lat, longitude=lon, maxradiuskm=radius_km)
    elif None not in (minlat, maxlat, minlon, maxlon):
        base.update(minlatitude=minlat, maxlatitude=maxlat,
                    minlongitude=minlon, maxlongitude=maxlon)
    if mindepth_km is not None:
        base["mindepth"] = mindepth_km
    if maxdepth_km is not None:
        base["maxdepth"] = maxdepth_km

    cache_key = {**base, "start": start_utc.isoformat(), "end": end_utc.isoformat()}
    path = _cache_path(cache_key)
    if use_cache:
        cached = _read_cache(path)
        if cached is not None:
            if verbose:
                print(f"  cache hit: {len(cached)} events "
                      f"({start_utc:%Y-%m-%d} to {end_utc:%Y-%m-%d})")
            return cached

    frames: List[pd.DataFrame] = []
    cur = start_utc
    chunk = timedelta(days=initial_chunk_days)

    while cur < end_utc:
        nxt = min(cur + chunk, end_utc)
        p = {**base, "starttime": cur.strftime("%Y-%m-%dT%H:%M:%S"),
             "endtime": nxt.strftime("%Y-%m-%dT%H:%M:%S")}

        n = _count(p)
        # Halve the window until the chunk fits under the response cap
        guard = 0
        while n > _MAX_EVENTS_PER_REQUEST * 0.95 and guard < 12:
            chunk = chunk / 2
            nxt = min(cur + chunk, end_utc)
            p["endtime"] = nxt.strftime("%Y-%m-%dT%H:%M:%S")
            n = _count(p)
            guard += 1

        if verbose:
            print(f"  {cur:%Y-%m-%d} -> {nxt:%Y-%m-%d}"
                  + (f"  ({n} events)" if n >= 0 else ""))
        if n != 0:
            frames.append(_parse_geojson(_get(FDSN_URL, p)))

        cur = nxt
        # Grow the window back if the last chunk was comfortably small
        if 0 <= n < _MAX_EVENTS_PER_REQUEST * 0.25:
            chunk = min(chunk * 2, timedelta(days=initial_chunk_days))

    if not frames:
        out = pd.DataFrame(columns=COLUMNS)
    else:
        out = (pd.concat(frames, ignore_index=True)
                 .drop_duplicates(subset="id")
                 .sort_values("time")
                 .reset_index(drop=True))

    if verbose:
        print(f"  total: {len(out)} events")
    if use_cache:
        _write_cache(out, path)
    return out


def detail(event_id: str) -> dict:
    """Full detail record for one event (moment tensor, products, etc.)."""
    return _get(FDSN_URL, {"format": "geojson", "eventid": event_id})
