"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Map, NavigationControl, ScaleControl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import type { Feature, Point, Polygon } from "geojson";
import { createRegionalPdf } from "../lib/pdf-report.mjs";
import { translateText, type Language } from "../lib/i18n";
import { ParameterLabel } from "./ParameterTooltip";

type SiteClass = "A" | "B" | "C" | "D" | "E" | "F";
type Coordinate = { lat: number; lng: number };
type SearchResult = { display_name: string; lat: string; lon: string; type: string };
type ImpactRadii = { high: number; mid: number; low: number };
type OverlayGeometry = { width: number; height: number; cx: number; cy: number; highX: number; highY: number; midX: number; midY: number; lowX: number; lowY: number };

const DEFAULT_CENTER: Coordinate = { lat: 40.7128, lng: -74.006 };
const SITE_FACTORS: Record<SiteClass, number> = { A: 0.72, B: 0.85, C: 1, D: 1.22, E: 1.48, F: 1.75 };
const SITE_CLASS_NAMES: Record<SiteClass, string> = {
  A: "Hard rock",
  B: "Rock",
  C: "Very dense soil and soft rock",
  D: "Stiff soil",
  E: "Soft clay soil",
  F: "Site-specific evaluation",
};
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

function epicenterFeature(center: Coordinate): Feature<Point> {
  return { type: "Feature", properties: { zone: "epicenter" }, geometry: { type: "Point", coordinates: [center.lng, center.lat] } };
}

const IMPACT_ZONES = [
  { key: "low", radius: "low", fill: "#f1c75b", line: "#d7aa3c", opacity: 0.2 },
  { key: "mid", radius: "mid", fill: "#ee925b", line: "#dc7543", opacity: 0.25 },
  { key: "high", radius: "high", fill: "#e35f4a", line: "#cb4737", opacity: 0.3 },
] as const;

function addImpactLayers(map: Map, center: Coordinate, radii: ImpactRadii) {
  IMPACT_ZONES.forEach((zone) => {
    const sourceId = `seismic-${zone.key}`;
    map.addSource(sourceId, { type: "geojson", data: circleFeature(center, radii[zone.radius], zone.key) });
    map.addLayer({ id: `${sourceId}-fill`, type: "fill", source: sourceId, paint: { "fill-color": zone.fill, "fill-opacity": zone.opacity } });
    map.addLayer({ id: `${sourceId}-line`, type: "line", source: sourceId, paint: { "line-color": zone.line, "line-width": 3 } });
  });
  map.addSource("seismic-epicenter-source", { type: "geojson", data: epicenterFeature(center) });
  map.addLayer({
    id: "seismic-epicenter", type: "circle", source: "seismic-epicenter-source",
    paint: { "circle-radius": 8, "circle-color": "#d9432f", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 },
  });
}

function updateImpactLayers(map: Map, center: Coordinate, radii: ImpactRadii) {
  IMPACT_ZONES.forEach((zone) => {
    (map.getSource(`seismic-${zone.key}`) as GeoJSONSource | undefined)?.setData(circleFeature(center, radii[zone.radius], zone.key));
  });
  (map.getSource("seismic-epicenter-source") as GeoJSONSource | undefined)?.setData(epicenterFeature(center));
}

function fitImpactArea(map: Map, center: Coordinate, radiusKm: number, duration = 500) {
  const latDelta = radiusKm / 110.574;
  const lngDelta = radiusKm / (111.32 * Math.max(Math.cos(center.lat * Math.PI / 180), 0.1));
  map.fitBounds(
    [[center.lng - lngDelta, center.lat - latDelta], [center.lng + lngDelta, center.lat + latDelta]],
    { padding: 58, pitch: 0, bearing: 0, duration },
  );
}

function projectImpactGeometry(map: Map, center: Coordinate, radii: ImpactRadii): OverlayGeometry {
  const container = map.getContainer();
  const projectedCenter = map.project([center.lng, center.lat]);
  const projectedRadius = (radiusKm: number) => {
    const longitudeDelta = radiusKm / (111.32 * Math.max(Math.cos(center.lat * Math.PI / 180), 0.1));
    const latitudeDelta = radiusKm / 110.574;
    const east = map.project([center.lng + longitudeDelta, center.lat]);
    const north = map.project([center.lng, center.lat + latitudeDelta]);
    return { x: Math.abs(east.x - projectedCenter.x), y: Math.abs(north.y - projectedCenter.y) };
  };
  const high = projectedRadius(radii.high);
  const mid = projectedRadius(radii.mid);
  const low = projectedRadius(radii.low);
  return { width: container.clientWidth, height: container.clientHeight, cx: projectedCenter.x, cy: projectedCenter.y, highX: high.x, highY: high.y, midX: mid.x, midY: mid.y, lowX: low.x, lowY: low.y };
}

