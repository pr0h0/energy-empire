# MASTER IMPLEMENTATION PROMPT — ENERGY EMPIRE

## ROLE AND OBJECTIVE

You are a senior game developer, game systems designer, simulation engineer, frontend engineer, UI/UX designer, and QA automation engineer.

Your assignment is to **design, implement, integrate, test, and polish a complete browser-based incremental energy tycoon game called Energy Empire**.

This is not a prototype, demo, mockup, proof of concept, or minimum viable product. The final deliverable must be a **fully playable, persistent, feature-complete single-player browser game**, covering progression from a small backyard electricity installation through neighborhoods, cities, countries, continents, planets, the solar system, galaxies, and the universe.

The game is conceptually inspired by Reactor Idle, but must have its own identity, UI, building catalog, technology progression, gameplay mechanics, and implementation. Do not copy proprietary code, graphics, sounds, or other assets.

The game must be enjoyable both as an active management game and as an idle/incremental game.

### Mandatory execution requirements

1. Implement the entire project end-to-end.
2. Do not stop after building the initial Backyard stage.
3. Do not replace difficult features with mock interfaces, fake data, or decorative buttons.
4. Do not silently omit systems described in this specification.
5. Do not produce a large planning document and consider the task completed. The actual application is the deliverable.
6. Do not ask unnecessary clarification questions. Make technically sound decisions where reasonable details are unspecified.
7. Do not implement all mechanics as trivial percentage multipliers. Different generation technologies must have genuinely different operating characteristics.
8. Verify the application using actual browser interaction and automated tests.
9. Every visible interactive control must perform its intended action.
10. Complete the work in a single autonomous execution workflow as far as the available environment permits.
11. Prioritize correct behavior, long-term simulation stability, and coherent gameplay over decorative complexity.
12. Maintain clean, modular, readable, strongly typed code.

**The goal is a complete game that a player can open, play, save, return to, prestige, and eventually progress to the final Universe stage.**

---

# PART 1 — GAME IDENTITY

## 1.1 Game concept

Energy Empire is an incremental strategy and energy-management game.

The player begins as a homeowner with a small amount of money, a house, and a limited amount of land.

The original objective is straightforward: generate enough electricity to power the house and reduce the electricity bill.

As generation increases, the player can connect to the electricity grid and sell surplus production.

The resulting revenue finances additional land, generators, upgrades, research, storage, infrastructure, employees, automation, and expansion.

The player's business grows through increasingly large geographic and technological scales:

1. Backyard
2. Neighborhood
3. City
4. Country
5. Continent
6. Planet
7. Solar System
8. Galaxy
9. Universe

Each new scale introduces meaningful capabilities and strategic considerations.

The player eventually progresses from small rooftop solar panels and micro wind turbines to nuclear reactors, fusion power, orbital solar collectors, planetary infrastructure, Dyson swarms, and speculative stellar and universal energy systems.

## 1.2 Core gameplay loop

The main loop is:

**Build → Generate → Supply demand → Store/sell → Earn → Research → Upgrade → Automate → Expand**

The long-term loop adds:

**Unlock larger geographic scales → Build more advanced infrastructure → Reach breakthroughs → Optionally prestige → Gain permanent advantages → Progress faster**

The player should constantly have meaningful investment decisions.

Examples:

- Should they purchase an additional solar panel or improve the efficiency of existing panels?
- Should they repair turbines or replace aging equipment?
- Should they buy a battery or increase grid export capacity?
- Should they hire technicians or accept occasional downtime?
- Should they build a dispatchable thermal generator or invest in renewable generation?
- Should they expand to the next geographic scale or optimize their existing installations?
- Should they spend prestige currency on research acceleration or reduced maintenance expenses?

## 1.3 Design philosophy

The game must be:

- Easy to understand initially.
- Increasingly deep as progression advances.
- Fully playable without prestige.
- Fully playable without purchasing anything with real money.
- Suitable for active and idle players.
- Visually clean.
- Mathematically coherent.
- Performance-efficient.
- Save-safe.
- Highly scalable.
- Satisfying to replay.

Avoid forced micromanagement.

Automation should gradually replace repetitive activities while preserving the ability to optimize manually.

---

# PART 2 — TECHNOLOGY STACK

## 2.1 Required technologies

Use:

- TypeScript with strict typing.
- React for the interface.
- Vite for the application and build process.
- Tailwind CSS for styling.
- Zustand or an equivalent lightweight state-management solution.
- PixiJS or another efficient rendering solution for the interactive game grid.
- IndexedDB for persistent game storage.
- Vitest for unit and integration tests.
- Playwright for browser end-to-end testing.
- Bun as the package manager and runtime for project scripts.

Use SVG assets and SVG iconography wherever possible.

WebAssembly is optional and should only be introduced when profiling demonstrates a material performance benefit.

A backend is not required for normal single-player operation.

## 2.2 Architectural requirements

Separate the game simulation from the React interface.

The simulation engine must own the authoritative game state.

React components render state snapshots and dispatch commands.

Do not place production calculations, employee scheduling, fuel consumption, or prestige accounting inside React components.

Recommended structure:

```
src/
  app/
    App.tsx
    navigation/
    layouts/
    components/
    screens/
    panels/
    hooks/
    stores/

  engine/
    core/
      GameEngine.ts
      GameClock.ts
      SimulationScheduler.ts
      GameEvents.ts
      Commands.ts
      State.ts

    systems/
      ElectricitySystem.ts
      GenerationSystem.ts
      DemandSystem.ts
      StorageSystem.ts
      GridSystem.ts
      FinanceSystem.ts
      MaintenanceSystem.ts
      FuelSystem.ts
      LogisticsSystem.ts
      EmployeeSystem.ts
      ResearchSystem.ts
      ConstructionSystem.ts
      TerrainSystem.ts
      LandSystem.ts
      BuildingSystem.ts
      AutomationSystem.ts
      TradingSystem.ts
      WeatherSystem.ts
      PrestigeSystem.ts
      ProgressionSystem.ts
      AchievementSystem.ts
      OfflineSimulationSystem.ts

    world/
      WorldManager.ts
      MapManager.ts
      TileGrid.ts
      TerrainGenerator.ts
      BuildingFootprints.ts
      BuildingAggregation.ts
      RegionDefinitions.ts

    math/
      LargeNumber.ts
      EconomyFormulas.ts
      EnergyUnits.ts
      PrestigeFormulas.ts
      ScalingFormulas.ts

    data/
      buildings/
      technologies/
      research/
      employees/
      terrain/
      upgrades/
      regions/
      achievements/
      prestige/
      contracts/

    persistence/
      SaveManager.ts
      SaveSchema.ts
      SaveMigration.ts
      BackupManager.ts

  rendering/
    MapRenderer.ts
    TileRenderer.ts
    BuildingRenderer.ts
    SVGAssets.ts
    CameraController.ts

  assets/
    icons/
    buildings/
    terrain/
    ui/

  tests/
    unit/
    integration/
    browser/
    balance/
    performance/
```

You may improve this structure when justified, but preserve modular boundaries.

## 2.3 Data-driven configuration

Building definitions, upgrades, research, progression requirements, prestige items, and balance coefficients must be data-driven.

Adding a new generator should ordinarily require:

1. Defining its properties.
2. Associating its operating systems.
3. Registering its visual representation.
4. Defining unlock requirements.

Avoid large blocks of hardcoded building-specific logic.

Use reusable systems for fuel, wear, storage, construction, staffing, generation, and research.

---

# PART 3 — WORLD AND MAP PROGRESSION

## 3.1 Hierarchical progression, independent maps

This is a critical design requirement.

Progression is hierarchical, but **maps are independent playable screens**.

For example, unlocking City must not produce a city grid containing hidden or inaccessible Backyard cells.

The Backyard remains its own accessible map.

The City is a separate map, with its own terrain, grid dimensions, buildings, land ownership, and local electricity economy.

The player switches between maps through navigation.

A map transition should feel like switching operational regions, not physically zooming into nested geographic terrain.

### Rules

