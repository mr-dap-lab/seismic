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
  assert.match(page, /Interactive 3D/);
  assert.match(page, /Download PDF report/);
  assert.match(page, /Professional-use disclaimer/);
  assert.match(page, /RegionalSimulator/);
});

test("wires PDF, regional mapping, and Vercel configuration", async () => {
  const [page, regional, pdf, css, packageJson, vercel, envExample] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/RegionalSimulator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/pdf-report.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(page, /createSeismicPdf/);
  assert.match(page, /Regional map/);
  assert.match(pdf, /jspdf-autotable/);
  assert.match(pdf, /IMPORTANT PROFESSIONAL-USE DISCLAIMER/);
  assert.match(regional, /@googlemaps\/js-api-loader/);
  assert.match(regional, /OpenStreetMap fallback/);
  assert.match(regional, /Click anywhere on the map/);
  assert.match(css, /\.regional-shell\s*\{/);
  assert.match(packageJson, /"jspdf"/);
  assert.match(packageJson, /"leaflet"/);
  assert.match(vercel, /"framework": "nextjs"/);
  assert.match(envExample, /NEXT_PUBLIC_GOOGLE_MAPS_API_KEY/);
});
