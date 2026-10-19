import type { GridLevel, StageDef, StageId } from './types';

/** Typical average output of one tile at native technology (kW) — used to size grids and fuel depots. */
export const KW_TILE: Record<StageId, number> = {
  backyard: 1.2, neighborhood: 80, city: 6.4e3, country: 7.6e5, continent: 8.3e7, planet: 5.7e9, solar: 2e16, galaxy: 1e27, universe: 1e35,
};

function grid(stage: StageId, scale: number, exportPrice: number): GridLevel[] {
  const k = KW_TILE[stage];
  const names = ['Base connection', 'Upgraded feeder', 'Distribution upgrade', 'High-capacity link', 'Backbone interconnect', 'Strategic interconnect'];
  const imp = [4, 10, 25, 60, 150, 400];
  const exp = [3, 8, 20, 50, 120, 300];
  const opex = [0, 0.05, 0.2, 1, 4, 12];
  const research = [undefined, undefined, undefined, 'grid_1', 'grid_2', 'grid_3'];
  // each tier is priced at ~80 h of the extra export it enables (daylight-weighted)
  return names.map((n, i) => ({
    name: n, importKW: imp[i] * k, exportKW: exp[i] * k, cost: i === 0 ? 0 : (exp[i] - exp[i - 1]) * k * exportPrice * 0.45 * 80,
    losses: 0.03, opex: opex[i] * scale, research: research[i],
  }));
}

const backyardGrid: GridLevel[] = [
  { name: 'Household service (import only)', importKW: 8, exportKW: 0, cost: 0, losses: 0, opex: 0 },
  { name: 'Net-metering connection', importKW: 10, exportKW: 10, cost: 45, losses: 0.02, opex: 0.02 },
  { name: 'Upgraded service panel', importKW: 15, exportKW: 30, cost: 200, losses: 0.02, opex: 0.05 },
  { name: 'Small-scale feeder', importKW: 25, exportKW: 80, cost: 900, losses: 0.02, opex: 0.15, research: 'grid_1' },
  { name: 'Prosumer microgrid link', importKW: 50, exportKW: 200, cost: 5000, losses: 0.02, opex: 0.5, research: 'grid_2' },
];

const s = (d: StageDef): StageDef => Object.freeze(d);

