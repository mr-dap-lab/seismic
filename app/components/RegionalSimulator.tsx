"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Map, NavigationControl, ScaleControl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import { ParameterLabel } from "./ParameterTooltip";

type SiteClass = "A" | "B" | "C" | "D" | "E" | "F";
type City = { name: string; lat: number; lng: number; site: SiteClass };
type Coordinate = { lat: number; lng: number };

// The visible 2D map uses a small raster style so the first useful frame needs
// only a handful of cached PNG requests. OpenFreeMap vectors load separately
// in the background for the 3D district view.
const RASTER_2D_STYLE: StyleSpecification = {
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

const OFM_VECTOR_TILES = "https://tiles.openfreemap.org/planet/20260802_080001_pt/{z}/{x}/{y}.pbf";
const VECTOR_3D_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    openmaptiles: {
      type: "vector",
      tiles: [OFM_VECTOR_TILES],
      minzoom: 0,
      maxzoom: 14,
      attribution: "© OpenStreetMap contributors · OpenFreeMap",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#e9eeeb" } },
    {
      id: "landuse",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      paint: {
        "fill-color": ["match", ["get", "class"], "park", "#dce9d8", "wood", "#d7e4d5", "industrial", "#e8e3db", "#eeeae4"],
        "fill-opacity": 0.72,
      },
    },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": "#b9d9df" } },
    { id: "waterway", type: "line", source: "openmaptiles", "source-layer": "waterway", paint: { "line-color": "#a8d0d8", "line-width": 1.2 } },
    {
      id: "roads",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary", "street", "minor", "service"], true, false],
      paint: {
        "line-color": ["match", ["get", "class"], ["motorway", "trunk"], "#cba68d", ["primary", "secondary"], "#d3c4b4", "#ffffff"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 13, 1.4, 16, 4],
      },
    },
    {
      id: "building-footprints",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 13,
      paint: { "fill-color": "#c8ceca", "fill-outline-color": "#b4bcb7", "fill-opacity": 0.62 },
    },
    {
      id: "place-label",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 5,
      layout: {
        "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 13, 13],
      },
      paint: { "text-color": "#53615b", "text-halo-color": "#f3f5f2", "text-halo-width": 1.3 },
    },
  ],
};
const CITIES: City[] = [
  { name: "San Francisco, USA", lat: 37.7749, lng: -122.4194, site: "D" },
  { name: "Los Angeles, USA", lat: 34.0522, lng: -118.2437, site: "D" },
  { name: "Mexico City, Mexico", lat: 19.4326, lng: -99.1332, site: "E" },
  { name: "Santiago, Chile", lat: -33.4489, lng: -70.6693, site: "D" },
  { name: "Tokyo, Japan", lat: 35.6762, lng: 139.6503, site: "D" },
  { name: "Istanbul, Turkiye", lat: 41.0082, lng: 28.9784, site: "D" },
  { name: "Seattle, USA", lat: 47.6062, lng: -122.3321, site: "D" },
  { name: "New York City, USA", lat: 40.7128, lng: -74.006, site: "C" },
];

const SITE_FACTORS: Record<SiteClass, number> = { A: 0.72, B: 0.85, C: 1, D: 1.22, E: 1.48, F: 1.75 };
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

function circleFeature(center: Coordinate, radiusKm: number, zone: string): Feature<Polygon> {
  const coordinates: [number, number][] = [];
  const latitudeRadians = center.lat * Math.PI / 180;
  for (let index = 0; index <= 96; index += 1) {
    const angle = (index / 96) * Math.PI * 2;
    const lat = center.lat + (radiusKm / 110.574) * Math.sin(angle);
    const lng = center.lng + (radiusKm / (111.32 * Math.cos(latitudeRadians))) * Math.cos(angle);
    coordinates.push([lng, lat]);
  }
  return { type: "Feature", properties: { zone }, geometry: { type: "Polygon", coordinates: [coordinates] } };
}

function zoneData(center: Coordinate, radius: number): FeatureCollection<Polygon | Point> {
  return {
    type: "FeatureCollection",
    features: [
      circleFeature(center, radius, "low"),
      circleFeature(center, radius * 0.66, "mid"),
      circleFeature(center, radius * 0.33, "high"),
      { type: "Feature", properties: { zone: "epicenter" }, geometry: { type: "Point", coordinates: [center.lng, center.lat] } },
    ],
  };
}

