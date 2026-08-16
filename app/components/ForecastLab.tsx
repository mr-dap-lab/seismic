"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, Marker, NavigationControl, Popup, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { ParameterLabel } from "./ParameterTooltip";
import { translateText, type Language } from "../lib/i18n";

type ForecastEvent = {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  latitude: number;
  longitude: number;
  depth: number;
};

type CatalogPayload = {
  events: ForecastEvent[];
  generated: number;
  sourceWindowDays: number;
  minimumCatalogMagnitude: number;
  fallback: boolean;
  error?: string;
};

type ForecastCell = {
  id: string;
  latitude: number;
  longitude: number;
  region: string;
  probability: number;
  expected: number;
  backgroundShare: number;
  triggerShare: number;
  remoteShare: number;
};

const R_EARTH_KM = 6371.0088;
const GRID_STEP = 5;
const ETAS = { alpha: 0.8, c: 0.05, p: 1.1, q: 1.5, d0: 50, gamma: 0.4 };
const REMOTE_STRESS_WEIGHTS = [0, 0.01, 0.03, 0.05] as const;
const TIDAL_WEIGHTS = [0, 0.0025, 0.005, 0.01] as const;
const EARTH_CYCLE_WEIGHTS = [0, 0.001, 0.0025, 0.005] as const;
const SHOW_EXPERIMENTAL_FORECAST_CONTROLS = false;

const FORECAST_COVERAGE_REGIONS = [
  { id: "north-america", contains: ({ latitude, longitude }: ForecastCell) => latitude >= 25 && latitude <= 85 && longitude >= -170 && longitude <= -50 },
  { id: "central-america", contains: ({ latitude, longitude }: ForecastCell) => latitude >= 5 && latitude < 25 && longitude >= -120 && longitude <= -50 },
  { id: "south-america", contains: ({ latitude, longitude }: ForecastCell) => latitude >= -60 && latitude < 15 && longitude >= -95 && longitude <= -30 },
  { id: "europe", contains: ({ latitude, longitude }: ForecastCell) => latitude >= 35 && latitude <= 75 && longitude >= -25 && longitude < 45 },
  { id: "africa", contains: ({ latitude, longitude }: ForecastCell) => latitude >= -40 && latitude < 35 && longitude >= -20 && longitude < 55 },
  { id: "asia", contains: ({ latitude, longitude }: ForecastCell) => latitude >= 5 && latitude <= 85 && longitude >= 45 && longitude <= 180 },
  { id: "oceania", contains: ({ latitude, longitude }: ForecastCell) => latitude >= -55 && latitude < 10 && longitude >= 105 && longitude <= 180 },
] as const;

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
    { id: "forecast-background", type: "background", paint: { "background-color": "#dfe7e2" } },
    { id: "forecast-osm", type: "raster", source: "osm", paint: { "raster-opacity": 0.7, "raster-saturation": -0.78, "raster-contrast": 0.08, "raster-fade-duration": 0 } },
  ],
};

const LOCALES: Record<Language, string> = {
  en: "en-US", es: "es-ES", fr: "fr-FR", yue: "zh-HK", hi: "hi-IN", ar: "ar-SA",
  pt: "pt-BR", ru: "ru-RU", ja: "ja-JP", it: "it-IT", de: "de-DE",
};

const COUNTRY_CODES: Record<string, string> = {
  afghanistan: "AF", argentina: "AR", canada: "CA", chile: "CL", china: "CN", colombia: "CO", "costa rica": "CR",
  ecuador: "EC", "el salvador": "SV", fiji: "FJ", greece: "GR", guatemala: "GT", iceland: "IS", india: "IN",
  indonesia: "ID", iran: "IR", italy: "IT", japan: "JP", mexico: "MX", "new zealand": "NZ", nicaragua: "NI",
  pakistan: "PK", peru: "PE", philippines: "PH", "papua new guinea": "PG", russia: "RU", "solomon islands": "SB",
  taiwan: "TW", tonga: "TO", turkey: "TR", türkiye: "TR", "united states": "US", vanuatu: "VU",
};

