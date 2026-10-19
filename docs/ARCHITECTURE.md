# Architecture

```
src/
  engine/            authoritative simulation (no React, fully serialisable, deterministic)
    core/            GameEngine (tick, commands, offline), Commands, State types, GameClock (environment
                     curves), SimulationScheduler (fixed-step browser driver), Modifiers, Helpers, GameEvents
    systems/         Electricity (dispatch), Demand, Grid/market prices, Thermal, Fuel, Logistics, Maintenance,
                     Research, Employee, Finance, Construction, Land, Building (retrofit/repower/rebuild),
                     Trading (PPAs, fuel contracts), Progression, Achievement, Prestige, Blueprint, Weather (events,
                     forecast), Goal (per-map goals + challenges), Advisor (hints), Incident (decision events)
    world/           MapManager, TerrainGenerator, TileGrid, BuildingFootprints, BuildingAggregation
    math/            LargeNumber (formatting, safe numbers), EnergyUnits, PrestigeFormulas, rng
    data/            data-driven catalog: stages, terrain, buildings, fuels, research, upgrades, employees,
                     contracts, prestige shop, achievements, balance coefficients
    persistence/     SaveManager (IndexedDB + export/import), SaveSchema (validation, checksum),
                     SaveMigration (versioned), BackupManager (rolling slots)
  rendering/         Canvas-2D MapRenderer, Tile/Building renderers, CameraController, SVGAssets
  app/               React UI: layouts, navigation, screens, panels, components, stores (zustand), hooks
tests/               unit · integration · balance (full progression bot) · performance · browser (Playwright)
```

## Key decisions

* **Command/query boundary.** React reads `engine.state` through `useGame()` and changes it only through
  `engine.dispatch(command)`. All production, scheduling, fuel and prestige accounting live in `engine/`.
* **Fixed timestep.** One tick = 2.5 game minutes; 1 real second = 10 game minutes (a day lasts 2.4 min).
  The scheduler accumulates real time and runs whole ticks; rendering is independent (requestAnimationFrame).
  The UI store is bumped at most once per frame for commands and at most ~4×/s for simulation ticks
  (`emit(fromTick)` → `bump(soft)`), so React never re-renders per tick even at 3× speed.
* **Offline progress** reuses the same `tick()` with coarser steps (0.5 h, 1 h or 2 h for very long absences)
  in an async, chunked runner; environment curves are closed-form, so online and offline agree (tested ≤ 3 %).
* **Dispatch.** Per map: must-run renewables → hydro/CSP flexible → storage (policy) → load-following thermal →
  emergency storage → import → unserved; surplus: thermal back to minimum stable load → storage → endgame sink →
  export → curtailment. Economic thermal export and spot-price arbitrage follow. Every tick asserts
  `sources = uses` (tests check |imbalance| < 1e-9).
* **Aggregation.** A building represents `floor(usable area × density / unit operating spacing)` units; fleets
  are one object with unit count, so late-game maps hold ~10¹² represented units in a few hundred objects.
* **Numbers.** Plain doubles (max late-game values ≈ 10⁴⁵ ≪ 10³⁰⁸); prestige maths in log space; `safe()` guards
  against NaN/∞ entering a save. Prices use deflating per-stage tariffs so money stays within ~10²⁰.
* **Saves.** JSON + FNV-1a checksum in IndexedDB, rotated through four slots; load walks the slots until one
  validates; migrations upgrade old versions and fill missing fields from a fresh state. Definitions are never
  referenced from state (instances store definition ids).
* **Performance.** Tick-scoped memoisation of modifiers and per-map aggregates (`tickMemo`), cached
  per-installation site factors and definitions; ~2–4 ms per tick for 600+ installations across nine maps.

## Later additions

* **Weather events** (`WeatherSystem`): deterministic per map seed in 4-day blocks; `envAt(m, t)` folds the active
  event into solar/wind/river/demand/cooling factors, so `forecast()` (ElectricitySystem) can predict exactly.
* **Repeatable research**: lives in `RESEARCH` with `repeat: { growth }` but is excluded from `RESEARCH_LIST`, so
  completion counts and milestones ignore it; levels are in `state.research.levels`, effects stack in
  `getMods()` (reductions asymptotic to −25%).
* **Research tree UI**: layout is computed from data (area per stage, rows by in-area prerequisite depth,
  barycentre ordering) and cached per column count; edges are SVG beziers.
* **Incidents** (`IncidentSystem`): one roll per 6-day block from the seed; pending decision expires after 24 h to
  the cautious default; active effects are multipliers read by `fuelPrice()` and customer demand.
* **Speed unlocks**: `speedCap(s)` derives the allowed speed from achievements, which survive prestige.
