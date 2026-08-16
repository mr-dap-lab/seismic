import { NextResponse } from "next/server";

type UsgsFeature = {
  id: string;
  properties: { mag: number | null; place: string | null; time: number };
  geometry: { coordinates: [number, number, number] };
};

type UsgsPayload = {
  metadata?: { generated?: number; count?: number };
  features?: UsgsFeature[];
};

const FDSN_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query";
const FALLBACK_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson";

function normalize(payload: UsgsPayload) {
  return (payload.features ?? []).flatMap((feature) => {
    const magnitude = feature.properties.mag;
    const [longitude, latitude, depth] = feature.geometry?.coordinates ?? [];
    if (!Number.isFinite(magnitude) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{
      id: feature.id,
      magnitude: magnitude as number,
      place: feature.properties.place ?? "Unlabelled region",
      time: feature.properties.time,
      latitude,
      longitude,
      depth: Number.isFinite(depth) ? depth : 0,
    }];
  });
}

export async function GET() {
  const end = new Date();
  const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
  const query = new URLSearchParams({
    format: "geojson",
    orderby: "time-asc",
    starttime: start.toISOString(),
    endtime: end.toISOString(),
    minmagnitude: "5",
    eventtype: "earthquake",
    limit: "20000",
  });

  try {
    const response = await fetch(`${FDSN_URL}?${query}`, {
      headers: { "User-Agent": "SEISMIC-Education-Forecast-Lab/1.0" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`USGS FDSN returned ${response.status}`);
    const payload = await response.json() as UsgsPayload;
    const events = normalize(payload);
    return NextResponse.json({
      events,
      generated: payload.metadata?.generated ?? Date.now(),
      sourceWindowDays: 365,
      minimumCatalogMagnitude: 5,
      fallback: false,
    }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch {
    const response = await fetch(FALLBACK_URL, {
      headers: { "User-Agent": "SEISMIC-Education-Forecast-Lab/1.0" },
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return NextResponse.json({ error: "USGS catalog is temporarily unavailable." }, { status: 503 });
    const payload = await response.json() as UsgsPayload;
    return NextResponse.json({
      events: normalize(payload),
      generated: payload.metadata?.generated ?? Date.now(),
      sourceWindowDays: 30,
      minimumCatalogMagnitude: 4.5,
      fallback: true,
    }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  }
}
