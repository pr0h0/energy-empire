import { STAGES } from './stages';
import type { ContractDef, DemandCategory, Milestone, StageId } from './types';

/**
 * Demand growth is driven by contracts the player signs (or home improvements in the Backyard),
 * so demand never grows without player agency. Each contract adds a block of demand with its
 * category's daily profile and a fixed customer price.
 */
type C = [id: string, name: string, category: DemandCategory, kw: number, price: number, fee: number, extra?: { income?: number; requires?: Milestone }];

const byStage: Record<StageId, C[]> = {
  backyard: [
    ['by_heatpump', 'Install a heat pump', 'household', 0.8, 0.5, 40, { income: 0.55 }],
    ['by_ev', 'Buy an electric car', 'household', 1.2, 0.5, 120, { income: 0.85 }],
    ['by_office', 'Set up a home office', 'household', 0.5, 0.5, 220, { income: 0.7 }],
    ['by_workshop', 'Open a hobby workshop', 'household', 1.0, 0.5, 600, { income: 1.3 }],
  ],
  neighborhood: [
    ['nb_cafe', 'Corner café & shops', 'commercial', 25, 0.26, 600],
    ['nb_homes2', 'Second housing block', 'residential', 60, 0.24, 2500],
    ['nb_school', 'School campus', 'infrastructure', 40, 0.22, 1500],
    ['nb_workshop', 'Light-industry workshop', 'industrial', 80, 0.2, 4000, { requires: { kind: 'reliability', value: 0.9, stage: 'neighborhood' } }],
    ['nb_ev', 'EV charging plaza', 'commercial', 120, 0.28, 9000, { requires: { kind: 'reliability', value: 0.95, stage: 'neighborhood' } }],
  ],
  city: [
    ['c_district', 'Residential district', 'residential', 4000, 0.08, 4e4],
    ['c_downtown', 'Downtown offices', 'commercial', 6000, 0.085, 7e4],
    ['c_metro', 'Metro & street lighting', 'infrastructure', 8000, 0.075, 1.2e5],
    ['c_factory', 'Factory park', 'industrial', 12000, 0.065, 2e5, { requires: { kind: 'reliability', value: 0.93, stage: 'city' } }],
    ['c_datacenter', 'Data-center campus', 'advanced', 20000, 0.09, 6e5, { requires: { kind: 'reliability', value: 0.97, stage: 'city' } }],
  ],
  country: [
    ['k_region', 'Provincial towns', 'residential', 5e5, 0.02, 1.2e6],
    ['k_rail', 'Electrified rail network', 'infrastructure', 8e5, 0.019, 2e6],
    ['k_industry', 'Industrial corridor', 'industrial', 1.2e6, 0.017, 3e6],
    ['k_smelter', 'Aluminium smelter', 'industrial', 2e6, 0.016, 5e6, { requires: { kind: 'reliability', value: 0.95, stage: 'country' } }],
    ['k_ai', 'National AI compute', 'advanced', 3e6, 0.022, 9e6, { requires: { kind: 'reliability', value: 0.97, stage: 'country' } }],
  ],
  continent: [
    ['ct_megacity', 'Megacity belt', 'residential', 6e7, 0.006, 4e7],
    ['ct_hyperloop', 'Hyperloop network', 'infrastructure', 8e7, 0.0058, 6e7],
    ['ct_industry', 'Continental heavy industry', 'industrial', 1e8, 0.0052, 8e7],
    ['ct_desal', 'Desalination grid', 'infrastructure', 1.5e8, 0.0055, 1.3e8, { requires: { kind: 'reliability', value: 0.95, stage: 'continent' } }],
    ['ct_compute', 'Continental compute fabric', 'advanced', 2.5e8, 0.0066, 2.5e8, { requires: { kind: 'reliability', value: 0.97, stage: 'continent' } }],
  ],
  planet: [
    ['p_arcology', 'Arcology network', 'residential', 4e9, 0.0026, 1.5e9],
    ['p_climate', 'Climate restoration programme', 'planetary', 6e9, 0.0024, 2.5e9],
    ['p_spaceport', 'Spaceport & launch loops', 'advanced', 8e9, 0.0028, 4e9, { requires: { kind: 'reliability', value: 0.95, stage: 'planet' } }],
    ['p_compute', 'Planetary compute', 'advanced', 1.2e10, 0.0029, 7e9, { requires: { kind: 'reliability', value: 0.97, stage: 'planet' } }],
  ],
  solar: [
    ['s_habitats', 'Orbital habitats', 'residential', 1.5e16, 2.6e-8, 4e10],
    ['s_shipyards', 'Interplanetary shipyards', 'industrial', 3e16, 2.4e-8, 8e10],
    ['s_terraform', 'Terraforming Mars', 'planetary', 5e16, 2.5e-8, 1.5e11, { requires: { kind: 'reliability', value: 0.95, stage: 'solar' } }],
    ['s_compute', 'Jupiter-brain compute', 'advanced', 8e16, 2.9e-8, 2.5e11, { requires: { kind: 'reliability', value: 0.97, stage: 'solar' } }],
  ],
  galaxy: [
    ['g_colonies', 'Colony worlds', 'interstellar', 7e26, 1.5e-17, 1.5e12],
    ['g_starlanes', 'Starlane propulsion network', 'interstellar', 1.5e27, 1.45e-17, 3e12],
    ['g_compute', 'Galactic compute nodes', 'advanced', 3e27, 1.65e-17, 6e12, { requires: { kind: 'reliability', value: 0.95, stage: 'galaxy' } }],
  ],
  universe: [
    ['u_civs', 'Allied civilisations', 'interstellar', 7e34, 5e-24, 5e13],
    ['u_lattice', 'Intergalactic lattice', 'interstellar', 1.5e35, 4.8e-24, 1e14],
    ['u_compute', 'Universal computation', 'advanced', 3e35, 5.5e-24, 2e14, { requires: { kind: 'reliability', value: 0.95, stage: 'universe' } }],
  ],
};

export const CONTRACTS: Record<string, ContractDef> = Object.fromEntries(
  Object.entries(byStage).flatMap(([stage, rows]) =>
    rows.map(([id, name, category, kw, price, fee, extra]) => {
      // utility contracts: connection fee ≈ 60 h of the margin over exporting the same energy
      const st = STAGES[stage as StageId];
      const f = stage === 'backyard' ? fee : Math.round(kw * Math.max(price * 0.15, price - st.export) * 60);
      return [id, Object.freeze({ id, stage: stage as StageId, name, category, kw, price, fee: f, ...extra })];
    }),
  ),
);

export const CONTRACT_LIST = Object.values(CONTRACTS);
