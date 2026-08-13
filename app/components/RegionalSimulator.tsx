"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Map, NavigationControl, ScaleControl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import { createRegionalPdf } from "../lib/pdf-report.mjs";
import { ParameterLabel } from "./ParameterTooltip";

type SiteClass = "A" | "B" | "C" | "D" | "E" | "F";
type Coordinate = { lat: number; lng: number };
type SearchResult = { display_name: string; lat: string; lon: string; type: string };
type ImpactRadii = { high: number; mid: number; low: number };

const DEFAULT_CENTER: Coordinate = { lat: 40.7128, lng: -74.006 };
const SITE_FACTORS: Record<SiteClass, number> = { A: 0.72, B: 0.85, C: 1, D: 1.22, E: 1.48, F: 1.75 };
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#e9eeeb" } },
    { id: "osm-raster", type: "raster", source: "osm", paint: { "raster-fade-duration": 0 } },
  ],
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function groundMotion(magnitude: number, depth: number, distance: number, site: SiteClass) {
  const hypocentralDistance = Math.sqrt(distance ** 2 + depth ** 2);
  const magnitudeTerm = Math.pow(10, (magnitude - 6) * 0.31);
  const attenuation = Math.exp(-hypocentralDistance / 105) / Math.pow(Math.max(hypocentralDistance, 5) / 10, 0.92);
  const pga = clamp(0.19 * magnitudeTerm * attenuation * SITE_FACTORS[site], 0.002, 2.5);
  const pgaCms = pga * 980.665;
  const mmi = clamp(pgaCms > 80 ? 3.66 * Math.log10(pgaCms) - 1.66 : 2.2 * Math.log10(pgaCms) + 1, 1, 12);
  return { pga, mmi };
}

function riskLabel(mmi: number) {
  if (mmi >= 9) return "Extreme";
  if (mmi >= 7) return "Severe";
  if (mmi >= 5) return "Strong";
  return "Light";
}

function impactRadii(magnitude: number, depth: number, radius: number, site: SiteClass): ImpactRadii {
  const lastDistanceAt = (threshold: number) => {
    let distance = 0;
    for (let step = 0; step <= 120; step += 1) {
      const candidate = radius * step / 120;
      if (groundMotion(magnitude, depth, candidate, site).mmi >= threshold) distance = candidate;
    }
    return distance;
  };
  const severity = clamp(((magnitude - 4) / 5.5) * SITE_FACTORS[site] * (22 / Math.max(depth, 5)), 0.15, 1);
  const low = clamp(lastDistanceAt(3) || radius * (0.35 + severity * 0.35), radius * 0.25, radius);
  const mid = clamp(lastDistanceAt(5) || low * (0.42 + severity * 0.18), low * 0.28, low * 0.8);
  const high = clamp(lastDistanceAt(7) || mid * (0.28 + severity * 0.16), mid * 0.2, mid * 0.68);
  return { high, mid, low };
}

function circleFeature(center: Coordinate, radiusKm: number, zone: string): Feature<Polygon> {
  const coordinates: [number, number][] = [];
  const latitudeRadians = center.lat * Math.PI / 180;
  for (let index = 0; index <= 96; index += 1) {
    const angle = index / 96 * Math.PI * 2;
    coordinates.push([
      center.lng + radiusKm / (111.32 * Math.max(Math.cos(latitudeRadians), 0.1)) * Math.cos(angle),
      center.lat + radiusKm / 110.574 * Math.sin(angle),
    ]);
  }
  return { type: "Feature", properties: { zone, radiusKm }, geometry: { type: "Polygon", coordinates: [coordinates] } };
}

function zoneData(center: Coordinate, radii: ImpactRadii): FeatureCollection<Polygon | Point> {
  return {
    type: "FeatureCollection",
    features: [
      circleFeature(center, radii.low, "low"),
      circleFeature(center, radii.mid, "mid"),
      circleFeature(center, radii.high, "high"),
      { type: "Feature", properties: { zone: "epicenter" }, geometry: { type: "Point", coordinates: [center.lng, center.lat] } },
    ],
  };
}