- All unlocked maps continue operating simultaneously.
- Opening one map does not pause the others.
- Maps do not overlap spatially.
- Buildings from smaller maps do not occupy tiles on larger maps.
- A player cannot accidentally build over an existing installation from another map.
- Every map has independently owned land.
- Every map has local power generation, storage, grid limits, fuel inventories, equipment, and operational workers.
- Money and research are shared company-wide.
- Regional economic statistics feed a global company dashboard.

The original Backyard remains accessible even after the player reaches the Universe stage.

## 3.2 World scales

Implement all nine progression stages.

### Stage 1 — Backyard

Purpose: Learn energy production and household electricity economics.

Technology:

- Residential solar.
- Micro wind turbines.
- Small waterwheel where suitable terrain exists.
- Residential batteries.
- Basic grid connections.
- Elementary electrical equipment.
- Simple maintenance automation.

The player starts with limited land and capital.

### Stage 2 — Neighborhood

Purpose: Become a community electricity supplier.

Technology:

- Small solar farms.
- Commercial wind turbines.
- Community battery banks.
- Diesel and gas generators.
- Biomass generation.
- Local substations.
- Distribution improvements.
- Fuel storage.
- Maintenance and logistics automation.

Unlock new customer demand categories and greater operational complexity.

### Stage 3 — City

Purpose: Operate a municipal electricity utility.

Technology:

- Utility-scale solar.
- Large wind farms.
- Conventional thermal plants.
- Industrial fuel infrastructure.
- Large battery farms.
- Municipal substations.
- Larger hydro installations where terrain permits.
- Electricity trading.
- Dynamic energy markets.
- Improved research facilities.

### Stage 4 — Country

Purpose: Operate a national energy grid.

Technology:

- Nuclear fission.
- Large hydroelectric dams.
- Pumped-storage hydro.
- Large geothermal installations.
- National transmission infrastructure.
- Advanced fuel supply networks.
- Large energy contracts.
- High-voltage distribution systems.

### Stage 5 — Continent

Purpose: Connect massive energy networks.

Technology:

- Interconnected supergrids.
- Large-scale energy storage.
- Advanced reactors.
- Improved transmission efficiency.
- Massive renewable complexes.
- Sophisticated electricity markets.
- Advanced research and automation.

### Stage 6 — Planet

Purpose: Supply a planetary civilization.

Technology:

- Commercial fusion.
- Planetary energy distribution.
- Massive renewable infrastructure.
- Advanced storage systems.
- Orbital infrastructure prerequisites.
- Speculative but internally coherent technologies.

### Stage 7 — Solar System

Purpose: Become a multi-world energy civilization.

Technology:

- Orbital solar collectors.
- Lunar energy facilities.
- Martian energy facilities.
- Planetary solar and geothermal complexes.
- Power transmission between local orbital networks.
- Advanced fusion infrastructure.
- Stellar energy collection.
- Dyson swarm construction.

Treat a Dyson swarm as a collection of orbital collectors, not an unrealistic rigid sphere.

### Stage 8 — Galaxy

Purpose: Expand infrastructure across star systems.

Technology:

- Interstellar energy networks.
- Stellar engineering.
- Advanced stellar collectors.
- Star-system energy production.
- Large-scale autonomous operations.
- Interstellar infrastructure breakthroughs.

### Stage 9 — Universe

Purpose: Final endgame.

Technology can become speculative, including:

- Galaxy-scale energy coordination.
- Exotic high-density energy systems.
- Advanced space-time energy infrastructure.
- Universal-scale construction projects.

Do not falsely represent speculative systems as real-world proven technologies.

The final stage must have an actual progression loop, technologies, milestones, upgrades, economic systems, and an achievable endgame objective.

It must not simply be an empty screen with an enormous number.

## 3.3 Map scale and physical units

Each map scale has a defined physical cell size.

Use consistent physical units internally.

For example:

- Backyard: meters.
- Neighborhood: tens or hundreds of meters.
- City: kilometer-scale cells.
- Country: multi-kilometer cells.
- Continent: regional cells.
- Planet: planetary regions.
- Solar System and above: abstract geographic or orbital sectors with explicit physical meaning.

Exact cell sizes are balance parameters.

Do not force every scale to use the same physical dimensions.

Large-scale stages may use sector grids rather than literal square terrain.

## 3.4 Local land expansion

Players purchase adjacent tiles.

Rules:

- A tile can be purchased only when it shares an allowed adjacency with owned land.
- Terrain affects land price and availability.
- Some tiles may be non-purchasable until milestones or technologies are unlocked.
- Purchased land stays owned when buildings are dismantled.
- Land ownership is separate from building occupancy.
- Expansion must be visualized clearly.

Make land acquisition reasonably priced relative to the stage's economy.

Avoid forcing repetitive purchases of thousands of tiles.

Later unlocks may allow bulk acquisition of contiguous land.

## 3.5 Unlocking the next scale

Every new geographic scale requires:

1. A set of gameplay milestones.
2. A monetary expansion purchase.

Examples:

- Total electricity sold.
- Revenue generated.
- Generation capacity installed.
- Supply reliability achieved.
- Research completed.
- Operational automation milestones.
- Infrastructure capabilities.

Players should see upcoming unlock requirements clearly.

Do not require every research branch to be completed before advancing.

Allow multiple viable generation strategies to satisfy progression.

New scales never automatically reset previous scales.

---

# PART 4 — MAP, TERRAIN, AND BUILDING VISUALS

## 4.1 Visual style

The game should have a **clean, professional, modern 2D management-game interface**.

Avoid excessive decorations, noisy textures, and visual clutter.

The map should be readable at a glance.

Buildings must have recognizable representations.

Preferred visual technology: **SVG**.

Each building should have its own simplified, visually recognizable SVG representation.

Examples:

- Solar panel: angled blue photovoltaic panel with a visible cell grid.
- Wind turbine: tower, rotor, and blades.
- Waterwheel: wheel positioned near flowing water.
- Battery: recognizable storage cabinet or battery symbol.
- Coal plant: industrial structure with boiler/chimney.
- Nuclear plant: industrial reactor building with distinctive cooling infrastructure.
- Hydro dam: concrete barrier, water, and spillway.
- Research laboratory: recognizable science facility.
- Substation: transformer and power-line structure.
- Fusion reactor: distinctive advanced containment structure.
- Orbital solar: collector panels with orbital framing.
- Dyson swarm: central star with orbiting collectors.

Avoid using emoji as primary map assets.

Use a consistent icon family for interface controls.

Lucide SVG icons are acceptable for general UI controls, but primary game buildings should have custom SVG illustrations.

## 4.2 SVG fallback

If SVG rendering proves unsuitable for a particular game element, use pixel-art sprites instead.

The agent must create the pixel-art assets itself.

Do not depend on externally hosted assets that might disappear.

Do not use unrelated stock imagery.

All required graphics must be included locally in the project.

SVG and pixel art may coexist if they share a consistent art direction.

## 4.3 Tile readability

Terrain does not need detailed rendering of every tree, building, rock, or road.

However, each tile type must be immediately recognizable.

Required visual distinctions include:

- Grass/open land.
- Forest.
- Hill.
- Mountain.
- River.
- Lake.
- Coast.
- Ocean.
- Desert.
- Industrial or urban terrain.
- Special terrain used by later-stage systems.

Use a restrained visual language:

- Clear base colors.
- Subtle terrain patterns.
- Simple SVG terrain symbols.
- Consistent tile boundaries.
- Hover and selection states.
- Ownership boundaries.
- Terrain eligibility indicators.

Provide a legend or inspectable tile tooltip.

Do not rely exclusively on color to communicate critical distinctions.

## 4.4 Building placement

Buildings may occupy multiple tiles.

Implement:

- Footprint previews.
- Rotation where relevant.
- Terrain compatibility checking.
- Occupancy checking.
- Ownership checking.
- Technology prerequisites.
- Resource cost previews.
- Invalid-placement explanations.
- Clear construction confirmation.
- Dismantle and replacement actions.

An invalid building placement must fail safely without consuming resources.

## 4.5 Automatic aggregation

This is a central feature.

