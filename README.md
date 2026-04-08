# Undercut — F1 Dashboard

An F1 data dashboard for race results, session replays, standings, and timing analysis — powered by the [OpenF1 API](https://openf1.org) and built with Next.js.

## Features

- **Session Replay** — scrub through any race, qualifying, or practice session with a live track map, timing tower, race control feed, and qualifying knockout zones
- **Race Results** — lap times, sector splits, tyre compounds, pit stops, and grid vs finish for every session
- **Lap Analysis** — lap time charts, position changes, and gap-to-leader progression for up to 4 drivers
- **Pit Strategy** — tyre strategy visualization with stint tracking and degradation analysis
- **Telemetry** — speed, throttle, brake, gear, and DRS data per driver
- **Weather** — temperature, humidity, and rainfall throughout sessions
- **Team Radio** — audio archive with playback for all radio messages
- **Standings** — driver and constructor championship standings
- **Calendar** — full season schedule with past results and upcoming events
- **26 Circuits** — SVG track maps with sector divisions and DRS zones
- **PWA** — installable as a standalone app on mobile and desktop

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19
- TypeScript (strict)
- Tailwind CSS v4
- [OpenF1 API](https://openf1.org)
- SWR + disk cache for data fetching
- Recharts for charts
- Framer Motion for animations
- Deployed on [Vercel](https://vercel.com)

## Getting Started

```bash
git clone https://github.com/amank08/f1-dashboard.git
cd f1-dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run pipeline` | Run data pipeline scripts |

## Project Structure

```
src/
  app/                      # Next.js App Router pages
    api/f1/[...endpoint]/   # OpenF1 proxy with disk cache
    live/                   # Session replay + timing
    race/[sessionKey]/      # Per-session analysis (laps, pitstops, telemetry, radio, weather)
    standings/              # Championship standings
    calendar/               # Race calendar
  components/
    live/                   # Timing board, track map, replay controls, race control feed
    charts/                 # Recharts wrappers
    tables/                 # Results table
    ui/                     # Shared primitives (Button, Skeleton, TyreIcon, etc.)
  lib/
    f1/                     # Replay snapshot builder, circuit paths, constants
    hooks/                  # SWR data hooks
    openf1/                 # API client + TypeScript types
    utils/                  # Formatters, colors, analytics, replay processor
```

## Data

All F1 data comes from the [OpenF1 API](https://openf1.org). Requests are proxied through `/api/f1/[...endpoint]` and cached to disk at `.cache/openf1/`.

> OpenF1 restricts free API access during live sessions. Data becomes available once the session ends.

## Deployment

Auto-deploys to [Vercel](https://vercel.com) on push to `main`. Every pull request gets a preview deployment.

## Contributing

Bug reports and feature requests welcome — use the [issue templates](.github/ISSUE_TEMPLATE).

## License

[MIT](LICENSE)