export const STAGES: Record<StageId, StageDef> = {
  backyard: s({ id: 'backyard', index: 0, name: 'Backyard', tagline: 'Power the house, cut the bill, sell the surplus.', w: 10, h: 8, cellM: 5, cellLabel: '5 m plots', elevRangeM: 3,
    retail: 0.5, export: 0.4, import: 0.5, scale: 1, landBase: 10, startOwned: [3, 2, 4, 4], baseDemandKW: 1.5, householdIncome: 1.6, grid: backyardGrid, unlock: null, space: false, distance: 1 }),
  neighborhood: s({ id: 'neighborhood', index: 1, name: 'Neighborhood', tagline: 'Become a community electricity supplier.', w: 16, h: 11, cellM: 50, cellLabel: '50 m lots', elevRangeM: 25,
    retail: 0.24, export: 0.13, import: 0.228, scale: 30, landBase: 30 * 14, startOwned: [6, 4, 3, 3], baseDemandKW: 40, grid: grid('neighborhood', 30, 0.13), space: false, distance: 1,
    unlock: { cost: 700, milestones: [{ kind: 'energySold', kwh: 400 }, { kind: 'capacity', kw: 25, stage: 'backyard' }, { kind: 'research', count: 2 }, { kind: 'workers', count: 1 }] } }),
  city: s({ id: 'city', index: 2, name: 'City', tagline: 'Run a municipal utility with markets and heavy plant.', w: 20, h: 13, cellM: 500, cellLabel: '500 m blocks', elevRangeM: 150,
    retail: 0.08, export: 0.045, import: 0.076, scale: 1000, landBase: 1000 * 12, startOwned: [8, 5, 3, 3], baseDemandKW: 3000, grid: grid('city', 1000, 0.045), space: false, distance: 1.5,
    unlock: { cost: 2.5e4, milestones: [{ kind: 'revenue', amount: 1e4 }, { kind: 'capacity', kw: 1500, stage: 'neighborhood' }, { kind: 'reliability', value: 0.95, stage: 'neighborhood' }, { kind: 'research', count: 6 }, { kind: 'contracts', count: 2, stage: 'neighborhood' }] } }),
  country: s({ id: 'country', index: 3, name: 'Country', tagline: 'Operate a national grid: nuclear, dams and HV transmission.', w: 22, h: 14, cellM: 5000, cellLabel: '5 km districts', elevRangeM: 1500,
    retail: 0.02, export: 0.011, import: 0.019, scale: 3e4, landBase: 3e4 * 12, startOwned: [9, 5, 3, 3], baseDemandKW: 4e5, grid: grid('country', 3e4, 0.011), space: false, distance: 2.5,
    unlock: { cost: 3e5, milestones: [{ kind: 'revenue', amount: 2e5 }, { kind: 'capacity', kw: 2.5e5, stage: 'city' }, { kind: 'reliability', value: 0.95, stage: 'city' }, { kind: 'research', count: 14 }, { kind: 'storage', kwh: 1e4 }] } }),
  continent: s({ id: 'continent', index: 4, name: 'Continent', tagline: 'Interconnect nations into a supergrid.', w: 24, h: 15, cellM: 50_000, cellLabel: '50 km regions', elevRangeM: 3000,
    retail: 0.006, export: 0.0033, import: 0.0057, scale: 1e6, landBase: 1e6 * 12, startOwned: [10, 6, 3, 3], baseDemandKW: 4e7, grid: grid('continent', 1e6, 0.0033), space: false, distance: 4,
    unlock: { cost: 1.2e7, milestones: [{ kind: 'revenue', amount: 6e6 }, { kind: 'capacity', kw: 1e7, stage: 'country' }, { kind: 'research', count: 24 }, { kind: 'researchDone', id: 'nuclear_1' }] } }),
  planet: s({ id: 'planet', index: 5, name: 'Planet', tagline: 'Supply a planetary civilisation; reach for orbit.', w: 26, h: 15, cellM: 400_000, cellLabel: '400 km sectors', elevRangeM: 6000,
    retail: 0.0026, export: 0.0015, import: 0.00247, scale: 3e7, landBase: 3e7 * 12, startOwned: [11, 6, 3, 3], baseDemandKW: 3e9, grid: grid('planet', 3e7, 0.0015), space: false, distance: 6,
    unlock: { cost: 4e8, milestones: [{ kind: 'revenue', amount: 2e8 }, { kind: 'capacity', kw: 1.5e9, stage: 'continent' }, { kind: 'research', count: 34 }, { kind: 'reliability', value: 0.97, stage: 'continent' }] } }),
  solar: s({ id: 'solar', index: 6, name: 'Solar System', tagline: 'Orbital collectors, lunar and Martian industry, the first swarm.', w: 24, h: 14, cellM: 7.5e9, cellLabel: '0.05 AU orbital sectors', elevRangeM: 0,
    retail: 2.6e-8, export: 1.5e-8, import: 2.47e-08, scale: 1e9, landBase: 1e9 * 12, startOwned: [10, 6, 3, 3], baseDemandKW: 1e16, grid: grid('solar', 1e9, 1.5e-8), space: true, distance: 10,
    unlock: { cost: 1.2e10, milestones: [{ kind: 'revenue', amount: 6e9 }, { kind: 'capacity', kw: 1e11, stage: 'planet' }, { kind: 'researchDone', id: 'orbital_1' }, { kind: 'research', count: 44 }] } }),
  galaxy: s({ id: 'galaxy', index: 7, name: 'Galaxy', tagline: 'Harvest star systems across the spiral arms.', w: 24, h: 14, cellM: 9.46e18, cellLabel: '1000 ly star fields', elevRangeM: 0,
    retail: 1.5e-17, export: 8.5e-18, import: 1.425e-17, scale: 3e10, landBase: 3e10 * 12, startOwned: [10, 6, 3, 3], baseDemandKW: 5e26, grid: grid('galaxy', 3e10, 8.5e-18), space: true, distance: 16,
    unlock: { cost: 4e11, milestones: [{ kind: 'revenue', amount: 2e11 }, { kind: 'capacity', kw: 2e17, stage: 'solar' }, { kind: 'researchDone', id: 'stellar_2' }, { kind: 'research', count: 54 }] } }),
  universe: s({ id: 'universe', index: 8, name: 'Universe', tagline: 'Coordinate galaxies and build the Convergence Engine.', w: 22, h: 13, cellM: 9.46e22, cellLabel: '10 Mly cosmic cells', elevRangeM: 0,
    retail: 5e-24, export: 2.8e-24, import: 4.75e-24, scale: 1e12, landBase: 1e12 * 12, startOwned: [9, 5, 3, 3], baseDemandKW: 5e34, grid: grid('universe', 1e12, 2.8e-24), space: true, distance: 24,
    unlock: { cost: 1.5e13, milestones: [{ kind: 'revenue', amount: 8e12 }, { kind: 'capacity', kw: 5e27, stage: 'galaxy' }, { kind: 'researchDone', id: 'stellar_4' }, { kind: 'research', count: 64 }] } }),
};

export const STAGE_LIST: StageDef[] = Object.values(STAGES).sort((a, b) => a.index - b.index);