Small generators are represented as aggregated fleets on larger map scales.

For example:

A small wind turbine might occupy a 20 × 20 meter footprint at Backyard scale.

A much larger map cell can contain an automatically determined number of comparable turbines.

The number must be based on:

- Physical size.
- Required operational spacing.
- Usable terrain area.
- Infrastructure allowance.
- Technology density.
- Building-specific restrictions.

Do not calculate capacity merely by dividing tile area by the generator's visual footprint when real operational spacing matters.

For example, wind farms require turbine separation.

A single large-scale building should represent the resulting fleet.

Players do not need to manage all individual turbine instances.

The aggregated installation tracks:

- Represented unit count.
- Total generation capacity.
- Fleet condition.
- Maintenance workload.
- Operating costs.
- Retrofit costs.
- Salvage value.
- Relevant fuel or other requirements.

Use aggregated state rather than allocating millions of individual machine objects.

At extremely large scales, use hierarchical aggregation and numerical approximation where appropriate.

---

# PART 5 — CONSTRUCTION AND DEMOLITION

## 5.1 Instant construction

**All construction is instant.**

After validating placement and deducting required money and materials, a building becomes available immediately.

There are no construction timers.

There are no construction workers.

There is no construction queue.

This applies even to large industrial structures and late-game megastructures.

The challenge comes from acquiring resources, satisfying prerequisites, finding suitable terrain, operating installations, and optimizing the economy.

Do not confuse instant construction with equipment renovation.

Retrofitting an operating generator may still cause temporary downtime.

## 5.2 Building demolition

Demolition must:

1. Remove the installation safely.
2. Free all occupied tiles.
3. Leave the land owned.
4. Recover building-specific salvage.
5. Update generation and maintenance calculations.
6. Cancel or reconcile linked repair/refueling jobs.
7. Update workforce demand and statistics.

## 5.3 Salvage system

Different building types recover different amounts.

Examples:

- Solar panels may retain significant component resale value.
- Wind turbines can recover equipment and recyclable materials.
- Batteries can recover some materials but may have poor resale value when degraded.
- Coal plants have dismantling expenses and lower recovery.
- Nuclear facilities may have substantial decommissioning expenses.
- Highly specialized orbital infrastructure may have limited salvage options.

Salvage depends on:

- Building category.
- Condition.
- Age.
- Installed upgrades.
- Remaining usable components.
- Relevant research.
- Prestige bonuses.

Prevent players from earning unlimited money by repeatedly buying and demolishing installations.

Salvage proceeds must remain below effective acquisition cost except where a deliberately designed external trading mechanic justifies otherwise.

---

# PART 6 — ELECTRICITY GENERATION AND DEMAND

## 6.1 Fundamental physical quantities

Always distinguish:

- Power: W, kW, MW, GW, TW, and higher units.
- Energy: Wh, kWh, MWh, GWh, TWh, and higher units.
- Storage capacity: energy units.
- Charge/discharge rates: power units.
- Efficiency: dimensionless ratio.
- Revenue: money per energy sold.

Energy production is calculated by integrating power over elapsed time.

For a constant-power interval:

```
energy_kWh = power_kW × duration_hours
```

All displayed and internal units must be consistent.

## 6.2 Local electricity balance

Each map maintains its own electrical system.

Electricity generation follows the characteristics of the installed equipment.

Local demand is satisfied before routine surplus exports.

Default priority:

1. Supply current local demand.
2. Use available storage according to the configured battery policy.
3. Import electricity when generation/storage are insufficient.
4. Charge storage with surplus where appropriate.
5. Export surplus through an available grid connection.
6. Curtail electricity that cannot be stored or sold.

Implement a coherent dispatch algorithm without double-counting any energy.

## 6.3 Beginning of the game

Backyard begins with household demand.

Electricity generation initially reduces the player's electricity purchasing cost.

Once the player has an export-enabled grid connection, surplus electricity sells automatically.

**Basic selling never requires an employee.**

Energy trading employees are introduced later to improve contracts, market access, and trading profitability.

## 6.4 Electricity demand growth

Demand grows as each region develops.

Do not implement a full city-population simulation.

Demand progression should use configurable development levels and consumer categories:

- Residential.
- Commercial.
- Industrial.
- Infrastructure.
- Advanced civilization demand.
- Planetary and interstellar demand.

Demand must not grow uncontrollably without visible player agency.

Make demand increases predictable through contracts, development upgrades, and milestones.

Supply shortages have economic and reliability consequences, but do not permanently destroy the player's game.

## 6.5 Grid connection limits

Grid connections have:

- Import capacity.
- Export capacity.
- Efficiency or losses where relevant.
- Upgrade costs.
- Operating costs where applicable.

Players cannot export unlimited power through a small residential grid connection.

Later scales introduce:

- Substations.
- Transformers.
- Distribution infrastructure.
- Transmission systems.
- Grid interconnections.
- Advanced interplanetary power transmission.

Keep the initial implementation understandable.

## 6.6 Electricity markets

Backyard starts with predictable fixed electricity tariffs.

Dynamic electricity prices unlock later.

Support:

- Fixed retail tariffs.
- Basic feed-in tariffs.
- Dynamic spot prices.
- Electricity supply contracts.
- Commercial/industrial buyers.
- Automated trading strategies.
- Optional energy trader employees.

Ensure prices do not oscillate chaotically or make automated idle operations unmanageable.

---

# PART 7 — WEATHER AND ENVIRONMENT

## 7.1 Simple weather model

We explicitly do **not** want a complicated weather simulator.

Implement predictable generation modifiers.

Solar depends on:

- Day/night cycle.
- Base regional solar potential.
- Modest seasonal adjustment where appropriate.
- Panel efficiency.
- Technology upgrades.

Wind depends on:

- Regional average wind potential.
- Smooth, predictable variation.
- Turbine characteristics.
- Technology upgrades.

Hydro depends on:

- River flow.
- Reservoir storage when applicable.
- Elevation difference.
- Turbine efficiency.

The player should be able to forecast approximate production.

Avoid random storms, destructive weather events, and high-frequency unpredictable changes in the initial game design.

Weather may become more sophisticated only if it improves gameplay.

## 7.2 Terrain-specific bonuses

Examples:

- Hills improve wind potential.
- Deserts improve solar potential.
- Rivers enable hydro generation.
- Geothermal locations enable geothermal installations.
- Coastal regions enable tidal/offshore facilities.
- Mountainous terrain may improve reservoir head but increase construction cost.

Terrain bonuses must be visible and documented in building tooltips.

---

# PART 8 — GENERATOR TYPES

Implement a sufficiently large, genuinely diverse catalog to support every world scale.

## 8.1 Solar

Progression:

- Small residential photovoltaic panels.
- Improved residential panels.
- Commercial solar arrays.
- Utility-scale solar farms.
- High-efficiency photovoltaic installations.
- Concentrated solar power.
- Advanced planetary solar infrastructure.
- Orbital solar collectors.
- Stellar collection arrays.

Mechanics:

- Daylight availability.
- Efficiency.
- Area usage.
- Long-term panel degradation.
- Cleaning/maintenance requirements where appropriate.
- Tracking upgrades.
- Grid/export constraints.
- Storage compatibility.

Solar must remain useful at larger scales through improved technology and aggregation.

## 8.2 Wind

Progression:

- Micro turbines.
- Residential turbines.
- Commercial turbines.
- Utility-scale turbines.
- Wind farms.
- Offshore wind farms.
- Advanced atmospheric harvesting.

Mechanics:

- Wind availability.
- Rotor/generator efficiency.
- Mechanical wear.
- Bearing maintenance.
- Spacing requirements.
- Component replacements.
- Advanced materials.

## 8.3 Hydroelectric

Progression:

- Small waterwheel.
- Micro hydro.
- Run-of-river generation.
- Small dam.
- Large hydroelectric dam.
- Pumped-storage hydro.
- Massive hydro complexes.

Hydro must meaningfully depend on terrain.

### Dam mechanics

A dam requires a valid river or watercourse site.

Implement a simplified but functional hydrology model with:

- Water flow.
- Elevation.
- Reservoir capacity.
- Upstream inundation.
- Head difference.
- Turbine throughput.
- Spillways/gates.
- Stored water.
- Downstream flow.
- Cascade effects where multiple dams exist.

Dam construction may flood upstream tiles based on elevation and reservoir levels.

Flooded land must affect construction eligibility and existing installations.

Do not arbitrarily destroy player buildings without a clear placement warning.

Implement a flood preview before confirming construction.

Allow controlled reservoir operation without requiring constant manual adjustment.

Do not build a full computational fluid dynamics engine.

A discrete elevation/flow model is sufficient.

## 8.4 Fossil-fuel generation

Implement:

- Diesel generation.
- Natural gas turbines.
- Coal-fired power plants.
- Advanced thermal plants.

Characteristics:

- Fuel consumption.
- Fuel costs.
- Dispatchable production.
- Operating efficiency.
- Wear and maintenance.
- Heat generation.
- Emissions as an optional gameplay attribute.
- Fuel storage requirements.

Fuel-consuming generators should not produce electricity without fuel.

## 8.5 Biomass

Implement:

- Biomass burners.
- Commercial biomass generation.
- Industrial biomass plants.

Provide fuel supply and storage requirements.

Self-production of biomass may become available through appropriate land or facilities.

## 8.6 Geothermal

Implement:

- Small geothermal installations.
- Deep geothermal plants.
- Enhanced geothermal systems.
- Advanced geothermal complexes.

Generation should depend on suitable terrain or geological conditions.

## 8.7 Nuclear fission

Implement multiple reactor tiers with increasing output and operating sophistication.

Requirements:

- Nuclear fuel.
- Thermal output.
- Cooling capability.
- Conversion efficiency.
- Specialized maintenance.
- Fuel replacement cycles.
- Reactor upgrades.

### Critical design rule

**Nuclear must be approachable, not punishing.**

New reactors should include safe automatic cooling as the default operating mode.

The player should not be forced to perform complex manual heat calculations to prevent constant failures.

Advanced thermal-management systems can unlock for players who want to optimize efficiency.

## 8.8 Fusion

Implement fusion as a major later-game research breakthrough.

Requirements may include:

- Advanced research.
- High initial construction cost.
- Specialized fuel or input resources.
- Cooling and containment.
- Significant generation output.

Fusion should not simply be identical to fission with a larger power number.

## 8.9 Orbital and stellar energy

Implement:

- Orbital solar stations.
- Planetary orbital collector networks.
- Space-based fusion complexes where appropriate.
- Stellar collector arrays.
- Dyson swarm modules.
- Advanced stellar engineering structures.

Each step must require appropriate breakthroughs and resources.

## 8.10 Universal endgame

Implement a coherent set of speculative technologies appropriate for the final stage.

They must have:

- Unlock prerequisites.
- Costs.
- Generation mechanics.
- Upgrade paths.
- Operating constraints.
- Achievements.
- Progression goals.

Avoid meaningless content inflation.

---

# PART 9 — HEAT AND COOLING

## 9.1 Heat as a real game system

Thermal generators produce heat.

Heat can be converted into electricity by appropriate conversion systems.

Efficiency depends on the generator and conversion technology.

Implement a unified thermal interface for applicable plants.

## 9.2 Automatic safety

Cooling is automatic and safe by default.

Normal operation should not require constant thermal micromanagement.

If an installation lacks sufficient thermal capacity, it should automatically throttle or safely shut down.

Do not rely on random catastrophic failures.

## 9.3 Advanced optimization

Research unlocks advanced options such as:

- Higher-efficiency turbines.
- Better heat exchangers.
- Cooling upgrades.
- Waste heat recovery.
- Combined-cycle improvements.
- Thermal energy storage where appropriate.
- Configurable operating targets.

Advanced optimization should improve economic efficiency, not simply act as an arbitrary universal multiplier.

A thermal management screen should explain:

- Heat production.
- Heat conversion.
- Cooling capacity.
- Waste heat.
- Electrical output.
- Operating efficiency.
- Thermal limitations.

---

# PART 10 — BATTERIES AND ENERGY STORAGE

## 10.1 Storage properties

Each storage installation has:

- Maximum energy capacity.
- Current stored energy.
- Maximum charge power.
- Maximum discharge power.
- Charging/discharging efficiency.
- Round-trip efficiency.
- Condition.
- Cycle degradation.
- Replacement cost.
- Maintenance requirements.

## 10.2 Operating modes

Initially provide simple modes:

1. Self-consumption priority.
2. Sell surplus priority.
3. Emergency reserve.

Later research unlocks:

- Minimum reserve percentages.
- Charge/discharge thresholds.
- Market-based arbitrage.
- Peak shaving.
- Smart dispatch.
- Advanced regional storage policies.

## 10.3 Battery aging

Battery degradation is cycle-based.

Ordinary maintenance restores equipment condition but does not reverse irreversible cell aging.

Cell replacement restores degraded usable capacity.

New battery technologies may:

- Reduce degradation.
- Improve efficiency.
- Increase capacity.
- Increase charge/discharge limits.
- Reduce replacement costs.

## 10.4 Storage progression

Progress through:

- Residential batteries.
- Community storage.
- Grid-scale battery farms.
- Pumped-storage hydro.
- Compressed-air or other bulk storage where appropriate.
- Advanced planetary storage.
- Orbital and futuristic storage systems.

No storage system may produce net energy from nothing.

---

# PART 11 — BUILDING WEAR, REPAIRS, AND REPLACEMENTS

## 11.1 Building condition

Buildings have condition or health, normally represented from 0% to 100%.

Condition declines with use according to equipment characteristics.

Examples:

- Wind turbines experience mechanical wear.
- Solar panels degrade slowly.
- Thermal generators experience operating wear.
- Batteries experience condition loss and separate cycle aging.
- Nuclear plants require specialized service.
- Some late-game structures have very long service intervals.

## 11.2 Manual repairs

Players can manually repair eligible equipment.

Repairs consume money and possibly materials.

Repair costs depend on:

- Building type.
- Condition.
- Required work.
- Technology upgrades.
- Prestige bonuses.

## 11.3 Automatic repairs

Players may hire maintenance employees.

Employees use a capacity-based system.

Each generator contributes expected Maintenance Load.

Workers provide Maintenance Capacity.

A worker may support multiple generators.

## 11.4 Configurable repair thresholds

The default repair threshold is 70% condition.

Allow players to change it.

Support:

- Global defaults.
- Map-specific defaults.
- Building-type overrides.
- Individual installation overrides where useful.

Avoid forcing players to configure every installation individually.

## 11.5 Priority repair queue

When a building reaches its threshold, a repair job enters a queue.

Jobs are prioritized according to:

1. Safety and operational urgency.
2. Equipment shutdown risk.
3. Economic impact.
4. Player priority overrides.
5. Waiting time.

Repair jobs consume worker capacity.

If capacity is insufficient, jobs remain queued.

The equipment continues wearing while it waits.

No job should remain permanently starved because it has slightly lower revenue.

## 11.6 Equipment upgrades and replacements

Distinguish:

- Repair.
- Preventive servicing.
- Component replacement.
- Retrofit.
- Repowering.
- Full rebuilding.

Retrofits may improve:

- Output.
- Durability.
- Efficiency.
- Reliability.
- Maintenance load.
- Fuel usage.

## 11.7 Fleet upgrades

Research unlocks improved technologies.

Players may upgrade installations individually or initiate optional bulk fleet upgrades.

Bulk upgrades:

- Target eligible buildings.
- Calculate the combined price.
- Consume required resources.
- Account for downtime.
- Respect existing upgrades.
- Preserve valid placements.
- Provide a clear confirmation summary.

Do not force automatic global retrofits immediately after research completion.

---

# PART 12 — FUEL, INVENTORY, AND LOGISTICS

## 12.1 Fuel economy

Support fuel categories appropriate to generators, including:

- Diesel.
- Coal.
- Natural gas.
- Biomass.
- Nuclear fuel.
- Fusion fuel or speculative late-game inputs.

Each fuel has:

