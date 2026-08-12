# SEISMIC Earthquake Simulator

An interactive Three.js structural response lab with configurable ground motion, multiple structural systems, PDF analysis reports, and a regional earthquake-impact map.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

## Features

- Configurable structural and earthquake-response simulation
- MMI, PGA, spectral acceleration, period, drift, and design coefficients
- Houses, garages, skyscrapers, bridges, tunnels, parking structures, and more
- Downloadable PDF report with professional-use disclaimer
- Keyless OpenStreetMap regional simulation with a lightweight local MapLibre style, direct OpenFreeMap vector tiles, and 3D buildings
- Responsive help center and guided walkthrough

## Deployment

The repository is ready for Vercel and requires no map API keys. See `PUBLISHING_GUIDE.md` for the complete Git, Vercel, and live smoke-test steps.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: create the Vercel-compatible production build
- `npm test`: build and verify the production application wiring
- `npm run lint`: run the Next.js lint rules

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs)
- [OpenFreeMap](https://openfreemap.org)