async function captureImpactMap(map: Map, overlay: SVGSVGElement | null) {
  const mapCanvas = map.getCanvas();
  if (!overlay) return mapCanvas.toDataURL("image/jpeg", 0.9);
  const output = document.createElement("canvas");
  output.width = mapCanvas.width;
  output.height = mapCanvas.height;
  const context = output.getContext("2d");
  if (!context) return mapCanvas.toDataURL("image/jpeg", 0.9);
  context.drawImage(mapCanvas, 0, 0);
  const serialized = new XMLSerializer().serializeToString(overlay);
  const overlayUrl = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const overlayImage = new Image();
    await new Promise<void>((resolve, reject) => {
      overlayImage.onload = () => resolve();
      overlayImage.onerror = () => reject(new Error("Impact overlay capture failed"));
      overlayImage.src = overlayUrl;
    });
    context.drawImage(overlayImage, 0, 0, output.width, output.height);
    return output.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(overlayUrl);
  }
}

export default function RegionalSimulator({ language }: { language: Language }) {
  const t = (value: string) => translateText(value, language);
  const mapRef = useRef<HTMLDivElement>(null);
  const impactOverlayRef = useRef<SVGSVGElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const placingEpicenterRef = useRef(false);
  const userSelectedLocationRef = useRef(false);
  const radiiRef = useRef<ImpactRadii>(impactRadii(7.2, 12, 45, "D"));
  const centerRef = useRef<Coordinate>(DEFAULT_CENTER);
  const overlayUpdateRef = useRef<() => void>(() => undefined);
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
  const [placingEpicenter, setPlacingEpicenter] = useState(false);
  const [overlayGeometry, setOverlayGeometry] = useState<OverlayGeometry | null>(null);

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
    const updateOverlay = () => setOverlayGeometry(projectImpactGeometry(map, centerRef.current, radiiRef.current));
    overlayUpdateRef.current = updateOverlay;
    map.on("move", updateOverlay);
    map.on("resize", updateOverlay);

    map.on("style.load", () => {
      const initialRadii = impactRadii(7.2, 12, 45, "D");
      addImpactLayers(map, DEFAULT_CENTER, initialRadii);
      fitImpactArea(map, DEFAULT_CENTER, initialRadii.low, 0);
      updateOverlay();
      setMapReady(true);
      setMapError("");

      if (!navigator.geolocation) {
        setLocationLabel("New York City, USA");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (userSelectedLocationRef.current) return;
          const detected = { lat: coords.latitude, lng: coords.longitude };
          setCenter(detected);
          setLocationLabel("Your detected area");
        },
        () => setLocationLabel("New York City, USA"),
        { enableHighAccuracy: false, timeout: 7000, maximumAge: 600000 },
      );
    });
    map.on("click", ({ lngLat }) => {
      if (!placingEpicenterRef.current) return;
      const selectedCenter = { lat: lngLat.lat, lng: lngLat.lng };
      userSelectedLocationRef.current = true;
      centerRef.current = selectedCenter;
      updateImpactLayers(map, selectedCenter, radiiRef.current);
      fitImpactArea(map, selectedCenter, radiiRef.current.low);
      map.triggerRepaint();
      setCenter(selectedCenter);
      setLocationLabel("Custom epicenter");
      placingEpicenterRef.current = false;
      setPlacingEpicenter(false);
    });

    return () => {
      resizeObserver.disconnect();
      mapInstanceRef.current = null;
      overlayUpdateRef.current = () => undefined;
      map.remove();
    };
  }, []);

  useEffect(() => {
    placingEpicenterRef.current = placingEpicenter;
  }, [placingEpicenter]);

  useEffect(() => {
    radiiRef.current = radii;
    centerRef.current = center;
  }, [center, radii]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;
    updateImpactLayers(map, center, radii);
    fitImpactArea(map, center, radii.low);
    map.triggerRepaint();
    overlayUpdateRef.current();
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
    userSelectedLocationRef.current = true;
    setCenter(selected);
    setLocationLabel(result.display_name);
    setQuery(result.display_name.split(",")[0]);
    setSearchResults([]);
    setPlacingEpicenter(false);
  };

  const toggleEpicenterPlacement = () => {
    const nextState = !placingEpicenterRef.current;
    placingEpicenterRef.current = nextState;
    setPlacingEpicenter(nextState);
  };

  const cancelEpicenterPlacement = () => {
    placingEpicenterRef.current = false;
    setPlacingEpicenter(false);
  };

  const resetRegional = () => {
    userSelectedLocationRef.current = true;
    centerRef.current = DEFAULT_CENTER;
    cancelEpicenterPlacement();
    setCenter(DEFAULT_CENTER);
    setLocationLabel("New York City, USA");
    setMagnitude(7.2);
    setDepth(12);
    setRadius(45);
    setSiteClass("D");
    setQuery("");
    setSearchResults([]);
    setSearchError("");
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
      try { mapImage = await captureImpactMap(map, impactOverlayRef.current); } catch { mapImage = undefined; }
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
      }, { language, translate: t });
    } finally {
      setReportBusy(false);
    }
  };

  return (
    <section className="regional-shell" data-impact-renderer="projected-overlay">
      <aside className="regional-controls">
        <div className="regional-title-row"><div><span className="eyebrow">GEOGRAPHIC SCENARIO</span><h1>Regional shaking model</h1></div><button className="text-button" type="button" onClick={resetRegional}>Reset</button></div>
        <p>Define the scenario, then search for a place or activate epicenter placement. Impact rings update from the complete scenario.</p>

        <button
          type="button"
          className={`epicenter-tool${placingEpicenter ? " active" : ""}`}
          aria-pressed={placingEpicenter}
          disabled={!mapReady}
          onClick={toggleEpicenterPlacement}
        >
          <i aria-hidden="true"><span /></i>
          <span><strong>{placingEpicenter ? "Cancel epicenter placement" : "Set epicenter"}</strong><small>{placingEpicenter ? "Click a point on the map" : "Choose an exact point interactively"}</small></span>
        </button>

        <form className="regional-search" onSubmit={searchCity}>
          <ParameterLabel label={t("Find a city or place")} description={t("Search OpenStreetMap by city or place name, then select a result to move the epicenter and impact rings.")} />
          <p>Jump to a location and center the regional scenario.</p>
          <div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bogotá, Colombia" aria-label="City or place" autoComplete="off" /><button type="submit" disabled={searchBusy}><span aria-hidden="true">⌕</span>{searchBusy ? "Searching…" : "Search"}</button></div>
          {searchError && <p className="regional-search-error" role="alert">{searchError}</p>}
          {searchResults.length > 0 && <ul aria-label="Place search results">{searchResults.map((result) => <li key={`${result.lat}-${result.lon}`}><button type="button" onClick={() => selectSearchResult(result)}>{result.display_name}</button></li>)}</ul>}
          <small>Location data © OpenStreetMap contributors</small>
        </form>

        <label className="regional-range"><span><ParameterLabel label={t("Magnitude")} description={t("The earthquake's logarithmic energy measure used by the regional attenuation model.")} /><strong>{magnitude.toFixed(1)}</strong></span><input type="range" min="4" max="9.5" step="0.1" value={magnitude} onChange={(event) => setMagnitude(Number(event.target.value))} /></label>
        <label className="regional-range"><span><ParameterLabel label={t("Focal depth")} description={t("Vertical distance to the earthquake focus. Deeper events generally produce weaker surface motion nearby.")} /><strong>{depth} km</strong></span><input type="range" min="2" max="80" step="1" value={depth} onChange={(event) => setDepth(Number(event.target.value))} /></label>
        <label className="regional-range"><span><ParameterLabel label={t("Analysis radius")} description={t("Maximum regional distance available to the impact-ring model.")} /><strong>{radius} km</strong></span><input type="range" min="5" max="150" step="5" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /></label>
        <label className="regional-field"><ParameterLabel label={t("Representative site class")} description={t("Assumed soil or rock class used to amplify or reduce calculated ground motion.")} /><select value={siteClass} onChange={(event) => setSiteClass(event.target.value as SiteClass)}>{(Object.keys(SITE_FACTORS) as SiteClass[]).map((site) => <option value={site} key={site}>{t("Class")} {site} — {t(SITE_CLASS_NAMES[site])}</option>)}</select></label>

        <div className="coordinate-grid">
          <label className="regional-field"><ParameterLabel label={t("Latitude")} description={t("The north–south coordinate of the modeled epicenter in decimal degrees.")} /><input type="number" step="0.0001" value={center.lat.toFixed(4)} onChange={(event) => setCenter((value) => ({ ...value, lat: Number(event.target.value) }))} /></label>
          <label className="regional-field"><ParameterLabel label={t("Longitude")} description={t("The east–west coordinate of the modeled epicenter in decimal degrees.")} /><input type="number" step="0.0001" value={center.lng.toFixed(4)} onChange={(event) => setCenter((value) => ({ ...value, lng: Number(event.target.value) }))} /></label>
        </div>

        <p className="regional-note">Location access is used only to choose the initial area and is not stored. Activate <strong>Set epicenter</strong>, then click once on the map.</p>
      </aside>

      <div className="regional-map-panel">
        <header><div><span className="eyebrow">OPENSTREETMAP IMPACT MAP</span><strong>{locationLabel}</strong></div><span className="map-provider">2D · OpenStreetMap</span></header>
        <div className="regional-map-stage">
          <div className={`regional-map${placingEpicenter ? " placing-epicenter" : ""}`} ref={mapRef} aria-label="Interactive OpenStreetMap earthquake impact map" />
          {overlayGeometry && <svg ref={impactOverlayRef} className="regional-impact-overlay" viewBox={`0 0 ${overlayGeometry.width} ${overlayGeometry.height}`} aria-hidden="true">
            <ellipse className="impact-ring impact-ring-low" cx={overlayGeometry.cx} cy={overlayGeometry.cy} rx={overlayGeometry.lowX} ry={overlayGeometry.lowY} fill="#f1c75b" fillOpacity="0.18" stroke="#d7aa3c" strokeWidth="3" />
            <ellipse className="impact-ring impact-ring-mid" cx={overlayGeometry.cx} cy={overlayGeometry.cy} rx={overlayGeometry.midX} ry={overlayGeometry.midY} fill="#ee925b" fillOpacity="0.22" stroke="#dc7543" strokeWidth="3" />
            <ellipse className="impact-ring impact-ring-high" cx={overlayGeometry.cx} cy={overlayGeometry.cy} rx={overlayGeometry.highX} ry={overlayGeometry.highY} fill="#e35f4a" fillOpacity="0.28" stroke="#cb4737" strokeWidth="3" />
            <circle className="impact-epicenter-halo" cx={overlayGeometry.cx} cy={overlayGeometry.cy} r="12" fill="#d9432f" fillOpacity="0.2" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="2" />
            <circle className="impact-epicenter-point" cx={overlayGeometry.cx} cy={overlayGeometry.cy} r="7" fill="#d9432f" stroke="#ffffff" strokeWidth="3" />
          </svg>}
        </div>
        {!mapReady && !mapError && <div className="map-loading" role="status"><i /><span>Loading map…</span></div>}
        {mapError && <p className="map-error">{mapError}</p>}
        {placingEpicenter && <div className="epicenter-map-prompt" role="status"><i aria-hidden="true" /><span><strong>Set epicenter</strong>Click once on the map</span><button type="button" onClick={cancelEpicenterPlacement}>Cancel</button></div>}
        <div className="map-legend"><span><i className="zone-high" /> Highest · {radii.high.toFixed(0)} km</span><span><i className="zone-mid" /> Moderate · {radii.mid.toFixed(0)} km</span><span><i className="zone-low" /> Lower · {radii.low.toFixed(0)} km</span><b>{placingEpicenter ? "Click the map to place epicenter" : "Activate Set epicenter to choose a point"}</b></div>
      </div>

      <aside className="regional-results">
        <span className="eyebrow">AREA ANALYSIS</span><h2>Scenario summary</h2>
        <div className="regional-primary"><span>EPICENTER MMI</span><strong>{centerMotion.mmi.toFixed(1)}</strong><b>{riskLabel(centerMotion.mmi)}</b></div>
        <div className="regional-metrics"><div><span>Epicenter PGA</span><strong>{centerMotion.pga.toFixed(3)} g</strong></div><div><span>Outer-edge PGA</span><strong>{edgeMotion.pga.toFixed(3)} g</strong></div><div><span>Modeled area</span><strong>{Math.round(Math.PI * radii.low ** 2).toLocaleString()} km²</strong></div><div><span>Site amplification</span><strong>× {SITE_FACTORS[siteClass].toFixed(2)}</strong></div></div>
        <h3>Distance profile</h3>
        <div className="distance-profile">{samples.map((sample) => <div key={sample.distance}><span>{Math.round(sample.distance)} km</span><i><b style={{ width: `${sample.pga / Math.max(centerMotion.pga, 0.01) * 100}%` }} /></i><strong>{sample.pga.toFixed(3)} g</strong></div>)}</div>
        <section className="report-section"><button className="report-button has-tooltip tooltip-top" type="button" onClick={downloadRegionalReport} disabled={reportBusy || !mapReady}><span>⇩</span>{t(reportBusy ? "Creating PDF…" : "Download regional PDF")}<span className="tooltip-bubble" aria-hidden="true">{t("Export the regional map, impact rings, inputs, and results as PDF")}</span></button><p>Includes the current map, impact rings, inputs, calculated results, OpenStreetMap attribution, and professional-use disclaimer.</p></section>
        <div className="regional-disclaimer"><strong>Screening model only</strong><p>Results use simplified attenuation and uniform site assumptions. They are not a hazard map, emergency forecast, or substitute for official seismic, geotechnical, or engineering analysis.</p></div>
      </aside>
    </section>
  );
}
