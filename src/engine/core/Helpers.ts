import { ACHIEVEMENTS } from '../data/achievements';
import { BALANCE } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { EMPLOYEES } from '../data/employees';
import { FUELS } from '../data/fuels';
import { KW_TILE, STAGES } from '../data/stages';
import { TERRAIN } from '../data/terrain';
import type { BuildingDef, FuelId, StageId, TerrainId } from '../data/types';
import { localMods, mod, tickMemo } from './Modifiers';
import type { BuildingInstance, GameState, MapState } from './State';

export type Def = BuildingDef & { unitCost: number };

/** Definition lookup, cached on a non-enumerable slot (never serialised; refreshed on repower). */
export function defOf(b: BuildingInstance): Def {
  const c = (b as unknown as { _d?: Def })._d;
  if (c && c.id === b.def) return c;
  const d = BUILDINGS[b.def];
  Object.defineProperty(b, '_d', { value: d, enumerable: false, writable: true, configurable: true });
  return d;
}
export const isGenerator = (d: BuildingDef) => !!d.gen || !!d.thermal;
export const isStorage = (d: BuildingDef) => !!d.storage;

export function effectiveTerrain(m: MapState, i: number): TerrainId {
  return m.flooded[i] ? 'reservoir' : m.terrain[i];
}

/** Rated electrical capacity of an installation (kW). */
export function ratedKW(b: BuildingInstance, d = defOf(b)): number {
  return d.unit.kw * b.units * (1 + localMods(b).capacity) * (1 - (d.storage ? 0 : b.wearOut));
}

export function nameplateKW(b: BuildingInstance, d = defOf(b)): number {
  return d.unit.kw * b.units * (1 + localMods(b).capacity);
}

export function storageCapacityKWh(s: GameState, b: BuildingInstance, d = defOf(b)): number {
  if (!d.storage) return 0;
  return d.storage.kwh * b.units * (1 - b.wearOut) * mod(s, 'storage.capacity');
}

export function storagePowerKW(s: GameState, b: BuildingInstance, d = defOf(b)): number {
  if (!d.storage) return 0;
  return d.storage.kwh * b.units * d.storage.cRate * (1 + localMods(b).power) * mod(s, 'storage.power');
}

export function repairThreshold(s: GameState, m: MapState, b: BuildingInstance): number {
  return b.repairThreshold ?? m.policies.typeThresholds[b.def] ?? m.policies.repairThreshold ?? s.defaultRepairThreshold ?? BALANCE.defaultRepairThreshold;
}

export function installedCapacity(s: GameState, stage?: StageId): number {
  let kw = 0;
  for (const m of Object.values(s.maps)) {
    if (!m || (stage && m.id !== stage)) continue;
    for (const b of Object.values(m.buildings)) {
      const d = defOf(b);
      if (isGenerator(d)) kw += nameplateKW(b, d);
    }
  }
  return kw;
}

export function installedStorage(s: GameState): number {
  let kwh = 0;
  for (const m of Object.values(s.maps)) if (m) for (const b of Object.values(m.buildings)) kwh += storageCapacityKWh(s, b);
  return kwh;
}

export function workerCount(s: GameState): number {
  let n = 0;
  for (const v of Object.values(s.workforce)) n += v;
  for (const m of Object.values(s.maps)) if (m) for (const v of Object.values(m.workforce)) n += v;
  return n;
}

export function buildingsOf(m: MapState, defId: string): BuildingInstance[] {
  return Object.values(m.buildings).filter((b) => b.def === defId);
}

export interface MapAgg {
  fuelDepots: number;
  depotWU: number;
  maintPct: number;
  opsPct: number;
  logisticsAmount: number;
  logisticsHubs: number;
  gridExtraKW: number;
  trading: number;
  opex: number;
  labRP: number;
  producers: number;
  hydro: number;
  fuels: FuelId[];
}

/** One pass over a map's installations for all role-based aggregates (memoised per tick). */
export function mapAgg(m: MapState): MapAgg {
  return tickMemo(m, () => {
    const a: MapAgg = { fuelDepots: 0, depotWU: 0, maintPct: 0, opsPct: 0, logisticsAmount: 0, logisticsHubs: 0, gridExtraKW: 0, trading: 0, opex: 0, labRP: 0, producers: 0, hydro: 0, fuels: [] };
    const fuels = new Set<FuelId>();
    for (const b of Object.values(m.buildings)) {
      const d = defOf(b);
      if (!d.fixed) a.opex += b.invested * BALANCE.omRate;
      if (d.thermal) fuels.add(d.thermal.fuel);
      if (d.gen?.kind === 'hydro' || d.gen?.kind === 'dam') a.hydro++;
      const r = d.infra;
      if (!r) continue;
      if (r.role === 'fuelStorage') a.fuelDepots++;
      else if (r.role === 'depot') {
        a.depotWU += r.amount ?? 0;
        a.maintPct += 0.25;
      } else if (r.role === 'ops') a.opsPct += r.amount ?? 0;
      else if (r.role === 'logistics') {
        a.logisticsAmount += r.amount ?? 0;
        a.logisticsHubs++;
      } else if (r.role === 'grid' && b.enabled && b.condition > 0.1) a.gridExtraKW += (r.kw ?? 0) * (0.5 + 0.5 * b.condition);
      else if (r.role === 'trading') a.trading += r.amount ?? 0;
      else if (r.role === 'lab' && b.enabled && b.condition > 0.1) a.labRP += (r.amount ?? 0) * (0.5 + 0.5 * b.condition);
      else if (r.role === 'fuelProducer') a.producers++;
    }
    a.fuels = [...fuels];
    return a;
  });
}

