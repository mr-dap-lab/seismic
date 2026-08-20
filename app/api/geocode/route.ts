import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ error: "A place name is required." }, { status: 400 });

  const params = new URLSearchParams({ q: query.slice(0, 160), format: "jsonv2", addressdetails: "1", limit: "5" });
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "Accept-Language": request.headers.get("accept-language") ?? "en",
        "User-Agent": "SEISMIC-Educational-App/1.0 (https://www.sismica.pro/)",
      },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return NextResponse.json({ error: "Place search is temporarily unavailable." }, { status: 502 });
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ error: "Place search is temporarily unavailable." }, { status: 503 });
  }
}