- Purchase price.
- Inventory quantity.
- Storage capacity.
- Supply availability.
- Appropriate energy content.
- Relevant delivery constraints.

## 12.2 Fuel consumption

Fuel consumption must be based on actual operating output and efficiency.

Throttled generators generally use less fuel.

Stopped generators should not consume normal operating fuel.

Prevent negative inventories.

## 12.3 Fuel market

Fuel prices change gradually.

Avoid extreme price swings that make idle play impractical.

Later unlock:

- Long-term supply contracts.
- Bulk purchasing.
- Advanced procurement.
- Self-production.
- Fuel extraction.
- Resource processing.
- Automated price-sensitive purchasing.

## 12.4 Timed deliveries

Fuel delivery is not instantaneous.

Logistics workers provide Logistics Capacity.

Deliveries take time and consume that capacity.

The duration may depend on:

- Quantity.
- Fuel type.
- Distance abstraction.
- Infrastructure.
- Employee upgrades.

No need to simulate individual road vehicles.

## 12.5 Automation levels

Support:

- Manual purchasing and refueling.
- Automated refueling from available inventory.
- Fully automated purchasing and refueling.

Automatic purchasing must respect budget limits and available cash.

A player should be able to pause automation.

---

# PART 13 — EMPLOYEES AND AUTOMATION

## 13.1 Capacity-based employment

Employees are not permanently assigned one-to-one to buildings.

Use regional or global capacity pools depending on job type.

### Maintenance

Regional technicians provide repair and preventive-maintenance capacity.

### Logistics

Regional workers handle refueling and material logistics.

### Researchers

Researchers contribute to a global company-wide research pool.

### Energy traders

Traders optimize advanced electricity market activities.

## 13.2 Employee properties

Employees or workforce tiers may have:

- Hiring cost.
- Wages.
- Capacity.
- Efficiency.
- Training level.
- Experience or upgrades.
- Specialization where relevant.

Avoid implementing a complex individual-person simulation.

Aggregate employees into workforce groups.

## 13.3 Employee infrastructure

Buildings such as maintenance depots, logistics hubs, operations centers, and laboratories may improve workforce capacity.

Do not require an office building to hire the first Backyard technician.

Research may improve worker effectiveness.

## 13.4 Automation policies

Implement practical policies including:

- Repair when condition falls below a threshold.
- Prioritize high-value generators.
- Refill when fuel reaches a threshold.
- Maintain minimum fuel inventory.
- Purchase fuel within spending limits.
- Use battery operating modes.
- Automatically export surplus.
- Use electricity contracts where eligible.

Automation settings should be configurable and visible.

Previously unlocked maps must remain operable without manual attention.

---

# PART 14 — RESEARCH

## 14.1 Hybrid research

Research uses:

- Money.
- Research work.
- Time.
- Scientist throughput.
- Facilities.
- Prerequisites.
- Milestones for major breakthroughs.

## 14.2 Global research pool

Scientists across all maps contribute to one company-wide research capacity.

Research is globally accessible.

Do not require manually transferring scientists between regions.

## 14.3 Parallel projects

Multiple projects can progress at the same time.

Players allocate percentages of total research capacity.

Allocations must be validated and normalized so total assigned throughput never exceeds available throughput.

Paused or completed projects must not consume active capacity.

## 14.4 Research branches

Include at least:

- Solar.
- Wind.
- Hydroelectric.
- Thermal.
- Geothermal.
- Nuclear.
- Fusion.
- Storage.
- Grid and transmission.
- Materials.
- Maintenance.
- Logistics.
- Workforce.
- Energy markets.
- Research efficiency.
- Orbital technology.
- Stellar engineering.
- Universal breakthroughs.

## 14.5 Research UI

The technology interface should provide:

- Search and filtering.
- Research category navigation.
- Prerequisite display.
- Available projects.
- Locked projects.
- Cost.
- Estimated completion time.
- Current progress.
- Assigned capacity.
- Effects.
- Technology unlocks.

A player should understand why a project is locked and exactly what completing it will do.

## 14.6 Persistence and prestige

Research persists across maps during an economic run.

Normal research progress and discoveries reset when prestiging, except for any explicitly purchased permanent prestige effects.

---

# PART 15 — PRESTIGE

## 15.1 Separate from expansion

Prestige is optional.

It is not required to unlock Neighborhood, City, Planet, or any other map scale.

A player can progress all the way to the endgame without prestiging.

Prestige provides replayability and permanent bonuses.

## 15.2 Prestige reset

Prestiging performs a full economic reset.

Reset:

- Money.
- Active buildings.
- Land purchases.
- Map-scale unlocks.
- Local inventories.
- Employees.
- Ordinary research progress.
- Ordinary research discoveries.
- Equipment upgrades.
- Active contracts.
- Regional infrastructure.

Restart at Backyard.

Preserve:

- Prestige currency.
- Previously purchased prestige upgrades.
- Prestige accounting history.
- Lifetime statistics.
- Achievements.
- Saved blueprints.
- Relevant settings.
- Historical run records.

## 15.3 Prestige basis

Prestige points derive exclusively from **cumulative lifetime electricity sales revenue**.

Revenue is accumulated across every run.

Spending money does not reduce prestige progression.

Electricity bill savings are not counted as electricity sales revenue.

Do not calculate prestige from current cash balance.

## 15.4 Prestige formula

Use a configurable diminishing-returns power-law formula.

Initial example:

```
entitledPoints = floor(
    (lifetimeElectricitySalesRevenue / 100000) ^ 0.25
)
```

The constants are balancing parameters.

Implement this using a numeric representation that remains stable across astronomical revenue values.

The initial formula corresponds to the fourth root.

Do not hardcode it as an unchangeable endgame formula.

## 15.5 High-water-mark accounting

Track:

- Lifetime revenue.
- Total prestige points previously awarded.
- Currently available prestige points.
- Prestige points spent.
- Number of prestige resets.

Calculate:

```
claimablePoints = max(
    0,
    entitledPoints - previouslyAwardedPoints
)
```

Claimable points are awarded only when the player confirms a prestige reset.

The previously awarded counter increases accordingly.

Prevent awarding the same currency twice.

Spending prestige points must not reduce the previously awarded counter.

## 15.6 Prestige shop

Prestige currency is earned exclusively through gameplay.

There are no real-money purchases.

Include categories such as:

- Electricity revenue multipliers.
- Lower maintenance costs.
- Slower equipment wear.
- Faster research.
- Increased workforce capacity.
- Reduced fuel expenses.
- Better generation efficiency.
- Reduced land acquisition cost.
- Improved storage efficiency.
- Earlier automation access.
- Selected quality-of-life improvements.

Some upgrades have multiple levels and escalating costs.

Other upgrades should be expensive one-time purchases.

Avoid making every bonus a repetitive percentage increase.

Include major quality-of-life rewards that meaningfully change future runs.

## 15.7 Prestige preview

Before resetting, show:

- Lifetime electricity sales.
- Current entitled prestige points.
- Previously awarded points.
- New points to be earned.
- Total available points afterward.
- Exactly which progress will be lost.
- Exactly which progress will survive.

Require explicit confirmation.

Do not reset the game through a single accidental click.

---

# PART 16 — BLUEPRINTS

## 16.1 Saving layouts

Players can save named blueprints for individual maps.

Blueprints record:

- Relative building positions.
- Building types.
- Footprint orientation.
- Equipment variants.
- Upgrade choices.
- Applicable automation settings.
- Relevant building configuration.

## 16.2 Manual reconstruction

Blueprint reconstruction is **manual only**.

Do not automatically rebuild saved layouts after prestige.

Players must explicitly choose to apply a blueprint.

Before applying it, display:

- Required land.
- Available buildings.
- Locked technologies.
- Missing materials.
- Total estimated cost.
- Conflicting terrain.
- Occupied tiles.
- Unavailable upgrades.

Allow an affordable or valid subset to be built when the player explicitly chooses that option.

Reconstruction must charge normal construction costs.

## 16.3 Blueprint compatibility

Blueprints must handle:

- Changed map sizes.
- Different terrain.
- Missing research.
- Different building versions.
- Save schema upgrades.