/** Fuel depot capacity on a map (kWh_th, shared by all fuels). */
export function depotCapacityKWh(m: MapState): number {
  return KW_TILE[m.id] * (BALANCE.depotBase + BALANCE.depotPerBuilding * mapAgg(m).fuelDepots);
}

export function depotUsedKWh(m: MapState, includeTransit = false): number {
  let e = 0;
  for (const [f, q] of Object.entries(m.fuel)) e += (q ?? 0) * FUELS[f as FuelId].energyPerUnit;
  if (includeTransit) for (const j of m.logisticsJobs) if (j.kind === 'delivery') e += j.qty * FUELS[j.fuel].energyPerUnit;
  return e;
}

export function maintenanceCapacity(s: GameState, m: MapState): number {
  let base = 0;
  for (const [tier, n] of Object.entries(m.workforce)) {
    const t = EMPLOYEES[tier];
    if (t?.group === 'maintenance') base += t.capacity * n;
  }
  base *= 1 + BALANCE.maintenanceTrainingStep * m.training.maintenance;
  const a = mapAgg(m);
  return (base + a.depotWU) * (1 + a.maintPct + a.opsPct) * mod(s, 'workforce.capacity') * mod(s, 'maintenance.capacity');
}

export function logisticsSlots(s: GameState, m: MapState): number {
  let base = 0;
  for (const [tier, n] of Object.entries(m.workforce)) {
    const t = EMPLOYEES[tier];
    if (t?.group === 'logistics') base += t.capacity * n;
  }
  base *= 1 + BALANCE.logisticsTrainingStep * m.training.logistics;
  base += mapAgg(m).logisticsAmount;
  return Math.floor(BALANCE.baseLogisticsSlots + base * mod(s, 'workforce.capacity') * mod(s, 'logistics.capacity'));
}

export function logisticsSpeed(s: GameState, m: MapState): number {
  const a = mapAgg(m);
  return mod(s, 'logistics.speed') + 0.2 * a.logisticsHubs + a.opsPct;
}

export function tradingCapacity(s: GameState): number {
  let t = 0;
  for (const [tier, n] of Object.entries(s.workforce)) if (EMPLOYEES[tier]?.group === 'trading') t += EMPLOYEES[tier].capacity * n;
  t *= 1 + BALANCE.staffTrainingStep * s.staffTraining.trading;
  for (const m of Object.values(s.maps)) if (m) t += mapAgg(m).trading;
  return t * mod(s, 'workforce.capacity');
}

/** Trader price uplift on market sales (exports/PPAs), capped. */
export function traderBonus(s: GameState): number {
  return Math.min(0.12, 0.01 * tradingCapacity(s));
}

export function gridLimits(s: GameState, m: MapState): { importKW: number; exportKW: number; losses: number } {
  const lvl = STAGES[m.id].grid[m.gridLevel];
  const extra = mapAgg(m).gridExtraKW;
  const k = mod(s, 'grid.capacity');
  const offGrid = s.challenge === 'off_grid' && m.id !== 'backyard';
  return { importKW: offGrid ? 0 : (lvl.importKW + extra) * k, exportKW: lvl.exportKW > 0 || extra > 0 ? (lvl.exportKW + extra) * k : 0, losses: lvl.losses * mod(s, 'grid.losses') };
}

export function terrainCostMult(m: MapState, tiles: number[]): number {
  if (!tiles.length) return 1;
  let k = 0;
  for (const i of tiles) k += m.terrain[i] === 'mountain' ? 1.3 : m.terrain[i] === 'ocean' ? 1.2 : 1;
  return k / Math.max(1, tiles.length);
}

export function terrainName(t: TerrainId) {
  return TERRAIN[t].name;
}

export function mapStage(m: MapState) {
  return STAGES[m.id];
}

/** Highest game speed unlocked: 2× after winning once, 3× with every achievement (both survive prestige). */
export function speedCap(s: GameState): number {
  if (ACHIEVEMENTS.every((a) => s.achievements[a.id] !== undefined)) return 3;
  return s.achievements.convergence !== undefined || s.won ? 2 : 1;
}

export const SPEED_UNLOCK = ['', 'Win the game to unlock 2×.', 'Unlock every achievement to unlock 3×.'];
