# Gameplay guide

Energy Empire starts with one rooftop panel in a Backyard and ends with the Convergence Engine in the Universe.
Every unlocked map keeps simulating while you look at another one; money, research and staff are company-wide.

## Maps

| # | Map | What's new |
| --- | --- | --- |
| 1 | Backyard | rooftop PV, small wind, home battery, household bill savings |
| 2 | Neighborhood | community supply, diesel/gas/biomass, fuel deliveries, contracts |
| 3 | City | spot markets, PPAs, dams, geothermal, combined cycle |
| 4 | Country | nuclear, large dams, offshore wind, HV transmission |
| 5 | Continent | supergrids, breeders, molten-salt reactors |
| 6 | Planet | fusion, orbital solar, mantle taps |
| 7 | Solar System | Dyson swarms, lunar/Mars industry, He-3 fusion |
| 8 | Galaxy | Matrioshka shells, pulsars, star lifting, accretion |
| 9 | Universe | quasars, Penrose engines, vacuum taps, **Convergence Engine** |

Unlocking the next map needs the milestones listed on the Progression screen plus a fee.

## Building

* **Build** tab → choose a building → click a tile. Hover shows cost, validity and terrain bonuses. `R` rotates.
* Building on unowned land next to yours offers to **buy the land** in the same step (cost breakdown shown).
* **Shift + drag** places a straight row; blocked or unaffordable spots are skipped.
* Dams flood upstream tiles; the preview shows the dam plus every flooded tile it has to buy.

## Running the grid

* **Dispatch order:** renewables → flexible hydro/CSP → storage → thermal → import → unserved. Surplus goes to
  storage, then the Convergence Engine (endgame), then export, then curtailment.
* **Grid connection** (Map tab): upgrade for more import/export; **downgrade** one tier at a time (no refund) if a
  tier's running cost no longer pays.
* **Storage** shows its charge on the map: green charging, red discharging, grey idle.
* **Fuel:** plants burn from their tank; the depot refills tanks; producers (plantations, wells, mines) show what
  share of your plants' full-load burn they cover. Map tab → Maintenance has **Repair all** / **Refuel all**.
* **Fusion** needs ignition energy, then runs at or above its minimum stable load (below it the plasma quenches).

## Planning tools

* **Advisor** (Map tab): the most urgent issues first, each with a button to the right screen.
* **Forecast** (Map tab): 48 h of expected solar + wind against demand, including announced weather.
* **Weather layer** (cloud button on the map): cycles Wind / Solar / Hydro. Tiles are red (poor) to green
  (strong) under the current weather; wind tiles also show live turbine output.
* **Top bar:** hover money, power and grid for a live breakdown of what is earning and spending.
* **Statistics:** cash, net income, sales, reliability, generation mix, grid exchange and research over time.

## Weather and events

* **Weather** (Earth maps only, at most one event per four days, announced 12 h ahead):
  storm (wind/solar ~50%, extra wear), heatwave (+12% demand, weaker cooling), drought (rivers ~60%).
* **Business events** occasionally ask for a decision within 24 h; doing nothing applies the cautious default:
  * Equipment recall — pay to fix, or affected solar/wind/storage loses 25% condition.
  * Fuel price spike — buy a hedge, or that fuel costs +60% for 3 days.
  * Demand boom — accept +25% customer demand for 5 days, or decline.
* **Hydro head:** run-of-river output depends on how steeply the river falls (×0.75 flat to ×1.5 steep).

## Research

* One shared RP pool, split across active projects by allocation weight.
* **Tree view** (default): one area per map, strings from prerequisites; hover to highlight a chain. **List view**
  for search/filters. View and filters are remembered.
* Every card shows its time at full RP; active ones show a live ETA.
* **Repeatable research (∞)**: one per map plus three in *Beyond* after Convergence Theory. 10× an average
  project, ×1.3 cost per level, small permanent bonuses (reductions cap at −25%). Levels reset on prestige.

## Staff

Maintenance and logistics crews work per map; researchers and traders company-wide. Training raises output
(+15% per level for crews on a map, +10% company-wide for researchers/traders).

## Goals, challenges and prestige

* Each map has four **goals** (capacity, storage, 24 h without imports, 72 h without fossil fuel) paying a reward.
* **Prestige** resets the run for points spent in the prestige shop. Pick a **challenge** for the next run for bonus
  points: Fossil-free (+25%), Off-grid (+40%), Tight margins (+30%).

## Winning and speed

Feed **2×10³⁸ kWh** of surplus into the Convergence Engine to win; play continues in sandbox mode.
Game speed starts at 1×; **2×** unlocks after winning once and **3×** after every achievement. Both survive
prestige.

## Controls

`Space` pause · `T` speed · `1`–`9` screens · `←`/`→` tabs · `↑`/`↓` maps · `Q` side-panel tab · `Esc` cancel ·
`R` rotate · `+`/`-` zoom · `WASD` pan · `F` fit · `C` centre · `L` land mode · `Shift`+drag row.
