"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SiteClass = "A" | "B" | "C" | "D" | "E" | "F";
type City = { name: string; lat: number; lng: number; site: SiteClass };

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
let googleMapsConfigured = false;

function groundMotion(magnitude: number, depth: number, distance: number, site: SiteClass) {
  const hypocentralDistance = Math.sqrt(distance ** 2 + depth ** 2);
  const magnitudeTerm = Math.pow(10, (magnitude - 6) * 0.31);
  const attenuation = Math.exp(-hypocentralDistance / 105) / Math.pow(Math.max(hypocentralDistance, 5) / 10, 0.92);
  const pga = clamp(0.19 * magnitudeTerm * attenuation * SITE_FACTORS[site], 0.002, 2.5);
  const pgaCms = pga * 980.665;
  const mmi = clamp((pgaCms > 80 ? 3.66 * Math.log10(pgaCms) - 1.66 : 2.2 * Math.log10(pgaCms) + 1), 1, 12);
  return { pga, mmi };
}

function riskLabel(mmi: number) {
  if (mmi >= 9) return "Extreme";
  if (mmi >= 7) return "Severe";
  if (mmi >= 5) return "Strong";
  return "Light";
}

export default function RegionalSimulator() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [cityIndex, setCityIndex] = useState(0);
  const [center, setCenter] = useState({ lat: CITIES[0].lat, lng: CITIES[0].lng });
  const [magnitude, setMagnitude] = useState(7.2);
  const [depth, setDepth] = useState(12);
  const [radius, setRadius] = useState(45);
  const [siteClass, setSiteClass] = useState<SiteClass>(CITIES[0].site);
  const [mapProvider, setMapProvider] = useState("Loading map...");
  const [mapError, setMapError] = useState("");

  const centerMotion = useMemo(() => groundMotion(magnitude, depth, 0, siteClass), [magnitude, depth, siteClass]);
  const edgeMotion = useMemo(() => groundMotion(magnitude, depth, radius, siteClass), [magnitude, depth, radius, siteClass]);
  const samples = useMemo(() => [0, 0.25, 0.5, 0.75, 1].map((part) => {
    const distance = radius * part;
    return { distance, ...groundMotion(magnitude, depth, distance, siteClass) };
  }), [magnitude, depth, radius, siteClass]);

  useEffect(() => {
    if (!mapRef.current) return;
    let disposed = false;
    let cleanup = () => {};
    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    const loadMap = async () => {
      setMapError("");
      if (googleKey) {
        try {
          const { setOptions, importLibrary } = await import("@googlemaps/js-api-loader");
          if (!googleMapsConfigured) {
            setOptions({ key: googleKey, v: "weekly", authReferrerPolicy: "origin" });
            googleMapsConfigured = true;
          }
          const { Map } = await importLibrary("maps");
          if (disposed || !mapRef.current) return;
          const map = new Map(mapRef.current, { center, zoom: Math.max(8, 12 - Math.round(radius / 25)), mapTypeControl: true, streetViewControl: false });
          const circles = [1, 0.66, 0.33].map((factor, index) => new google.maps.Circle({
            map,
            center,
            radius: radius * factor * 1000,
            fillColor: ["#f1c75b", "#ee925b", "#e35f4a"][index],
            fillOpacity: 0.13,
            strokeColor: ["#d7aa3c", "#dc7543", "#cb4737"][index],
            strokeOpacity: 0.9,
            strokeWeight: 2,
          }));
          const listener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
            if (event.latLng) setCenter({ lat: event.latLng.lat(), lng: event.latLng.lng() });
          });
          setMapProvider("Google Maps");
          cleanup = () => { listener.remove(); circles.forEach((circle) => circle.setMap(null)); };
          return;
        } catch {
          if (!disposed) setMapError("Google Maps could not load. OpenStreetMap fallback is active.");
        }
      }

      const L = await import("leaflet");
      if (disposed || !mapRef.current) return;
      const map = L.map(mapRef.current, { zoomControl: true, preferCanvas: true }).setView([center.lat, center.lng], Math.max(8, 12 - Math.round(radius / 25)));
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
      [1, 0.66, 0.33].forEach((factor, index) => L.circle([center.lat, center.lng], {
        radius: radius * factor * 1000,
        color: ["#d7aa3c", "#dc7543", "#cb4737"][index],
        fillColor: ["#f1c75b", "#ee925b", "#e35f4a"][index],
        fillOpacity: 0.13,
        weight: 2,
      }).addTo(map));
      L.circleMarker([center.lat, center.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#e6663f", fillOpacity: 1 }).addTo(map).bindTooltip("Scenario epicenter");
      map.on("click", (event) => setCenter({ lat: event.latlng.lat, lng: event.latlng.lng }));
      setMapProvider("OpenStreetMap");
      cleanup = () => map.remove();
    };

    void loadMap();
    return () => { disposed = true; cleanup(); };
  }, [center, radius]);

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
        <header><div><span className="eyebrow">IMPACT MAP</span><strong>{CITIES[cityIndex].name}</strong></div><span className="map-provider">{mapProvider}</span></header>
        <div className="regional-map" ref={mapRef} aria-label="Interactive regional earthquake impact map" />
        {mapError && <p className="map-error">{mapError}</p>}
        <div className="map-legend"><span><i className="zone-high" /> Highest modeled motion</span><span><i className="zone-mid" /> Moderate modeled motion</span><span><i className="zone-low" /> Lower modeled motion</span></div>
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
