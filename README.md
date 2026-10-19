# Energy Empire

A browser-based incremental energy tycoon. Start with one rooftop panel in your Backyard and grow through
Neighborhood, City, Country, Continent, Planet, Solar System and Galaxy to the Universe, where you build the
Convergence Engine to win. Single-player, works offline, saves to IndexedDB, no accounts, no monetisation.

**Live:** https://game-energy.pr0h0.me

## Features

* 9 maps, 82 buildings, real dispatch (renewables, storage, thermal, nuclear, fusion, space and exotic sources),
  grid import/export tiers, curtailment, and an energy-balance invariant checked every tick.
* Fuel logistics, maintenance crews and repair queues, staff and training, spot markets, PPAs, fuel contracts.
* Research tree with 102 projects laid out per map, plus repeatable (∞) research for idle RP.
* Weather events, a 48 h production forecast, a map weather layer, and business events that ask for decisions.
* Advisor hints, per-map goals, challenge runs, prestige shop, 48 achievements, blueprints, offline progress.
* Canvas renderer with animated terrain and buildings, styled tooltips, light/dark themes, keyboard controls.

## Quick start (Docker — nothing installed on the host)

```bash
./dev.sh bun install                     # dependencies into ./node_modules (inside the container)
PORT=5173 ./dev.sh bun run dev --host    # dev server → http://localhost:5173
```

`dev.sh` builds the `energy-empire-dev` image (Playwright + Chromium + Bun) on first use and runs any command
inside it as your user. Without Docker: install Bun ≥ 1.4, then `bun install && bun run dev`.

## Commands

| Command | What it does |
| --- | --- |
| `./dev.sh bun run dev --host` | Vite dev server (set `PORT=5173`) |
| `./dev.sh bun run typecheck` | `tsc -b` (strict) |
| `./dev.sh bun run lint` | ESLint |
| `./dev.sh npx vitest run` | all Vitest suites: unit, integration, balance bot, performance |
| `./dev.sh bunx playwright test` | browser tests (builds and previews automatically) |
| `./dev.sh bun run build` | production build into `dist/` |

## Production

```bash
./dev.sh bun run build
docker compose -f docker-compose.prod.yml up -d    # nginx serving dist/ on 127.0.0.1:3700
```

Published through a Cloudflare tunnel — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Project layout

```
src/engine     deterministic simulation (no React): core, systems, world, data, persistence, math
src/rendering  canvas map renderer, SVG art and animation frames
src/app        React UI: layouts, screens, panels, components, zustand stores
tests          unit · integration · balance bot · performance · Playwright browser tests
deploy         nginx and cloudflared configs
docs           design and reference documents
```

## Documentation

| Document | Contents |
| --- | --- |
| [docs/GAMEPLAY.md](docs/GAMEPLAY.md) | how to play: maps, building, grid, planning tools, events, research, prestige, controls |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | environment, checks, test layout, adding content, conventions |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | engine design, dispatch, aggregation, saves, performance |
| [docs/BALANCE.md](docs/BALANCE.md) | cost model, pacing, tuning knobs |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | build, nginx, Cloudflare tunnel |
| [docs/PLAN.md](docs/PLAN.md) | original design brief |
| [docs/CHECKLIST.md](docs/CHECKLIST.md) · [docs/TEST_REPORT.md](docs/TEST_REPORT.md) | implementation status and the 1.0 test report |
