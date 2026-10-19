import type { PrestigeUpgradeDef } from './types';

const p = (d: PrestigeUpgradeDef): PrestigeUpgradeDef => Object.freeze(d);

/** Prestige shop. Currency is earned only through gameplay (lifetime sales revenue). */
export const PRESTIGE_UPGRADES: Record<string, PrestigeUpgradeDef> = Object.fromEntries(
  [
    p({ id: 'p_revenue', name: 'Brand Recognition', desc: '+15% electricity sales revenue per level.', category: 'revenue', baseCost: 1, costGrowth: 1.6, maxLevel: 15, effects: [{ type: 'mod', key: 'revenue', add: 0.15 }] }),
    p({ id: 'p_maint', name: 'Lean Maintenance', desc: '−8% repair and maintenance costs per level.', category: 'maintenance', baseCost: 1, costGrowth: 1.5, maxLevel: 8, effects: [{ type: 'mod', key: 'repair.cost', add: -0.08 }] }),
    p({ id: 'p_wear', name: 'Durable Designs', desc: '−6% equipment wear per level.', category: 'maintenance', baseCost: 2, costGrowth: 1.6, maxLevel: 8, effects: [{ type: 'mod', key: 'wear', add: -0.06 }] }),
    p({ id: 'p_research', name: 'Research Endowment', desc: '+25% research speed per level.', category: 'research', baseCost: 1, costGrowth: 1.6, maxLevel: 10, effects: [{ type: 'mod', key: 'research.speed', add: 0.25 }] }),
    p({ id: 'p_workforce', name: 'Talent Network', desc: '+10% workforce capacity per level.', category: 'workforce', baseCost: 2, costGrowth: 1.5, maxLevel: 8, effects: [{ type: 'mod', key: 'workforce.capacity', add: 0.1 }] }),
    p({ id: 'p_fuel', name: 'Fuel Hedging', desc: '−8% fuel purchase cost per level.', category: 'fuel', baseCost: 2, costGrowth: 1.5, maxLevel: 8, effects: [{ type: 'mod', key: 'fuel.cost', add: -0.08 }] }),
    p({ id: 'p_generation', name: 'Efficiency Patents', desc: '+4% renewable & fusion output per level.', category: 'generation', baseCost: 3, costGrowth: 1.7, maxLevel: 10,
      effects: (['solar.output', 'wind.output', 'hydro.output', 'fusion.output', 'orbital.output', 'stellar.output', 'geothermal.output'] as const).map((key) => ({ type: 'mod' as const, key, add: 0.04 })) }),
    p({ id: 'p_land', name: 'Land Bank', desc: '−10% land acquisition cost per level.', category: 'land', baseCost: 1, costGrowth: 1.5, maxLevel: 6, effects: [{ type: 'mod', key: 'land.cost', add: -0.1 }] }),
    p({ id: 'p_storage', name: 'Storage Chemistry', desc: '+2% storage efficiency and −10% cycle aging per level.', category: 'storage', baseCost: 2, costGrowth: 1.6, maxLevel: 5, effects: [{ type: 'mod', key: 'storage.eta', add: 0.02 }, { type: 'mod', key: 'storage.aging', add: -0.1 }] }),
    p({ id: 'p_capital', name: 'Seed Capital', desc: 'Start each run with more money (×10 per level).', category: 'revenue', baseCost: 2, costGrowth: 2, maxLevel: 6, effects: [], special: 'startMoney' }),
    p({ id: 'p_starter', name: 'Veteran Technician', desc: 'Start every run with a free Backyard technician, Maintenance Scheduling and Home Batteries researched.', category: 'automation', baseCost: 3, costGrowth: 1, maxLevel: 1, effects: [], special: 'starterTech' }),
    p({ id: 'p_autofuel', name: 'Supply-Chain Veteran', desc: 'Automated fuel purchasing, preventive maintenance and priority overrides available from the start.', category: 'automation', baseCost: 8, costGrowth: 1, maxLevel: 1,
      effects: [{ type: 'feature', feature: 'fuel.autoBuy' }, { type: 'feature', feature: 'repair.preventive' }, { type: 'feature', feature: 'automation.priority' }], special: 'autoFuelEarly' }),
    p({ id: 'p_bulkland', name: "Surveyor's Licence", desc: 'Bulk land purchase and fleet upgrades available from the start.', category: 'qol', baseCost: 4, costGrowth: 1, maxLevel: 1,
      effects: [{ type: 'feature', feature: 'land.bulk' }, { type: 'feature', feature: 'fleet.upgrade' }] }),
    p({ id: 'p_keepland', name: 'Family Homestead', desc: 'Keep all Backyard land ownership through prestige resets.', category: 'land', baseCost: 6, costGrowth: 1, maxLevel: 1, effects: [], special: 'keepBackyardLand' }),
    p({ id: 'p_memory', name: 'Institutional Memory', desc: 'Backyard- and Neighborhood-stage research stays completed after prestige.', category: 'research', baseCost: 15, costGrowth: 1, maxLevel: 1, effects: [], special: 'keepBasicResearch' }),
    p({ id: 'p_offline', name: 'Night Shift', desc: 'Offline progress cap extended from 12 h to 48 h.', category: 'qol', baseCost: 5, costGrowth: 1, maxLevel: 1, effects: [{ type: 'feature', feature: 'offline.extended' }], special: 'offlineCap' }),
  ].map((x) => [x.id, x]),
);

export const PRESTIGE_LIST = Object.values(PRESTIGE_UPGRADES);

export function prestigeCost(id: string, level: number): number {
  const d = PRESTIGE_UPGRADES[id];
  return Math.ceil(d.baseCost * Math.pow(d.costGrowth, level));
}
