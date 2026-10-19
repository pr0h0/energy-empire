# Balance configuration

All coefficients live in `src/engine/data/balance.ts`, `stages.ts`, `buildings.ts`, `research.ts`, `fuels.ts`,
`contracts.ts`, `employees.ts` and `prestige.ts`.

## Model

* **Time:** 1 real second = 10 game minutes; one game hour = 6 real seconds; a year is 120 game days.
* **Costs are derived, not hand-typed.** Generator unit cost = `unit kW × reference capacity factor × native
  stage retail price × payback hours × paybackScale[stage]`. Storage cost = `kWh × retail × payback/24`; fuel
  producers = `rate × fuel price × payback`. Fleet cost scales with `units^0.97`.
* **Per-stage deflation:** each stage's tariff per kWh is lower (Backyard $0.50/kWh → Universe $5e-24/kWh) while
  installations are ~10²–10⁹ × larger, so money grows ~30–100× per stage while power spans 10³ W → 10³⁹ W.
  Older technology priced at its native (higher) stage price becomes uneconomic later — natural obsolescence.
* **Grid tiers** cost ≈ 80 h of the extra export they enable; contracts' connection fees ≈ 60 h of the margin
  over exporting the same energy.
* **Land:** stage base × terrain multiplier × 1.03^(tiles bought).
* **Maintenance:** load (WU) = wear rate × usage × maintenance load × 60; a technician provides 2 WU.
* **Prestige:** `floor((lifetime sales / 1e5)^0.25)`, high-water mark; shop costs 1–15 points with 1.5–2× growth.

## Pacing (bot measurements, see TEST_REPORT.md)

Latest full bot run at 1× (real minutes): Neighborhood 158 · City 222 · Country 439 · Continent 594 · Planet 812 ·
Solar 1140 · Galaxy 1381 · Universe 1636 · win 1951. The bot path is chaotic: small rule changes shift the space
stages by ±15% without a real balance change, so compare several knobs before concluding anything.


Targets from the design brief: first savings 1–2 min, first sale 5–10 min, first technician 10–15 min, first
research 10–20 min, Neighborhood 25–40 min. The greedy test bot (which plays worse than an attentive human)
hits first sale ≈ 3 min, first hire ≈ 12–50 min, first research ≈ 15–30 min, Neighborhood ≈ 40–60 min, and
reaches the Universe in roughly a day of accelerated play; prestige measurably shortens the next run.

## Tuning knobs

`BALANCE.paybackScale`, stage `unlock.cost`/`milestones`, `BALANCE.winEnergyKWh` (endgame length),
`PRESTIGE_FORMULA`, `TIME.offlineCapRealH`, fuel `price`, employee `wage`, weather strengths (`WEATHER` in
`WeatherSystem.ts`), incident sizes (`SPIKE`, `BOOM`, `RECALL_HIT` in `IncidentSystem.ts`), repeatable research
`REP_GROWTH` and effect sizes (`research.ts`), goal targets/rewards (`goals.ts`), hydro head range (`hydroHead`).
