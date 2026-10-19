import { BALANCE } from './balance';
import { FUELS } from './fuels';
import { STAGES } from './stages';
import type { BuildingDef, StageId, TerrainId } from './types';

/**
 * Building catalog. Each definition describes ONE represented unit (a panel, a turbine, a
 * reactor...). On a map, a building's unit count is derived from usable footprint area and
 * the unit's operating spacing (see world/BuildingAggregation.ts). Costs are derived from a
 * payback target at the native stage's electricity price unless explicitly given, which keeps
 * the whole catalog on one coherent economic curve.
 */

const OPEN: TerrainId[] = ['grass', 'hill', 'desert', 'urban', 'industrial', 'coast'];
const LAND: TerrainId[] = ['grass', 'hill', 'desert', 'urban', 'industrial', 'coast', 'forest', 'mountain', 'geothermal'];
const FLAT: TerrainId[] = ['grass', 'desert', 'industrial', 'urban', 'coast'];
const SPACE: TerrainId[] = ['void', 'inner', 'orbit', 'asteroid'];
const STARS: TerrainId[] = ['star_red', 'star_yellow', 'star_blue'];
const GALAXIES: TerrainId[] = ['galaxy_spiral', 'galaxy_elliptical'];
const ALL_STAGES: StageId[] = ['backyard', 'neighborhood', 'city', 'country', 'continent', 'planet', 'solar', 'galaxy', 'universe'];
const COOLING_WATER: TerrainId[] = ['river', 'lake', 'coast', 'ocean', 'reservoir'];

type Partial2 = Omit<BuildingDef, 'aggregate' | 'wear' | 'aging' | 'maint' | 'salvage' | 'paybackH' | 'category'> &
  Partial<Pick<BuildingDef, 'aggregate' | 'wear' | 'aging' | 'maint' | 'salvage' | 'paybackH' | 'category'>>;

function b(d: Partial2): BuildingDef {
  return Object.freeze({
    category: 'generation',
    aggregate: true,
    wear: 0.003,
    aging: 0.00001,
    maint: 1,
    salvage: 0.4,
    paybackH: 100,
    ...d,
  }) as BuildingDef;
}