function fitImpactArea(map: Map, center: Coordinate, radiusKm: number, duration = 500) {
  const latDelta = radiusKm / 110.574;
  const lngDelta = radiusKm / (111.32 * Math.max(Math.cos(center.lat * Math.PI / 180), 0.1));
  map.fitBounds(
    [[center.lng - lngDelta, center.lat - latDelta], [center.lng + lngDelta, center.lat + latDelta]],
    { padding: 58, pitch: 0, bearing: 0, duration },
  );
}

export default function RegionalSimulator() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const [center, setCenter] = useState<Coordinate>(DEFAULT_CENTER);
  const [locationLabel, setLocationLabel] = useState("Detecting your area…");
  const [magnitude, setMagnitude] = useState(7.2);
  const [depth, setDepth] = useState(12);
  const [radius, setRadius] = useState(45);
  const [siteClass, setSiteClass] = useState<SiteClass>("D");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const radii = useMemo(() => impactRadii(magnitude, depth, radius, siteClass), [magnitude, depth, radius, siteClass]);
  const centerMotion = useMemo(() => groundMotion(magnitude, depth, 0, siteClass), [magnitude, depth, siteClass]);
  const edgeMotion = useMemo(() => groundMotion(magnitude, depth, radii.low, siteClass), [magnitude, depth, radii.low, siteClass]);
  const samples = useMemo(() => [0, 0.25, 0.5, 0.75, 1].map((part) => {
    const distance = radii.low * part;
    return { distance, ...groundMotion(magnitude, depth, distance, siteClass) };
  }), [magnitude, depth, radii.low, siteClass]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let map: Map;
    try {
      map = new Map({
        container: mapRef.current,
        style: MAP_STYLE,
        center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
        zoom: 8,
        pitch: 0,
        bearing: 0,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
    } catch {
      window.setTimeout(() => setMapError("The map could not start. WebGL may be unavailable in this browser."), 0);
      return;
    }
    mapInstanceRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapRef.current);

    map.on("style.load", () => {
      const initialRadii = impactRadii(7.2, 12, 45, "D");
      map.addSource("seismic-zones", { type: "geojson", data: zoneData(DEFAULT_CENTER, initialRadii) });
      map.addLayer({
        id: "seismic-zone-fill", type: "fill", source: "seismic-zones", filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": ["match", ["get", "zone"], "high", "#e35f4a", "mid", "#ee925b", "#f1c75b"], "fill-opacity": 0.24 },
      });
      map.addLayer({
        id: "seismic-zone-line", type: "line", source: "seismic-zones", filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "line-color": ["match", ["get", "zone"], "high", "#cb4737", "mid", "#dc7543", "#d7aa3c"], "line-width": 2.5 },
      });
      map.addLayer({
        id: "seismic-epicenter", type: "circle", source: "seismic-zones", filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-radius": 8, "circle-color": "#d9432f", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 },
      });
      fitImpactArea(map, DEFAULT_CENTER, initialRadii.low, 0);
      setMapReady(true);
      setMapError("");

      if (!navigator.geolocation) {
        setLocationLabel("New York City, USA");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const detected = { lat: coords.latitude, lng: coords.longitude };
          setCenter(detected);
          setLocationLabel("Your detected area");
        },
        () => setLocationLabel("New York City, USA"),
        { enableHighAccuracy: false, timeout: 7000, maximumAge: 600000 },
      );
    });
    map.on("click", ({ lngLat }) => {
      setCenter({ lat: lngLat.lat, lng: lngLat.lng });
      setLocationLabel("Custom epicenter");
    });

    return () => {
      resizeObserver.disconnect();
      mapInstanceRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;
    (map.getSource("seismic-zones") as GeoJSONSource | undefined)?.setData(zoneData(center, radii));
    fitImpactArea(map, center, radii.low);
  }, [center, radii, mapReady]);

  const searchCity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const searchTerm = query.trim();
    if (!searchTerm || searchBusy) return;
    setSearchBusy(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const params = new URLSearchParams({ q: searchTerm, format: "jsonv2", addressdetails: "1", limit: "5" });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { "Accept-Language": navigator.language } });
      if (!response.ok) throw new Error("search failed");
      const results = await response.json() as SearchResult[];
      setSearchResults(results);
      if (!results.length) setSearchError("No matching city or place was found.");
    } catch {
      setSearchError("City search is temporarily unavailable. Try again shortly.");
    } finally {
      setSearchBusy(false);
    }
  };

  const selectSearchResult = (result: SearchResult) => {
    const selected = { lat: Number(result.lat), lng: Number(result.lon) };
    setCenter(selected);
    setLocationLabel(result.display_name);
    setQuery(result.display_name.split(",")[0]);
    setSearchResults([]);
  };

  const downloadRegionalReport = async () => {
    const map = mapInstanceRef.current;
    if (!map || reportBusy) return;
    setReportBusy(true);
    try {
      if (!map.loaded()) {
        await Promise.race([
          new Promise<void>((resolve) => map.once("idle", () => resolve())),
          new Promise<void>((resolve) => window.setTimeout(resolve, 2500)),
        ]);
      }
      map.triggerRepaint();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      let mapImage: string | undefined;
      try { mapImage = map.getCanvas().toDataURL("image/jpeg", 0.9); } catch { mapImage = undefined; }
      await createRegionalPdf({
        filename: "seismic-regional-impact-report.pdf",
        location: locationLabel,
        latitude: center.lat,
        longitude: center.lng,
        magnitude,
        focalDepth: depth,
        analysisRadius: radius,
        siteClass,
        siteFactor: SITE_FACTORS[siteClass],
        mmi: centerMotion.mmi,
        epicenterPga: centerMotion.pga,
        edgePga: edgeMotion.pga,
        highRadius: radii.high,
        moderateRadius: radii.mid,
        lowRadius: radii.low,
        mapImage,
      });
    } finally {
      setReportBusy(false);
    }
  };

  return (
    <section className="regional-shell">
      <aside className="regional-controls">
        <span className="eyebrow">GEOGRAPHIC SCENARIO</span>
        <h1>Regional shaking model</h1>
        <p>Search for a place or click the map to position the epicenter. Impact rings update from the complete scenario.</p>

        <form className="regional-search" onSubmit={searchCity}>
          <ParameterLabel label="Find a city or place" description="Search OpenStreetMap by city or place name, then select a result to move the epicenter and impact rings." />
          <div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Bogotá, Colombia" aria-label="City or place" /><button type="submit" disabled={searchBusy}>{searchBusy ? "…" : "Search"}</button></div>
          {searchError && <p role="alert">{searchError}</p>}
          {searchResults.length > 0 && <ul aria-label="Place search results">{searchResults.map((result) => <li key={`${result.lat}-${result.lon}`}><button type="button" onClick={() => selectSearchResult(result)}>{result.display_name}</button></li>)}</ul>}
          <small>Search data © OpenStreetMap contributors</small>
        </form>

        <div className="coordinate-grid">
          <label className="regional-field"><ParameterLabel label="Latitude" description="The north–south coordinate of the modeled epicenter in decimal degrees." /><input type="number" step="0.0001" value={center.lat.toFixed(4)} onChange={(event) => setCenter((value) => ({ ...value, lat: Number(event.target.value) }))} /></label>
          <label className="regional-field"><ParameterLabel label="Longitude" description="The east–west coordinate of the modeled epicenter in decimal degrees." /><input type="number" step="0.0001" value={center.lng.toFixed(4)} onChange={(event) => setCenter((value) => ({ ...value, lng: Number(event.target.value) }))} /></label>
        </div>
        <label className="regional-range"><span><ParameterLabel label="Magnitude" description="The earthquake's logarithmic energy measure used by the regional attenuation model." /><strong>{magnitude.toFixed(1)}</strong></span><input type="range" min="4" max="9.5" step="0.1" value={magnitude} onChange={(event) => setMagnitude(Number(event.target.value))} /></label>
        <label className="regional-range"><span><ParameterLabel label="Focal depth" description="Vertical distance to the earthquake focus. Deeper events generally produce weaker surface motion nearby." /><strong>{depth} km</strong></span><input type="range" min="2" max="80" step="1" value={depth} onChange={(event) => setDepth(Number(event.target.value))} /></label>
        <label className="regional-range"><span><ParameterLabel label="Analysis radius" description="Maximum regional distance available to the impact-ring model." /><strong>{radius} km</strong></span><input type="range" min="5" max="150" step="5" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /></label>
        <label className="regional-field"><ParameterLabel label="Representative site class" description="Assumed soil or rock class used to amplify or reduce calculated ground motion." /><select value={siteClass} onChange={(event) => setSiteClass(event.target.value as SiteClass)}>{Object.keys(SITE_FACTORS).map((site) => <option value={site} key={site}>Class {site}</option>)}</select></label>
        <p className="regional-note">Click anywhere on the map to set a custom epicenter. Location access is used only to choose the initial area and is not stored.</p>
      </aside>

      <div className="regional-map-panel">
        <header><div><span className="eyebrow">OPENSTREETMAP IMPACT MAP</span><strong>{locationLabel}</strong></div><span className="map-provider">2D · OpenStreetMap</span></header>
        <div className="regional-map" ref={mapRef} aria-label="Interactive OpenStreetMap earthquake impact map" />
        {!mapReady && !mapError && <div className="map-loading" role="status"><i /><span>Loading map…</span></div>}
        {mapError && <p className="map-error">{mapError}</p>}
        <div className="map-legend"><span><i className="zone-high" /> Highest · {radii.high.toFixed(0)} km</span><span><i className="zone-mid" /> Moderate · {radii.mid.toFixed(0)} km</span><span><i className="zone-low" /> Lower · {radii.low.toFixed(0)} km</span><b>Click map to move epicenter</b></div>
      </div>

      <aside className="regional-results">
        <span className="eyebrow">AREA ANALYSIS</span><h2>Scenario summary</h2>
        <div className="regional-primary"><span>EPICENTER MMI</span><strong>{centerMotion.mmi.toFixed(1)}</strong><b>{riskLabel(centerMotion.mmi)}</b></div>
        <div className="regional-metrics"><div><span>Epicenter PGA</span><strong>{centerMotion.pga.toFixed(3)} g</strong></div><div><span>Outer-edge PGA</span><strong>{edgeMotion.pga.toFixed(3)} g</strong></div><div><span>Modeled area</span><strong>{Math.round(Math.PI * radii.low ** 2).toLocaleString()} km²</strong></div><div><span>Site amplification</span><strong>× {SITE_FACTORS[siteClass].toFixed(2)}</strong></div></div>
        <h3>Distance profile</h3>
        <div className="distance-profile">{samples.map((sample) => <div key={sample.distance}><span>{Math.round(sample.distance)} km</span><i><b style={{ width: `${sample.pga / Math.max(centerMotion.pga, 0.01) * 100}%` }} /></i><strong>{sample.pga.toFixed(3)} g</strong></div>)}</div>
        <section className="regional-report"><button type="button" onClick={downloadRegionalReport} disabled={reportBusy || !mapReady}><span>⇩</span>{reportBusy ? "Creating PDF…" : "Download regional PDF"}</button><p>Includes the current map, impact rings, inputs, calculated results, OpenStreetMap attribution, and professional-use disclaimer.</p></section>
        <div className="regional-disclaimer"><strong>Screening model only</strong><p>Results use simplified attenuation and uniform site assumptions. They are not a hazard map, emergency forecast, or substitute for official seismic, geotechnical, or engineering analysis.</p></div>
      </aside>
    </section>
  );
}
