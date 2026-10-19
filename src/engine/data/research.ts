import { STAGES } from './stages';
import type { Effect, Milestone, ResearchBranch, ResearchDef, StageId } from './types';

/** Research work (RP) and money scale with the stage a project belongs to. */
export const RP_BASE: Record<StageId, number> = {
  backyard: 20, neighborhood: 120, city: 700, country: 3000, continent: 1.2e4, planet: 4e4, solar: 1.5e5, galaxy: 5e5, universe: 1.5e6,
};
/** Research facility output multiplier by stage of the map it is built on. */
export const LAB_MULT: Record<StageId, number> = {
  backyard: 1, neighborhood: 3, city: 10, country: 30, continent: 100, planet: 300, solar: 1000, galaxy: 3000, universe: 10000,
};

type R = [id: string, name: string, branch: ResearchBranch, stage: StageId, mult: number, prereq: string[], effects: Effect[], desc: string, extra?: { milestone?: Milestone; minH?: number }];

const mod = (key: Extract<Effect, { type: 'mod' }>['key'], add: number): Effect => ({ type: 'mod', key, add });
const unlock = (building: string): Effect => ({ type: 'unlock', building });
const upg = (upgrade: string): Effect => ({ type: 'upgrade', upgrade });
const feat = (feature: Extract<Effect, { type: 'feature' }>['feature']): Effect => ({ type: 'feature', feature });