function addSeismicLayers(map: Map, data: FeatureCollection<Polygon | Point>, beforeId?: string) {
  map.addSource("seismic-zones", { type: "geojson", data });
  map.addLayer({
    id: "seismic-zone-fill",
    type: "fill",
    source: "seismic-zones",
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: {
      "fill-color": ["match", ["get", "zone"], "high", "#e35f4a", "mid", "#ee925b", "#f1c75b"],
      "fill-opacity": 0.18,
    },
  }, beforeId);
  map.addLayer({
    id: "seismic-zone-line",
    type: "line",
    source: "seismic-zones",
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "line-color": ["match", ["get", "zone"], "high", "#cb4737", "mid", "#dc7543", "#d7aa3c"], "line-width": 2 },
  }, beforeId);
  map.addLayer({
    id: "seismic-epicenter",
    type: "circle",
    source: "seismic-zones",
    filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 7, "circle-color": "#e6663f", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
  });
}

function addBuildingExtrusions(map: Map) {
  map.addLayer({
    id: "seismic-3d-buildings",
    type: "fill-extrusion",
    source: "openmaptiles",
    "source-layer": "building",
    minzoom: 15,
    filter: ["!=", ["get", "hide_3d"], true],
    paint: {
      "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 6], 0, "#c7cec9", 80, "#d4aa83", 220, "#e6663f"],
      "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.6, ["coalesce", ["get", "render_height"], 6]],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      "fill-extrusion-opacity": 0.9,
    },
  }, "place-label");
}