function localizedRegion(region: string, locale: string) {
  const code = COUNTRY_CODES[region.toLocaleLowerCase("en-US")];
  if (!code) return region;
  return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? region;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

function regionFromPlace(place: string) {
  if (place.includes(",")) return place.split(",").at(-1)?.trim() || place;
  return place.replace(/^\s*\d+\s*km\s+[NSEW]{1,3}\s+of\s+/i, "").trim();
}

function normalize(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);
  return values.map((value) => value / total);
}

function moonTideEnvelope(now: number) {
  // Reference new moon: 2000-01-06 18:14 UTC. New and full moons are spring-tide peaks.
  const reference = Date.UTC(2000, 0, 6, 18, 14);
  const synodicDays = 29.53058867;
  const days = (now - reference) / 86_400_000;
  const phase = ((days % synodicDays) + synodicDays) % synodicDays / synodicDays;
  return { phase, envelope: Math.cos(4 * Math.PI * phase) };
}

function earthCycleEnvelope(now: number) {
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const dayStart = Date.UTC(year, date.getUTCMonth(), date.getUTCDate());
  const yearStart = Date.UTC(year, 0, 1);
  const nextYearStart = Date.UTC(year + 1, 0, 1);
  const rotation = Math.cos(2 * Math.PI * ((now - dayStart) / 86_400_000));
  const revolution = Math.cos(2 * Math.PI * ((now - yearStart) / (nextYearStart - yearStart)));
  return { rotation, revolution, envelope: (rotation + revolution) / 2 };
}

function forecastPoints(cells: ForecastCell[], selectedId: string | null): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: cells.map((cell, index) => ({
      type: "Feature",
      id: cell.id,
      properties: {
        id: cell.id,
        probability: cell.probability * 100,
        visual: Math.min(1, Math.sqrt(cell.probability / 0.5)),
        rank: index + 1,
        selected: cell.id === selectedId ? 1 : 0,
      },
      geometry: { type: "Point", coordinates: [cell.longitude, cell.latitude] },
    })),
  };
}

function forecastMarkerCells(cells: ForecastCell[]) {
  const selected = new globalThis.Map<string, ForecastCell>();
  const add = (cell: ForecastCell) => {
    if (cell.probability > 0) selected.set(cell.id, cell);
  };
  const separated = (matches: (cell: ForecastCell) => boolean, limit: number, minimumDistanceKm: number) => {
    const picked: ForecastCell[] = [];
    for (const cell of cells) {
      if (cell.probability <= 0 || !matches(cell)) continue;
      if (picked.every((candidate) => haversine(cell.latitude, cell.longitude, candidate.latitude, candidate.longitude) >= minimumDistanceKm)) {
        picked.push(cell);
      }
      if (picked.length === limit) break;
    }
    return picked;
  };

  separated(() => true, 14, 900).forEach(add);
  FORECAST_COVERAGE_REGIONS.forEach((region) => separated(region.contains, 7, 750).forEach(add));
  return [...selected.values()].sort((a, b) => b.probability - a.probability);
}

function forecastCoverageRegion(cell: ForecastCell) {
  return FORECAST_COVERAGE_REGIONS.find((region) => region.contains(cell))?.id ?? "global";
}

type ForecastMapLabels = {
  area: string;
  probability: string;
  expected: string;
  baseline: string;
  aftershock: string;
  remote: string;
  scenario: string;
  days: string;
  close: string;
};

function largeEventPoints(events: ForecastEvent[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: events.filter((event) => event.magnitude >= 7 && Date.now() - event.time <= 30 * 86_400_000).map((event) => ({
      type: "Feature",
      id: event.id,
      properties: { magnitude: event.magnitude },
      geometry: { type: "Point", coordinates: [event.longitude, event.latitude] },
    })),
  };
}

