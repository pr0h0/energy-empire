import type { UpgradeDef } from './types';

/** Equipment retrofits. Applied per installation (or in bulk) after research; cause downtime. */
const u = (d: UpgradeDef): UpgradeDef => Object.freeze(d);

export const UPGRADES: Record<string, UpgradeDef> = Object.fromEntries(
  [
    u({ id: 'solar_clean', name: 'Automated Panel Cleaning', desc: 'Robotic cleaning cuts soiling wear by 45%.', costFrac: 0.08, downtimeH: 1, effects: [{ key: 'wear', add: -0.45 }] }),
    u({ id: 'solar_tracking', name: 'Single-Axis Tracking', desc: 'Panels follow the sun: +18% output, slightly more mechanical maintenance.', costFrac: 0.22, downtimeH: 4, effects: [{ key: 'output', add: 0.18 }, { key: 'maint', add: 0.1 }] }),
    u({ id: 'solar_bifacial', name: 'Bifacial Module Retrofit', desc: 'Rear-side capture: +10% output, slower aging.', costFrac: 0.2, downtimeH: 6, effects: [{ key: 'output', add: 0.1 }, { key: 'aging', add: -0.3 }] }),
    u({ id: 'wind_bearings', name: 'Sealed Bearing Package', desc: 'Main-bearing and gearbox seals: −35% mechanical wear.', costFrac: 0.1, downtimeH: 2, effects: [{ key: 'wear', add: -0.35 }] }),
    u({ id: 'wind_blades', name: 'Carbon-Fibre Blades', desc: 'Longer, lighter blades: +15% output, +5% wear.', costFrac: 0.25, downtimeH: 6, effects: [{ key: 'output', add: 0.15 }, { key: 'wear', add: 0.05 }] }),
    u({ id: 'wind_controls', name: 'Predictive Pitch Control', desc: 'Lidar-guided pitch: +8% output, −10% wear.', costFrac: 0.12, downtimeH: 2, effects: [{ key: 'output', add: 0.08 }, { key: 'wear', add: -0.1 }] }),
    u({ id: 'hydro_turbine', name: 'High-Efficiency Runner', desc: 'Re-profiled turbine runner: +12% conversion efficiency.', costFrac: 0.15, downtimeH: 8, effects: [{ key: 'output', add: 0.12 }] }),
    u({ id: 'thermal_hx', name: 'Advanced Heat Exchanger', desc: 'More cooling surface: +25% cooling capacity (removes cooling throttling).', costFrac: 0.12, downtimeH: 6, effects: [{ key: 'cooling', add: 0.25 }] }),
    u({ id: 'thermal_turbine', name: 'High-Efficiency Turbine', desc: 'Re-bladed turbine: +3 points conversion efficiency (less fuel per kWh).', costFrac: 0.18, downtimeH: 10, effects: [{ key: 'eta', add: 0.03 }] }),
    u({ id: 'thermal_whr', name: 'Waste Heat Recovery', desc: 'Heat-recovery steam generator: +6 points efficiency.', costFrac: 0.25, downtimeH: 12, effects: [{ key: 'eta', add: 0.06 }] }),
    u({ id: 'thermal_storage', name: 'Thermal Energy Storage', desc: 'Molten-salt buffer decouples boiler and turbine: ramp rate ×3.', costFrac: 0.2, downtimeH: 8, effects: [{ key: 'ramp', add: 2 }] }),
    u({ id: 'nuclear_fuel', name: 'High-Burnup Fuel', desc: '−25% fuel consumption, longer cycles between refuelling outages.', costFrac: 0.08, downtimeH: 0, effects: [{ key: 'fuel', add: -0.25 }] }),
    u({ id: 'nuclear_uprate', name: 'Power Uprate', desc: '+10% rated capacity; +10% wear.', costFrac: 0.12, downtimeH: 24, effects: [{ key: 'capacity', add: 0.1 }, { key: 'wear', add: 0.1 }] }),
    u({ id: 'storage_bms', name: 'Battery Management System', desc: 'Cell balancing: −40% cycle aging, +1% efficiency.', costFrac: 0.08, downtimeH: 1, effects: [{ key: 'aging', add: -0.4 }, { key: 'storageEta', add: 0.01 }] }),
    u({ id: 'storage_power', name: 'Inverter Upgrade', desc: '+50% charge/discharge power.', costFrac: 0.12, downtimeH: 2, effects: [{ key: 'power', add: 0.5 }] }),
    u({ id: 'fusion_blanket', name: 'Lithium Breeding Blanket', desc: 'Breeds tritium in-situ: −40% fuel purchases.', costFrac: 0.15, downtimeH: 24, effects: [{ key: 'fuel', add: -0.4 }] }),
    u({ id: 'fusion_magnets', name: 'HTS Magnet Retrofit', desc: 'High-temperature superconductors: +5 points net efficiency.', costFrac: 0.2, downtimeH: 24, effects: [{ key: 'eta', add: 0.05 }] }),
    u({ id: 'geo_reinject', name: 'Reinjection Wells', desc: 'Return brine to the reservoir: halves pressure decline.', costFrac: 0.15, downtimeH: 6, effects: [{ key: 'aging', add: -0.5 }] }),
    u({ id: 'stellar_mirrors', name: 'Adaptive Mirror Films', desc: '+15% collected flux.', costFrac: 0.2, downtimeH: 4, effects: [{ key: 'output', add: 0.15 }] }),
    // late-game retrofits (space, stellar, exotic, cosmic storage)
    u({ id: 'orbital_radiators', name: 'Thin-Film Radiators', desc: 'Lighter radiators and sun-tracking arrays: +10% output, −20% wear.', costFrac: 0.15, downtimeH: 6, effects: [{ key: 'output', add: 0.1 }, { key: 'wear', add: -0.2 }] }),
    u({ id: 'stellar_swarm_ai', name: 'Swarm Coordination AI', desc: 'Collectors reposition as one: +12% output.', costFrac: 0.2, downtimeH: 8, effects: [{ key: 'output', add: 0.12 }] }),
    u({ id: 'stellar_selfrepair', name: 'Self-Healing Collectors', desc: 'Nanite repair films: −40% wear, −20% maintenance load.', costFrac: 0.12, downtimeH: 4, effects: [{ key: 'wear', add: -0.4 }, { key: 'maint', add: -0.2 }] }),
    u({ id: 'exotic_containment', name: 'Metric Containment Fields', desc: 'Stabilised extraction geometry: +10% output, −25% wear.', costFrac: 0.2, downtimeH: 12, effects: [{ key: 'output', add: 0.1 }, { key: 'wear', add: -0.25 }] }),
    u({ id: 'exotic_phaselock', name: 'Phase-Locked Extraction', desc: 'Resonant coupling to the source: +8% output.', costFrac: 0.18, downtimeH: 8, effects: [{ key: 'output', add: 0.08 }] }),
    u({ id: 'storage_quantum', name: 'Quantum Charge Control', desc: 'Coherent charge transfer: +40% power, −30% aging.', costFrac: 0.15, downtimeH: 4, effects: [{ key: 'power', add: 0.4 }, { key: 'aging', add: -0.3 }] }),
    u({ id: 'maint_sensors', name: 'Condition Monitoring Sensors', desc: 'Vibration and thermal sensors: −25% maintenance load, −10% wear.', costFrac: 0.05, downtimeH: 1, effects: [{ key: 'maint', add: -0.25 }, { key: 'wear', add: -0.1 }] }),
  ].map((x) => [x.id, x]),
);

/** Upgrades usable by every generator regardless of family. */
export const UNIVERSAL_UPGRADES = ['maint_sensors'];

/** Research that enables each upgrade. */
export const UPGRADE_RESEARCH: Record<string, string> = {
  solar_clean: 'solar_2', solar_tracking: 'solar_3', solar_bifacial: 'solar_4', wind_bearings: 'wind_2', wind_blades: 'wind_3', wind_controls: 'wind_5',
  hydro_turbine: 'hydro_2', thermal_hx: 'thermal_2', thermal_turbine: 'thermal_3', thermal_whr: 'thermal_4', thermal_storage: 'thermal_5',
  nuclear_fuel: 'nuclear_2', nuclear_uprate: 'nuclear_3', storage_bms: 'storage_2', storage_power: 'storage_3', fusion_blanket: 'fusion_2', fusion_magnets: 'fusion_3',
  geo_reinject: 'geo_2', stellar_mirrors: 'stellar_3', maint_sensors: 'maintenance_2',
  orbital_radiators: 'orbital_4', stellar_swarm_ai: 'stellar_4', stellar_selfrepair: 'maintenance_5', exotic_containment: 'universal_3', exotic_phaselock: 'universal_4', storage_quantum: 'storage_10',
};
