"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, Marker, NavigationControl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { ParameterLabel } from "./ParameterTooltip";
import { translateText, type Language } from "../lib/i18n";

type FeedWindow = "hour" | "day" | "48hours" | "72hours" | "week";

type UsgsFeature = {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    updated: number;
    url: string;
    felt: number | null;
    mmi: number | null;
    alert: "green" | "yellow" | "orange" | "red" | null;
    status: string;
    tsunami: number;
    sig: number;
  };
  geometry: {
    coordinates: [number, number, number];
  };
};

type UsgsFeed = {
  metadata: { generated: number; count: number; title: string };
  features: UsgsFeature[];
};

const FEED_URLS: Partial<Record<FeedWindow, string>> = {
  hour: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
  day: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
  week: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
};

const WINDOW_HOURS: Partial<Record<FeedWindow, number>> = { "48hours": 48, "72hours": 72 };

function feedUrl(window: FeedWindow) {
  const staticFeed = FEED_URLS[window];
  if (staticFeed) return staticFeed;
  const startTime = new Date(Date.now() - (WINDOW_HOURS[window] ?? 24) * 60 * 60 * 1000).toISOString();
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&starttime=${encodeURIComponent(startTime)}`;
}

const WINDOW_LABELS: Record<FeedWindow, string> = {
  hour: "Past hour",
  day: "Past 24 hours",
  "48hours": "Past 48 hours",
  "72hours": "Past 72 hours",
  week: "Past 7 days",
};

const LOCALES: Record<Language, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  yue: "zh-HK",
  hi: "hi-IN",
  ar: "ar-SA",
};

const WORLD_CENTER: [number, number] = [0, 0];
const WORLD_ZOOM = 1.45;
const WORLD_MAP_STYLE: StyleSpecification = {
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
    { id: "alerts-world-background", type: "background", paint: { "background-color": "#dce5e0" } },
    { id: "alerts-world-osm", type: "raster", source: "osm", paint: { "raster-opacity": 0.78, "raster-saturation": -0.72, "raster-contrast": 0.08, "raster-fade-duration": 0 } },
  ],
};

function earthquakePoints(events: UsgsFeature[], selectedId: string | null): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: events.map((event) => ({
      type: "Feature",
      id: event.id,
      properties: {
        id: event.id,
        magnitude: event.properties.mag ?? 0,
        selected: event.id === selectedId ? 1 : 0,
      },
      geometry: { type: "Point", coordinates: [event.geometry.coordinates[0], event.geometry.coordinates[1]] },
    })),
  };
}

function WorldEarthquakeMap({ events, selectedEvent, onSelect, t, locale }: {
  events: UsgsFeature[];
  selectedEvent: UsgsFeature | null;
  onSelect: (eventId: string | null) => void;
  t: (value: string) => string;
  locale: string;
}) {
  const mapMountRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const eventsRef = useRef(events);
  const selectedIdRef = useRef(selectedEvent?.id ?? null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    eventsRef.current = events;
    selectedIdRef.current = selectedEvent?.id ?? null;
  }, [events, selectedEvent]);

  useEffect(() => {
    if (!mapMountRef.current || mapInstanceRef.current) return;
    const map = new Map({
      container: mapMountRef.current,
      style: WORLD_MAP_STYLE,
      center: WORLD_CENTER,
      zoom: WORLD_ZOOM,
      minZoom: 0.05,
      maxZoom: 8,
      pitch: 0,
      bearing: 0,
      renderWorldCopies: false,
    });
    mapInstanceRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.setProjection({ type: "globe" });
      map.addSource("live-earthquakes", { type: "geojson", data: earthquakePoints(eventsRef.current, selectedIdRef.current) });
      map.addLayer({
        id: "live-earthquake-halo",
        type: "circle",
        source: "live-earthquakes",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "magnitude"], 0, 7, 4.5, 11, 6, 17, 8, 27],
          "circle-color": ["case", ["==", ["get", "selected"], 1], "#ffffff", "#e6663f"],
          "circle-opacity": ["case", ["==", ["get", "selected"], 1], 0.8, 0.2],
          "circle-blur": 0.45,
        },
      });
      map.addLayer({
        id: "live-earthquake-points",
        type: "circle",
        source: "live-earthquakes",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "magnitude"], 0, 3, 4.5, 5, 6, 8, 8, 13],
          "circle-color": ["step", ["get", "magnitude"], "#8ba49a", 4.5, "#e0b74e", 6, "#e57845", 7, "#cf433b"],
          "circle-stroke-color": ["case", ["==", ["get", "selected"], 1], "#17211f", "#ffffff"],
          "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 3, 1.5],
          "circle-opacity": 0.94,
        },
      });
      setMapReady(true);
    });

    map.on("mouseenter", "live-earthquake-points", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "live-earthquake-points", () => { map.getCanvas().style.cursor = "grab"; });
    map.on("click", "live-earthquake-points", (event) => {
      const eventId = event.features?.[0]?.properties?.id;
      if (typeof eventId === "string") onSelect(eventId);
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(mapMountRef.current);
    return () => {
      observer.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [onSelect]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = events.map((event) => {
      const magnitude = event.properties.mag ?? 0;
      const tone = magnitudeTone(magnitude);
      const markerColors = { low: "#8ba49a", moderate: "#e0b74e", high: "#e57845", critical: "#cf433b" } as const;
      const markerHalos = { low: "rgba(139,164,154,.22)", moderate: "rgba(224,183,78,.24)", high: "rgba(229,120,69,.25)", critical: "rgba(207,67,59,.27)" } as const;
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = `alerts-earthquake-marker tone-${tone}${event.id === selectedEvent?.id ? " is-selected" : ""}`;
      markerButton.style.width = `${Math.min(22, 8 + magnitude * 1.5)}px`;
      markerButton.style.height = markerButton.style.width;
      markerButton.style.padding = "0";
      markerButton.style.border = event.id === selectedEvent?.id ? "2px solid #17211f" : "1.5px solid rgba(255,255,255,.96)";
      markerButton.style.borderRadius = "50%";
      markerButton.style.backgroundColor = markerColors[tone];
      markerButton.style.boxShadow = `0 0 0 ${tone === "critical" ? 6 : tone === "high" ? 5 : 4}px ${markerHalos[tone]}, 0 2px 8px rgba(26,40,35,.38)`;
      markerButton.style.cursor = "pointer";
      if (event.id === selectedEvent?.id) {
        markerButton.style.outline = "2px solid #fff";
        markerButton.style.outlineOffset = "2px";
      }
      markerButton.title = `${t("Magnitude")} ${magnitude.toFixed(1)} · ${event.properties.place ?? t("Location unavailable")}`;
      markerButton.setAttribute("aria-label", markerButton.title);
      markerButton.addEventListener("click", (clickEvent) => {
        clickEvent.stopPropagation();
        onSelect(event.id);
      });
      return new Marker({ element: markerButton, anchor: "center" })
        .setLngLat([event.geometry.coordinates[0], event.geometry.coordinates[1]])
        .addTo(map);
    });
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [events, onSelect, selectedEvent?.id, t]);

  useEffect(() => {
    if (!mapReady) return;
    (mapInstanceRef.current?.getSource("live-earthquakes") as GeoJSONSource | undefined)?.setData(earthquakePoints(events, selectedEvent?.id ?? null));
  }, [events, mapReady, selectedEvent]);

  useEffect(() => {
    if (!selectedEvent || !mapInstanceRef.current) return;
    mapInstanceRef.current.easeTo({ center: [selectedEvent.geometry.coordinates[0], selectedEvent.geometry.coordinates[1]], zoom: Math.max(mapInstanceRef.current.getZoom(), 3), duration: 650 });
  }, [selectedEvent]);

  const resetWorldView = () => {
    onSelect(null);
    mapInstanceRef.current?.easeTo({ center: WORLD_CENTER, zoom: WORLD_ZOOM, pitch: 0, bearing: 0, duration: 650 });
  };

  return (
    <section className="alerts-world-map-section" aria-label={t("Worldwide earthquake map")}>
      <header className="alerts-world-map-header">
        <div><span className="eyebrow">{t("GLOBAL ACTIVITY")}</span><h3>{t("Worldwide earthquake map")}</h3><p>{t("Select a marker to inspect an earthquake. Marker size and color increase with magnitude.")}</p></div>
        <button type="button" onClick={resetWorldView}>{t("Reset world view")}</button>
      </header>
      <div className="alerts-world-map-stage">
        <div ref={mapMountRef} className="alerts-world-map" aria-label={t("Interactive world map of filtered USGS earthquakes")} />
        <div className="alerts-world-legend" aria-label={t("Magnitude legend")}>
          <span><i className="low" />M &lt; 4.5</span><span><i className="moderate" />M 4.5–5.9</span><span><i className="high" />M 6–6.9</span><span><i className="critical" />M 7+</span>
        </div>
        <div className="alerts-map-count"><strong>{events.length}</strong><span>{t("events on map")}</span></div>
        {selectedEvent && (
          <article className="alerts-map-selection">
            <button type="button" onClick={() => onSelect(null)} aria-label={t("Close map event details")}>×</button>
            <span>{relativeTime(selectedEvent.properties.time, locale)}</span>
            <strong>M {(selectedEvent.properties.mag ?? 0).toFixed(1)}</strong>
            <h4>{selectedEvent.properties.place ?? t("Location unavailable")}</h4>
            <div><span>{t("Depth")} · {selectedEvent.geometry.coordinates[2].toFixed(1)} km</span><span>{t("Status")} · {t(selectedEvent.properties.status === "reviewed" ? "Reviewed" : "Automatic")}</span></div>
            <a href={selectedEvent.properties.url} target="_blank" rel="noreferrer">{t("Details on USGS")} ↗</a>
          </article>
        )}
      </div>
    </section>
  );
}

function relativeTime(timestamp: number, locale: string) {
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function magnitudeTone(magnitude: number) {
  if (magnitude >= 7) return "critical";
  if (magnitude >= 6) return "high";
  if (magnitude >= 4.5) return "moderate";
  return "low";
}

export default function LiveAlerts({ language }: { language: Language }) {
  const [feedWindow, setFeedWindow] = useState<FeedWindow>("day");
  const [minimumMagnitude, setMinimumMagnitude] = useState(4.5);
  const [events, setEvents] = useState<UsgsFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [monitoring, setMonitoring] = useState(true);
  const [lastSynchronized, setLastSynchronized] = useState<number | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [selectedMapEventId, setSelectedMapEventId] = useState<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const minimumMagnitudeRef = useRef(minimumMagnitude);
  const notificationsEnabledRef = useRef(false);
  const t = useCallback((value: string) => translateText(value, language), [language]);
  const locale = LOCALES[language];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!("Notification" in window)) {
        setNotificationPermission("unsupported");
        return;
      }
      setNotificationPermission(Notification.permission);
      const enabled = window.localStorage.getItem("seismic-live-alerts") === "enabled" && Notification.permission === "granted";
      notificationsEnabledRef.current = enabled;
      setNotificationsEnabled(enabled);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const notify = useCallback((event: UsgsFeature) => {
    if (!("Notification" in window) || Notification.permission !== "granted" || !notificationsEnabledRef.current) return;
    const magnitude = event.properties.mag ?? 0;
    const notification = new Notification(`${t("Magnitude")} ${magnitude.toFixed(1)} · ${t("Earthquake detected")}`, {
      body: event.properties.place ?? t("Location unavailable"),
      tag: event.id,
      icon: "/favicon.ico",
    });
    notification.onclick = () => {
      window.open(event.properties.url, "_blank", "noopener,noreferrer");
      notification.close();
    };
  }, [t]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(feedUrl(feedWindow), { cache: "no-store", signal });
      if (!response.ok) throw new Error(`USGS ${response.status}`);
      const feed = await response.json() as UsgsFeed;
      const sorted = [...feed.features].sort((a, b) => b.properties.time - a.properties.time);
      const incomingIds = new Set(sorted.map((event) => event.id));

      if (initializedRef.current) {
        const fresh = sorted.filter((event) => !seenIdsRef.current.has(event.id));
        const visibleFresh = fresh.filter((event) => (event.properties.mag ?? 0) >= minimumMagnitudeRef.current);
        setNewEventIds(new Set(visibleFresh.map((event) => event.id)));
        visibleFresh.slice(0, 3).forEach(notify);
      } else {
        initializedRef.current = true;
        setNewEventIds(new Set());
      }

      seenIdsRef.current = incomingIds;
      setEvents(sorted);
      setLastSynchronized(feed.metadata.generated || Date.now());
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(t("Unable to reach the USGS earthquake service."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [feedWindow, notify, t]);

  useEffect(() => {
    initializedRef.current = false;
    seenIdsRef.current = new Set();
    const controller = new AbortController();
    const timer = window.setTimeout(() => void refresh(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [feedWindow, refresh]);

  useEffect(() => {
    if (!monitoring) return;
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, [monitoring, refresh]);

  const filteredEvents = useMemo(
    () => events.filter((event) => (event.properties.mag ?? 0) >= minimumMagnitude),
    [events, minimumMagnitude],
  );

  const largest = filteredEvents.reduce((maximum, event) => Math.max(maximum, event.properties.mag ?? 0), 0);
  const tsunamiCount = filteredEvents.filter((event) => event.properties.tsunami === 1).length;
  const reviewedCount = filteredEvents.filter((event) => event.properties.status === "reviewed").length;
  const selectedMapEvent = filteredEvents.find((event) => event.id === selectedMapEventId) ?? null;

  const toggleNotifications = async () => {
    if (!("Notification" in window)) return;
    if (notificationsEnabled) {
      notificationsEnabledRef.current = false;
      setNotificationsEnabled(false);
      window.localStorage.removeItem("seismic-live-alerts");
      return;
    }
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setNotificationPermission(permission);
    if (permission === "granted") {
      notificationsEnabledRef.current = true;
      setNotificationsEnabled(true);
      window.localStorage.setItem("seismic-live-alerts", "enabled");
    }
  };

  const notificationLabel = notificationPermission === "unsupported"
    ? t("Not supported")
    : notificationPermission === "denied"
      ? t("Permission denied")
      : notificationsEnabled ? t("Disable alerts") : t("Enable alerts");

  return (
    <section className="live-alerts-shell">
      <aside className="alerts-sidebar">
        <div className="alerts-kicker"><span className={monitoring ? "alerts-pulse" : ""} />{t(monitoring ? "LIVE USGS FEED" : "PAUSED")}</div>
        <h1>{t("Real-time earthquake alerts")}</h1>
        <p className="alerts-intro">{t("Monitor recent earthquakes from the U.S. Geological Survey and receive optional browser notifications for new events that match your threshold.")}</p>

        <div className="alerts-settings-heading">
          <span>{t("Alert settings")}</span>
          <small>{t("Updates every minute")}</small>
        </div>

        <label className="alerts-field">
          <span><ParameterLabel label={t("Minimum magnitude")} description={t("Only earthquakes at or above this magnitude appear in the list and trigger new-event notifications.")} /><strong>M {minimumMagnitude.toFixed(1)}+</strong></span>
          <input
            type="range"
            min="0"
            max="8"
            step="0.5"
            value={minimumMagnitude}
            onChange={(event) => {
              const value = Number(event.target.value);
              minimumMagnitudeRef.current = value;
              setMinimumMagnitude(value);
            }}
            aria-label={t("Minimum magnitude")}
            style={{ "--range-progress": `${(minimumMagnitude / 8) * 100}%` } as React.CSSProperties}
          />
          <small><span>0</span><span>8+</span></small>
        </label>

        <label className="alerts-field alerts-select-field">
          <span><ParameterLabel label={t("Time window")} description={t("Choose how far back the USGS feed should look for recent earthquakes.")} /></span>
          <select value={feedWindow} onChange={(event) => setFeedWindow(event.target.value as FeedWindow)}>
            {(Object.keys(WINDOW_LABELS) as FeedWindow[]).map((value) => <option key={value} value={value}>{t(WINDOW_LABELS[value])}</option>)}
          </select>
        </label>

        <div className="alerts-notification-control">
          <div><ParameterLabel label={t("Browser notifications")} description={t("Opt in to desktop or mobile browser notifications for new matching events while this app remains open.")} /><small>{t("Browser alerts work while this page remains open.")}</small></div>
          <button type="button" onClick={toggleNotifications} disabled={notificationPermission === "denied" || notificationPermission === "unsupported"} className={notificationsEnabled ? "active" : ""}>{notificationLabel}</button>
        </div>

        <div className="alerts-actions">
          <button type="button" onClick={() => setMonitoring((value) => !value)}>{t(monitoring ? "Pause monitoring" : "Resume monitoring")}</button>
          <button type="button" className="primary" onClick={() => void refresh()} disabled={loading}>{t(loading ? "Refreshing..." : "Refresh now")}</button>
        </div>

        <div className="alerts-source-note">
          <strong>{t("Educational monitor")}</strong>
          <p>{t("USGS data is preliminary and may be revised. This monitor is educational and is not an emergency warning service.")}</p>
          <a href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php" target="_blank" rel="noreferrer">{t("Data source: U.S. Geological Survey")} ↗</a>
        </div>
      </aside>

      <div className="alerts-main">
        <header className="alerts-title-row">
          <div><span className="eyebrow">{t("USGS LIVE MONITOR")}</span><h2>{t("Recent earthquakes")}</h2></div>
          <div className="alerts-sync"><span>{t("Last synchronized")}</span><strong>{lastSynchronized ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(lastSynchronized) : t("Awaiting first update")}</strong></div>
        </header>

        <div className="alerts-summary" aria-label={t("Earthquake feed summary")}>
          <div><span>{t("Matching events")}</span><strong>{filteredEvents.length}</strong></div>
          <div><span>{t("Largest event")}</span><strong>{largest ? `M ${largest.toFixed(1)}` : "—"}</strong></div>
          <div><span>{t("Tsunami flags")}</span><strong>{tsunamiCount}</strong></div>
          <div><span>{t("Reviewed")}</span><strong>{reviewedCount}</strong></div>
        </div>

        <WorldEarthquakeMap events={filteredEvents} selectedEvent={selectedMapEvent} onSelect={setSelectedMapEventId} t={t} locale={locale} />

        <div className="alerts-list-heading"><div><span>{t("Newest first")}</span><i />{t(monitoring ? "Monitoring active" : "Monitoring paused")}</div><small>{t(WINDOW_LABELS[feedWindow])} · M {minimumMagnitude.toFixed(1)}+</small></div>

        {error && <div className="alerts-state alerts-error" role="alert"><strong>{error}</strong><button type="button" onClick={() => void refresh()}>{t("Try again")}</button></div>}
        {!error && loading && events.length === 0 && <div className="alerts-state"><span className="alerts-loader" /><strong>{t("Connecting to the USGS feed...")}</strong></div>}
        {!error && !loading && filteredEvents.length === 0 && <div className="alerts-state"><strong>{t("No earthquakes match these filters.")}</strong><p>{t("Lower the minimum magnitude or select a wider time window.")}</p></div>}

        {!error && filteredEvents.length > 0 && (
          <div className="alerts-event-list">
            {filteredEvents.slice(0, 100).map((event) => {
              const magnitude = event.properties.mag ?? 0;
              const [longitude, latitude, depth] = event.geometry.coordinates;
              return (
                <article className={`alert-event-card tone-${magnitudeTone(magnitude)}${newEventIds.has(event.id) ? " is-new" : ""}`} key={event.id}>
                  <div className="event-magnitude"><span>M</span><strong>{magnitude.toFixed(1)}</strong></div>
                  <div className="event-details">
                    <div className="event-card-topline">
                      <time title={new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "long" }).format(event.properties.time)}>{relativeTime(event.properties.time, locale)}</time>
                      {newEventIds.has(event.id) && <span className="event-new-badge">{t("New")}</span>}
                      {event.properties.alert && <span className={`event-alert-badge ${event.properties.alert}`}>{t("USGS alert")} · {event.properties.alert.toUpperCase()}</span>}
                      {event.properties.tsunami === 1 && <span className="event-tsunami-badge">{t("Tsunami flag")}</span>}
                    </div>
                    <h3>{event.properties.place ?? t("Location unavailable")}</h3>
                    <div className="event-meta">
                      <span><b>{t("Depth")}</b>{depth.toFixed(1)} km</span>
                      <span><b>{t("Coordinates")}</b>{latitude.toFixed(2)}, {longitude.toFixed(2)}</span>
                      <span><b>{t("Felt reports")}</b>{event.properties.felt ?? 0}</span>
                      <span><b>{t("Status")}</b>{t(event.properties.status === "reviewed" ? "Reviewed" : "Automatic")}</span>
                    </div>
                  </div>
                  <a className="event-link" href={event.properties.url} target="_blank" rel="noreferrer" aria-label={`${t("Details on USGS")}: ${event.properties.place ?? ""}`}>↗</a>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