const rows: R[] = [
  // Solar
  ['solar_1', 'Monocrystalline Cells', 'solar', 'backyard', 1, [], [unlock('pv_improved'), mod('solar.output', 0.05)], 'Higher-efficiency silicon for rooftop panels.'],
  ['solar_2', 'Panel Cleaning Robotics', 'solar', 'neighborhood', 1, ['solar_1'], [upg('solar_clean')], 'Retrofit panels with automated cleaning.'],
  ['solar_3', 'Single-Axis Trackers', 'solar', 'city', 1, ['solar_2'], [upg('solar_tracking')], 'Panels that follow the sun through the day.'],
  ['solar_4', 'Bifacial Modules', 'solar', 'country', 1, ['solar_3'], [unlock('pv_bifacial'), upg('solar_bifacial')], 'Two-sided modules capture reflected light.'],
  ['solar_5', 'Concentrated Solar Power', 'solar', 'country', 1.4, ['solar_3', 'thermal_3'], [unlock('csp_tower')], 'Mirror fields and molten-salt storage — solar after sunset.'],
  ['solar_6', 'Perovskite Tandem Cells', 'solar', 'continent', 1.2, ['solar_4'], [mod('solar.output', 0.15)], 'Stacked junctions break the silicon efficiency limit.'],
  ['solar_7', 'Self-Assembling Photovoltaics', 'solar', 'planet', 1.2, ['solar_6', 'materials_5'], [mod('solar.output', 0.1), mod('density', 0.1)], 'Panels laid by autonomous fabricators at higher density.'],
  // Wind
  ['wind_1', 'Small-Turbine Aerodynamics', 'wind', 'backyard', 1.2, [], [unlock('wind_residential'), mod('wind.output', 0.08)], 'Better blade profiles for small rotors.'],
  ['wind_2', 'Sealed Bearings', 'wind', 'neighborhood', 1, ['wind_1'], [upg('wind_bearings')], 'Cut mechanical wear on turbines.'],
  ['wind_3', 'Composite Blades', 'wind', 'city', 1, ['wind_2'], [upg('wind_blades')], 'Longer carbon-fibre blades.'],
  ['wind_4', 'Offshore Engineering', 'wind', 'country', 1.3, ['wind_3'], [unlock('wind_offshore'), feat('terrain.ocean')], 'Foundations and cabling for open water. Allows buying ocean tiles.'],
  ['wind_5', 'Predictive Pitch Control', 'wind', 'continent', 1, ['wind_4'], [upg('wind_controls'), mod('wind.output', 0.1)], 'Lidar-guided blade pitch.'],
  ['wind_6', 'Atmospheric Harvesting', 'wind', 'planet', 1.2, ['wind_5', 'materials_5'], [unlock('kite')], 'Tethered wings in the jet stream.'],
  // Hydro
  ['hydro_1', 'Micro-Hydro Turbines', 'hydro', 'neighborhood', 0.6, [], [unlock('micro_hydro')], 'Cross-flow turbines for creeks.'],
  ['hydro_2', 'Kaplan Runners', 'hydro', 'city', 0.8, ['hydro_1'], [upg('hydro_turbine'), mod('hydro.output', 0.05)], 'Adjustable-blade runners for variable flow.'],
  ['hydro_3', 'Dam Engineering', 'hydro', 'city', 1.2, ['hydro_1'], [unlock('small_dam')], 'Impoundment, spillways and reservoir operation.'],
  ['hydro_4', 'Large Dams', 'hydro', 'country', 1, ['hydro_3'], [unlock('large_dam')], 'Roller-compacted concrete megadams.'],
  ['hydro_5', 'Pumped Storage', 'hydro', 'country', 1, ['hydro_3'], [unlock('pumped_storage')], 'Reversible pump-turbines as bulk storage.'],
  ['hydro_6', 'Tidal Barrages', 'hydro', 'country', 1, ['hydro_2'], [unlock('tidal_barrage')], 'Harness the predictable tides.'],
  ['hydro_7', 'Continental Hydro Complexes', 'hydro', 'continent', 1, ['hydro_4'], [unlock('hydro_complex')], 'Chains of dams on the largest rivers.'],
  // Thermal / biomass
  ['thermal_1', 'Gas Turbines', 'thermal', 'neighborhood', 0.6, [], [unlock('gas_peaker')], 'Aero-derivative turbines for fast peaking.'],
  ['thermal_2', 'Heat Exchangers', 'thermal', 'neighborhood', 0.8, ['thermal_1'], [upg('thermal_hx'), mod('thermal.cooling', 0.05)], 'More effective heat rejection.'],
  ['thermal_3', 'Steam Cycle Optimisation', 'thermal', 'city', 1, ['thermal_2'], [upg('thermal_turbine'), mod('thermal.eta', 0.02)], 'Higher-efficiency steam turbines.'],
  ['thermal_4', 'Combined-Cycle Plants', 'thermal', 'city', 1.2, ['thermal_3'], [unlock('ccgt'), upg('thermal_whr')], 'Recover gas-turbine exhaust heat.'],
  ['thermal_5', 'Advanced Thermal Management', 'thermal', 'country', 1, ['thermal_4'], [feat('thermal.advanced'), upg('thermal_storage')], 'Configurable operating targets (up to 110%), optimised cooling margins and thermal storage.'],
  ['thermal_6', 'Ultra-Supercritical Steam', 'thermal', 'country', 1.1, ['thermal_5', 'materials_4'], [unlock('adv_coal')], 'Alloys for 700 °C steam.'],
  ['biomass_1', 'Biomass Combustion', 'thermal', 'neighborhood', 0.7, [], [unlock('biomass_burner'), unlock('biomass_plantation')], 'Burn energy crops; grow your own fuel.'],
  ['biomass_2', 'Industrial Biomass', 'thermal', 'city', 0.8, ['biomass_1'], [unlock('biomass_commercial')], 'Grate-fired biomass stations.'],
  ['biomass_3', 'Fluidised-Bed Combustion', 'thermal', 'country', 0.8, ['biomass_2'], [unlock('biomass_industrial')], 'Large clean-burning biomass plants.'],
  // Geothermal
  ['geo_1', 'Geothermal Drilling', 'geothermal', 'city', 1, [], [unlock('geo_small')], 'Tap hot springs and steam fields.'],
  ['geo_2', 'Reservoir Reinjection', 'geothermal', 'country', 1, ['geo_1'], [unlock('geo_deep'), upg('geo_reinject')], 'Deep wells and brine reinjection.'],
  ['geo_3', 'Enhanced Geothermal Systems', 'geothermal', 'continent', 1, ['geo_2'], [unlock('geo_egs'), mod('geothermal.output', 0.1)], 'Fracture hot dry rock anywhere.'],
  ['geo_4', 'Mantle Taps', 'geothermal', 'planet', 1, ['geo_3'], [unlock('geo_planetary')], 'Heat exchangers reaching the upper mantle.'],
  // Nuclear
  ['nuclear_1', 'Fission Fundamentals', 'nuclear', 'country', 1.5, ['thermal_3'], [unlock('smr'), unlock('uranium_mine')], 'Licensing, fuel cycle and passive safety. Reactors ship with automatic safe cooling.', { milestone: { kind: 'research', count: 10 } }],
  ['nuclear_2', 'High-Burnup Fuel', 'nuclear', 'country', 0.8, ['nuclear_1'], [upg('nuclear_fuel')], 'Longer fuel cycles.'],
  ['nuclear_3', 'Large Reactors', 'nuclear', 'country', 1.3, ['nuclear_1'], [unlock('pwr'), upg('nuclear_uprate')], 'Gigawatt-scale pressurised water reactors.'],
  ['nuclear_4', 'Fast Breeder Reactors', 'nuclear', 'continent', 1.2, ['nuclear_3'], [unlock('gen4'), mod('nuclear.fuel', -0.15)], 'Breed fissile fuel from fertile material.'],
  ['nuclear_5', 'Molten-Salt Reactors', 'nuclear', 'continent', 1.2, ['nuclear_3', 'materials_4'], [unlock('msr'), mod('nuclear.fuel', -0.1)], 'Liquid-fuel thorium reactors that follow load.'],
  // Fusion
  ['fusion_1', 'Plasma Confinement', 'fusion', 'planet', 2, ['nuclear_4', 'research_3'], [unlock('tokamak'), unlock('deuterium_plant')], 'BREAKTHROUGH: sustained burning plasma.', { milestone: { kind: 'produced', kwh: 1e12 }, minH: 24 }],
  ['fusion_2', 'Breeding Blankets', 'fusion', 'planet', 1, ['fusion_1'], [upg('fusion_blanket')], 'Self-sufficient tritium.'],
  ['fusion_3', 'HTS Magnets', 'fusion', 'planet', 1.2, ['fusion_1'], [upg('fusion_magnets'), unlock('stellarator'), mod('fusion.output', 0.05)], 'High-temperature superconducting coils.'],
  ['fusion_4', 'Aneutronic Fusion', 'fusion', 'solar', 1.2, ['fusion_3', 'orbital_2'], [unlock('orbital_fusion'), unlock('he3_scoop')], 'D-He3 fusion with direct energy conversion.'],
  // Storage
  ['storage_1', 'Home Batteries', 'storage', 'backyard', 1, [], [unlock('battery_home')], 'Lithium-ion packs for self-consumption.'],
  ['storage_2', 'Battery Management', 'storage', 'neighborhood', 0.8, ['storage_1'], [upg('storage_bms'), mod('storage.aging', -0.1)], 'Cell balancing and thermal control.'],
  ['storage_3', 'Smart Dispatch', 'storage', 'neighborhood', 1, ['storage_2'], [feat('battery.advanced'), upg('storage_power')], 'Reserve percentages, peak shaving and smart dispatch modes.'],
  ['storage_4', 'Grid-Scale Batteries', 'storage', 'city', 1, ['storage_2'], [unlock('battery_grid')], 'Containerised utility storage.'],
  ['storage_5', 'Market Arbitrage', 'storage', 'city', 1, ['storage_3', 'markets_1'], [feat('battery.arbitrage')], 'Charge cheap, discharge expensive (requires spot pricing).'],
  ['storage_6', 'Compressed Air Storage', 'storage', 'country', 1, ['storage_4'], [unlock('caes')], 'Cavern air storage.'],
  ['storage_7', 'Flow Batteries', 'storage', 'continent', 1, ['storage_6'], [unlock('storage_continental'), mod('storage.capacity', 0.1)], 'Long-duration vanadium flow cells.'],
  ['storage_8', 'Superconducting Storage', 'storage', 'planet', 1, ['storage_7', 'fusion_3'], [unlock('storage_planetary')], 'SMES rings.'],
  ['storage_9', 'Orbital Flywheels', 'storage', 'solar', 1, ['storage_8'], [unlock('storage_orbital')], 'Frictionless flywheels in vacuum.'],
  ['storage_10', 'Antimatter Containment', 'storage', 'galaxy', 1, ['storage_9'], [unlock('storage_galactic'), upg('storage_quantum')], 'Penning-trap banks at scale.'],
  ['storage_11', 'False-Vacuum Reservoirs', 'storage', 'universe', 1, ['storage_10'], [unlock('storage_universal')], 'SPECULATIVE metastable-vacuum storage.'],
  // Grid
  ['grid_1', 'Feeder Upgrades', 'grid', 'backyard', 1.5, [], [], 'Unlocks higher-capacity grid connection tiers on every map.'],
  ['grid_2', 'Medium-Voltage Networks', 'grid', 'neighborhood', 1.2, ['grid_1'], [mod('grid.losses', -0.2)], 'Unlocks backbone interconnect tiers; −20% grid losses.'],
  ['grid_3', 'High-Voltage Transmission', 'grid', 'city', 1.2, ['grid_2'], [mod('grid.capacity', 0.1)], 'Unlocks strategic interconnect tiers; +10% grid capacity.'],
  ['grid_4', 'HVDC Supergrids', 'grid', 'continent', 1, ['grid_3'], [mod('grid.capacity', 0.2), mod('grid.losses', -0.3)], 'Low-loss DC transmission.'],
  ['grid_5', 'Wireless Power Beaming', 'grid', 'planet', 1, ['grid_4', 'orbital_1'], [mod('grid.capacity', 0.25)], 'Microwave power links between regions.'],
  // Materials
  ['materials_1', 'Standardised Components', 'materials', 'backyard', 1, [], [mod('build.cost', -0.05)], '−5% construction cost.'],
  ['materials_2', 'Mountain Engineering', 'materials', 'city', 1, ['materials_1'], [feat('terrain.mountain')], 'Allows purchasing mountain tiles.'],
  ['materials_3', 'Component Recycling', 'materials', 'neighborhood', 0.8, ['materials_1'], [mod('salvage', 0.1)], '+10% salvage value.'],
  ['materials_4', 'Advanced Composites', 'materials', 'country', 1, ['materials_2'], [mod('wear', -0.1)], '−10% equipment wear.'],
  ['materials_5', 'Metamaterials', 'materials', 'planet', 1, ['materials_4'], [mod('build.cost', -0.1)], '−10% construction cost.'],
  ['materials_6', 'Programmable Matter', 'materials', 'galaxy', 1, ['materials_5'], [mod('density', 0.2)], '+20% installation density.'],
  // Maintenance
  ['maintenance_1', 'Maintenance Scheduling', 'maintenance', 'backyard', 1, [], [mod('maintenance.capacity', 0.15)], '+15% maintenance capacity.'],
  ['maintenance_2', 'Condition Monitoring', 'maintenance', 'neighborhood', 1, ['maintenance_1'], [upg('maint_sensors'), feat('automation.priority')], 'Sensor retrofits and priority repair overrides.'],
  ['maintenance_3', 'Predictive Maintenance', 'maintenance', 'city', 1, ['maintenance_2'], [feat('repair.preventive'), mod('wear', -0.08)], 'Idle crews perform preventive servicing; −8% wear.'],
  ['maintenance_4', 'Robotic Maintenance', 'maintenance', 'continent', 1, ['maintenance_3'], [mod('maintenance.capacity', 0.3)], '+30% maintenance capacity.'],
  ['maintenance_5', 'Self-Repairing Systems', 'maintenance', 'solar', 1, ['maintenance_4'], [mod('wear', -0.2), upg('stellar_selfrepair')], '−20% wear.'],
  ['fleet_1', 'Fleet Management', 'maintenance', 'neighborhood', 0.8, ['maintenance_1'], [feat('fleet.upgrade')], 'Bulk fleet retrofits across a map.'],
  // Logistics
  ['logistics_1', 'Delivery Routing', 'logistics', 'neighborhood', 0.8, [], [mod('logistics.speed', 0.2), feat('fuel.autoBuy')], '+20% delivery speed; automated fuel purchasing.'],
  ['logistics_2', 'Fuel Contracts', 'logistics', 'city', 1, ['logistics_1'], [feat('fuel.contracts'), feat('fuel.bulk'), unlock('gas_well')], 'Long-term supply contracts and bulk discounts.'],
  ['logistics_3', 'Pipeline Networks', 'logistics', 'country', 1, ['logistics_2'], [mod('logistics.speed', 0.3), mod('logistics.capacity', 0.25)], 'Pipelines and rail: faster, larger deliveries.'],
  ['logistics_4', 'Orbital Freight', 'logistics', 'solar', 1, ['logistics_3'], [mod('logistics.speed', 0.3)], 'Mass drivers and tugs.'],
  ['land_1', 'Land Surveying', 'logistics', 'neighborhood', 0.6, [], [feat('land.bulk'), mod('land.cost', -0.05)], 'Buy every adjacent purchasable tile in one action (10% bulk discount).'],
  // Workforce
  ['workforce_1', 'Training Programs', 'workforce', 'backyard', 1, [], [mod('workforce.capacity', 0.1)], '+10% workforce capacity.'],
  ['workforce_2', 'Specialist Certification', 'workforce', 'city', 1, ['workforce_1'], [], 'Hire engineers and fleet managers.'],
  ['workforce_3', 'Autonomous Units', 'workforce', 'continent', 1, ['workforce_2', 'research_2'], [], 'Hire robotic maintenance and autonomous freight.'],
  ['workforce_4', 'Synthetic Workforce', 'workforce', 'solar', 1, ['workforce_3'], [mod('workforce.capacity', 0.3), mod('wages', -0.2)], '+30% capacity, −20% wages.'],
  // Markets
  ['markets_1', 'Spot Markets', 'markets', 'city', 1, [], [feat('market.spot')], 'Dynamic hourly prices; hire energy traders.'],
  ['markets_2', 'Power Purchase Agreements', 'markets', 'city', 1, ['markets_1'], [feat('market.contracts')], 'Sell firm power at fixed prices.'],
  ['markets_3', 'Algorithmic Trading', 'markets', 'country', 1, ['markets_2'], [feat('trading.auto'), mod('market.price', 0.05)], 'Automated bidding: +5% market prices.'],
  ['markets_4', 'Interplanetary Exchange', 'markets', 'solar', 1, ['markets_3'], [mod('market.price', 0.05)], '+5% market prices.'],
  // Research
  ['research_1', 'Scientific Method', 'research', 'backyard', 1, [], [mod('research.speed', 0.15)], '+15% research speed.'],
  ['research_2', 'Laboratory Automation', 'research', 'city', 1, ['research_1'], [mod('research.speed', 0.2)], '+20% research speed; research teams.'],
  ['research_3', 'AI Research Assistants', 'research', 'continent', 1, ['research_2'], [mod('research.speed', 0.3)], '+30% research speed; AI clusters.'],
  ['research_4', 'Distributed Cognition', 'research', 'galaxy', 1, ['research_3'], [mod('research.speed', 0.5)], '+50% research speed; distributed minds.'],
  // Orbital
  ['orbital_1', 'Reusable Launch Systems', 'orbital', 'planet', 1.5, ['grid_4', 'materials_5'], [unlock('orbital_solar')], 'Cheap access to orbit: orbital solar power stations.', { milestone: { kind: 'capacity', kw: 5e10 } }],
  ['orbital_2', 'Lunar Industry', 'orbital', 'solar', 1, ['orbital_1'], [unlock('lunar_plant'), mod('orbital.output', 0.1)], 'Mine and build on the Moon.'],
  ['orbital_3', 'Martian Industry', 'orbital', 'solar', 1, ['orbital_2'], [unlock('martian_geo')], 'Industrial base on Mars.'],
  ['orbital_4', 'Interplanetary Beaming', 'orbital', 'solar', 1, ['orbital_2', 'grid_5'], [mod('orbital.output', 0.15), mod('grid.capacity', 0.15), upg('orbital_radiators')], 'Power relays between worlds.'],
  // Stellar
  ['stellar_1', 'Stellar Collection', 'stellar', 'solar', 1, ['orbital_1'], [unlock('stellar_array')], 'Heat-resistant collectors near the Sun.'],
  ['stellar_2', 'Dyson Swarm Engineering', 'stellar', 'solar', 1.5, ['stellar_1', 'orbital_2'], [unlock('dyson_module')], 'BREAKTHROUGH: self-replicating swarm collectors.', { milestone: { kind: 'capacity', kw: 1e17, stage: 'solar' }, minH: 24 }],
  ['stellar_3', 'Adaptive Mirror Films', 'stellar', 'galaxy', 1, ['stellar_2'], [upg('stellar_mirrors'), mod('stellar.output', 0.1)], '+flux capture.'],
  ['stellar_4', 'Matrioshka Shells', 'stellar', 'galaxy', 1.3, ['stellar_3'], [unlock('matrioshka'), upg('stellar_swarm_ai')], 'Nested swarm layers.', { milestone: { kind: 'capacity', kw: 1e27, stage: 'galaxy' } }],
  ['stellar_5', 'Pulsar Induction', 'stellar', 'galaxy', 1, ['stellar_3'], [unlock('pulsar_array')], 'Harvest neutron-star magnetospheres.'],
  ['stellar_6', 'Star Lifting', 'stellar', 'galaxy', 1.2, ['stellar_3'], [unlock('star_lifter'), unlock('accretion')], 'Mine stars; feed accretion harvesters.'],
  // Universal
  ['universal_1', 'Quasar Jet Physics', 'universal', 'universe', 1, ['stellar_4'], [unlock('quasar_tap')], 'Intercept relativistic jets.'],
  ['universal_2', 'Ergosphere Mechanics', 'universal', 'universe', 1.2, ['universal_1'], [unlock('penrose')], 'Penrose-process extraction.'],
  ['universal_3', 'Vacuum Fluctuation Theory', 'universal', 'universe', 1.4, ['universal_2'], [unlock('vacuum_tap'), unlock('exotic_forge'), mod('exotic.output', 0.1), upg('exotic_containment')], 'SPECULATIVE: zero-point extraction with exotic catalysts.'],
  ['universal_4', 'Cosmic Filament Conduits', 'universal', 'universe', 1, ['universal_1'], [unlock('filament_conduit'), upg('exotic_phaselock')], 'Transmit energy along cosmic web filaments.'],
  ['universal_5', 'Convergence Theory', 'universal', 'universe', 3, ['universal_3', 'universal_4', 'research_4'], [unlock('convergence_engine')], 'FINAL BREAKTHROUGH: design the Convergence Engine.', { milestone: { kind: 'capacity', kw: 1e36, stage: 'universe' }, minH: 48 }],
];

