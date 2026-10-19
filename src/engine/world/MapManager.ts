import { BALANCE } from '../data/balance';
import { STAGES } from '../data/stages';
import type { StageId } from '../data/types';
import type { BuildingInstance, FlowStats, Ledger, MapState } from '../core/State';
import { generateTerrain } from './TerrainGenerator';
import { idx } from './TileGrid';

export const emptyFlow = (): FlowStats => ({
  generation: 0, demand: 0, served: 0, selfServed: 0, imported: 0, exported: 0, curtailed: 0, charged: 0, discharged: 0, unserved: 0, sink: 0,
  sales: 0, retailRev: 0, exportRev: 0, contractRev: 0, savings: 0, importCost: 0, fuelCost: 0, wages: 0, maintenance: 0, opex: 0, income: 0, penalty: 0, carbon: 0, emissions: 0,
});

export const emptyLedger = (): Ledger => ({
  sales: 0, savings: 0, income: 0, importCost: 0, fuel: 0, wages: 0, maintenance: 0, repairs: 0, land: 0, research: 0, construction: 0,
  infrastructure: 0, salvage: 0, opex: 0, hiring: 0, penalties: 0, carbon: 0, upgrades: 0, other: 0,
});

/** Kahn topological order of river tiles (upstream first) so cascades propagate in one pass. */
export function riverTopoOrder(m: Pick<MapState, 'riverNext' | 'riverBase'>, tiles: number[]): number[] {
  const indeg = new Map<number, number>();
  for (const i of tiles) indeg.set(i, 0);
  for (const i of tiles) {
    const n = m.riverNext[i];
    if (n >= 0 && indeg.has(n)) indeg.set(n, (indeg.get(n) ?? 0) + 1);
  }
  const q = tiles.filter((i) => indeg.get(i) === 0);
  const out: number[] = [];
  while (q.length) {
    const i = q.shift()!;
    out.push(i);
    const n = m.riverNext[i];
    if (n >= 0 && indeg.has(n)) {
      indeg.set(n, indeg.get(n)! - 1);
      if (indeg.get(n) === 0) q.push(n);
    }
  }
  return out;
}

export function mapSeed(gameSeed: number, stage: StageId): number {
  return (gameSeed * 31 + STAGES[stage].index * 7919 + 17) >>> 0;
}

export function createMap(stage: StageId, gameSeed: number, time: number): MapState {
  const s = STAGES[stage];
  const seed = mapSeed(gameSeed, stage);
  const g = generateTerrain(stage, seed);
  const n = s.w * s.h;
  const owned = new Array(n).fill(0);
  const [sx, sy, sw, sh] = s.startOwned;
  for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) owned[idx(x, y, s.w)] = 1;
  const m: MapState = {
    id: stage, w: s.w, h: s.h, seed, terrain: g.terrain, elev: g.elev, owned, occ: new Array(n).fill(null), flooded: new Array(n).fill(null),
    riverBase: g.riverBase, riverNext: g.riverNext, riverOrder: [], riverFlow: g.riverBase.slice(), resource: g.resource,
    buildings: {}, gridLevel: 0, fuel: {}, contracts: [], workforce: {}, training: { maintenance: 0, logistics: 0 }, repairJobs: [], logisticsJobs: [],
    policies: { repairThreshold: null, typeThresholds: {}, importForShortage: BALANCE.importForShortageDefault, autoExport: true, tariff: 'fixed', fuel: {}, defaultStorageMode: 'self' },
    flow: emptyFlow(), reliability: 1, totals: { produced: 0, sold: 0, revenue: 0, expenses: 0 }, ledger: emptyLedger(), lastExportCapped: false, unlockedAt: time, goalTrack: { noImportH: 0, cleanH: 0 },
  };
  m.riverOrder = riverTopoOrder(m, g.riverOrder);
  if (stage === 'backyard') {
    const house: BuildingInstance = newInstance('house_0', 'house', sx, sy, 0, 1, 0);
    m.buildings[house.id] = house;
    for (const i of [idx(sx, sy, s.w), idx(sx + 1, sy, s.w), idx(sx, sy + 1, s.w), idx(sx + 1, sy + 1, s.w)]) m.occ[i] = house.id;
  }
  return m;
}

export function newInstance(id: string, def: string, x: number, y: number, rot: 0 | 1, units: number, invested: number): BuildingInstance {
  return {
    id, def, x, y, rot, units, condition: 1, wearOut: 0, ageH: 0, upgrades: [], enabled: true, downtimeUntil: 0, invested,
    output: 0, available: 0, status: 'Operating', energy: 0, revenue: 0, opCost: 0, rRevenue: 0, rCost: 0,
  };
}