const list: BuildingDef[] = [
  // ───────────── House (fixed) ─────────────
  b({ id: 'house', name: 'Your House', desc: 'Your home. Household demand is supplied first; generation offsets your electricity bill.', family: 'house', art: 'house', stages: ['backyard'],
    size: [2, 2], terrain: ['urban', 'grass'], unit: { label: 'house', kw: 0, areaM2: 0 }, aggregate: false, category: 'special', fixed: true, unique: true, wear: 0, maint: 0, salvage: 0, infra: { role: 'house' } }),

  // ───────────── Solar ─────────────
  b({ id: 'pv_rooftop', name: 'Rooftop PV Array', desc: 'Residential photovoltaic panels. Daylight only; slow soiling wear.', family: 'solar', art: 'pv', stages: ['backyard', 'neighborhood'],
    size: [1, 1], terrain: OPEN, unit: { label: 'PV panel', kw: 0.4, areaM2: 2.2 }, paybackH: 70, gen: { kind: 'solar' }, wear: 0.0022, aging: 0.00002, maint: 0.3, salvage: 0.5,
    upgrades: ['solar_clean', 'solar_tracking'], successor: 'pv_improved' }),
  b({ id: 'pv_improved', name: 'High-Efficiency Rooftop PV', desc: 'Monocrystalline panels with 37% more output per panel area.', family: 'solar', art: 'pv2', stages: ['backyard', 'neighborhood', 'city'],
    size: [1, 1], terrain: OPEN, unit: { label: 'PV panel', kw: 0.55, areaM2: 2.2 }, paybackH: 62, research: 'solar_1', gen: { kind: 'solar' }, wear: 0.002, aging: 0.000015, maint: 0.3, salvage: 0.5,
    upgrades: ['solar_clean', 'solar_tracking', 'solar_bifacial'] }),
  b({ id: 'pv_commercial', name: 'Commercial Solar Array', desc: 'Ground-mounted commercial PV rows with access spacing.', family: 'solar', art: 'pv_farm', stages: ['neighborhood', 'city'],
    size: [1, 1], terrain: OPEN, unit: { label: 'PV module', kw: 0.45, areaM2: 4 }, paybackH: 90, gen: { kind: 'solar' }, wear: 0.0018, aging: 0.000015, maint: 1, salvage: 0.5,
    upgrades: ['solar_clean', 'solar_tracking', 'solar_bifacial'] }),
  b({ id: 'pv_utility', name: 'Utility Solar Farm', desc: 'Utility-scale PV with inverter stations and row spacing.', family: 'solar', art: 'pv_farm', stages: ['city', 'country'],
    size: [2, 2], terrain: FLAT.concat('hill'), unit: { label: 'PV module', kw: 0.5, areaM2: 6 }, paybackH: 100, gen: { kind: 'solar' }, wear: 0.0016, aging: 0.000012, maint: 2.5, salvage: 0.5,
    upgrades: ['solar_clean', 'solar_tracking', 'solar_bifacial'] }),
  b({ id: 'pv_bifacial', name: 'Bifacial PV Plant', desc: 'High-efficiency bifacial modules on trackers.', family: 'solar', art: 'pv_farm2', stages: ['country', 'continent'],
    size: [2, 2], terrain: FLAT.concat('hill'), unit: { label: 'PV module', kw: 0.6, areaM2: 6 }, paybackH: 95, research: 'solar_4', gen: { kind: 'solar' }, wear: 0.0015, aging: 0.00001, maint: 3, salvage: 0.5,
    upgrades: ['solar_clean', 'solar_tracking'] }),
  b({ id: 'csp_tower', name: 'Concentrated Solar Tower', desc: 'Heliostats focus sunlight on a molten-salt tower. Stores 10 h of heat: dispatchable after sunset.', family: 'solar', art: 'csp', stages: ['country', 'continent'],
    size: [2, 2], terrain: ['desert', 'grass', 'hill'], unit: { label: '100 MW tower block', kw: 100_000, areaM2: 2e6 }, paybackH: 105, research: 'solar_5', gen: { kind: 'csp', storageH: 10 }, wear: 0.0025, aging: 0.00001, maint: 4, salvage: 0.35,
    upgrades: ['thermal_turbine'] }),
  b({ id: 'pv_mega', name: 'Continental Solar Complex', desc: 'Contiguous desert-scale PV complex with HVDC collection.', family: 'solar', art: 'pv_farm2', stages: ['continent', 'planet'],
    size: [3, 3], terrain: FLAT.concat('hill'), unit: { label: 'PV module', kw: 0.65, areaM2: 6 }, paybackH: 100, gen: { kind: 'solar' }, wear: 0.0014, aging: 0.00001, maint: 5, salvage: 0.5,
    upgrades: ['solar_clean', 'solar_tracking'] }),
  b({ id: 'pv_planetary', name: 'Planetary Solar Belt', desc: 'Planet-girdling PV belt; dawn-to-dusk coverage across longitudes smooths output.', family: 'solar', art: 'pv_belt', stages: ['planet'],
    size: [3, 3], terrain: LAND.filter((t) => t !== 'forest'), unit: { label: 'PV tile', kw: 0.7, areaM2: 5.5 }, paybackH: 100, gen: { kind: 'solar' }, wear: 0.0012, aging: 0.000008, maint: 6, salvage: 0.5 }),
  b({ id: 'orbital_solar', name: 'Orbital Solar Power Station', desc: 'Geostationary collectors beam microwaves to a ground rectenna. Near-continuous output, no night.', family: 'orbital', art: 'orbital_solar', stages: ['planet'],
    size: [2, 2], terrain: LAND.concat('ocean'), unit: { label: '5 GW station', kw: 5e6, areaM2: 4e8 }, paybackH: 120, research: 'orbital_1', gen: { kind: 'orbital' }, wear: 0.0012, aging: 0.000005, maint: 6, salvage: 0.2,
    upgrades: ['stellar_mirrors', 'orbital_radiators', 'stellar_selfrepair'] }),
  b({ id: 'orbital_collector', name: 'Orbital Collector Array', desc: 'Free-flying thin-film collectors in solar orbit. Output scales with local stellar flux.', family: 'orbital', art: 'collector', stages: ['solar'],
    size: [2, 2], terrain: ['void', 'inner', 'orbit', 'asteroid'], unit: { label: '1 km² collector', kw: 4e5, areaM2: 1e9 }, paybackH: 100, gen: { kind: 'orbital' }, wear: 0.001, aging: 0.000005, maint: 5, salvage: 0.2,
    upgrades: ['stellar_mirrors', 'orbital_radiators', 'stellar_selfrepair'] }),
  b({ id: 'stellar_array', name: 'Stellar Collection Array', desc: 'Heat-hardened collectors close to the Sun.', family: 'stellar', art: 'stellar_array', stages: ['solar'],
    size: [2, 2], terrain: ['inner', 'corona'], unit: { label: 'array segment', kw: 2e6, areaM2: 1.2e9 }, paybackH: 95, research: 'stellar_1', gen: { kind: 'stellar' }, wear: 0.0018, aging: 0.000008, maint: 6, salvage: 0.15,
    upgrades: ['stellar_mirrors', 'stellar_swarm_ai', 'stellar_selfrepair'] }),
  b({ id: 'dyson_module', name: 'Dyson Swarm Module', desc: 'A cohort of independent orbiting collectors — a swarm, not a rigid shell. Shading gives diminishing returns as swarm coverage of the star grows.', family: 'stellar', art: 'dyson', stages: ['solar'],
    size: [1, 1], terrain: ['inner', 'corona', 'orbit'], unit: { label: 'swarm collector', kw: 1e7, areaM2: 5e9 }, paybackH: 90, research: 'stellar_2', gen: { kind: 'dyson' }, wear: 0.0012, aging: 0.000005, maint: 6, salvage: 0.1,
    upgrades: ['stellar_mirrors', 'stellar_swarm_ai', 'stellar_selfrepair'] }),
  b({ id: 'stellar_swarm', name: 'Stellar Swarm Network', desc: 'Swarms around many star systems in a star field. Output depends on star class.', family: 'stellar', art: 'swarm_net', stages: ['galaxy'],
    size: [2, 2], terrain: STARS, unit: { label: 'equipped star system', kw: 1e23, areaM2: 1e34 }, paybackH: 100, gen: { kind: 'stellar' }, wear: 0.001, aging: 0.000004, maint: 6, salvage: 0.1,
    upgrades: ['stellar_mirrors', 'stellar_swarm_ai', 'stellar_selfrepair'] }),
  b({ id: 'matrioshka', name: 'Matrioshka Collector Shell', desc: 'Nested swarm layers reuse each layer\'s waste heat. Highest efficiency per star.', family: 'stellar', art: 'matrioshka', stages: ['galaxy'],
    size: [2, 2], terrain: ['star_yellow', 'star_blue'], unit: { label: 'shelled star', kw: 3.5e23, areaM2: 1e34 }, paybackH: 92, research: 'stellar_4', gen: { kind: 'stellar' }, wear: 0.0009, aging: 0.000003, maint: 7, salvage: 0.1,
    upgrades: ['stellar_mirrors', 'stellar_swarm_ai', 'stellar_selfrepair'] }),
  b({ id: 'galactic_node', name: 'Galactic Coordination Node', desc: 'Coordinates the stellar networks of whole galaxies into one dispatchable output.', family: 'stellar', art: 'galactic_node', stages: ['universe'],
    size: [2, 2], terrain: GALAXIES, unit: { label: 'coordinated galaxy', kw: 1e33, areaM2: 9e43 }, paybackH: 100, gen: { kind: 'stellar' }, wear: 0.001, aging: 0.000003, maint: 6, salvage: 0.1, upgrades: ['stellar_swarm_ai', 'stellar_selfrepair'] }),

  // ───────────── Wind ─────────────
  b({ id: 'wind_micro', name: 'Micro Wind Turbine', desc: 'Small rooftop/garden turbine. Produces day and night; mechanical wear needs regular service.', family: 'wind', art: 'wind_small', stages: ['backyard', 'neighborhood'],
    size: [1, 1], terrain: ['grass', 'hill', 'coast', 'desert', 'urban'], unit: { label: 'micro turbine', kw: 1.2, areaM2: 20 }, paybackH: 78, gen: { kind: 'wind' }, wear: 0.0065, aging: 0.00002, maint: 0.6, salvage: 0.45, shutdownBelow: 0.25,
    upgrades: ['wind_bearings', 'wind_blades'], successor: 'wind_residential' }),
  b({ id: 'wind_residential', name: 'Residential Wind Turbine', desc: 'Taller mast, larger rotor.', family: 'wind', art: 'wind_small', stages: ['backyard', 'neighborhood'],
    size: [1, 1], terrain: ['grass', 'hill', 'coast', 'desert'], unit: { label: 'turbine', kw: 2.5, areaM2: 20 }, paybackH: 70, research: 'wind_1', gen: { kind: 'wind' }, wear: 0.006, aging: 0.000018, maint: 0.7, salvage: 0.45, shutdownBelow: 0.25,
    upgrades: ['wind_bearings', 'wind_blades'] }),
  b({ id: 'wind_commercial', name: 'Community Wind Turbine', desc: '250 kW turbine with 3-rotor-diameter spacing.', family: 'wind', art: 'wind', stages: ['neighborhood', 'city'],
    size: [2, 2], terrain: ['grass', 'hill', 'coast', 'desert', 'forest'], unit: { label: '250 kW turbine', kw: 250, areaM2: 8100 }, paybackH: 62, gen: { kind: 'wind' }, wear: 0.0055, aging: 0.000015, maint: 1.5, salvage: 0.45, shutdownBelow: 0.25,
    upgrades: ['wind_bearings', 'wind_blades', 'wind_controls'] }),
  b({ id: 'wind_utility', name: 'Utility Wind Farm', desc: '3 MW turbines spaced 3×5 rotor diameters to limit wake losses.', family: 'wind', art: 'wind_farm', stages: ['city', 'country'],
    size: [2, 2], terrain: ['grass', 'hill', 'coast', 'desert', 'forest', 'mountain'], unit: { label: '3 MW turbine', kw: 3000, areaM2: 1.5e5 }, paybackH: 66, gen: { kind: 'wind' }, wear: 0.005, aging: 0.000012, maint: 3, salvage: 0.45, shutdownBelow: 0.25,
    upgrades: ['wind_bearings', 'wind_blades', 'wind_controls'] }),
  b({ id: 'wind_offshore', name: 'Offshore Wind Farm', desc: '12 MW turbines at 7D spacing on open water. Strong, steady winds.', family: 'wind', art: 'wind_offshore', stages: ['country', 'continent'],
    size: [2, 2], terrain: ['ocean', 'coast'], unit: { label: '12 MW turbine', kw: 12000, areaM2: 1.2e6 }, paybackH: 70, research: 'wind_4', gen: { kind: 'wind' }, wear: 0.0055, aging: 0.000012, maint: 4, salvage: 0.4, shutdownBelow: 0.25,
    upgrades: ['wind_bearings', 'wind_blades', 'wind_controls'] }),
  b({ id: 'wind_mega', name: 'Supergrid Wind Province', desc: 'Continental wind province of 15 MW turbines.', family: 'wind', art: 'wind_farm', stages: ['continent', 'planet'],
    size: [3, 3], terrain: ['grass', 'hill', 'coast', 'desert', 'forest', 'mountain', 'ocean'], unit: { label: '15 MW turbine', kw: 15000, areaM2: 1.2e6 }, paybackH: 68, gen: { kind: 'wind' }, wear: 0.0045, aging: 0.00001, maint: 5, salvage: 0.4, shutdownBelow: 0.25,
    upgrades: ['wind_bearings', 'wind_blades', 'wind_controls'] }),
  b({ id: 'kite', name: 'Jet-Stream Kite Array', desc: 'Tethered high-altitude wings harvesting steady jet-stream winds (capacity factor ~60%).', family: 'wind', art: 'kite', stages: ['planet'],
    size: [2, 2], terrain: LAND.concat('ocean'), unit: { label: '5 MW kite', kw: 5000, areaM2: 4e5 }, paybackH: 70, research: 'wind_6', gen: { kind: 'wind' }, wear: 0.005, aging: 0.00001, maint: 5, salvage: 0.3, shutdownBelow: 0.25,
    upgrades: ['wind_controls'] }),

  // ───────────── Hydro ─────────────
  b({ id: 'waterwheel', name: 'Garden Waterwheel', desc: 'Undershot wheel on the stream. Output follows stream flow.', family: 'hydro', art: 'waterwheel', stages: ['backyard'],
    size: [1, 1], terrain: ['river'], unit: { label: 'waterwheel', kw: 1.5, areaM2: 0 }, aggregate: false, paybackH: 75, gen: { kind: 'hydro', head: 1.6, eta: 0.6 }, wear: 0.004, maint: 0.5, salvage: 0.4 }),
  b({ id: 'micro_hydro', name: 'Micro-Hydro Turbine', desc: 'Cross-flow turbine on the creek.', family: 'hydro', art: 'hydro_small', stages: ['neighborhood', 'city'],
    size: [1, 1], terrain: ['river'], unit: { label: 'turbine', kw: 60, areaM2: 0 }, aggregate: false, paybackH: 70, research: 'hydro_1', gen: { kind: 'hydro', head: 4, eta: 0.75 }, wear: 0.0035, maint: 1, salvage: 0.4,
    upgrades: ['hydro_turbine'] }),
  b({ id: 'run_of_river', name: 'Run-of-River Plant', desc: 'Diversion weir and turbines; no reservoir, output follows river flow.', family: 'hydro', art: 'hydro_small', stages: ['city', 'country'],
    size: [1, 1], terrain: ['river'], unit: { label: 'plant', kw: 9000, areaM2: 0 }, aggregate: false, paybackH: 80, gen: { kind: 'hydro', head: 12, eta: 0.85 }, wear: 0.003, maint: 2, salvage: 0.35,
    upgrades: ['hydro_turbine'] }),
  b({ id: 'small_dam', name: 'Small Hydro Dam', desc: 'Impounds a reservoir upstream (floods low land). Stored water makes output dispatchable.', family: 'hydro', art: 'dam', stages: ['city', 'country'],
    size: [1, 1], terrain: ['river'], unit: { label: 'dam', kw: 30000, areaM2: 0 }, aggregate: false, paybackH: 90, research: 'hydro_3', gen: { kind: 'dam', head: 30, crest: 35, eta: 0.88 }, wear: 0.002, maint: 3, salvage: 0.15, decommission: 0.05,
    upgrades: ['hydro_turbine'] }),
  b({ id: 'large_dam', name: 'Large Hydroelectric Dam', desc: 'Major concrete dam with spillway gates. Large reservoir, cascade-aware.', family: 'hydro', art: 'dam', stages: ['country', 'continent'],
    size: [1, 1], terrain: ['river'], unit: { label: 'dam', kw: 2.4e6, areaM2: 0 }, aggregate: false, paybackH: 95, research: 'hydro_4', gen: { kind: 'dam', head: 140, crest: 160, eta: 0.9 }, wear: 0.0015, maint: 5, salvage: 0.1, decommission: 0.06,
    upgrades: ['hydro_turbine'] }),
  b({ id: 'hydro_complex', name: 'Continental Hydro Complex', desc: 'Chain of high dams and tunnels on a major river.', family: 'hydro', art: 'dam', stages: ['continent'],
    size: [1, 1], terrain: ['river'], unit: { label: 'complex', kw: 1.5e8, areaM2: 0 }, aggregate: false, paybackH: 95, research: 'hydro_7', gen: { kind: 'dam', head: 250, crest: 280, eta: 0.92 }, wear: 0.0012, maint: 6, salvage: 0.1, decommission: 0.06,
    upgrades: ['hydro_turbine'] }),
  b({ id: 'tidal_barrage', name: 'Tidal Barrage', desc: 'Generates on ebb and flood tides — perfectly predictable 12.4 h cycle.', family: 'hydro', art: 'tidal', stages: ['country', 'continent'],
    size: [2, 1], terrain: ['coast'], unit: { label: 'barrage', kw: 1.2e6, areaM2: 0 }, aggregate: false, paybackH: 85, research: 'hydro_6', gen: { kind: 'tidal' }, wear: 0.0025, maint: 4, salvage: 0.15,
    upgrades: ['hydro_turbine'] }),

  // ───────────── Fossil ─────────────
  b({ id: 'diesel_gen', name: 'Diesel Generator Bank', desc: 'Dispatchable backup. Fast ramp, expensive fuel.', family: 'fossil', art: 'diesel', stages: ['neighborhood', 'city'],
    size: [1, 1], terrain: OPEN.concat('forest'), unit: { label: '150 kW genset bank', kw: 150, areaM2: 0 }, aggregate: false, paybackH: 30, wear: 0.006, maint: 1.2, salvage: 0.35, emissions: 1,
    thermal: { fuel: 'diesel', eta: 0.36, minLoad: 0.25, ramp: 8, cooling: 1.2, partLoad: 0.25, tankH: 8 }, upgrades: ['thermal_hx', 'thermal_whr'] }),
  b({ id: 'gas_peaker', name: 'Gas Turbine Peaker', desc: 'Open-cycle gas turbine: starts fast, follows load.', family: 'fossil', art: 'gas', stages: ['neighborhood', 'city', 'country'],
    size: [1, 1], terrain: OPEN, unit: { label: '400 kW turbine', kw: 400, areaM2: 0 }, aggregate: false, paybackH: 36, research: 'thermal_1', wear: 0.005, maint: 1.5, salvage: 0.35, emissions: 1,
    thermal: { fuel: 'gas', eta: 0.32, minLoad: 0.2, ramp: 10, cooling: 1.2, partLoad: 0.3, tankH: 12 }, upgrades: ['thermal_hx', 'thermal_whr'] }),
  b({ id: 'coal_plant', name: 'Coal-Fired Power Station', desc: 'Boiler, steam turbine and cooling. Cheap fuel, slow ramp, 40% minimum stable load.', family: 'fossil', art: 'coal', stages: ['city', 'country'],
    size: [2, 2], terrain: ['grass', 'industrial', 'desert', 'hill', 'coast'], adjacent: undefined, unit: { label: '300 MW unit', kw: 3e5, areaM2: 0 }, aggregate: false, paybackH: 55, wear: 0.0035, maint: 4, salvage: 0.15, decommission: 0.05, emissions: 1,
    thermal: { fuel: 'coal', eta: 0.38, minLoad: 0.4, ramp: 0.5, cooling: 0.92, partLoad: 0.2, tankH: 36 }, upgrades: ['thermal_hx', 'thermal_turbine', 'thermal_storage'] }),
  b({ id: 'ccgt', name: 'Combined-Cycle Gas Plant', desc: 'Gas turbine plus heat-recovery steam cycle. 56% efficient, flexible.', family: 'fossil', art: 'ccgt', stages: ['city', 'country', 'continent'],
    size: [2, 1], terrain: ['grass', 'industrial', 'desert', 'coast', 'urban'], unit: { label: '400 MW block', kw: 4e5, areaM2: 0 }, aggregate: false, paybackH: 55, research: 'thermal_4', wear: 0.0035, maint: 4, salvage: 0.25, emissions: 1,
    thermal: { fuel: 'gas', eta: 0.56, minLoad: 0.35, ramp: 3, cooling: 1, partLoad: 0.25, tankH: 18 }, upgrades: ['thermal_hx', 'thermal_turbine'] }),
  b({ id: 'adv_coal', name: 'Ultra-Supercritical Plant', desc: 'Advanced steam conditions push coal to 46% efficiency.', family: 'fossil', art: 'coal', stages: ['country', 'continent'],
    size: [2, 2], terrain: ['grass', 'industrial', 'desert', 'hill', 'coast'], unit: { label: '1 GW unit', kw: 1e6, areaM2: 1e7 }, paybackH: 55, research: 'thermal_6', wear: 0.003, maint: 5, salvage: 0.15, decommission: 0.05, emissions: 1,
    thermal: { fuel: 'coal', eta: 0.46, minLoad: 0.35, ramp: 0.7, cooling: 0.95, partLoad: 0.18, tankH: 36 }, upgrades: ['thermal_hx', 'thermal_turbine', 'thermal_storage'] }),

  // ───────────── Biomass ─────────────
  b({ id: 'biomass_burner', name: 'Biomass Boiler Plant', desc: 'Burns wood chips and energy crops. Fuel can be grown locally.', family: 'biomass', art: 'biomass', stages: ['neighborhood', 'city'],
    size: [1, 1], terrain: OPEN.concat('forest'), unit: { label: '120 kW plant', kw: 120, areaM2: 0 }, aggregate: false, paybackH: 45, research: 'biomass_1', wear: 0.005, maint: 1.2, salvage: 0.3, emissions: 1,
    thermal: { fuel: 'biomass', eta: 0.25, minLoad: 0.35, ramp: 1.5, cooling: 1.1, partLoad: 0.2, tankH: 24 }, upgrades: ['thermal_hx', 'thermal_whr'] }),
  b({ id: 'biomass_commercial', name: 'Commercial Biomass Station', desc: '30 MW grate-fired biomass station.', family: 'biomass', art: 'biomass', stages: ['city', 'country'],
    size: [1, 1], terrain: OPEN.concat('forest'), unit: { label: '30 MW station', kw: 3e4, areaM2: 0 }, aggregate: false, paybackH: 50, research: 'biomass_2', wear: 0.0045, maint: 2.5, salvage: 0.3, emissions: 1,
    thermal: { fuel: 'biomass', eta: 0.3, minLoad: 0.35, ramp: 1, cooling: 1, partLoad: 0.2, tankH: 24 }, upgrades: ['thermal_hx', 'thermal_turbine', 'thermal_whr'] }),
  b({ id: 'biomass_industrial', name: 'Industrial Biomass Plant', desc: '500 MW circulating fluidised-bed biomass plant.', family: 'biomass', art: 'biomass', stages: ['country', 'continent'],
    size: [2, 2], terrain: OPEN.concat('forest'), unit: { label: '500 MW plant', kw: 5e5, areaM2: 1e7 }, paybackH: 52, research: 'biomass_3', wear: 0.004, maint: 4, salvage: 0.25, emissions: 1,
    thermal: { fuel: 'biomass', eta: 0.36, minLoad: 0.35, ramp: 1, cooling: 1, partLoad: 0.2, tankH: 24 }, upgrades: ['thermal_hx', 'thermal_turbine'] }),

  // ───────────── Geothermal ─────────────
  b({ id: 'geo_small', name: 'Geothermal Plant', desc: 'Flash-steam plant on a geothermal field. Constant output; reservoir pressure slowly declines under load and recovers when idle.', family: 'geothermal', art: 'geo', stages: ['city', 'country'],
    size: [1, 1], terrain: ['geothermal'], unit: { label: '40 MW plant', kw: 4e4, areaM2: 0 }, aggregate: false, paybackH: 85, research: 'geo_1', gen: { kind: 'geothermal', decline: 0.0004 }, wear: 0.0025, maint: 2.5, salvage: 0.25,
    upgrades: ['geo_reinject'] }),
  b({ id: 'geo_deep', name: 'Deep Geothermal Plant', desc: '5 km wells into hot rock.', family: 'geothermal', art: 'geo', stages: ['country', 'continent'],
    size: [1, 1], terrain: ['geothermal', 'mountain', 'hill'], terrainBonus: { geothermal: 2.5 }, unit: { label: '600 MW plant', kw: 6e5, areaM2: 0 }, aggregate: false, paybackH: 88, research: 'geo_2', gen: { kind: 'geothermal', decline: 0.0003 }, wear: 0.0022, maint: 3, salvage: 0.25,
    upgrades: ['geo_reinject'] }),
  b({ id: 'geo_egs', name: 'Enhanced Geothermal System', desc: 'Engineered reservoirs anywhere with hot dry rock; best on geothermal fields.', family: 'geothermal', art: 'geo', stages: ['continent', 'planet'],
    size: [2, 2], terrain: ['geothermal', 'mountain', 'hill', 'grass', 'desert'], terrainBonus: { geothermal: 2 }, unit: { label: '5 GW field', kw: 5e6, areaM2: 2e8 }, paybackH: 90, research: 'geo_3', gen: { kind: 'geothermal', decline: 0.00025 }, wear: 0.002, maint: 4, salvage: 0.2,
    upgrades: ['geo_reinject'] }),
  b({ id: 'geo_planetary', name: 'Planetary Mantle Tap', desc: 'Deep mantle heat exchangers.', family: 'geothermal', art: 'geo', stages: ['planet'],
    size: [2, 2], terrain: ['geothermal', 'mountain', 'hill', 'grass', 'desert'], terrainBonus: { geothermal: 2 }, unit: { label: 'mantle tap', kw: 2e8, areaM2: 1e10 }, paybackH: 92, research: 'geo_4', gen: { kind: 'geothermal', decline: 0.0002 }, wear: 0.0018, maint: 5, salvage: 0.2,
    upgrades: ['geo_reinject'] }),
  b({ id: 'martian_geo', name: 'Martian Geothermal Complex', desc: 'Volcanic-province heat mining on Mars.', family: 'geothermal', art: 'geo', stages: ['solar'],
    size: [1, 1], terrain: ['martian'], unit: { label: 'complex', kw: 1.5e16, areaM2: 0 }, aggregate: false, paybackH: 90, research: 'orbital_3', gen: { kind: 'geothermal', decline: 0.0002 }, wear: 0.0018, maint: 5, salvage: 0.2,
    upgrades: ['geo_reinject'] }),

  // ───────────── Nuclear ─────────────
  b({ id: 'smr', name: 'Small Modular Reactor', desc: '300 MW light-water SMR. Automatic safe cooling; refuels every ~30 days with a 24 h outage.', family: 'nuclear', art: 'smr', stages: ['country', 'continent'],
    size: [1, 1], terrain: ['grass', 'industrial', 'coast', 'hill', 'desert'], unit: { label: '300 MW reactor', kw: 3e5, areaM2: 4e6 }, paybackH: 60, research: 'nuclear_1', wear: 0.002, maint: 4, salvage: 0.05, decommission: 0.15,
    thermal: { fuel: 'uranium', eta: 0.33, minLoad: 0.5, ramp: 0.3, cooling: 1, partLoad: 0.1, tankH: 720, refuelOutageH: 24 }, upgrades: ['nuclear_fuel', 'nuclear_uprate', 'thermal_hx'] }),
  b({ id: 'pwr', name: 'Pressurized Water Reactor', desc: '1.6 GW PWR with cooling towers. Baseload workhorse; 72 h refuelling outages.', family: 'nuclear', art: 'nuclear', stages: ['country', 'continent'],
    size: [2, 2], terrain: ['grass', 'industrial', 'coast', 'hill', 'desert'], unit: { label: '1.6 GW reactor', kw: 1.6e6, areaM2: 6e6 }, paybackH: 58, research: 'nuclear_3', wear: 0.0018, maint: 6, salvage: 0.05, decommission: 0.18,
    thermal: { fuel: 'uranium', eta: 0.34, minLoad: 0.6, ramp: 0.2, cooling: 0.95, partLoad: 0.1, tankH: 1440, refuelOutageH: 72 }, upgrades: ['nuclear_fuel', 'nuclear_uprate', 'thermal_hx', 'thermal_turbine'] }),
  b({ id: 'gen4', name: 'Gen IV Fast Reactor', desc: 'Sodium-cooled fast reactor: breeds fuel, 42% efficient.', family: 'nuclear', art: 'nuclear', stages: ['continent', 'planet'],
    size: [2, 2], terrain: ['grass', 'industrial', 'coast', 'hill', 'desert'], unit: { label: '4 GW reactor', kw: 4e6, areaM2: 1e7 }, paybackH: 58, research: 'nuclear_4', wear: 0.0016, maint: 7, salvage: 0.05, decommission: 0.15,
    thermal: { fuel: 'uranium', eta: 0.42, minLoad: 0.5, ramp: 0.3, cooling: 1, partLoad: 0.1, tankH: 2880, refuelOutageH: 48 }, upgrades: ['nuclear_fuel', 'nuclear_uprate', 'thermal_hx'] }),
  b({ id: 'msr', name: 'Molten-Salt Thorium Reactor', desc: 'Liquid-fuel reactor. Load-following capable (fast ramp, 25% min load), online refuelling.', family: 'nuclear', art: 'msr', stages: ['continent', 'planet'],
    size: [2, 2], terrain: ['grass', 'industrial', 'coast', 'hill', 'desert', 'mountain'], unit: { label: '2 GW reactor', kw: 2e6, areaM2: 1e7 }, paybackH: 58, research: 'nuclear_5', wear: 0.0016, maint: 7, salvage: 0.05, decommission: 0.12,
    thermal: { fuel: 'uranium', eta: 0.45, minLoad: 0.25, ramp: 2, cooling: 1.05, partLoad: 0.1, tankH: 240 }, upgrades: ['nuclear_uprate', 'thermal_hx', 'thermal_turbine'] }),

  // ───────────── Fusion ─────────────
  b({ id: 'tokamak', name: 'Tokamak Fusion Plant', desc: 'Magnetic-confinement fusion fleet. Needs ignition energy, draws 15% for magnets, must stay above 50% load or the plasma quenches.', family: 'fusion', art: 'fusion', stages: ['planet', 'solar'],
    size: [2, 2], terrain: ['grass', 'industrial', 'coast', 'desert', 'hill'], unit: { label: '2 GW tokamak', kw: 2e6, areaM2: 2e7 }, paybackH: 70, research: 'fusion_1', wear: 0.004, maint: 6, salvage: 0.1, decommission: 0.04,
    thermal: { fuel: 'fusion', eta: 0.45, minLoad: 0.5, ramp: 1, cooling: 1.1, partLoad: 0.1, tankH: 48, parasitic: 0.15, ignitionH: 0.5 }, upgrades: ['fusion_blanket', 'fusion_magnets', 'thermal_hx'] }),
  b({ id: 'stellarator', name: 'Stellarator Fusion Plant', desc: 'Twisted-coil confinement: steady-state, 8% parasitic load, 35% minimum load.', family: 'fusion', art: 'stellarator', stages: ['planet', 'solar'],
    size: [2, 2], terrain: ['grass', 'industrial', 'coast', 'desert', 'hill'], unit: { label: '3 GW stellarator', kw: 3e6, areaM2: 2e7 }, paybackH: 70, research: 'fusion_3', wear: 0.003, maint: 6, salvage: 0.1, decommission: 0.04,
    thermal: { fuel: 'fusion', eta: 0.48, minLoad: 0.35, ramp: 1.5, cooling: 1.1, partLoad: 0.1, tankH: 48, parasitic: 0.08, ignitionH: 0.3 }, upgrades: ['fusion_blanket', 'thermal_hx'] }),
  b({ id: 'orbital_fusion', name: 'Orbital He-3 Fusion Complex', desc: 'Aneutronic D-He3 fusion with direct conversion; radiators reject heat to space.', family: 'fusion', art: 'orbital_fusion', stages: ['solar'],
    size: [2, 2], terrain: SPACE.concat('gasgiant', 'lunar'), unit: { label: 'complex', kw: 3e16, areaM2: 0 }, aggregate: false, paybackH: 70, research: 'fusion_4', wear: 0.003, maint: 6, salvage: 0.1,
    thermal: { fuel: 'he3', eta: 0.62, minLoad: 0.4, ramp: 2, cooling: 1.2, partLoad: 0.1, tankH: 72, parasitic: 0.1, ignitionH: 0.3 }, upgrades: ['fusion_magnets', 'thermal_hx'] }),

  // ───────────── Space / stellar / exotic ─────────────
  b({ id: 'lunar_plant', name: 'Lunar Polar Solar Ring', desc: 'Collectors on the permanently lit lunar polar rims — near-constant output.', family: 'orbital', art: 'lunar', stages: ['solar'],
    size: [1, 1], terrain: ['lunar'], unit: { label: 'ring segment', kw: 4e16, areaM2: 0 }, aggregate: false, paybackH: 90, research: 'orbital_2', gen: { kind: 'constant' }, wear: 0.0015, maint: 5, salvage: 0.15, upgrades: ['orbital_radiators', 'stellar_selfrepair'] }),
  b({ id: 'pulsar_array', name: 'Pulsar Induction Array', desc: 'Induction loops in a pulsar\'s magnetosphere. Output pulses on a 2 h period.', family: 'stellar', art: 'pulsar', stages: ['galaxy'],
    size: [1, 1], terrain: ['neutron'], unit: { label: 'array', kw: 2e27, areaM2: 0 }, aggregate: false, paybackH: 85, research: 'stellar_5', gen: { kind: 'pulsar', period: 2 }, wear: 0.002, maint: 6, salvage: 0.1, upgrades: ['stellar_swarm_ai', 'stellar_selfrepair'] }),
  b({ id: 'accretion', name: 'Accretion Disk Harvester', desc: 'Feeds stellar matter to a black hole; harvests ~10% of rest mass as radiation.', family: 'stellar', art: 'accretion', stages: ['galaxy', 'universe'],
    size: [2, 2], terrain: ['galactic_core', 'nebula'], unit: { label: 'harvester', kw: 6e27, areaM2: 0 }, aggregate: false, paybackH: 65, research: 'stellar_6', wear: 0.003, maint: 7, salvage: 0.05,
    thermal: { fuel: 'stellar', eta: 0.6, minLoad: 0.3, ramp: 2, cooling: 1.5, partLoad: 0.1, tankH: 48 }, upgrades: ['stellar_swarm_ai', 'stellar_selfrepair'] }),
  b({ id: 'quasar_tap', name: 'Quasar Jet Harvester', desc: 'Intercepts a fraction of a relativistic quasar jet. Steady, enormous output.', family: 'exotic', art: 'quasar', stages: ['universe'],
    size: [1, 1], terrain: ['quasar'], unit: { label: 'jet harvester', kw: 4e35, areaM2: 0 }, aggregate: false, paybackH: 90, research: 'universal_1', gen: { kind: 'constant' }, wear: 0.0025, maint: 7, salvage: 0.05, speculative: true, upgrades: ['exotic_containment', 'exotic_phaselock'] }),
  b({ id: 'penrose', name: 'Penrose Ergosphere Engine', desc: 'Extracts rotational energy from a spinning black hole. The spin reservoir is finite and depletes with use (slow natural spin-up from accretion).', family: 'exotic', art: 'penrose', stages: ['universe'],
    size: [1, 1], terrain: ['smbh'], unit: { label: 'engine', kw: 1e36, areaM2: 0 }, aggregate: false, paybackH: 70, research: 'universal_2', gen: { kind: 'penrose', poolH: 2000 }, wear: 0.002, maint: 7, salvage: 0.05, speculative: true, upgrades: ['exotic_containment', 'exotic_phaselock'] }),
  b({ id: 'vacuum_tap', name: 'Vacuum Fluctuation Tap', desc: 'SPECULATIVE. Hypothetical zero-point extraction stabilised by exotic-matter catalyst.', family: 'exotic', art: 'vacuum', stages: ['universe'],
    size: [2, 2], terrain: ['supervoid', 'filament', 'void'], unit: { label: 'tap', kw: 2e36, areaM2: 0 }, aggregate: false, paybackH: 65, research: 'universal_3', wear: 0.003, maint: 8, salvage: 0.05, speculative: true,
    thermal: { fuel: 'exotic', eta: 0.9, minLoad: 0.3, ramp: 2, cooling: 2, partLoad: 0.05, tankH: 48 }, upgrades: ['exotic_containment', 'exotic_phaselock'] }),

  // ───────────── Storage ─────────────
  b({ id: 'battery_home', name: 'Home Battery', desc: '13.5 kWh lithium-ion wall battery. Stores midday surplus for the evening peak.', family: 'storage', art: 'battery', category: 'storage', stages: ['backyard', 'neighborhood'],
    size: [1, 1], terrain: ['grass', 'urban', 'hill', 'desert'], unit: { label: '13.5 kWh pack', kw: 0, areaM2: 20 }, paybackH: 48, research: 'storage_1', wear: 0.001, maint: 0.2, salvage: 0.3,
    storage: { kwh: 13.5, cRate: 0.4, etaIn: 0.95, etaOut: 0.95, cycleAging: 0.0006 }, upgrades: ['storage_bms', 'storage_power'] }),
  b({ id: 'battery_community', name: 'Community Battery', desc: '500 kWh containerised battery.', family: 'storage', art: 'battery_big', category: 'storage', stages: ['neighborhood', 'city'],
    size: [1, 1], terrain: OPEN, unit: { label: '500 kWh container', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 96, wear: 0.001, maint: 0.6, salvage: 0.3,
    storage: { kwh: 500, cRate: 0.5, etaIn: 0.95, etaOut: 0.95, cycleAging: 0.0005 }, upgrades: ['storage_bms', 'storage_power'] }),
  b({ id: 'battery_grid', name: 'Grid Battery Farm', desc: 'Rows of 4 MWh containers with grid inverters.', family: 'storage', art: 'battery_big', category: 'storage', stages: ['city', 'country'],
    size: [1, 1], terrain: OPEN, unit: { label: '4 MWh container', kw: 0, areaM2: 1200 }, paybackH: 96, research: 'storage_4', wear: 0.001, maint: 2, salvage: 0.3,
    storage: { kwh: 4000, cRate: 0.5, etaIn: 0.95, etaOut: 0.95, cycleAging: 0.0004 }, upgrades: ['storage_bms', 'storage_power'] }),
  b({ id: 'pumped_storage', name: 'Pumped-Storage Hydro', desc: 'Pumps water uphill when power is cheap and generates on demand. Needs a hill/mountain next to water.', family: 'hydro', art: 'pumped', category: 'storage', stages: ['country', 'continent'],
    size: [1, 1], terrain: ['hill', 'mountain'], adjacent: ['lake', 'river', 'reservoir', 'coast'], unit: { label: 'station', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 90, research: 'hydro_5', wear: 0.0012, maint: 3, salvage: 0.1,
    storage: { kwh: 3e7, cRate: 0.1, etaIn: 0.9, etaOut: 0.9, cycleAging: 0.00001 } }),
  b({ id: 'caes', name: 'Compressed-Air Storage', desc: 'Compresses air into salt caverns under hills.', family: 'storage', art: 'caes', category: 'storage', stages: ['country', 'continent'],
    size: [1, 1], terrain: ['hill', 'mountain', 'desert'], unit: { label: 'cavern', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 80, research: 'storage_6', wear: 0.0015, maint: 3, salvage: 0.15,
    storage: { kwh: 8e6, cRate: 0.2, etaIn: 0.82, etaOut: 0.82, cycleAging: 0.00002 } }),
  b({ id: 'storage_continental', name: 'Flow Battery Park', desc: 'Vanadium flow batteries: long life, modest efficiency.', family: 'storage', art: 'flow', category: 'storage', stages: ['continent', 'planet'],
    size: [2, 2], terrain: OPEN, unit: { label: '100 MWh string', kw: 0, areaM2: 2e4 }, paybackH: 90, research: 'storage_7', wear: 0.0008, maint: 4, salvage: 0.3,
    storage: { kwh: 1e5, cRate: 0.25, etaIn: 0.88, etaOut: 0.88, cycleAging: 0.00003 }, upgrades: ['storage_power'] }),
  b({ id: 'storage_planetary', name: 'Superconducting Storage Ring', desc: 'Superconducting magnetic energy storage loops.', family: 'storage', art: 'smes', category: 'storage', stages: ['planet'],
    size: [2, 2], terrain: LAND, unit: { label: 'ring', kw: 0, areaM2: 2e9 }, paybackH: 90, research: 'storage_8', wear: 0.0008, maint: 5, salvage: 0.25,
    storage: { kwh: 5e8, cRate: 1, etaIn: 0.97, etaOut: 0.97, cycleAging: 0.00001 } }),
  b({ id: 'storage_orbital', name: 'Orbital Flywheel Ring', desc: 'Massive magnetically levitated flywheels in orbit.', family: 'storage', art: 'flywheel', category: 'storage', stages: ['solar'],
    size: [1, 1], terrain: SPACE, unit: { label: 'flywheel ring', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 90, research: 'storage_9', wear: 0.0008, maint: 5, salvage: 0.2,
    storage: { kwh: 2e17, cRate: 0.5, etaIn: 0.96, etaOut: 0.96, cycleAging: 0.00001 }, upgrades: ['storage_quantum'] }),
  b({ id: 'storage_galactic', name: 'Antimatter Containment Bank', desc: 'Stores energy as magnetically trapped antimatter.', family: 'storage', art: 'antimatter', category: 'storage', stages: ['galaxy'],
    size: [1, 1], terrain: ['void', 'nebula'].concat(STARS) as TerrainId[], unit: { label: 'bank', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 90, research: 'storage_10', wear: 0.0008, maint: 6, salvage: 0.1, speculative: true,
    storage: { kwh: 1e28, cRate: 0.5, etaIn: 0.9, etaOut: 0.9, cycleAging: 0.00001 }, upgrades: ['storage_quantum'] }),
  b({ id: 'storage_universal', name: 'False-Vacuum Bubble Reservoir', desc: 'SPECULATIVE. Energy held in metastable vacuum bubbles.', family: 'storage', art: 'vacuum_store', category: 'storage', stages: ['universe'],
    size: [1, 1], terrain: ['supervoid', 'filament', 'void'], unit: { label: 'reservoir', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 90, research: 'storage_11', wear: 0.0008, maint: 6, salvage: 0.1, speculative: true,
    storage: { kwh: 1e36, cRate: 0.5, etaIn: 0.95, etaOut: 0.95, cycleAging: 0.00001 }, upgrades: ['storage_quantum'] }),

  // ───────────── Grid ─────────────
  ...([
    ['substation_local', 'Local Substation', 'neighborhood', 120, 30, 'industrial urban grass'],
    ['substation_municipal', 'Municipal Substation', 'city', 9000, 1000, 'industrial urban grass desert'],
    ['hv_transmission', 'HV Transmission Hub', 'country', 1.1e6, 3e4, 'industrial grass desert hill'],
    ['supergrid', 'HVDC Converter Station', 'continent', 1.2e8, 1e6, 'industrial grass desert hill coast'],
    ['planetary_ring', 'Planetary Power Ring Node', 'planet', 8e9, 3e7, 'industrial grass desert hill coast ocean'],
    ['interplanetary_relay', 'Interplanetary Beam Relay', 'solar', 3e16, 1e9, 'void orbit inner asteroid'],
    ['interstellar_relay', 'Interstellar Relay', 'galaxy', 1.5e27, 3e10, 'void nebula star_red star_yellow star_blue'],
    ['filament_conduit', 'Cosmic Filament Conduit', 'universe', 1.5e35, 1e12, 'filament void supervoid'],
  ] as const).map(([id, name, stage, kw, scale, terr]) =>
    b({ id, name, desc: `Adds ${'import/export'} capacity to this map's grid connection.`, family: 'grid', art: id === 'substation_local' || id === 'substation_municipal' ? 'substation' : stage === 'country' || stage === 'continent' ? 'transmission' : 'relay',
      category: 'grid', stages: [stage as StageId], size: [1, 1], terrain: terr.split(' ') as TerrainId[], unit: { label: 'station', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 0,
      unitCost: 150 * (scale as number), wear: 0.001, maint: 0.8, salvage: 0.35, infra: { role: 'grid', kw: kw as number }, research: stage === 'universe' ? 'universal_4' : undefined })),

  // ───────────── Infrastructure (generic, cost scales with map) ─────────────
  b({ id: 'garage_lab', name: 'Garage Workshop', desc: 'Tinker with electronics: +3 RP/h company research.', family: 'infra', art: 'lab', category: 'research', stages: ['backyard'],
    size: [1, 1], terrain: ['grass', 'urban', 'hill'], unit: { label: 'workshop', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 0, unitCost: 70, unique: true, wear: 0.0005, maint: 0.2, salvage: 0.4, infra: { role: 'lab', amount: 3 } }),
  b({ id: 'research_lab', name: 'Research Laboratory', desc: 'Company research facility. RP scale with the map\'s stage.', family: 'infra', art: 'lab', category: 'research', stages: ALL_STAGES.slice(1),
    size: [1, 1], terrain: ['grass', 'urban', 'industrial', 'hill', 'desert', 'coast', 'void', 'orbit', 'lunar', 'martian', 'asteroid', 'nebula', 'galaxy_spiral', 'galaxy_elliptical', 'filament'], unit: { label: 'lab', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 0,
    unitCost: 400, scaled: true, wear: 0.0005, maint: 0.5, salvage: 0.4, infra: { role: 'lab', amount: 8 } }),
  b({ id: 'maint_depot', name: 'Maintenance Depot', desc: 'Workshop, spares and vehicles: +4 work units and +25% maintenance capacity on this map.', family: 'infra', art: 'depot', category: 'infrastructure', stages: ALL_STAGES,
    size: [1, 1], terrain: ['grass', 'urban', 'industrial', 'hill', 'desert', 'coast', 'void', 'orbit', 'lunar', 'martian', 'asteroid', 'nebula', 'galaxy_spiral', 'galaxy_elliptical', 'filament'], unit: { label: 'depot', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 0,
    unitCost: 90, scaled: true, wear: 0.0005, maint: 0.3, salvage: 0.4, infra: { role: 'depot', amount: 4 } }),
  b({ id: 'logistics_hub', name: 'Logistics Hub', desc: 'Fleet yard: +2 logistics slots and 20% faster deliveries on this map.', family: 'infra', art: 'logistics', category: 'infrastructure', stages: ALL_STAGES.slice(1),
    size: [1, 1], terrain: ['grass', 'urban', 'industrial', 'desert', 'coast', 'void', 'orbit', 'lunar', 'martian', 'asteroid', 'nebula', 'galaxy_spiral', 'galaxy_elliptical', 'filament'], unit: { label: 'hub', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 0,
    unitCost: 300, scaled: true, wear: 0.0005, maint: 0.3, salvage: 0.4, infra: { role: 'logistics', amount: 2 } }),
  b({ id: 'fuel_depot', name: 'Fuel Storage Depot', desc: 'Tanks, bunkers and silos: increases this map\'s fuel inventory capacity.', family: 'fuel', art: 'tank', category: 'infrastructure', stages: ALL_STAGES.slice(1),
    size: [1, 1], terrain: ['grass', 'industrial', 'desert', 'coast', 'hill', 'void', 'orbit', 'asteroid', 'nebula', 'galaxy_spiral', 'galaxy_elliptical', 'filament'], unit: { label: 'depot', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 0,
    unitCost: 160, scaled: true, wear: 0.0005, maint: 0.2, salvage: 0.4, infra: { role: 'fuelStorage', amount: 6 } }),
  b({ id: 'ops_center', name: 'Operations Center', desc: 'Control room: +20% maintenance and logistics efficiency on this map.', family: 'infra', art: 'ops', category: 'automation', stages: ALL_STAGES.slice(2), unique: true,
    size: [1, 1], terrain: ['grass', 'urban', 'industrial', 'desert', 'coast', 'hill', 'void', 'orbit', 'lunar', 'martian', 'asteroid', 'nebula', 'galaxy_spiral', 'galaxy_elliptical', 'filament'], unit: { label: 'center', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 0,
    unitCost: 800, scaled: true, wear: 0.0005, maint: 0.4, salvage: 0.4, infra: { role: 'ops', amount: 0.2 } }),
  b({ id: 'trading_desk', name: 'Energy Trading Desk', desc: 'Market data and dispatch desk: +2 trading capacity company-wide.', family: 'infra', art: 'trading', category: 'automation', stages: ALL_STAGES.slice(2), unique: true,
    size: [1, 1], terrain: ['urban', 'industrial', 'grass', 'void', 'orbit', 'nebula', 'galaxy_spiral', 'galaxy_elliptical', 'filament'], unit: { label: 'desk', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 0,
    unitCost: 1500, scaled: true, research: 'markets_1', wear: 0.0005, maint: 0.4, salvage: 0.4, infra: { role: 'trading', amount: 2 } }),

  // ───────────── Fuel production ─────────────
  b({ id: 'biomass_plantation', name: 'Energy Crop Plantation', desc: 'Fast-growing willow/miscanthus harvested as biomass fuel.', family: 'fuel', art: 'plantation', category: 'infrastructure', stages: ['neighborhood', 'city', 'country'],
    size: [1, 1], terrain: ['grass', 'forest', 'hill'], unit: { label: 'plot', kw: 0, areaM2: 2000 }, paybackH: 90, research: 'biomass_1', wear: 0.001, maint: 0.4, salvage: 0.2,
    infra: { role: 'fuelProducer', fuel: 'biomass', rate: 0.03, loadKW: 0.5 } }),
  b({ id: 'coal_mine', name: 'Coal Mine', desc: 'Open-pit coal extraction; consumes electricity.', family: 'fuel', art: 'mine', category: 'infrastructure', stages: ['city', 'country'],
    size: [1, 1], terrain: ['hill', 'mountain', 'desert'], unit: { label: 'mine', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 80, wear: 0.003, maint: 2, salvage: 0.15,
    infra: { role: 'fuelProducer', fuel: 'coal', rate: 60, loadKW: 1500 } }),
  b({ id: 'gas_well', name: 'Gas Wellfield', desc: 'Natural-gas wells and gathering lines; consumes electricity for compression.', family: 'fuel', art: 'gaswell', category: 'infrastructure', stages: ['city', 'country'],
    size: [1, 1], terrain: ['desert', 'grass', 'industrial', 'coast'], unit: { label: 'wellfield', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 80, research: 'logistics_2', wear: 0.003, maint: 2, salvage: 0.15,
    infra: { role: 'fuelProducer', fuel: 'gas', rate: 40, loadKW: 1200 } }),
  b({ id: 'uranium_mine', name: 'Uranium Mine & Enrichment', desc: 'Mining, conversion and fuel fabrication.', family: 'fuel', art: 'mine', category: 'infrastructure', stages: ['country', 'continent'],
    size: [1, 1], terrain: ['mountain', 'desert', 'hill'], unit: { label: 'complex', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 80, research: 'nuclear_1', wear: 0.002, maint: 3, salvage: 0.1,
    infra: { role: 'fuelProducer', fuel: 'uranium', rate: 6, loadKW: 4e4 } }),
  b({ id: 'deuterium_plant', name: 'Deuterium Extraction Plant', desc: 'Extracts deuterium from seawater and breeds tritium.', family: 'fuel', art: 'gaswell', category: 'infrastructure', stages: ['planet'],
    size: [1, 1], terrain: ['ocean', 'coast'], unit: { label: 'plant', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 80, research: 'fusion_1', wear: 0.002, maint: 3, salvage: 0.1,
    infra: { role: 'fuelProducer', fuel: 'fusion', rate: 3e5, loadKW: 5e7 } }),
  b({ id: 'he3_scoop', name: 'Helium-3 Atmospheric Scoop', desc: 'Skims He-3 from a gas giant\'s upper atmosphere.', family: 'fuel', art: 'he3', category: 'infrastructure', stages: ['solar'],
    size: [1, 1], terrain: ['gasgiant'], unit: { label: 'scoop fleet', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 80, research: 'fusion_4', wear: 0.002, maint: 4, salvage: 0.1,
    infra: { role: 'fuelProducer', fuel: 'he3', rate: 250, loadKW: 1e15 } }),
  b({ id: 'star_lifter', name: 'Star Lifter', desc: 'Strips matter from stellar atmospheres for accretion harvesters.', family: 'fuel', art: 'starlifter', category: 'infrastructure', stages: ['galaxy'],
    size: [1, 1], terrain: STARS.concat('nebula'), unit: { label: 'lifter', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 80, research: 'stellar_6', wear: 0.002, maint: 5, salvage: 0.1,
    infra: { role: 'fuelProducer', fuel: 'stellar', rate: 3000, loadKW: 2e26 } }),
  b({ id: 'exotic_forge', name: 'Exotic Matter Forge', desc: 'SPECULATIVE. Synthesises negative-energy-density catalyst.', family: 'fuel', art: 'forge', category: 'infrastructure', stages: ['universe'],
    size: [1, 1], terrain: ['filament', 'galaxy_spiral', 'galaxy_elliptical', 'void'], unit: { label: 'forge', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 80, research: 'universal_3', wear: 0.002, maint: 6, salvage: 0.1, speculative: true,
    infra: { role: 'fuelProducer', fuel: 'exotic', rate: 3e-4, loadKW: 5e34 } }),

  // ───────────── Endgame ─────────────
  b({ id: 'convergence_engine', name: 'Convergence Engine', desc: 'The final project: channels the energy of a universe into one coherent structure. Consumes all power you route to it; completion wins the game.', family: 'exotic', art: 'convergence', category: 'special', stages: ['universe'],
    size: [3, 3], terrain: ['void', 'filament', 'supervoid', 'galaxy_spiral', 'galaxy_elliptical'], unit: { label: 'engine', kw: 0, areaM2: 0 }, aggregate: false, paybackH: 0, unitCost: 3e14, unique: true, research: 'universal_5',
    wear: 0, maint: 8, salvage: 0, speculative: true, infra: { role: 'sink', kw: 5e36 } }),
];

/** Derive unit costs from the balance model; done once at load, results frozen. */
function unitCostOf(d: BuildingDef): number {
  if (d.unitCost !== undefined) return d.unitCost;
  const stage = STAGES[d.stages[0]];
  const pb = d.paybackH * (BALANCE.paybackScale[stage.id] ?? 1);
  if (d.storage) return d.storage.kwh * stage.retail * (pb / 24);
  if (d.infra?.role === 'fuelProducer' && d.infra.fuel) return (d.infra.rate ?? 0) * FUELS[d.infra.fuel].price * pb;
  const kind = d.thermal ? 'thermal' : d.gen?.kind ?? 'solar';
  return d.unit.kw * (BALANCE.cfRef[kind] ?? 0.5) * stage.retail * pb;
}

export const BUILDINGS: Record<string, BuildingDef & { unitCost: number }> = Object.fromEntries(
  list.map((d) => [d.id, Object.freeze({ ...d, unitCost: unitCostOf(d) })]),
);

export const BUILDING_LIST = Object.values(BUILDINGS);

export function buildingsForStage(stage: StageId) {
  return BUILDING_LIST.filter((d) => d.stages.includes(stage) && !d.fixed);
}

export { COOLING_WATER };