Handle incompatibilities gracefully rather than crashing.

---

# PART 17 — FINANCIAL SYSTEM

## 17.1 Shared company economy

Money is global.

Each map reports local revenue and expenses.

The company dashboard aggregates:

- Electricity sales.
- Electricity purchase expenses.
- Fuel costs.
- Employee wages.
- Maintenance costs.
- Land purchases.
- Research spending.
- Infrastructure spending.
- Net income.

## 17.2 Clear profitability

Show profitability at multiple levels:

- Selected generator.
- Installation or fleet.
- Map.
- Entire company.

Where meaningful, display:

- Revenue per hour.
- Operating cost per hour.
- Net profit per hour.
- Estimated payback period.
- Capacity utilization.
- Equipment condition.

Do not imply that nominal output always equals actual generation.

## 17.3 Economic stability

Prevent easy infinite-money exploits.

Examples to test:

- Repeated buying and demolishing.
- Buying fuel and reselling generated electricity with inconsistent conversions.
- Charging batteries from grid electricity and selling it at a permanently profitable fixed spread without intended limits.
- Repeated prestige claims.
- Duplicating money through save imports.
- Excessively favorable time-step rounding.
- Double-counting energy transfers.
- Negative-price accounting bugs.

Unprofitable operations may lose money, but players must be able to recover.

Do not create irreversible economic dead ends.

---

# PART 18 — GAME UI AND UX

## 18.1 Design objectives

The UI must look like a polished modern management game.

It should be:

- Clean.
- Consistent.
- Readable.
- Responsive.
- Information-dense without being cluttered.
- Visually attractive without excessive decoration.
- Comfortable during long play sessions.

Use restrained colors, consistent spacing, clear typography, and recognizable SVG iconography.

Avoid oversized decorative headers that consume gameplay space.

## 18.2 Main layout

Suggested desktop layout:

### Top status bar

Show:

- Company money.
- Net income.
- Total production.
- Total demand.
- Grid import/export.
- Research status.
- Prestige availability.
- Alerts.
- Current map.
- Time controls.
- Fullscreen button.

### Map navigation

Show unlocked geographic scales.

Allow instant switching.

Locked scales should display their requirements.

### Main map

Interactive grid with:

- Building placement.
- Selection.
- Hover tooltips.
- Terrain information.
- Ownership boundaries.
- Zoom.
- Panning.
- Building footprints.
- Construction preview.
- Optional overlays.

### Building catalog

Categorize:

- Generation.
- Storage.
- Grid.
- Infrastructure.
- Automation.
- Research.
- Specialized facilities.

Include search and filters.

### Building inspector

Show:

- Name.
- Type.
- Generation output.
- Condition.
- Operating state.
- Fuel.
- Efficiency.
- Maintenance requirements.
- Financial statistics.
- Upgrades.
- Repair actions.
- Retrofit actions.
- Demolition.
- Configurable policies.

### Management screens

Provide:

- Research.
- Employees.
- Operations.
- Automation.
- Fuel and inventory.
- Energy market.
- Company finances.
- Statistics.
- Progression milestones.
- Blueprints.
- Prestige shop.
- Achievements.
- Settings.

## 18.3 Configurable UI

Allow players to toggle optional details.

Examples:

- Show/hide grid lines.
- Show/hide terrain labels.
- Show/hide building names.
- Show/hide production values.
- Show/hide maintenance indicators.
- Show/hide electrical overlays.
- Show/hide animations.
- Compact/detailed building inspector.
- Compact/detailed financial dashboard.
- Notifications and alert verbosity.
- Number formatting.
- Scientific notation preferences.
- Dark/light theme if feasible.

Do not overload the main screen with every statistic by default.

Use progressive disclosure.

## 18.4 Fullscreen support

**Fullscreen mode is mandatory.**

Implement a working fullscreen toggle using the browser Fullscreen API where supported.

The game must:

- Enter fullscreen when requested.
- Exit fullscreen when requested.
- Correctly detect fullscreen state.
- Update button state.
- Handle Escape.
- Recalculate the viewport dimensions.
- Reflow/rescale the interface.
- Keep the map interactive.
- Preserve zoom and selection when possible.

Provide a clear fallback when fullscreen is unavailable.

Do not fake fullscreen by merely hiding application borders.

## 18.5 Resolution independence

**The game must be resolution-independent wherever practical.**

Support at least:

- 1280 × 720.
- 1366 × 768.
- 1440 × 900.
- 1920 × 1080.
- 2560 × 1440.
- 3840 × 2160.
- Common laptop aspect ratios.
- Narrow browser windows.

Use:

- Responsive layout primitives.
- Flexible panels.
- Resizable or collapsible sidebars.
- Dynamic canvas sizing.
- Device-pixel-ratio-aware rendering.
- Camera transforms independent of screen pixels.
- Sensible UI scaling.
- Vector graphics for sharpness.
- Safe handling of display resizing.

The playable grid must not assume a fixed 1920 × 1080 viewport.

At smaller widths, management panels may become tabs or drawers.

At larger widths, available screen space should be used intelligently without stretching text excessively.

## 18.6 Camera behavior

Implement:

- Mouse-wheel zoom.
- Click-and-drag or equivalent panning.
- Center-on-map action.
- Reset zoom.
- Fit-map-to-viewport action.
- Selection persistence.
- Zoom limits.
- Smooth interaction.

Avoid accidental tile purchases while panning.

## 18.7 Accessibility

Provide:

- Keyboard-accessible UI controls.
- Tooltips.
- Sufficient color contrast.
- Visible focus states.
- Text alternatives for critical icon-only controls.
- Reduced-motion option.
- Consistent input feedback.

## 18.8 Feedback and notifications

Use notifications for events such as:

- Research completed.
- New technology unlocked.
- Map-scale milestone satisfied.
- Generator requires maintenance.
- Fuel shortage.
- Storage full.
- Grid export limit reached.
- New prestige points available.
- Major breakthrough achieved.

Notifications should be useful, not excessively noisy.

Include an event history.

---

# PART 19 — GAME CLOCK AND IDLE PROGRESSION

## 19.1 Deterministic simulation

Use a simulation clock independent from rendering.

A fixed logical time step is preferable.

Game calculations must not depend on browser frame rate.

## 19.2 Time control

Provide:

- Pause.
- Resume.
- Display of current simulation speed.
- A limited optional speed-up mechanism if useful.

Do not grant unrestricted extreme time acceleration unless deliberately balanced.

## 19.3 Offline progression

The game continues to simulate elapsed time when closed.

Offline calculations must include:

- Generation.
- Demand.
- Sales.
- Fuel consumption.
- Fuel delivery.
- Maintenance.
- Employee wages.
- Battery charge/discharge.
- Battery degradation.
- Research.
- Equipment condition.
- Financial expenses.

Use event-driven or chunked reconciliation.

Do not run one frame for every elapsed millisecond.

## 19.4 Offline summary

When returning after a meaningful absence, show:

- Time elapsed.
- Electricity produced.
- Electricity sold.
- Revenue earned.
- Expenses.
- Net income.
- Repairs completed.
- Fuel consumed.
- Research progress.
- Critical operating issues.

The summary should be dismissible.

## 19.5 Numerical consistency

Online and offline simulations should agree within explicitly defined tolerances.

Use test scenarios to verify this.

---

# PART 20 — SAVE SYSTEM

## 20.1 Persistent saves

Autosave to IndexedDB.

Include:

- Complete game state.
- Map state.
- Building installations.
- Employees.
- Research.
- Prestige.
- Blueprints.
- Automation policies.
- Financial statistics.
- Achievements.
- Simulation timestamp.
- Save schema version.

## 20.2 Backup and export

Support:

- Automatic saves.
- Manual save.
- Export save file.
- Import save file.
- Save reset with confirmation.
- Recovery from a corrupted primary save when a valid backup exists.

## 20.3 Migrations

Save schema changes must not silently destroy player progress.

Implement versioned migrations.

Provide validation before loading.

Avoid mutable references shared between loaded save objects and static definition data.

---