export const RESEARCH: Record<string, ResearchDef> = Object.fromEntries(
  rows.map(([id, name, branch, stage, mult, prereq, effects, desc, extra]) => [
    id,
    Object.freeze({ id, name, branch, stage, prereq, effects, desc, rp: Math.round(RP_BASE[stage] * mult), cost: Math.round(STAGES[stage].scale * (stage === 'backyard' ? 20 : 15) * mult), ...extra }),
  ]),
);

/** One-off projects only: repeatables never count toward completion totals or milestones. */
export const RESEARCH_LIST = Object.values(RESEARCH);

/** Repeatable research per area: 10× the area's average project, +30% per level; small effects — something to chew on, not a power spike, forever. */
type Rep = [id: string, name: string, branch: ResearchBranch, stage: StageId, effects: Effect[], desc: string, beyond?: boolean];
const REP_GROWTH = 1.3;
const reps: Rep[] = [
  ['rep_backyard', 'Rooftop Tuning', 'solar', 'backyard', [mod('solar.output', 0.01)], 'Endless small gains from panel angles and wiring.'],
  ['rep_neighborhood', 'Community Efficiency', 'maintenance', 'neighborhood', [mod('maintenance.capacity', 0.015), mod('wages', -0.005)], 'Better rosters and shared crews.'],
  ['rep_city', 'Urban Grid Tuning', 'grid', 'city', [mod('grid.capacity', 0.015), mod('grid.losses', -0.01)], 'Re-conductoring and load balancing, street by street.'],
  ['rep_country', 'Thermal Refinement', 'thermal', 'country', [mod('thermal.eta', 0.005), mod('wear', -0.005)], 'Incremental turbine and boiler improvements.'],
  ['rep_continent', 'Supergrid Optimisation', 'wind', 'continent', [mod('wind.output', 0.01), mod('hydro.output', 0.01)], 'Continental forecasting and dispatch.'],
  ['rep_planet', 'Planetary Engineering', 'fusion', 'planet', [mod('fusion.output', 0.01), mod('build.cost', -0.005)], 'Industrial scale-up on a planetary scale.'],
  ['rep_solar', 'Orbital Refinement', 'orbital', 'solar', [mod('orbital.output', 0.01), mod('storage.capacity', 0.015)], 'Lighter structures, denser storage.'],
  ['rep_galaxy', 'Stellar Refinement', 'stellar', 'galaxy', [mod('stellar.output', 0.01)], 'Tighter swarm orbits and better collectors.'],
  ['rep_universe', 'Exotic Refinement', 'universal', 'universe', [mod('exotic.output', 0.01)], 'Coaxing more from the vacuum.'],
  ['rep_unified', 'Unified Field Studies', 'universal', 'universe', [mod('solar.output', 0.005), mod('wind.output', 0.005), mod('hydro.output', 0.005), mod('fusion.output', 0.005), mod('orbital.output', 0.005), mod('stellar.output', 0.005), mod('exotic.output', 0.005)], 'Every generator gets a little better.', true],
  ['rep_entropy', 'Entropy Management', 'materials', 'universe', [mod('wear', -0.01), mod('build.cost', -0.01)], 'Slower decay, cheaper construction.', true],
  ['rep_cosmic_ops', 'Cosmic Operations', 'logistics', 'universe', [mod('maintenance.capacity', 0.02), mod('logistics.speed', 0.02), mod('workforce.capacity', 0.015)], 'Crews and freight that span the cosmos.', true],
];
const avgRP = (st: StageId) => {
  const xs = RESEARCH_LIST.filter((r) => r.stage === st);
  return xs.reduce((a, r) => a + r.rp, 0) / Math.max(1, xs.length);
};
for (const [id, name, branch, stage, effects, desc, beyond] of reps)
  RESEARCH[id] = Object.freeze({ id, name, branch, stage, effects, desc, beyond, prereq: beyond ? ['universal_5'] : [], cost: 0, rp: Math.round(avgRP(stage) * (beyond ? 3 : 1) * 10), repeat: { growth: REP_GROWTH } });

