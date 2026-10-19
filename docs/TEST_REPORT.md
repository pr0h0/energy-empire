# Test report — Energy Empire 1.0

> Snapshot of the 1.0 release (2026-10-18). Current suite: 119 Vitest tests and 27 Playwright tests, all passing;
> run them with the commands in [DEVELOPMENT.md](DEVELOPMENT.md).

Environment: Docker image `energy-empire-dev` (Playwright 1.63 noble + Bun 1.4, headless Chromium, software
rendering). All commands run through `./dev.sh`. Date: 2026-10-18.

| Check | Command | Result |
| --- | --- | --- |
| Type-check | `bun run typecheck` (tsc 6, strict) | ✅ no errors |
| Lint | `bun run lint` | ✅ no errors |
| Production build | `bun run build` | ✅ (single 565 kB JS chunk, 173 kB gzip) |
| Vitest (unit, integration, balance, performance) | `bun run test` | ✅ 85 / 85 tests, 13 files |
| Playwright (real browser) | `bun run test:e2e` | ✅ 20 / 20 tests |
| Deployment | https://game-energy.pr0h0.me | ✅ HTTP 200, serves the current build |

## Automated tests (Vitest)

* **units / formatting / prestige maths** (`unit/math`): power×time integration, SI formatting incl. rounding
  edge cases, 4th-root prestige formula, log-space stability at 1e300, high-water mark, environment curves
  (day/night, wind power curve, demand means = 1, tidal period).
* **electricity** (`unit/electricity`): solar day/night, wind at night, no fuel → no output, fuel burnt ∝ output,
  **energy balance |sources − uses| < 1e-9 for 3 days on two maps**, import/export limits & curtailment, local
  demand first, storage efficiency/no free energy, charge-power limits, cycle aging vs repair vs cell replacement,
  shortage → unserved demand and reliability drop.
* **maintenance** (`unit/maintenance`): wear and critical shutdown, queue at 70 % threshold, manual repair cost,
  technicians repair automatically, priority aging prevents starvation, threshold resolution order, jobs for
  removed buildings dropped, preventive servicing.
* **fuel & logistics** (`unit/fuel`): timed deliveries, logistics slot limits, auto-refuel, no negative
  inventories, stopped plants burn nothing, refuel jobs cancelled on demolition with fuel returned, budgeted
  auto-purchase + automation pause, supply availability per scale, nuclear refuelling outage.
* **research** (`unit/research`): no cycles / every project reachable, all gated content references real
  research, all 18 branches present, cost → progress → unlock, allocation normalisation, paused projects get
  nothing, lock reasons, breakthrough milestones.
* **world** (`unit/world`): all 9 maps generate, rivers flow downhill, adjacency-only land, ocean/mountain gating,
  bounds/ownership/occupancy/terrain/money checks fail without charging, research-locked buildings, rotation,
  no double occupancy, aggregation by operating spacing, dam flood preview/flooding/eligibility/generation/
  un-flooding, salvage < cost and nuclear decommissioning cost.
* **prestige** (`unit/prestige`): typed confirmation, reset scope, preserved data, no double award, spending
  does not lower the high-water mark, bonuses (start money, technician, homestead, revenue) apply next run,
  expansion never requires prestige.
* **saves** (`unit/save`): full round-trip, checksum corruption detection, invalid import rejected, export →
  import identical, v1 → v3 migration, IndexedDB (fake-indexeddb) save/load with recovery from a corrupted
  primary via backup.
* **exploits** (`unit/exploits`): buy/demolish loops lose money, salvage caps, import > export everywhere,
  import-resale margin bounded, fuel→electricity ≤ thermal efficiency, repeated prestige, time-step
  independence (dt 2.5 min vs 30 min within 3 %), finite values at 1e40, invalid commands, overdraft safeguard.
* **integration** (`integration/workflow`): the 25-step workflow from the spec — first panel reduces imports,
  export connection, sales accrue (= prestige basis), land purchase, more generation, manual repair, technician
  auto-repair, research → battery, Neighborhood unlocked through real milestones, two maps simulate together,
  fuel purchase → timed delivery → thermal generation, City via milestones, prestige with correct points,
  shop purchase, +15 % revenue observed in the next run.
* **offline** (`integration/offline`): offline vs online over 14 game days agree within 3 % (production, sales,
  money; wages within 1 %); summary includes fuel, research, expenses; long absences capped; chunked.
