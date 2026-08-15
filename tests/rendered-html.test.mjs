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

test("wires PDF, geolocated regional mapping, live USGS alerts, parameter help, and Vercel configuration", async () => {
  const [page, regional, liveAlerts, tooltip, i18n, pdf, css, packageJson, vercel] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/RegionalSimulator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LiveAlerts.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ParameterTooltip.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/i18n.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/pdf-report.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /createSeismicPdf/);
  assert.match(page, /Regional map/);
  assert.match(page, /SITE_CLASSES\[config\.siteClass\]\.amplification/);
  assert.match(page, /LocalizationRuntime/);
  assert.match(page, /className="language-switcher"/);
  assert.match(page, /setLanguage\(nextLanguage\)/);
  assert.doesNotMatch(page, /window\.location\.reload/);
  assert.match(page, /RegionalSimulator language=\{language\}/);
  assert.match(page, /LiveAlerts language=\{language\}/);
  assert.match(page, /appMode === "alerts"/);
  assert.match(page, /useState<"structure" \| "regional" \| "alerts">\("alerts"\)/);
  assert.match(page, /Live alerts/);
  assert.ok(page.indexOf(">Live alerts</button>") < page.indexOf(">Regional map</button>"));
  assert.ok(page.indexOf(">Regional map</button>") < page.indexOf(">Structure lab</button>"));
  assert.match(i18n, /"en" \| "es" \| "fr" \| "yue" \| "hi" \| "ar"/);
  assert.match(i18n, /Español/);
  assert.match(i18n, /Français/);
  assert.match(i18n, /廣東話/);
  assert.match(i18n, /हिन्दी/);
  assert.match(i18n, /العربية/);
  assert.match(i18n, /language === "ar" \? "rtl" : "ltr"/);
  assert.match(pdf, /jspdf-autotable/);
  assert.match(pdf, /IMPORTANT PROFESSIONAL-USE DISCLAIMER/);
  assert.match(pdf, /createRegionalPdf/);
  assert.match(pdf, /enableUnicodeText/);
  assert.match(pdf, /t\("STRUCTURAL RESPONSE REPORT"\)/);
  assert.match(pdf, /LANGUAGE_LOCALES/);
  assert.match(pdf, /Map data © OpenStreetMap contributors/);
  assert.match(regional, /maplibre-gl/);
  assert.match(regional, /translateText, type Language/);
  assert.match(regional, /const MAP_STYLE: StyleSpecification/);
  assert.match(regional, /tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(regional, /"raster-fade-duration": 0/);
  assert.match(regional, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(regional, /nominatim\.openstreetmap\.org\/search/);
  assert.match(regional, /function impactRadii/);
  assert.match(regional, /function updateImpactLayers/);
  assert.match(regional, /captureImpactMap\(map, impactOverlayRef\.current\)/);
  assert.match(regional, /createRegionalPdf/);
  assert.doesNotMatch(regional, /3D|fill-extrusion|OpenFreeMap|openfreemap|preloader/);
  assert.match(regional, /placingEpicenterRef/);
  assert.match(regional, /userSelectedLocationRef/);
  assert.match(regional, /updateImpactLayers\(map, selectedCenter, radiiRef\.current\)/);
  assert.match(regional, /Set epicenter/);
  assert.match(regional, /className="report-button has-tooltip tooltip-top"/);
  assert.ok(regional.indexOf("Set epicenter") < regional.indexOf("Find a city or place"));
  assert.ok(regional.indexOf("Find a city or place") < regional.indexOf("Latitude"));
  assert.ok(regional.indexOf("Representative site class") < regional.indexOf("Latitude"));
  assert.match(regional, /\{t\("Class"\)\} \{site\} — \{t\(SITE_CLASS_NAMES\[site\]\)\}/);
  assert.match(regional, /resetRegional/);
  assert.match(regional, /fillOpacity="0\.18"/);
  assert.match(regional, /IMPACT_ZONES\.forEach/);
  assert.match(regional, /updateImpactLayers\(map, center, radii\)/);
  assert.match(regional, /projectImpactGeometry/);
  assert.match(regional, /regional-impact-overlay/);
  assert.match(regional, /map\.triggerRepaint\(\)/);
  assert.match(liveAlerts, /earthquake\.usgs\.gov\/earthquakes\/feed\/v1\.0\/summary\/all_day\.geojson/);
  assert.match(liveAlerts, /earthquake\.usgs\.gov\/fdsnws\/event\/1\/query/);
  assert.match(liveAlerts, /"48hours": "Past 48 hours"/);
  assert.match(liveAlerts, /"72hours": "Past 72 hours"/);
  assert.match(liveAlerts, /const WORLD_ZOOM = 1\.45/);
  assert.match(liveAlerts, /zoom: WORLD_ZOOM/);
  assert.match(liveAlerts, /setProjection\(\{ type: "globe" \}\)/);
  assert.match(liveAlerts, /window\.setInterval\(\(\) => void refresh\(\), 60_000\)/);
  assert.match(liveAlerts, /Notification\.requestPermission\(\)/);
  assert.match(liveAlerts, /new Notification/);
  assert.match(liveAlerts, /seenIdsRef/);
  assert.match(liveAlerts, /cache: "no-store"/);
  assert.match(liveAlerts, /USGS data is preliminary and may be revised/);
  assert.match(liveAlerts, /Data source: U\.S\. Geological Survey/);
  assert.match(liveAlerts, /from "maplibre-gl"/);
  assert.match(liveAlerts, /const WORLD_MAP_STYLE: StyleSpecification/);
  assert.match(liveAlerts, /tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(liveAlerts, /function earthquakePoints/);
  assert.match(liveAlerts, /id: "live-earthquake-points"/);
  assert.match(liveAlerts, /new Marker/);
  assert.match(liveAlerts, /alerts-earthquake-marker/);
  assert.match(liveAlerts, /WorldEarthquakeMap events=\{filteredEvents\}/);
  assert.match(liveAlerts, /Worldwide earthquake map/);
  assert.match(tooltip, /role="tooltip"/);
  assert.match(tooltip, /aria-describedby/);
  assert.match(css, /\.parameter-tooltip-bubble/);
  assert.match(css, /\.regional-search/);
  assert.match(css, /\.regional-map\.placing-epicenter \.maplibregl-canvas \{ cursor: crosshair/);
  assert.match(css, /\.epicenter-tool/);
  assert.match(css, /\.impact-ring-high/);
  assert.match(css, /\.report-button/);
  assert.match(css, /\.language-switcher/);
  assert.match(css, /min-width: 148px/);
  assert.match(css, /\.mode-nav \{ position: absolute/);
  assert.match(css, /\.live-alerts-shell/);
  assert.match(css, /\.alerts-event-list/);
  assert.match(css, /\.alerts-world-map-section/);
  assert.match(css, /\.alerts-world-map-stage/);
  assert.match(css, /\.alerts-world-map\.maplibregl-map\s*\{[^}]*position:\s*absolute;[^}]*height:\s*100%/s);
  assert.match(css, /\.alerts-earthquake-marker/);
  assert.match(css, /\.alerts-map-selection/);
  assert.match(css, /\.mode-nav button \{ flex: 1; min-width: 0/);
  assert.match(css, /\.select-control select, \.regional-field select \{ min-height: 44px; font-size: 14px/);
  assert.match(css, /html\[dir="rtl"\]/);
  assert.doesNotMatch(css, /\.regional-report/);
  assert.match(css, /\.regional-shell\s*\{/);
  assert.match(packageJson, /"jspdf"/);
  assert.match(packageJson, /"maplibre-gl"/);
  assert.doesNotMatch(packageJson, /googlemaps|leaflet/);
  assert.match(vercel, /"framework": "nextjs"/);
});