export const REPEATABLE_LIST = Object.values(RESEARCH).filter((r) => r.repeat);

/** RP needed for the next level of a repeatable (or the project's RP). */
export const levelRP = (r: ResearchDef, level: number) => (r.repeat ? Math.round(r.rp * Math.pow(r.repeat.growth, level)) : r.rp);

export const BRANCHES: { id: ResearchBranch; name: string }[] = [
  { id: 'solar', name: 'Solar' }, { id: 'wind', name: 'Wind' }, { id: 'hydro', name: 'Hydroelectric' }, { id: 'thermal', name: 'Thermal' },
  { id: 'geothermal', name: 'Geothermal' }, { id: 'nuclear', name: 'Nuclear' }, { id: 'fusion', name: 'Fusion' }, { id: 'storage', name: 'Storage' },
  { id: 'grid', name: 'Grid & transmission' }, { id: 'materials', name: 'Materials' }, { id: 'maintenance', name: 'Maintenance' }, { id: 'logistics', name: 'Logistics' },
  { id: 'workforce', name: 'Workforce' }, { id: 'markets', name: 'Energy markets' }, { id: 'research', name: 'Research efficiency' }, { id: 'orbital', name: 'Orbital' },
  { id: 'stellar', name: 'Stellar engineering' }, { id: 'universal', name: 'Universal' },
];
