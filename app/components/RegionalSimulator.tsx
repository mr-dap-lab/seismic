"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Map, NavigationControl, ScaleControl, type GeoJSONSource } from "maplibre-gl";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";

type SiteClass = "A" | "B" | "C" | "D" | "E" | "F";
type City = { name: string; lat: number; lng: number; site: SiteClass };
type Coordinate = { lat: number; lng: number };

const MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";
const VECTOR_TILES = "https://tiles.openfreemap.org/planet";
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

export default function RegionalSimulator() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const [cityIndex, setCityIndex] = useState(0);
  const [center, setCenter] = useState<Coordinate>({ lat: CITIES[0].lat, lng: CITIES[0].lng });
  const [magnitude, setMagnitude] = useState(7.2);
  const [depth, setDepth] = useState(12);
  const [radius, setRadius] = useState(45);
  const [siteClass, setSiteClass] = useState<SiteClass>(CITIES[0].site);
  const [view3D, setView3D] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  const centerMotion = useMemo(() => groundMotion(magnitude, depth, 0, siteClass), [magnitude, depth, siteClass]);
  const edgeMotion = useMemo(() => groundMotion(magnitude, depth, radius, siteClass), [magnitude, depth, radius, siteClass]);
  const samples = useMemo(() => [0, 0.25, 0.5, 0.75, 1].map((part) => {
    const distance = radius * part;
    return { distance, ...groundMotion(magnitude, depth, distance, siteClass) };
  }), [magnitude, depth, radius, siteClass]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = new Map({
      container: mapRef.current,
      style: MAP_STYLE,
      center: [CITIES[0].lng, CITIES[0].lat],
      zoom: 15.5,
      pitch: 55,
      bearing: -18,
      canvasContextAttributes: { antialias: true },
    });
    mapInstanceRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      const layers = map.getStyle().layers ?? [];
      const labelLayer = layers.find((layer) => layer.type === "symbol" && layer.layout?.["text-field"]);
      map.addSource("seismic-zones", { type: "geojson", data: zoneData(CITIES[0], 45) });
      map.addLayer({
        id: "seismic-zone-fill",
        type: "fill",
        source: "seismic-zones",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": ["match", ["get", "zone"], "high", "#e35f4a", "mid", "#ee925b", "#f1c75b"],
          "fill-opacity": 0.18,
        },
      }, labelLayer?.id);
      map.addLayer({
        id: "seismic-zone-line",
        type: "line",
        source: "seismic-zones",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "line-color": ["match", ["get", "zone"], "high", "#cb4737", "mid", "#dc7543", "#d7aa3c"], "line-width": 2 },
      }, labelLayer?.id);
      map.addSource("openfreemap-buildings", { type: "vector", url: VECTOR_TILES });
      map.addLayer({
        id: "seismic-3d-buildings",
        type: "fill-extrusion",
        source: "openfreemap-buildings",
        "source-layer": "building",
        minzoom: 15,
        filter: ["!=", ["get", "hide_3d"], true],
        paint: {
          "fill-extrusion-color": ["interpolate", ["linear"], ["get", "render_height"], 0, "#c7cec9", 80, "#d4aa83", 220, "#e6663f"],
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.6, ["get", "render_height"]],
          "fill-extrusion-base": ["case", [">=", ["zoom"], 15.6], ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.9,
        },
      }, labelLayer?.id);
      map.addLayer({
        id: "seismic-epicenter",
        type: "circle",
        source: "seismic-zones",
        filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-radius": 7, "circle-color": "#e6663f", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
      });
      setMapReady(true);
    });
    map.on("click", (event) => setCenter({ lat: event.lngLat.lat, lng: event.lngLat.lng }));
    map.on("error", () => setMapError("Some open map tiles could not be loaded. Check your connection and try again."));

    return () => {
      mapInstanceRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;
    (map.getSource("seismic-zones") as GeoJSONSource | undefined)?.setData(zoneData(center, radius));
    if (view3D) {
      map.easeTo({ center: [center.lng, center.lat], zoom: 15.5, pitch: 55, bearing: -18, duration: 750 });
    } else {
      const latDelta = radius / 110.574;
      const lngDelta = radius / (111.32 * Math.cos(center.lat * Math.PI / 180));
      map.fitBounds([[center.lng - lngDelta, center.lat - latDelta], [center.lng + lngDelta, center.lat + latDelta]], { padding: 58, pitch: 0, bearing: 0, duration: 750 });
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
        <label className="regional-field"><span>City preset</span><select value={cityIndex} onChange={(event) => selectCity(Number(event.target.value))}>{CITIES.map((city, index) => <option value={index} key={city.name}>{city.name}</option>)}</select></label>
        <div className="coordinate-grid">
          <label className="regional-field"><span>Latitude</span><input type="number" step="0.0001" value={center.lat.toFixed(4)} onChange={(event) => setCenter((value) => ({ ...value, lat: Number(event.target.value) }))} /></label>
          <label className="regional-field"><span>Longitude</span><input type="number" step="0.0001" value={center.lng.toFixed(4)} onChange={(event) => setCenter((value) => ({ ...value, lng: Number(event.target.value) }))} /></label>
        </div>
        <label className="regional-range"><span><b>Magnitude</b><strong>{magnitude.toFixed(1)}</strong></span><input type="range" min="4" max="9.5" step="0.1" value={magnitude} onChange={(event) => setMagnitude(Number(event.target.value))} /></label>
        <label className="regional-range"><span><b>Focal depth</b><strong>{depth} km</strong></span><input type="range" min="2" max="80" step="1" value={depth} onChange={(event) => setDepth(Number(event.target.value))} /></label>
        <label className="regional-range"><span><b>Analysis radius</b><strong>{radius} km</strong></span><input type="range" min="5" max="150" step="5" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /></label>
        <label className="regional-field"><span>Representative site class</span><select value={siteClass} onChange={(event) => setSiteClass(event.target.value as SiteClass)}>{Object.keys(SITE_FACTORS).map((site) => <option value={site} key={site}>Class {site}</option>)}</select></label>
        <p className="regional-note">Click anywhere on the map to move the scenario epicenter. Site classes are preset estimates and must be confirmed by geotechnical investigation.</p>
      </aside>

      <div className="regional-map-panel">
        <header>
          <div><span className="eyebrow">OPENSTREETMAP IMPACT MAP</span><strong>{CITIES[cityIndex].name}</strong></div>
          <div className="map-toolbar"><span className="map-provider">OpenFreeMap · keyless</span><button type="button" onClick={() => setView3D((current) => !current)}>{view3D ? "Area overview" : "3D district"}</button></div>
        </header>
        <div className="regional-map" ref={mapRef} aria-label="Interactive OpenStreetMap regional earthquake impact map with 3D buildings" />
        {mapError && <p className="map-error">{mapError}</p>}
        <div className="map-legend"><span><i className="zone-high" /> Highest modeled motion</span><span><i className="zone-mid" /> Moderate modeled motion</span><span><i className="zone-low" /> Lower modeled motion</span><b>{view3D ? "3D OSM buildings shown at district scale" : "Area-scale impact view"}</b></div>
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