* **balance** (`balance/progression`): greedy legal bot (no cheats) from Backyard to Universe and the
  Convergence Engine win. Measured (simulated real minutes): Neighborhood 57 · City 112 · Country 371 ·
  Continent 469 · Planet 712 · Solar System 946 · Galaxy 1004 · Universe 1212 · **won at 1605** ·
  102/102 research. Prestige: reaching City took 114 min in run 1 and 97 min in run 2 (4 points); further
  resets never double-award (`available + spent = awarded`).
* **performance** (`performance/perf`): synthetic late game, 9 maps, 623 installations representing 4.7×10¹²
  units: 2.3–7.7 ms per tick depending on load (budget 250 ms), save 7–12 ms, load 12–23 ms (435 KiB),
  12 h offline reconciliation 9–14 s (async with progress screen in the browser), heap ≈ 42–53 MiB.

## Browser tests (Playwright, real Chromium)

`tests/browser/game.spec.ts`: clean load (no console errors), building via catalog + canvas click with toast and
money change, invalid placement on unowned land (error, money unchanged), selection → inspector, hover tooltip,
land purchase (and **dragging does not buy**), every management screen opens, manual repair, hiring, automation
toggle, starting research, battery placement + mode change, Neighborhood + diesel + fuel order, map switching with
both maps simulating, expansion through the Progression screen, save → reload with offline summary, export and
import of a save file (and rejection of an invalid file), prestige with typed confirmation + shop purchase,
blueprint save → prestige → manual subset rebuild, fullscreen enter/exit (state + button label) and continued
interaction, responsive sizes 1280×720 · 1366×768 · 1920×1080 · 2560×1440 · 390×844 · 820×1180 with no
horizontal page scroll while in build mode.

`tests/browser/screenshots.spec.ts`: captures in `test-results/screens/` (1280×720, 1366×768, 1920×1080,
2560×1440, 390×844, fullscreen, plus research/finance/stats/thermal/prestige/progress screens). These were
inspected manually; fixes made from inspection: CSS layer precedence (padding), `$1.00e+3M` formatting, side panel
toggle overlap, onboarding position, mobile default (panel collapsed), zoom preserved proportionally on
resize, larger text on ≥2500 px screens.

`tests/browser/perf.spec.ts`: busy Planet map, headless software rendering: idle ≈ 41–47 fps, panning ≈ 27–34
fps, zooming ≈ 34–43 fps, ≈ 2.5–2.9 ms per map render.

## Feature status

**Implemented and tested automatically:** everything listed above — 9 stage maps, generation families (solar,
CSP, wind, kites, hydro, dams with flooding/cascade, tidal, diesel/gas/coal/CCGT/USC, biomass + plantations,
geothermal with pressure, fission tiers incl. refuelling outages and MSR load-following, fusion with ignition and
parasitic load, orbital, stellar, Dyson swarm with diminishing returns, pulsar, accretion, quasar, Penrose,
speculative vacuum tap), storage, grid tiers + stations, demand contracts, spot markets, PPAs, fuel contracts,
traders, maintenance crews/queue, logistics, research, prestige, blueprints, offline, saves, endgame win.

**Verified in the browser (manually via screenshots and automated e2e):** layout at all required sizes, light
theme, inspector (thermal panel, fuel, finances, actions), map overview, build preview, research/finance/
statistics/progression screens, fullscreen.

**Implemented but only covered indirectly:** retrofits/fleet upgrades/repowering/rebuild (exercised by the bot and
UI code paths, not individually asserted), arbitrage/smart/peak battery modes (logic exercised in dispatch, no
dedicated profitability test), carbon pricing setting, achievements beyond those reached by the bot, light theme
contrast (inspected visually only).

**Not verified:** behaviour on real GPUs / non-Chromium browsers (only headless Chromium was used), touch-gesture
pinch zoom (not implemented — buttons and wheel only), screen-reader experience beyond labels/roles.

## Known limitations

* Pacing is calibrated with a greedy bot that plays worse than an attentive player; a full first run takes the
  bot ≈ 27 h of simulated time (much of it idle-able). Neighborhood arrives at ≈ 57 min for the bot (target
  25–40 min for a human).
* The canvas map has no keyboard tile cursor; keyboard users can pan/zoom and use all panels, but placing
  buildings needs a pointer.
* Weather is deliberately deterministic (no random storms).
* Very long absences (> 12 h, or 48 h with the prestige upgrade) are capped; reconciliation uses up to 2 h steps.
* Single bundle > 500 kB (no code splitting); loads fine locally, ~173 kB gzip.
