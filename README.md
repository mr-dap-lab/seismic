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
- Regional city/area simulation with Google Maps and OpenStreetMap fallback
- Responsive help center and guided walkthrough

## Optional environment variable

Copy `.env.example` to `.env.local` and add a restricted Google Maps browser key to use Google Maps. Without it, the Regional Map uses OpenStreetMap.

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_restricted_key
```

## Deployment

The repository is ready for Vercel. See `PUBLISHING_GUIDE.md` for the complete Git, Google Maps, Vercel, and live smoke-test steps.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: create the Vercel-compatible production build
- `npm test`: build and verify the production application wiring
- `npm run lint`: run the Next.js lint rules

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