# PART 21 — PROGRESSION BALANCING

## 21.1 Full-game balance

The game must have a coherent growth curve from the first solar panel to universal-scale energy production.

Do not set all prices and multipliers arbitrarily without testing.

Implement a balancing model that considers:

- Generator cost.
- Footprint.
- Capacity factor.
- Generation efficiency.
- Fuel cost.
- Maintenance cost.
- Lifespan.
- Repair requirements.
- Workforce capacity.
- Grid capacity.
- Land price.
- Research cost.
- Progression milestones.
- Prestige effects.

## 21.2 Early game targets

First-run target pacing:

- First electricity savings: 1–2 minutes.
- First surplus sales: 5–10 minutes.
- First maintenance decision: 5–10 minutes.
- First technician: approximately 10–15 minutes.
- First research unlock: approximately 10–20 minutes.
- First battery: approximately 15–25 minutes.
- Neighborhood: approximately 25–40 minutes.

These are initial playtesting targets.

Tune them as necessary.

## 21.3 Long-term progression

Every scale should introduce substantial progression rather than being completed by clicking one purchase.

Avoid excessive grinding.

Do not require the player to leave the game running for weeks before anything meaningful happens.

Later stages should offer multiple viable investment choices and visible intermediate goals.

## 21.4 Prestige balance

Test the prestige formula against complete simulated economic runs.

Prestige bonuses should noticeably accelerate subsequent runs without making normal progression impossible or unpleasant.

Avoid prestige currency inflation that makes the entire shop trivial.

Avoid prestige progression so slow that players never obtain meaningful upgrades.

---

# PART 22 — PERFORMANCE REQUIREMENTS

## 22.1 Large-scale simulations

The game must handle:

- Hundreds of installed buildings.
- Thousands of represented generators.
- Large aggregated fleets.
- Multiple simultaneously operating maps.
- Large research catalogs.
- Large financial values.
- Extremely large late-game energy production.

Do not instantiate one simulation object for every represented turbine or solar panel in an aggregated fleet.

## 22.2 Rendering

Avoid rendering off-screen details unnecessarily.

Use viewport culling.

Batch rendering where practical.

Keep detailed tooltips and management panels separate from high-frequency rendering updates.

## 22.3 State updates

Do not rerender the entire application on every logical simulation update.

Publish efficient snapshots or selected state changes.

Use memoized selectors and suitable subscriptions.

## 22.4 Web Workers

Consider a Web Worker for simulation if main-thread performance becomes unacceptable.

Keep the simulation serializable and testable regardless of whether it runs on the main thread or in a worker.

## 22.5 Benchmarks

Measure:

- Idle FPS.
- FPS while panning.
- FPS while zooming.
- Simulation processing time.
- Large-map update cost.
- Save/load duration.
- Offline reconciliation time.
- Memory usage.

Use realistic late-game synthetic save states.

---

# PART 23 — TESTING REQUIREMENTS

Testing is mandatory, not optional.

The project must have automated tests and must also be exercised in a real browser.

## 23.1 Unit tests

Test:

- Energy conversion.
- Generator output.
- Capacity factors.
- Day/night behavior.
- Demand allocation.
- Grid import/export.
- Storage efficiency.
- Battery limits.
- Cycle degradation.
- Condition deterioration.
- Repairs.
- Repair queues.
- Fuel consumption.
- Fuel inventory.
- Logistics capacity.
- Delivery timing.
- Research progress.
- Research allocation.
- Building footprints.
- Land adjacency.
- Terrain eligibility.
- Building aggregation.
- Salvage.
- Prestige calculations.
- High-water-mark accounting.
- Numerical scaling.

## 23.2 Integration tests

Test complete workflows such as:

1. Buy a solar panel.
2. Start producing power.
3. Reduce household grid imports.
4. Upgrade the export connection.
5. Sell surplus.
6. Accumulate revenue.
7. Purchase adjacent land.
8. Place additional generation.
9. Repair deteriorating equipment.
10. Hire maintenance employees.
11. Confirm automatic repair behavior.
12. Purchase and operate storage.
13. Fund research.
14. Complete research and unlock equipment.
15. Expand to Neighborhood.
16. Operate multiple maps simultaneously.
17. Purchase fuel.
18. Dispatch timed delivery.
19. Operate a thermal generator.
20. Complete research milestones.
21. Reach advanced geographic stages.
22. Prestige.
23. Claim correct permanent currency.
24. Purchase a prestige-shop item.
25. Restart from Backyard with the correct permanent bonuses.

## 23.3 Browser end-to-end testing

Use Playwright or equivalent browser automation.

Open the running game in a real browser and interact with it.

Do not limit testing to checking whether the dev server responds with HTTP 200.

Verify:

- Clicking tiles.
- Purchasing land.
- Placing buildings.
- Invalid placement behavior.
- Selecting buildings.
- Viewing tooltips.
- Opening management screens.
- Repairing generators.
- Hiring employees.
- Changing automation settings.
- Purchasing fuel.
- Operating batteries.
- Performing research.
- Switching maps.
- Unlocking progression milestones.
- Saving and reloading.
- Importing/exporting saves.
- Prestiging.
- Buying prestige upgrades.
- Rebuilding from blueprints.
- Fullscreen mode.
- Responsive resizing.

Every main feature must be functionally tested.

## 23.4 Visual inspection

Use browser screenshots and inspect the game at multiple resolutions.

Required viewport checks:

- 1280 × 720.
- 1366 × 768.
- 1920 × 1080.
- 2560 × 1440.
- At least one narrow/mobile-style viewport.
- Fullscreen at a supported resolution.

Check for:

- Overlapping panels.
- Overflowing text.
- Tiny unreadable labels.
- Misaligned SVG elements.
- Broken asset loading.
- Unclickable controls.
- Incorrect z-index layering.
- Distorted maps.
- Blurry rendering.
- Unexpected horizontal scrolling.
- Layout changes that make gameplay impossible.

Fix identified issues and verify again.

## 23.5 Browser console and runtime errors

Inspect:

- JavaScript exceptions.
- React warnings.
- Missing assets.
- Unhandled promises.
- Failed IndexedDB operations.
- Rendering failures.
- Save migration errors.
- Performance warnings.

Do not leave known critical errors unresolved.

## 23.6 Simulation consistency

Run accelerated long-duration simulation tests.

Simulate:

- Several hours of Backyard operation.
- Days of Neighborhood and City operation.
- Extended Country/Continent operation.
- Advanced Planet and Solar System economies.
- Very large late-game values.
- Repeated prestige cycles.

Test both fully automated and partially automated operations.

## 23.7 Full progression test

Create at least one automated or semi-automated gameplay validation scenario that advances from Backyard to Universe using valid game rules.

Debug/test acceleration may be used in isolated automated test environments, but production gameplay must not require cheats.

The test must verify that every geographic stage is genuinely unlockable and that the final endgame objective can be completed.

## 23.8 Exploit and edge-case tests

Test:

- Negative inventories.
- Negative money.
- Repeated clicking.
- Repeated demolition.
- Invalid tile selection.
- Out-of-bounds placement.
- Double building occupancy.
- Fuel delivery to dismantled buildings.
- Repairs targeting removed equipment.
- Research allocation exceeding capacity.
- Duplicate prestige rewards.
- Extremely large values.
- Save import with invalid data.
- Reload during an operation.
- Switching maps during automation.
- Offline progress after long absences.
- Fullscreen entry/exit.
- Browser resizing during building placement.

---

# PART 24 — IMPLEMENTATION WORKFLOW

Execute the following phases autonomously.

## Phase A — Foundation

1. Create the project.
2. Configure TypeScript, Vite, React, Tailwind, and Bun.
3. Configure linting and testing.
4. Implement the base application shell.
5. Establish data schemas and simulation interfaces.
6. Implement the game clock.
7. Implement persistent saves.

## Phase B — Complete energy simulation

Implement:

1. Generation.
2. Demand.
3. Grid allocation.
4. Storage.
5. Revenue and expenses.
6. Equipment wear.
7. Maintenance.
8. Fuel.
9. Logistics.
10. Research.
11. Automation.
12. Prestige.
13. Offline progression.

