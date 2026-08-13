import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the production-ready SEISMIC application", async () => {
  await access(new URL("../.next/BUILD_ID", import.meta.url));
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /SEISMIC/);
  assert.match(layout, /<body suppressHydrationWarning>/);
  assert.match(page, /Interactive 3D/);
  assert.match(page, /Download PDF report/);
  assert.match(page, /Professional-use disclaimer/);
  assert.match(page, /RegionalSimulator/);
});

test("wires PDF, geolocated regional mapping, parameter help, and Vercel configuration", async () => {
  const [page, regional, tooltip, pdf, css, packageJson, vercel] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/RegionalSimulator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ParameterTooltip.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/pdf-report.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /createSeismicPdf/);
  assert.match(page, /Regional map/);
  assert.match(pdf, /jspdf-autotable/);
  assert.match(pdf, /IMPORTANT PROFESSIONAL-USE DISCLAIMER/);
  assert.match(pdf, /createRegionalPdf/);
  assert.match(pdf, /Map data © OpenStreetMap contributors/);
  assert.match(regional, /maplibre-gl/);
  assert.match(regional, /const MAP_STYLE: StyleSpecification/);
  assert.match(regional, /tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(regional, /"raster-fade-duration": 0/);
  assert.match(regional, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(regional, /nominatim\.openstreetmap\.org\/search/);
  assert.match(regional, /function impactRadii/);
  assert.match(regional, /setData\(zoneData\(center, radii\)\)/);
  assert.match(regional, /map\.getCanvas\(\)\.toDataURL/);
  assert.match(regional, /createRegionalPdf/);
  assert.doesNotMatch(regional, /3D|fill-extrusion|OpenFreeMap|openfreemap|preloader/);
  assert.match(regional, /Click anywhere on the map/);
  assert.match(tooltip, /role="tooltip"/);
  assert.match(tooltip, /aria-describedby/);
  assert.match(css, /\.parameter-tooltip-bubble/);
  assert.match(css, /\.regional-search/);
  assert.match(css, /\.regional-report/);
  assert.match(css, /\.regional-shell\s*\{/);
  assert.match(packageJson, /"jspdf"/);
  assert.match(packageJson, /"maplibre-gl"/);
  assert.doesNotMatch(packageJson, /googlemaps|leaflet/);
  assert.match(vercel, /"framework": "nextjs"/);
});