export default function RegionalSimulator() {
  const mapRef = useRef<HTMLDivElement>(null);
  const preloadMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const preloadInstanceRef = useRef<Map | null>(null);
  const [cityIndex, setCityIndex] = useState(0);
  const [center, setCenter] = useState<Coordinate>({ lat: CITIES[0].lat, lng: CITIES[0].lng });
  const [magnitude, setMagnitude] = useState(7.2);
  const [depth, setDepth] = useState(12);
  const [radius, setRadius] = useState(45);
  const [siteClass, setSiteClass] = useState<SiteClass>(CITIES[0].site);
  const [view3D, setView3D] = useState(false);
  const [view3DReady, setView3DReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const scenarioRef = useRef({ center, radius });

  const centerMotion = useMemo(() => groundMotion(magnitude, depth, 0, siteClass), [magnitude, depth, siteClass]);
  const edgeMotion = useMemo(() => groundMotion(magnitude, depth, radius, siteClass), [magnitude, depth, radius, siteClass]);
  const samples = useMemo(() => [0, 0.25, 0.5, 0.75, 1].map((part) => {
    const distance = radius * part;
    return { distance, ...groundMotion(magnitude, depth, distance, siteClass) };
  }), [magnitude, depth, radius, siteClass]);

  useEffect(() => {
    scenarioRef.current = { center, radius };
  }, [center, radius]);

  useEffect(() => {
    if (!mapRef.current || !preloadMapRef.current || mapInstanceRef.current) return;
    const mapContainer = mapRef.current;
    const vectorContainer = preloadMapRef.current;
    let map: Map;
    let vectorMap: Map | null = null;
    let disposed = false;
    let vectorStartTimer = 0;

    try {
      map = new Map({
        container: mapContainer,
        style: RASTER_2D_STYLE,
        center: [CITIES[0].lng, CITIES[0].lat],
        zoom: 9,
        pitch: 0,
        bearing: 0,
      });
    } catch {
      window.setTimeout(() => setMapError("The interactive map could not start. WebGL may be unavailable in this browser."), 0);
      return;
    }

    mapInstanceRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    const moveEpicenter = (event: { lngLat: { lat: number; lng: number } }) => {
      setCenter({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    };

    const startVectorMap = () => {
      if (disposed || vectorMap) return;
      vectorMap = new Map({
        container: vectorContainer,
        style: VECTOR_3D_STYLE,
        center: [scenarioRef.current.center.lng, scenarioRef.current.center.lat],
        zoom: 15.5,
        pitch: 55,
        bearing: -18,
        canvasContextAttributes: { antialias: true },
      });
      preloadInstanceRef.current = vectorMap;
      vectorMap.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
      vectorMap.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
      vectorMap.on("style.load", () => {
        if (!vectorMap) return;
        const scenario = scenarioRef.current;
        addSeismicLayers(vectorMap, zoneData(scenario.center, scenario.radius), "place-label");
        addBuildingExtrusions(vectorMap);
        vectorMap.resize();
        vectorMap.once("idle", () => setView3DReady(true));
      });
      vectorMap.on("click", moveEpicenter);
    };

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      vectorMap?.resize();
    });
    resizeObserver.observe(mapContainer.parentElement ?? mapContainer);

    map.on("style.load", () => {
      const scenario = scenarioRef.current;
      addSeismicLayers(map, zoneData(scenario.center, scenario.radius));
      map.resize();
      setMapError("");
      setMapReady(true);
      map.once("idle", startVectorMap);
      vectorStartTimer = window.setTimeout(startVectorMap, 900);
    });
    map.on("click", moveEpicenter);

    return () => {
      disposed = true;
      window.clearTimeout(vectorStartTimer);
      resizeObserver.disconnect();
      mapInstanceRef.current = null;
      preloadInstanceRef.current = null;
      map.remove();
      vectorMap?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const vectorMap = preloadInstanceRef.current;
    if (!map || !mapReady) return;
    const data = zoneData(center, radius);
    (map.getSource("seismic-zones") as GeoJSONSource | undefined)?.setData(data);
    (vectorMap?.getSource("seismic-zones") as GeoJSONSource | undefined)?.setData(data);

    const latDelta = radius / 110.574;
    const lngDelta = radius / (111.32 * Math.cos(center.lat * Math.PI / 180));
    if (view3D && vectorMap) {
      vectorMap.easeTo({ center: [center.lng, center.lat], zoom: 15.5, pitch: 55, bearing: -18, duration: 550 });
    } else {
      map.fitBounds([[center.lng - lngDelta, center.lat - latDelta], [center.lng + lngDelta, center.lat + latDelta]], { padding: 58, pitch: 0, bearing: 0, duration: 350 });
      if (vectorMap) {
        window.setTimeout(() => setView3DReady(false), 0);
        vectorMap.jumpTo({ center: [center.lng, center.lat], zoom: 15.5, pitch: 55, bearing: -18 });
        vectorMap.once("idle", () => setView3DReady(true));
      }
    }
  }, [center, radius, view3D, mapReady]);

  const selectCity = (index: number) => {
    const city = CITIES[index];
    setCityIndex(index);
    setCenter({ lat: city.lat, lng: city.lng });
    setSiteClass(city.site);
  };

  return (
    <section className="regional-shell">
      <aside className="regional-controls">
        <span className="eyebrow">GEOGRAPHIC SCENARIO</span>
        <h1>Regional shaking model</h1>
        <p>Place an epicenter, define the affected radius, and explore distance-based ground motion across a city or geographic area.</p>
        <label className="regional-field"><ParameterLabel label="City preset" description="Moves the epicenter to a predefined city and assigns a representative site class for initial screening." /><select value={cityIndex} onChange={(event) => selectCity(Number(event.target.value))}>{CITIES.map((city, index) => <option value={index} key={city.name}>{city.name}</option>)}</select></label>
        <div className="coordinate-grid">
          <label className="regional-field"><ParameterLabel label="Latitude" description="The north–south coordinate of the modeled earthquake epicenter in decimal degrees." /><input type="number" step="0.0001" value={center.lat.toFixed(4)} onChange={(event) => setCenter((value) => ({ ...value, lat: Number(event.target.value) }))} /></label>
          <label className="regional-field"><ParameterLabel label="Longitude" description="The east–west coordinate of the modeled earthquake epicenter in decimal degrees." /><input type="number" step="0.0001" value={center.lng.toFixed(4)} onChange={(event) => setCenter((value) => ({ ...value, lng: Number(event.target.value) }))} /></label>
        </div>
        <label className="regional-range"><span><ParameterLabel label="Magnitude" description="The earthquake's logarithmic energy measure used by the regional attenuation model." /><strong>{magnitude.toFixed(1)}</strong></span><input type="range" min="4" max="9.5" step="0.1" value={magnitude} onChange={(event) => setMagnitude(Number(event.target.value))} /></label>
        <label className="regional-range"><span><ParameterLabel label="Focal depth" description="The vertical distance from the ground surface to the earthquake focus. Deeper events generally produce weaker surface motion nearby." /><strong>{depth} km</strong></span><input type="range" min="2" max="80" step="1" value={depth} onChange={(event) => setDepth(Number(event.target.value))} /></label>
        <label className="regional-range"><span><ParameterLabel label="Analysis radius" description="The radial distance from the epicenter over which ground motion and affected area are estimated." /><strong>{radius} km</strong></span><input type="range" min="5" max="150" step="5" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /></label>
        <label className="regional-field"><ParameterLabel label="Representative site class" description="The assumed regional soil or rock class used to amplify or reduce the calculated ground motion across the selected area." /><select value={siteClass} onChange={(event) => setSiteClass(event.target.value as SiteClass)}>{Object.keys(SITE_FACTORS).map((site) => <option value={site} key={site}>Class {site}</option>)}</select></label>
        <p className="regional-note">Click anywhere on the map to move the scenario epicenter. Site classes are preset estimates and must be confirmed by geotechnical investigation.</p>
      </aside>

      <div className="regional-map-panel">
        <header>
          <div><span className="eyebrow">OPENSTREETMAP IMPACT MAP</span><strong>{CITIES[cityIndex].name}</strong></div>
          <div className="map-toolbar">
            <span className={`map-warm-status${view3DReady ? " ready" : ""}`}><i />{view3DReady ? "3D ready" : "Preparing 3D"}</span>
            <div className="map-view-switcher" role="group" aria-label="Map view">
              <button type="button" className={!view3D ? "active" : ""} aria-label="2D area overview" aria-pressed={!view3D} onClick={() => setView3D(false)}>2D</button>
              <button type="button" className={view3D ? "active" : ""} aria-label={view3DReady ? "3D district" : "3D district is preparing"} aria-pressed={view3D} disabled={!view3DReady && !view3D} onClick={() => setView3D(true)}>3D</button>
            </div>
          </div>
        </header>
        <div className="regional-map-stack">
          <div className="regional-map" ref={mapRef} aria-label="Interactive 2D OpenStreetMap regional earthquake impact map" aria-hidden={view3D} />
          <div className={`regional-map-preloader${view3D ? " active" : ""}`} ref={preloadMapRef} aria-label="Interactive 3D OpenStreetMap regional earthquake impact map" aria-hidden={!view3D} />
        </div>
        {!mapReady && !mapError && <div className="map-loading" role="status"><i /><span>Loading 2D map…</span></div>}
        {mapError && <p className="map-error">{mapError}</p>}
        <div className="map-legend"><span><i className="zone-high" /> Highest modeled motion</span><span><i className="zone-mid" /> Moderate modeled motion</span><span><i className="zone-low" /> Lower modeled motion</span><b>{view3D ? "3D OSM buildings shown at district scale" : "2D area overview · 3D prepared in background"}</b></div>
      </div>

      <aside className="regional-results">
        <span className="eyebrow">AREA ANALYSIS</span>
        <h2>Scenario summary</h2>
        <div className="regional-primary"><span>EPICENTER MMI</span><strong>{centerMotion.mmi.toFixed(1)}</strong><b>{riskLabel(centerMotion.mmi)}</b></div>
        <div className="regional-metrics"><div><span>Epicenter PGA</span><strong>{centerMotion.pga.toFixed(3)} g</strong></div><div><span>Radius-edge PGA</span><strong>{edgeMotion.pga.toFixed(3)} g</strong></div><div><span>Analysis area</span><strong>{Math.round(Math.PI * radius * radius).toLocaleString()} km2</strong></div><div><span>Site amplification</span><strong>x {SITE_FACTORS[siteClass].toFixed(2)}</strong></div></div>
        <h3>Distance profile</h3>
        <div className="distance-profile">{samples.map((sample) => <div key={sample.distance}><span>{Math.round(sample.distance)} km</span><i><b style={{ width: `${(sample.pga / Math.max(centerMotion.pga, 0.01)) * 100}%` }} /></i><strong>{sample.pga.toFixed(3)} g</strong></div>)}</div>
        <div className="regional-disclaimer"><strong>Screening model only</strong><p>Results use simplified attenuation and uniform site assumptions. They are not a hazard map, emergency forecast, or substitute for official seismic, geotechnical, or engineering analysis.</p></div>
      </aside>
    </section>
  );
}
