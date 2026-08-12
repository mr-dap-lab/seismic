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

test("wires PDF, keyless 3D regional mapping, parameter help, and Vercel configuration", async () => {
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
  assert.match(regional, /maplibre-gl/);
  assert.match(regional, /tiles\.openfreemap\.org\/planet\/\d+_\d+_pt\/\{z\}\/\{x\}\/\{y\}\.pbf/);
  assert.match(regional, /fill-extrusion/);
  assert.match(regional, /const MAP_STYLE: StyleSpecification/);
  assert.match(regional, /source: "openmaptiles"/);
  assert.doesNotMatch(regional, /styles\/bright/);
  assert.match(regional, /3D district/);
  assert.match(regional, /useState\(false\)/);
  assert.match(regional, /regional-map-preloader/);
  assert.match(regional, /Preparing 3D/);
  assert.match(regional, /aria-pressed=/);
  assert.match(regional, /visibility", "none"/);
  assert.match(regional, /Click anywhere on the map/);
  assert.match(tooltip, /role="tooltip"/);
  assert.match(tooltip, /aria-describedby/);
  assert.match(css, /\.parameter-tooltip-bubble/);
  assert.match(css, /\.regional-shell\s*\{/);
  assert.match(packageJson, /"jspdf"/);
  assert.match(packageJson, /"maplibre-gl"/);
  assert.doesNotMatch(packageJson, /googlemaps|leaflet/);
  assert.match(vercel, /"framework": "nextjs"/);
});
