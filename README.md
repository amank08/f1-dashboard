# Undercut — F1 Dashboard

A real-time Formula 1 data dashboard built with Next.js. Analyze sessions, compare drivers, replay races, and explore detailed timing data powered by the OpenF1 API.

## Features

- **Live Timing** — Real-time position updates, intervals, gaps, sector times, and tire tracking
- **Session Replay** — Interactive replay with car positions on track, playback speed controls, and lap navigation
- **Race Results** — Comprehensive results tables with grid vs finish, pit stops, and sector breakdowns
- **Lap Analysis** — Lap time charts, position changes, gap-to-leader progression for up to 4 drivers
- **Pit Strategy** — Tire strategy visualization with stint merging and degradation analysis
- **Telemetry** — Speed, throttle, brake, RPM, gear, and DRS data per driver
- **Weather** — Temperature, humidity, and rainfall tracking throughout sessions
- **Team Radio** — Audio archive with playback for all team radio messages
- **Race Control** — Flags, penalties, incidents, and safety car messages
- **26 Circuits** — SVG track maps with sector divisions and DRS zones
- **PWA Support** — Installable as a standalone app on mobile and desktop

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org) 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts
- **Data Fetching:** SWR with in-memory and disk caching
- **Data Source:** [OpenF1 API](https://openf1.org)
- **Icons:** Lucide React

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
git clone https://github.com/amank08/f1-dashboard.git
cd f1-dashboard
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

## Project Structure

```
src/
  app/                  # Next.js App Router pages
    live/               # Live session analysis + replay
    race/[sessionKey]/  # Session-specific pages (laps, pitstops, radio, telemetry, weather)
    api/f1/             # OpenF1 API proxy with caching
  components/
    charts/             # Recharts visualizations (11 chart types)
    cards/              # Race, stat, and team radio cards
    live/               # Timing board, circuit map, replay, podium
    tables/             # Results table with sector times
    selectors/          # Driver, season, and comparison selectors
    ui/                 # Shared UI components (badge, skeleton, tabs)
  lib/
    data/               # Static circuit paths, DRS zones, tire allocations
    hooks/              # SWR data-fetching hooks for each OpenF1 endpoint
    openf1/             # API client, caching, rate limiting, types
    utils/              # Formatters, colors, analytics, replay processing
```

## Docker

```bash
docker compose up --build
```

This builds a multi-stage production image and runs the app at [http://localhost:3000](http://localhost:3000).

## Deployment

The project is configured for [Vercel](https://vercel.com). Connect your GitHub repo at [vercel.com/new](https://vercel.com/new) to get:

- Automatic production deploys on push to `main`
- Preview deploys on every pull request
- Edge caching for API routes

## Testing

Tests use [Vitest](https://vitest.dev) with React Testing Library. Run the suite with:

```bash
npm test
```

## CI/CD

GitHub Actions runs lint, test, and build on every push and pull request. [CodeRabbit](https://coderabbit.ai) provides automated code reviews on PRs.

## License

MIT