Create unit tests for each system.

## Phase C — World and construction

Implement:

1. Map manager.
2. All geographic stages.
3. Terrain generation.
4. Tile ownership.
5. Adjacent land purchases.
6. Building footprints.
7. Instant construction.
8. Demolition.
9. Salvage.
10. Aggregated fleets.
11. Regional simulation.

## Phase D — Complete content catalog

Implement all required:

1. Generators.
2. Batteries and storage.
3. Grid infrastructure.
4. Research projects.
5. Equipment upgrades.
6. Employees.
7. Automation upgrades.
8. Prestige-shop upgrades.
9. Milestones.
10. Achievements.
11. Geographic expansion requirements.
12. Late-game breakthroughs.

Avoid leaving content branches empty.

## Phase E — User interface

Implement all screens, navigation, panels, interactions, SVG assets, responsive behavior, and fullscreen functionality.

## Phase F — Progression and balancing

Validate the economy from Backyard to Universe.

Adjust costs, output, demand growth, research duration, employee capacity, and prestige rewards.

## Phase G — Quality assurance

1. Run all tests.
2. Start the game.
3. Open it in the browser.
4. Play through the early game.
5. Test major features.
6. Test all map stages.
7. Test full progression.
8. Test prestige.
9. Test saving and offline progress.
10. Inspect multiple viewport sizes.
11. Fix issues.
12. Repeat tests.

Do not consider implementation complete until these phases are finished.

---

# PART 25 — DESIGN AND CODING RULES

Follow these constraints throughout the project.

### Code quality

- Strict TypeScript.
- Avoid `any` unless genuinely unavoidable.
- Favor explicit domain types.
- Centralize formulas.
- Keep calculations deterministic.
- Avoid duplicated business logic.
- Keep game definitions data-driven.
- Maintain a clear command/query boundary.
- Use meaningful naming.
- Document unusual mathematical or architectural decisions.

### User interface

- SVG icons and building illustrations preferred.
- No generic emoji-based building catalog.
- Clean, coherent styling.
- High information density with good readability.
- Fullscreen support.
- Resolution independence.
- Functional UI toggles.
- Accessible controls.
- No dead buttons.
- No fake charts.
- No placeholder panels in the completed release.

### Gameplay

- All nine stages implemented.
- All major generation families implemented.
- Multiple viable progression strategies.
- Optional prestige.
- No monetization.
- No required online services.
- No forced manual maintenance after automation is established.
- No invisible resource generation.
- No impossible progression gates.
- No silent destruction of unrelated map data.
- No arbitrary energy creation.

### Player experience

- Clear onboarding.
- Understandable milestones.
- Meaningful upgrades.
- Visible financial consequences.
- Useful tooltips.
- Easy navigation between maps.
- Convenient long-term automation.
- Interesting late-game systems.
- Save-safe progression.

---

# PART 26 — ACCEPTANCE CRITERIA

The game is complete only when all the following are true.

## Gameplay

- A new player can start from Backyard and progress through all nine scales.
- All scales have functional construction, energy generation, and progression.
- Solar, wind, hydro, fuel-based, nuclear, fusion, and space-based generation are functional.
- Electricity demand and grid exports operate correctly.
- Batteries charge and discharge correctly.
- Maintenance and condition degradation work.
- Repair automation works.
- Fuel consumption and timed logistics work.
- Research advances and unlocks real capabilities.
- Equipment upgrades modify actual simulation behavior.
- Advanced thermal management works without making basic nuclear gameplay unnecessarily difficult.
- Terrain engineering and dam flooding work.
- Company finances reconcile correctly.
- Prestige resets the correct state and preserves permanent bonuses.
- Blueprints can be saved and manually reapplied.
- Offline progression works.
- The final Universe stage has an attainable endgame objective.

## User interface

- The game looks visually coherent and professionally finished.
- Every terrain category is visually recognizable.
- Every major building category has distinctive SVG or locally generated pixel-art assets.
- All primary screens are functional.
- Fullscreen works.
- The layout adapts to different resolutions.
- Camera zoom and panning work.
- Tooltips and selected-building inspectors are readable.
- Relevant optional overlays and UI settings can be toggled.

## Engineering

- The production build succeeds.
- TypeScript compilation passes.
- Automated tests pass.
- Save/load functions correctly.
- No known progression-blocking bugs remain.
- No critical JavaScript runtime errors remain.
- Late-game simulation does not require instantiating millions of individual generator objects.
- Financial and energy calculations remain stable at large scales.

## Validation

- Actual browser testing has been performed.
- Screenshots have been inspected at several resolutions.
- Main gameplay interactions have been exercised.
- End-to-end progression has been validated.
- Prestige has been validated over multiple resets.
- A final test report has been produced.

---

# PART 27 — FINAL DELIVERABLES

Deliver:

1. The complete source code.
2. A working browser game.
3. All required local SVG or pixel-art assets.
4. The complete generation/building catalog.
5. All map stages.
6. The complete research tree.
7. The employee and automation systems.
8. The prestige system and shop.
9. Working save/load/export/import.
10. All automated tests.
11. Browser end-to-end tests.
12. A documented balancing configuration.
13. A README explaining installation, development, testing, and production builds.
14. A short architecture document.
15. A testing report with results.
16. A list of any known limitations or unresolved problems.

Use Bun commands where applicable.

The README must explain how to run the game locally with minimal setup.

The final report must explicitly distinguish:

- Features fully implemented.
- Features tested automatically.
- Features verified in a browser.
- Features not verified.
- Known limitations.

Never claim a mechanic was tested if it was not actually exercised.

---

# PART 28 — AUTONOMOUS EXECUTION INSTRUCTIONS

You are expected to implement this project, not merely propose how it might be implemented.

Work systematically.

Use internal implementation milestones to manage complexity, but do not treat intermediate milestones as the final deliverable.

Do not repeatedly ask the user to approve minor implementation decisions.

If an unspecified detail arises, select the option that best preserves:

1. Correctness.
2. Playability.
3. Performance.
4. Architectural simplicity.
5. Future maintainability.
6. Consistency with this specification.

Do not hide unfinished work behind polished UI.

Do not implement cosmetic placeholders for unimplemented gameplay systems.

Create a working vertical slice early so the core simulation can be tested, then continue expanding until the complete game is implemented.

Use browser automation continuously throughout development rather than waiting until the very end.

When you encounter a bug:

1. Reproduce it.
2. Identify the cause.
3. Fix the underlying problem.
4. Add a regression test when practical.
5. Verify the fix in the browser.

When implementing graphics, prefer distinctive but simple SVG illustrations that communicate function clearly.

When implementing layouts, prioritize usable gameplay space, clarity, and resolution independence.

When implementing large-scale generation, preserve mathematical consistency and use aggregation instead of brute-force object simulation.

When implementing research and progression, make sure all technologies have reachable prerequisites and meaningful effects.

When implementing the economy, make sure there are viable paths through every stage.

When implementing prestige, preserve the exact lifetime-revenue high-water-mark rules.

When implementing the final stage, provide a meaningful win condition and a way to continue sandbox play afterward.

**Begin implementation immediately. The target is a complete, polished, tested Energy Empire game from Backyard to Universe, delivered as a functioning browser application rather than a partial implementation or design proposal.**

Do not declare completion until the game has been built, exercised in the browser, tested across resolutions, and verified against the acceptance criteria above.

### A few implementation considerations

Three parts deserve particularly strict validation:

1\. Progression reachability. An agent should test that every stage can actually be unlocked, with no circular research dependencies, impossible resource requirements, or dead-end economic states.

2\. Simulation integrity. Electricity cannot be double-counted, offline income cannot ignore fuel or upkeep, and prestige high-water-mark accounting cannot grant duplicate points.

3\. Browser verification. A passing production build is insufficient. The agent needs real browser testing of construction, maps, overlays, fullscreen, responsive layouts, automation, research, and prestige.

I also recommend that the agent keep a persistent implementation checklist inside the repository, so it can track unfinished mechanics if its context is compacted during the build.
