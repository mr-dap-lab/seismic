# SEISMIC Earthquake Simulator

SEISMIC is an educational earthquake-awareness and preparedness web application. It combines live earthquake data, regional impact exploration, probabilistic rate forecasting, structural-response visualization, and household emergency planning in one accessible interface.

## Live application

Visit **[https://www.sismica.pro/](https://www.sismica.pro/)**.

The live site is informational and educational. It is not an emergency-warning service, an engineering analysis package, or a method for predicting the exact time, location, or magnitude of a future earthquake.

## Main areas

The application tabs are ordered as follows:

1. **Live Alerts** — monitors recent worldwide earthquakes from the USGS FDSN event service, with configurable time windows up to 72 hours, magnitude filters, a world map, event metadata, tsunami flags, refresh controls, and accessible text status messages.
2. **Regional Map** — uses OpenStreetMap and MapLibre to explore a selected area in 2D. Users can use browser geolocation, search for a city or place, set an epicenter, and display dynamic highest/moderate/lower impact rings based on magnitude, focal depth, analysis radius, and representative site class. A PDF report includes the current map, rings, inputs, results, attribution, and disclaimer.
3. **Forecast Lab** — presents a probabilistic, catalog-based rate forecast over a configurable target magnitude and forecast horizon. It uses USGS catalog data and displays regional forecast points with metadata. Experimental stress, tidal, and Earth rotation/revolution diagnostics are implemented in the model but their controls are intentionally hidden until they are ready for release.
4. **Structure Lab** — visualizes simplified ground-motion response in Three.js. Configure magnitude, intensity, amplitude, frequency, floors, structure type, site class, damping, response modification, importance, and other design parameters. Available structures include houses, garages, sheds, skyscrapers, warehouses, malls, bridges, towers, tunnels, parking garages, parking structures, and occupied multi-story car parks. The lab supports zoom, playback, damage indicators, responsive re-rendering, and downloadable PDF reports.
5. **Emergency Kit** — provides a category-by-category household emergency-kit checklist, configurable household size and planning days, progress tracking saved on the device, water-planning guidance, and preparedness resources.

## Calculations and model outputs

The Structure Lab exposes configurable educational calculations including:

- Modified Mercalli Intensity (MMI), with legends explaining the meaning of each intensity level.
- Peak Ground Acceleration (PGA) and spectral acceleration.
- Site class from A through F and site amplification.
- Fundamental period (T), damping ratio (ζ), and drift limits (Δ).
- Response Modification Coefficient (R), importance factor, material/reliability coefficients, and related design indicators.
- Simplified damage and drift visualizations that respond to the selected motion and structure parameters.

The Forecast Lab also documents important scientific limitations: remote dynamic stress and gravity/tidal proxies have no demonstrated prospective global predictive skill, and Earth rotation/revolution are treated as diagnostics rather than proven predictors.

## Languages and accessibility

English is the default language. The interface supports Spanish, French, Cantonese, Hindi, Arabic, Portuguese, Russian, Japanese, Italian, and German. Arabic uses right-to-left layout where appropriate. Translated controls, tooltips, dropdown values, help content, disclaimers, emergency-kit content, and PDF report text follow the selected language.

Accessibility features include a skip link, keyboard navigation, descriptive labels, live status messages, screen-reader-friendly map/event content, larger text, enhanced contrast, reduced motion, responsive layouts, and text-based alerts/results so audio is not required. The application is designed to support users with hearing, vision, and mobility needs, but should still be evaluated against the accessibility requirements of each deployment context.

## Data sources and attribution

- Earthquake events: [USGS FDSN Event Web Service](https://earthquake.usgs.gov/fdsnws/event/1/)
- Mapping and geocoding: [OpenStreetMap](https://www.openstreetmap.org/), [Nominatim](https://nominatim.org/), and [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- 3D visualization: [Three.js](https://threejs.org/)
- PDF generation: `jspdf` and `jspdf-autotable`

USGS catalog records are preliminary and may be revised. OpenStreetMap data must retain the required contributor attribution. Neither USGS nor OpenStreetMap endorses this application.

## Run locally

### Prerequisites

- Node.js `>=22.13.0`
- npm

### Install and start

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js, normally [http://localhost:3000](http://localhost:3000).

### Production build

```bash
npm run build
npm start
```

## Development commands

- `npm run dev` — start the Next.js development server.
- `npm run build` — create the production build used by Vercel.
- `npm start` — serve the production build locally.
- `npm test` — build the app and run rendered-HTML regression tests.
- `npm run lint` — run ESLint checks.

## Deployment

The project is configured as a standard Next.js application for Vercel and does not require a map API key. See [PUBLISHING_GUIDE.md](./PUBLISHING_GUIDE.md) for GitHub, Vercel, smoke-test, and release instructions.

Typical release workflow:

```bash
npm test
npm run lint
git add .
git commit -m "Describe the update"
git push origin main
```

When the GitHub repository is connected to Vercel, pushes to `main` create production deployments and other branches create preview deployments.

## Safety and professional-use disclaimer

SEISMIC is a simplified educational model. It does not replace a site investigation, building-code review, structural analysis, inspection, emergency-management guidance, or the expertise of a licensed engineer or other qualified professional. Do not use its simulations, forecasts, maps, alerts, or generated reports to make life-safety, evacuation, construction, insurance, investment, or emergency decisions. The project and its contributors assume no liability for decisions made from the application or its reports.

The Help Center includes the full methodology and disclaimer in every supported language. Generated Structure Lab and Regional Map PDFs include the selected language and the professional-use disclaimer.

## Project structure

```text
app/
  api/forecast-catalog/       USGS catalog proxy
  components/                 Live Alerts, Regional Map, Forecast Lab, Structure Lab, Emergency Kit, help
  lib/                        translations, disclaimer content, PDF utilities
  page.tsx                    application shell and navigation
  globals.css                 responsive and accessibility styles
tests/                        rendered-HTML regression tests
zpredictorfiles/              research foundation and methodology notes
```

## License and contributions

This repository is maintained for public education and earthquake awareness. Review the repository's Git history and project policy before redistributing, embedding, or using the software in a professional workflow.
