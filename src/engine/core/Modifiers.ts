import { BUILDINGS } from '../data/buildings';
import { PRESTIGE_UPGRADES } from '../data/prestige';
import { RESEARCH } from '../data/research';
import { UPGRADES } from '../data/upgrades';
import type { Effect, Feature, LocalKey, ModKey } from '../data/types';
import type { BuildingInstance, GameState } from './State';

export interface ModSet {
  sig: string;
  /** Multipliers: 1 + Σ adds (clamped ≥ 0.05). */
  m: Record<string, number>;
  features: Set<Feature>;
  unlockedBuildings: Set<string>;
  unlockedUpgrades: Set<string>;
}

const cache = new WeakMap<GameState, ModSet>();
const ALL_KEYS: ModKey[] = [
  'solar.output', 'wind.output', 'hydro.output', 'thermal.eta', 'thermal.cooling', 'geothermal.output', 'nuclear.fuel', 'fusion.output', 'orbital.output', 'stellar.output', 'exotic.output',
  'storage.eta', 'storage.capacity', 'storage.aging', 'storage.power', 'grid.capacity', 'grid.losses', 'wear', 'maintenance.capacity', 'repair.cost', 'logistics.speed', 'logistics.capacity',
  'research.speed', 'market.price', 'fuel.cost', 'land.cost', 'density', 'wages', 'build.cost', 'salvage', 'demand.price', 'revenue', 'workforce.capacity',
];

/** Research completions and prestige purchases are the only inputs; both are monotonic counters. */
function signature(s: GameState): string {
  const lv = Object.values(s.research.levels ?? {}).reduce((a, b) => a + b, 0);
  return `${Object.keys(s.research.done).length}:${lv}:${s.prestige.spent}:${s.prestige.resets}`;
}

const REP_CAP = 0.25;

let frozen: { s: GameState; set: ModSet } | null = null;

/** During a simulation tick modifiers are computed once (one-tick lag for mid-tick research). */
export function freezeMods(s: GameState) {
  frozen = null;
  frozen = { s, set: getMods(s) };
}
export function unfreezeMods() {
  frozen = null;
  memo.clear();
}

const memo = new Map<unknown, unknown>();
/** Memoise an expensive aggregate for the duration of the current tick (no-op outside ticks). */
export function tickMemo<T>(key: unknown, fn: () => T): T {
  if (!frozen) return fn();
  if (memo.has(key)) return memo.get(key) as T;
  const v = fn();
  memo.set(key, v);
  return v;
}

/** Company-wide modifiers from completed research and purchased prestige upgrades. */
export function getMods(s: GameState): ModSet {
  if (frozen && frozen.s === s) return frozen.set;
  const sig = signature(s);
  const c = cache.get(s);
  if (c && c.sig === sig) return c;
  const add: Record<string, number> = {};
  const features = new Set<Feature>();
  const unlockedBuildings = new Set<string>();
  const unlockedUpgrades = new Set<string>();
  const apply = (e: Effect, times = 1) => {
    if (e.type === 'mod') add[e.key] = (add[e.key] ?? 0) + e.add * times;
    else if (e.type === 'feature') features.add(e.feature);
    else if (e.type === 'unlock') unlockedBuildings.add(e.building);
    else unlockedUpgrades.add(e.upgrade);
  };
  for (const id of Object.keys(s.research.done)) RESEARCH[id]?.effects.forEach((e) => apply(e));
  for (const [id, lvl] of Object.entries(s.research.levels ?? {})) RESEARCH[id]?.effects.forEach((e) => {
    // reductions approach −REP_CAP asymptotically so a repeatable can never drive a cost to zero
    if (e.type === 'mod' && e.add < 0) add[e.key] = (add[e.key] ?? 0) - REP_CAP * (1 - Math.pow(1 + e.add / REP_CAP, lvl));
    else apply(e, lvl);
  });
  for (const [id, lvl] of Object.entries(s.prestige.upgrades)) if (lvl > 0) PRESTIGE_UPGRADES[id]?.effects.forEach((e) => apply(e, lvl));
  const m: Record<string, number> = {};
  for (const k of ALL_KEYS) m[k] = Math.max(0.05, 1 + (add[k] ?? 0));
  const set: ModSet = { sig, m, features, unlockedBuildings, unlockedUpgrades };
  cache.set(s, set);
  return set;
}

export const mod = (s: GameState, key: ModKey) => getMods(s).m[key];
export const hasFeature = (s: GameState, f: Feature) => getMods(s).features.has(f);

export function isBuildingUnlocked(s: GameState, defId: string): boolean {
  const d = BUILDINGS[defId];
  if (!d) return false;
  return !d.research || s.research.done[d.research] !== undefined || getMods(s).unlockedBuildings.has(defId);
}

export function isUpgradeUnlocked(s: GameState, upgradeId: string): boolean {
  return getMods(s).unlockedUpgrades.has(upgradeId);
}

const localCache = new WeakMap<BuildingInstance, { key: string; r: Record<LocalKey, number> }>();

/** Per-installation retrofit modifiers (sum of adds). Cached until the upgrade list changes. */
export function localMods(inst: BuildingInstance): Record<LocalKey, number> {
  const key = inst.upgrades.join(',');
  const c = localCache.get(inst);
  if (c && c.key === key) return c.r;
  const r: Record<LocalKey, number> = { output: 0, wear: 0, eta: 0, cooling: 0, maint: 0, fuel: 0, capacity: 0, aging: 0, storageEta: 0, ramp: 0, power: 0 };
  for (const u of inst.upgrades) for (const e of UPGRADES[u]?.effects ?? []) r[e.key] += e.add;
  localCache.set(inst, { key, r });
  return r;
}