function ForecastWorldMap({ cells, events, selectedId, onSelect, label, labels, targetMagnitude, horizonDays, locale }: {
  cells: ForecastCell[];
  events: ForecastEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  label: string;
  labels: ForecastMapLabels;
  targetMagnitude: number;
  horizonDays: number;
  locale: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupRef = useRef<Popup | null>(null);
  const popupCellIdRef = useRef<string | null>(null);
  const cellsRef = useRef(cells);
  const eventsRef = useRef(events);
  const selectedRef = useRef(selectedId);
  const metadataRef = useRef({ labels, targetMagnitude, horizonDays, locale });

  useEffect(() => {
    cellsRef.current = cells;
    eventsRef.current = events;
    selectedRef.current = selectedId;
    metadataRef.current = { labels, targetMagnitude, horizonDays, locale };
  }, [cells, events, horizonDays, labels, locale, selectedId, targetMagnitude]);

  const showMetadata = useCallback((cell: ForecastCell) => {
    const map = mapRef.current;
    if (!map) return;
    const metadata = metadataRef.current;
    const region = localizedRegion(cell.region, metadata.locale);
    const percent = new Intl.NumberFormat(metadata.locale, { style: "percent", maximumFractionDigits: 2 }).format;
    const number = new Intl.NumberFormat(metadata.locale, { maximumFractionDigits: 3 }).format;
    const panel = document.createElement("section");
    panel.className = "forecast-popup";
    const heading = document.createElement("strong");
    heading.textContent = region;
    const coordinates = document.createElement("small");
    coordinates.textContent = `${cell.latitude.toFixed(1)}°, ${cell.longitude.toFixed(1)}° · ${metadata.labels.scenario}: M ${metadata.targetMagnitude.toFixed(1)}+ / ${metadata.horizonDays} ${metadata.labels.days}`;
    const list = document.createElement("dl");
    const rows: Array<[string, string]> = [
      [metadata.labels.probability, percent(cell.probability)],
      [metadata.labels.expected, number(cell.expected)],
      [metadata.labels.baseline, percent(cell.backgroundShare)],
      [metadata.labels.aftershock, percent(cell.triggerShare)],
      [metadata.labels.remote, percent(cell.remoteShare)],
    ];
    rows.forEach(([term, value]) => {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = term;
      dd.textContent = value;
      list.append(dt, dd);
    });
    panel.append(heading, coordinates, list);
    popupRef.current?.remove();
    popupCellIdRef.current = cell.id;
    const popup = new Popup({ closeButton: true, closeOnClick: false, offset: 14, maxWidth: "300px", anchor: cell.latitude < 10 ? "bottom" : "top" })
      .setLngLat([cell.longitude, cell.latitude])
      .setDOMContent(panel)
      .addTo(map);
    popup.getElement().querySelector<HTMLButtonElement>(".maplibregl-popup-close-button")?.setAttribute("aria-label", metadata.labels.close);
    popup.on("close", () => {
      if (popupRef.current === popup) {
        popupRef.current = null;
        popupCellIdRef.current = null;
      }
    });
    popupRef.current = popup;
  }, []);

  useEffect(() => {
    if (!mountRef.current || mapRef.current) return;
    const map = new Map({
      container: mountRef.current,
      style: MAP_STYLE,
      center: [10, 6],
      zoom: 0.7,
      minZoom: 0.25,
      maxZoom: 7,
      renderWorldCopies: false,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("forecast-grid", { type: "geojson", data: forecastPoints(cellsRef.current, selectedRef.current) });
      map.addLayer({
        id: "forecast-heat",
        type: "heatmap",
        source: "forecast-grid",
        maxzoom: 5,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "visual"], 0, 0, 0.2, 0.12, 1, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.85, 5, 1.5],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 16, 5, 38],
          "heatmap-opacity": 0.72,
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(77,120,105,0)", 0.25, "#8cb69a", 0.5, "#e4c55c", 0.72, "#e9874b", 1, "#c94238"],
        },
      });
      map.addLayer({
        id: "forecast-cells",
        type: "circle",
        source: "forecast-grid",
        paint: {
          "circle-radius": ["case", ["==", ["get", "selected"], 1], 10, ["interpolate", ["linear"], ["get", "visual"], 0, 2, 1, 7]],
          "circle-color": ["case", ["==", ["get", "selected"], 1], "#ffffff", ["interpolate", ["linear"], ["get", "visual"], 0, "#74a68c", 0.25, "#d6b94f", 0.55, "#e9874b", 1, "#c94238"]],
          "circle-stroke-color": "#273630",
          "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 3, 0.8],
          "circle-opacity": ["interpolate", ["linear"], ["get", "visual"], 0, 0, 0.01, 0.18, 1, 0.92],
        },
      });
      map.addSource("forecast-large-events", { type: "geojson", data: largeEventPoints(eventsRef.current) });
      map.addLayer({
        id: "forecast-large-events",
        type: "circle",
        source: "forecast-large-events",
        paint: { "circle-radius": 7, "circle-color": "#182a24", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
      });
    });
    map.on("mouseenter", "forecast-cells", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "forecast-cells", () => { map.getCanvas().style.cursor = "grab"; });
    map.on("click", "forecast-cells", (event) => {
      const id = event.features?.[0]?.properties?.id;
      if (typeof id === "string") {
        const cell = cellsRef.current.find((candidate) => candidate.id === id);
        if (cell) showMetadata(cell);
        onSelect(id);
      }
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(mountRef.current);
    return () => {
      observer.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      popupRef.current?.remove();
      popupRef.current = null;
      popupCellIdRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [onSelect, showMetadata]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource("forecast-grid") as GeoJSONSource | undefined)?.setData(forecastPoints(cells, selectedId));
    (map.getSource("forecast-large-events") as GeoJSONSource | undefined)?.setData(largeEventPoints(events));
  }, [cells, events, selectedId]);

  useEffect(() => {
    const popupCellId = popupCellIdRef.current;
    if (!popupCellId) return;
    const updatedCell = cells.find((cell) => cell.id === popupCellId);
    if (updatedCell) showMetadata(updatedCell);
  }, [cells, horizonDays, locale, showMetadata, targetMagnitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = forecastMarkerCells(cells).map((cell) => {
      const button = document.createElement("button");
      const dot = document.createElement("span");
      const visual = Math.min(1, Math.sqrt(cell.probability / 0.5));
      button.type = "button";
      button.className = `forecast-cell-marker${cell.id === selectedId ? " is-selected" : ""}`;
      button.dataset.cellId = cell.id;
      button.dataset.latitude = String(cell.latitude);
      button.dataset.longitude = String(cell.longitude);
      button.dataset.coverageRegion = forecastCoverageRegion(cell);
      Object.assign(button.style, {
        display: "grid",
        placeItems: "center",
        width: "44px",
        height: "44px",
        padding: "0",
        border: "0",
        borderRadius: "50%",
        background: "transparent",
        cursor: "pointer",
      });
      const region = localizedRegion(cell.region, locale);
      const formattedProbability = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(cell.probability);
      const formattedExpected = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(cell.expected);
      button.setAttribute("aria-label", `${labels.area}: ${region}. ${labels.probability}: ${formattedProbability}. ${labels.expected}: ${formattedExpected}.`);
      button.title = button.getAttribute("aria-label") ?? region;
      dot.style.width = `${6 + visual * 13}px`;
      dot.style.height = `${6 + visual * 13}px`;
      dot.style.background = visual > 0.72 ? "#c94238" : visual > 0.42 ? "#e9874b" : visual > 0.18 ? "#d6b94f" : "#74a68c";
      button.append(dot);
      button.addEventListener("click", (event) => { event.stopPropagation(); showMetadata(cell); onSelect(cell.id); });
      return new Marker({ element: button, anchor: "center" }).setLngLat([cell.longitude, cell.latitude]).addTo(map);
    });
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [cells, labels.area, labels.expected, labels.probability, locale, onSelect, selectedId, showMetadata]);

  return <div className="forecast-map" ref={mountRef} role="img" aria-label={label} />;
}

function FactorRow({ name, status, detail, tone = "muted" }: { name: string; status: string; detail: string; tone?: "strong" | "research" | "muted" }) {
  return <div className={`forecast-factor tone-${tone}`}><div><strong>{name}</strong><span>{detail}</span></div><b>{status}</b></div>;
}

export default function ForecastLab({ language }: { language: Language }) {
  const t = useCallback((value: string) => translateText(value, language), [language]);
  const locale = LOCALES[language];
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetMagnitude, setTargetMagnitude] = useState(6);
  const [horizonDays, setHorizonDays] = useState(7);
  const [aftershockEnabled, setAftershockEnabled] = useState(true);
  const [remoteStressWeight, setRemoteStressWeight] = useState(0);
  const [tidalWeight, setTidalWeight] = useState(0);
  const [earthCycleWeight, setEarthCycleWeight] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/forecast-catalog", { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as CatalogPayload;
        if (!response.ok || payload.error) throw new Error(payload.error || "USGS catalog request failed.");
        setCatalog(payload);
      })
      .catch((requestError: unknown) => {
        if ((requestError as Error).name !== "AbortError") setError(requestError instanceof Error ? requestError.message : "USGS catalog request failed.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [refreshSignal]);

  const model = useMemo(() => {
    if (!catalog?.events.length) return null;
    const now = catalog.generated;
    const events = catalog.events;
    const background: number[] = [];
    const trigger: number[] = [];
    const remote: number[] = [];
    const cells: Array<Omit<ForecastCell, "probability" | "expected" | "backgroundShare" | "triggerShare" | "remoteShare">> = [];

    const spatialBandwidthKm = 430 + (7 - targetMagnitude) * 55;

    for (let latitude = -85; latitude <= 85; latitude += GRID_STEP) {
      for (let longitude = -175; longitude <= 175; longitude += GRID_STEP) {
        let backgroundValue = 0;
        let triggerValue = 0;
        let remoteValue = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;
        let nearestPlace = "Unlabelled region";

        for (const event of events) {
          const distance = haversine(latitude, longitude, event.latitude, event.longitude);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestPlace = event.place;
          }
          if (distance <= 3000 && event.magnitude >= catalog.minimumCatalogMagnitude) {
            const magnitudeWeight = 10 ** (0.22 * (event.magnitude - catalog.minimumCatalogMagnitude));
            backgroundValue += magnitudeWeight * Math.exp(-0.5 * (distance / spatialBandwidthKm) ** 2);
          }

          const ageDays = Math.max(0.01, (now - event.time) / 86_400_000);
          if (aftershockEnabled && ageDays <= 30 && distance <= 1500) {
            const spatialScale = ETAS.d0 * 10 ** (ETAS.gamma * (event.magnitude - catalog.minimumCatalogMagnitude));
            const productivity = 10 ** (ETAS.alpha * (event.magnitude - catalog.minimumCatalogMagnitude));
            triggerValue += productivity * (ageDays + ETAS.c) ** -ETAS.p * (1 + (distance / spatialScale) ** 2) ** -ETAS.q;
          }
          if (remoteStressWeight > 0 && event.magnitude >= 7 && ageDays <= 7) {
            remoteValue += 10 ** (0.6 * (event.magnitude - 7)) * Math.exp(-ageDays / 2) / (1 + (distance / 4000) ** 2);
          }
        }
        cells.push({ id: `${latitude}:${longitude}`, latitude, longitude, region: regionFromPlace(nearestPlace) });
        background.push(backgroundValue);
        trigger.push(triggerValue);
        remote.push(remoteValue);
      }
    }

    const bgShare = normalize(background);
    const triggerShare = normalize(trigger);
    const remoteShare = normalize(remote);
    let combined = bgShare.map((value, index) => aftershockEnabled && triggerShare[index] > 0
      ? value * 0.7 + triggerShare[index] * 0.3
      : value);
    if (remoteStressWeight > 0 && remoteShare.some((value) => value > 0)) {
      combined = combined.map((value, index) => value * (1 - remoteStressWeight) + remoteShare[index] * remoteStressWeight);
    }
    combined = normalize(combined);

    const catalogRate = events.filter((event) => event.magnitude >= catalog.minimumCatalogMagnitude).length / catalog.sourceWindowDays;
    const magnitudeScaledRate = catalogRate * 10 ** (-(targetMagnitude - catalog.minimumCatalogMagnitude));
    const tide = moonTideEnvelope(now);
    const earthCycle = earthCycleEnvelope(now);
    const tideMultiplier = 1 + tidalWeight * tide.envelope;
    const earthCycleMultiplier = 1 + earthCycleWeight * earthCycle.envelope;
    const globalRate = magnitudeScaledRate * tideMultiplier * earthCycleMultiplier;
    const modeledCells: ForecastCell[] = cells.map((cell, index) => {
      const expected = globalRate * combined[index] * horizonDays;
      return {
        ...cell,
        expected,
        probability: 1 - Math.exp(-expected),
        backgroundShare: bgShare[index],
        triggerShare: triggerShare[index],
        remoteShare: remoteShare[index],
      };
    }).sort((a, b) => b.probability - a.probability);

    return {
      cells: modeledCells,
      top: modeledCells.slice(0, 12),
      globalChance: 1 - Math.exp(-globalRate * horizonDays),
      globalExpected: globalRate * horizonDays,
      tide,
      recentLarge: events.filter((event) => event.magnitude >= 7 && now - event.time <= 30 * 86_400_000).sort((a, b) => b.time - a.time),
      end: new Date(now + horizonDays * 86_400_000),
    };
  }, [aftershockEnabled, catalog, earthCycleWeight, horizonDays, remoteStressWeight, targetMagnitude, tidalWeight]);

  const effectiveSelectedId = selectedId && model?.cells.some((cell) => cell.id === selectedId) ? selectedId : model?.top[0]?.id ?? null;
  const selected = model?.cells.find((cell) => cell.id === effectiveSelectedId) ?? model?.top[0] ?? null;
  const percent = (value: number) => new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: value < 0.01 ? 2 : 1, maximumFractionDigits: value < 0.01 ? 2 : 1 }).format(value);
  const number = (value: number, digits = 2) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  const weightPercent = (value: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(value);
  const resetParameters = () => {
    setTargetMagnitude(6);
    setHorizonDays(7);
    setAftershockEnabled(true);
    setRemoteStressWeight(0);
    setTidalWeight(0);
    setEarthCycleWeight(0);
    setSelectedId(null);
  };

  return (
    <section className="forecast-shell" data-i18n-managed="true" aria-label={t("Probabilistic earthquake forecast lab")}>
      <aside className="forecast-controls">
        <span className="eyebrow">{t("RESEARCH FORECAST")}</span>
        <h1>{t("Probabilistic forecast lab")}</h1>
        <p className="forecast-intro">{t("Explore where earthquake occurrence is statistically more likely within a selected time window. This is a forecast of rates, not a prediction of the next earthquake.")}</p>

        <div className="forecast-warning" role="note">
          <strong>{t("No exact earthquake prediction")}</strong>
          <p>{t("Science cannot currently determine the exact time, place, and magnitude of the next major earthquake. Never use this educational model for emergency or life-safety decisions.")}</p>
        </div>

        <div className="forecast-control-stack">
          <label className="forecast-field">
            <ParameterLabel label={t("Target magnitude")} description={t("The minimum magnitude being forecast. Gutenberg–Richter scaling reduces the expected rate as the target magnitude rises.")} />
            <select value={targetMagnitude} onChange={(event) => setTargetMagnitude(Number(event.target.value))}>
              {[5, 5.5, 6, 6.5, 7].map((value) => <option value={value} key={value}>M {value.toFixed(1)}+</option>)}
            </select>
          </label>
          <label className="forecast-field">
            <ParameterLabel label={t("Forecast horizon")} description={t("The future interval over which each cell probability and expected count are calculated.")} />
            <select value={horizonDays} onChange={(event) => setHorizonDays(Number(event.target.value))}>
              {[1, 7, 30].map((value) => <option value={value} key={value}>{value} {t(value === 1 ? "day" : "days")}</option>)}
            </select>
          </label>

          <fieldset className="forecast-options">
            <legend>{t("Model components")}</legend>
            <label className="forecast-option-toggle"><input type="checkbox" checked={aftershockEnabled} onChange={(event) => setAftershockEnabled(event.target.checked)} /><span><strong>{t("Aftershock clustering")}</strong><small>{t("ETAS-style time and distance decay from recent earthquakes.")}</small></span></label>
            {SHOW_EXPERIMENTAL_FORECAST_CONTROLS && <>
              <label className="forecast-weight-field">
                <ParameterLabel label={t("Remote dynamic stress")} description={t("Distant earthquakes can trigger mostly small, short-lived activity, but this proxy has not been prospectively validated.")} />
                <select value={remoteStressWeight} onChange={(event) => setRemoteStressWeight(Number(event.target.value))}>
                  {REMOTE_STRESS_WEIGHTS.map((value) => <option value={value} key={value}>{value === 0 ? `${t("OFF")} · ` : ""}{weightPercent(value)}</option>)}
                </select>
              </label>
              <label className="forecast-weight-field">
                <ParameterLabel label={t("Gravity and tidal pull")} description={t("Some fault types show weak correlations; tides do not reliably predict earthquakes.")} />
                <select value={tidalWeight} onChange={(event) => setTidalWeight(Number(event.target.value))}>
                  {TIDAL_WEIGHTS.map((value) => <option value={value} key={value}>{value === 0 ? `${t("OFF")} · ` : ""}{weightPercent(value)}</option>)}
                </select>
              </label>
              <label className="forecast-weight-field">
                <ParameterLabel label={`${t("Earth rotation")} / ${t("revolution")}`} description={t("Time-of-day and annual cycles are tracked as diagnostics only because they have no demonstrated global predictive skill.")} />
                <select value={earthCycleWeight} onChange={(event) => setEarthCycleWeight(Number(event.target.value))}>
                  {EARTH_CYCLE_WEIGHTS.map((value) => <option value={value} key={value}>{value === 0 ? `${t("OFF")} · ` : ""}{weightPercent(value)}</option>)}
                </select>
              </label>
            </>}
          </fieldset>

          <div className="forecast-actions">
            <button className="forecast-refresh" type="button" onClick={() => { setLoading(true); setError(null); setRefreshSignal((value) => value + 1); }} disabled={loading}>
              {loading ? t("Updating catalog...") : t("Refresh USGS catalog")}
            </button>
            {SHOW_EXPERIMENTAL_FORECAST_CONTROLS && <button className="forecast-reset" type="button" onClick={resetParameters}>{t("Reset")}</button>}
          </div>
        </div>

        <div className="forecast-catalog-status" role="status" aria-live="polite">
          {loading ? <p>{t("Loading the USGS catalog and calculating the forecast...")}</p> : error ? <p className="is-error">{t("Forecast data is temporarily unavailable.")} {error}</p> : catalog ? <>
            <span>{t("CATALOG STATUS")}</span>
            <strong>{number(catalog.events.length, 0)} {t("earthquakes analyzed")}</strong>
            <small>{catalog.sourceWindowDays} {t("days")} · M {catalog.minimumCatalogMagnitude}+{catalog.fallback ? ` · ${t("fallback window")}` : ""}</small>
          </> : null}
        </div>
      </aside>

      <main className="forecast-main">
        <header className="forecast-summary">
          <div><span>{t("FORECAST WINDOW")}</span><strong>{horizonDays} {t(horizonDays === 1 ? "day" : "days")} · M {targetMagnitude.toFixed(1)}+</strong><small>{model ? `${t("Through")} ${model.end.toLocaleDateString(locale, { dateStyle: "medium" })}` : t("Awaiting catalog")}</small></div>
          <div><span>{t("GLOBAL EXPECTED COUNT")}</span><strong>{model ? number(model.globalExpected, 2) : "—"}</strong><small>{t("Poisson mean, not a guaranteed count")}</small></div>
          <div><span>{t("CHANCE OF ONE OR MORE WORLDWIDE")}</span><strong>{model ? percent(model.globalChance) : "—"}</strong><small>{t("Broad global probability")}</small></div>
        </header>

        <section className="forecast-map-card">
          <div className="forecast-section-heading"><div><span>{t("PROBABILITY SURFACE")}</span><h2>{t("Where rates are elevated")}</h2><p>{t("Select a point or use the ranked table. Warmer colors indicate higher modeled probability within the chosen window.")}</p></div><div className="forecast-map-key"><i /><span>{t("Lower")}</span><b /><span>{t("Higher")}</span></div></div>
          {model ? <ForecastWorldMap
            cells={model.cells}
            events={catalog?.events ?? []}
            selectedId={effectiveSelectedId}
            onSelect={setSelectedId}
            label={t("Interactive world map of probabilistic earthquake forecast cells")}
            targetMagnitude={targetMagnitude}
            horizonDays={horizonDays}
            locale={locale}
            labels={{
              area: t("Area"),
              probability: t("Probability"),
              expected: t("Expected count"),
              baseline: t("Baseline spatial share"),
              aftershock: t("Aftershock spatial share"),
              remote: t("Remote-stress spatial share"),
              scenario: t("Scenario"),
              days: t(horizonDays === 1 ? "day" : "days"),
              close: t("Close forecast details"),
            }}
          /> : <div className="forecast-map-loading">{loading ? t("Calculating probability surface...") : t("No forecast surface available")}</div>}
          {selected && <div className="forecast-selection" aria-live="polite"><div><span>{t("SELECTED AREA")}</span><strong>{localizedRegion(selected.region, locale)}</strong><small>{selected.latitude.toFixed(1)}°, {selected.longitude.toFixed(1)}° · {GRID_STEP}° {t("cell")}</small></div><div><span>{t("CELL PROBABILITY")}</span><strong>{percent(selected.probability)}</strong><small>{t("Expected count")} {number(selected.expected, 3)}</small></div></div>}
        </section>

        <div className="forecast-lower-grid">
          <section className="forecast-ranking">
            <div className="forecast-section-heading"><div><span>{t("RANKED CELLS")}</span><h2>{t("Highest modeled probabilities")}</h2><p>{t("Ranks describe grid-cell rates; they do not identify the location of the next earthquake.")}</p></div></div>
            <div className="forecast-table-wrap">
              <table>
                <thead><tr><th>{t("Rank")}</th><th>{t("Area")}</th><th>{t("Probability")}</th><th>{t("Expected")}</th></tr></thead>
                <tbody>{model?.top.map((cell, index) => <tr key={cell.id} className={cell.id === effectiveSelectedId ? "is-selected" : ""} onClick={() => setSelectedId(cell.id)}><td>{index + 1}</td><td><button type="button" onClick={() => setSelectedId(cell.id)}>{localizedRegion(cell.region, locale)}<small>{cell.latitude.toFixed(1)}°, {cell.longitude.toFixed(1)}°</small></button></td><td>{percent(cell.probability)}</td><td>{number(cell.expected, 3)}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className="forecast-evidence">
            <div className="forecast-section-heading"><div><span>{t("MODEL EVIDENCE")}</span><h2>{t("What affects this forecast")}</h2></div></div>
            <FactorRow name={t("Smoothed seismicity")} status={t("PRIMARY")} detail={t("Historical spatial rate and Gutenberg–Richter scaling.")} tone="strong" />
            <FactorRow name={t("Aftershock clustering")} status={aftershockEnabled ? t("ACTIVE") : t("OFF")} detail={t("Short-term local triggering; strongest validated time-dependent component.")} tone={aftershockEnabled ? "strong" : "muted"} />
            <FactorRow name={t("Remote dynamic stress")} status={remoteStressWeight > 0 ? `${t("EXPERIMENTAL")} · ${weightPercent(remoteStressWeight)}` : t("OFF")} detail={t("Distant earthquakes can trigger mostly small, short-lived activity, but this proxy has not been prospectively validated.")} tone="research" />
            <FactorRow name={t("Gravity and tidal pull")} status={tidalWeight > 0 ? `${t("EXPERIMENTAL")} · ${weightPercent(tidalWeight)}` : t("0% DEFAULT WEIGHT")} detail={t("Some fault types show weak correlations; tides do not reliably predict earthquakes.")} tone="research" />
            <FactorRow name={t("Earth rotation") + " / " + t("revolution")} status={earthCycleWeight > 0 ? `${t("EXPERIMENTAL")} · ${weightPercent(earthCycleWeight)}` : t("0% WEIGHT")} detail={t("Time-of-day and annual cycles are tracked as diagnostics only because they have no demonstrated global predictive skill.")} tone={earthCycleWeight > 0 ? "research" : "muted"} />
            <p className="forecast-research-note"><strong>{t("Research rule:")}</strong> {t("Experimental factors should remain excluded unless walk-forward testing shows positive information gain beyond the baseline.")}</p>
          </section>
        </div>

        <footer className="forecast-method-note">
          <div><strong>{t("Methodology")}</strong><p>{t("Ported from the supplied Python foundation: adaptive-style smoothed seismicity, Gutenberg–Richter rate scaling, ETAS-family triggering, Poisson cell probabilities, and explicit component ablation. This browser implementation is simplified for education.")}</p></div>
          <div><strong>{t("Scientific and safety limitation")}</strong><p>{t("This tool cannot predict the exact next earthquake and is not an official warning, hazard map, or operational forecast. Follow local authorities and official geological agencies.")}</p></div>
          <nav aria-label={t("Forecast sources")}><a href="https://www.usgs.gov/faqs/can-you-predict-earthquakes" target="_blank" rel="noreferrer">{t("USGS on earthquake prediction")} ↗</a><a href="https://earthquake.usgs.gov/fdsnws/event/1/" target="_blank" rel="noreferrer">{t("USGS FDSN data service")} ↗</a></nav>
        </footer>
      </main>
    </section>
  );
}
