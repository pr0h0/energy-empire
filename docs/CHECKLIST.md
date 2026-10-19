# Implementation checklist (persistent across context compaction)

Status legend: [ ] todo, [~] partial, [x] done+tested

## Foundation
- [x] Docker dev env (Dockerfile.dev, dev.sh)
- [x] Vite/React/TS/Tailwind/Zustand/Vitest/Playwright config
- [x] Engine core: state, clock, scheduler, commands, events
- [x] Persistence: IndexedDB, backups, export/import, migrations, validation

## Simulation systems
- [x] Weather (solar/wind/hydro/tidal deterministic)
- [x] Demand (categories, contracts, development)
- [x] Generation (solar, wind, hydro ror, dam, tidal, thermal, CSP, geothermal, nuclear, fusion, orbital, stellar, dyson, pulsar, penrose, quasar, vacuum)
- [x] Electricity dispatch + storage + grid import/export + curtailment, energy balance invariant
- [x] Finance (revenue/expense breakdown, map + company)
- [x] Maintenance (wear, aging, repair queue, priority, thresholds, preventive)
- [x] Fuel + logistics (depot, tanks, timed deliveries, auto purchase, contracts, self-production)
- [x] Employees (groups/tiers/training, infra buildings)
- [x] Research (global pool, allocation, prereqs, milestones)
- [x] Market (fixed, feed-in, spot, PPAs, traders, arbitrage)
- [x] Thermal (heat, conversion, cooling, throttling, advanced targets)
- [x] Prestige (high-water mark, shop, reset)
- [x] Progression (stage unlocks) + achievements + endgame win
- [x] Offline simulation + summary
- [x] Blueprints

## World
- [x] 9 stage maps, terrain generators, rivers, elevation
- [x] Land purchase (adjacency, terrain gating, bulk)
- [x] Placement (footprint, rotation, terrain, occupancy, ownership, tech), demolition, salvage
- [x] Aggregation (units by area/spacing/density)
- [x] Dam flooding preview + cascade

## UI
- [x] Layout: top bar, stage nav, map canvas, catalog, inspector
- [x] Screens: research, workforce, operations, automation, fuel, market, thermal, finances, statistics, progression, blueprints, prestige, achievements, settings, event history
- [x] SVG assets for all buildings and terrains
- [x] Camera: zoom/pan/fit/center/reset; overlays; tooltips; legend
- [x] Fullscreen, responsive, accessibility, settings toggles

## Tests
- [x] Unit tests
- [x] Integration workflow test
- [x] Full progression bot Backyard→Universe
- [x] Offline/online consistency
- [x] Exploit tests
- [x] Playwright e2e + screenshots at resolutions
- [x] Performance benchmark

## Delivery
- [x] README, ARCHITECTURE.md, BALANCE.md, TEST_REPORT.md
- [x] Production container + cloudflared tunnel game-energy.pr0h0.me

## Notes (keep updated)
- Balance validated by tests/balance/AutoPlayer.ts (greedy legal bot). Scratch runners in tests/scratch (excluded from tsc/lint).
- Engine perf: ~2.3–4 ms/tick for 600+ installations; offline uses coarse steps (0.5/1/2 h) and async chunking.
- TypeScript pinned to 6.x because typescript-eslint does not support TS 7.
