import { BALANCE } from '../data/balance';
import { FUELS } from '../data/fuels';
import { STAGES } from '../data/stages';
import { TERRAIN } from '../data/terrain';
import type { FuelId } from '../data/types';
import { fuelPriceFactor } from '../core/GameClock';
import { type Def, defOf, ratedKW } from '../core/Helpers';
import { hasFeature, localMods, mod, tickMemo } from '../core/Modifiers';
import type { BuildingInstance, GameState, MapState } from '../core/State';
import { rectBorder } from '../world/TileGrid';
import { footprint } from '../world/BuildingFootprints';
import { incidentMult } from './IncidentSystem';
import { WEATHER, weatherAt } from './WeatherSystem';

/**
 * Unified thermal interface: fuel → heat → (conversion efficiency) → electricity, with waste
 * heat rejected by cooling. Insufficient cooling throttles output automatically — never a
 * catastrophic failure. Advanced management (research) unlocks operating targets above 100%
 * and an optimised cooling margin.
 */
export interface ThermalLimits {
  rated: number;
  max: number;
  lo: number;
  hi: number;
  minStable: number;
  eta: number;
  coolingCap: number;
  maxByCooling: number;
  maxByFuel: number;
  mc: number;
  limitedBy: string;
}

const PHASES: Record<FuelId, number> = { diesel: 0.1, gas: 0.37, coal: 0.61, biomass: 0.83, uranium: 0.2, fusion: 0.5, he3: 0.7, stellar: 0.9, exotic: 0.3 };

/** Current market price per fuel unit (smooth drift, never chaotic). */
export function fuelPrice(s: GameState, f: FuelId, t = s.time): number {
  const d = FUELS[f];
  return d.price * fuelPriceFactor(t, d.volatility, PHASES[f]) * mod(s, 'fuel.cost') * incidentMult(s, 'fuel', f, t);
}

const coolCache = new WeakMap<BuildingInstance, { k: string; v: number }>();
export function siteCooling(m: MapState, b: BuildingInstance, d: Def): number {
  const [w, h] = footprint(d, b.rot);
  const [bx, by] = [b.x, b.y];
  const k = `${bx},${by},${w},${h},${floodSig(m)}`;
  const c = coolCache.get(b);
  if (c && c.k === k) return c.v;
  const v = computeCooling(m, b, w, h);
  coolCache.set(b, { k, v });
  return v;
}

/** Change detector for reservoirs (count of flooded tiles), memoised per tick. */
function floodSig(m: MapState): number {
  return tickMemo(m.flooded, () => {
    let n = 0;
    for (const f of m.flooded) if (f) n++;
    return n;
  });
}

function computeCooling(m: MapState, b: BuildingInstance, w: number, h: number): number {
  let best = 1;
  for (const i of rectBorder(b.x, b.y, w, h, m.w, m.h)) {
    const t = m.flooded[i] ? 'reservoir' : m.terrain[i];
    best = Math.max(best, TERRAIN[t].cooling ?? 1);
  }
  const own = TERRAIN[m.terrain[b.y * m.w + b.x]].cooling ?? 1;
  return best * (own < 1 ? own : 1);
}

export function thermalEta(s: GameState, b: BuildingInstance, d: Def, load: number): number {
  const th = d.thermal!;
  const lm = localMods(b);
  const base = Math.min(0.95, (th.eta + lm.eta) * mod(s, 'thermal.eta'));
  const partLoad = 1 - th.partLoad * (1 - Math.min(1, load)) ** 2;
  return Math.max(0.05, base * partLoad * (0.85 + 0.15 * b.condition));
}

export function thermalLimits(s: GameState, m: MapState, b: BuildingInstance, d: Def, dt: number): ThermalLimits {
  const th = d.thermal!;
  const lm = localMods(b);
  const rated = ratedKW(b, d);
  const advanced = hasFeature(s, 'thermal.advanced');
  const target = Math.min(advanced ? 1.1 : 1, b.target ?? 1);
  const max = rated * target;
  const eta = thermalEta(s, b, d, 1);
  const ratedWaste = rated * (1 / th.eta - 1);
  const margin = advanced && b.coolingMode === 'optimized' ? 1 : 0.96;
  const wx = weatherAt(m, s.time);
  const coolingCap = ratedWaste * th.cooling * siteCooling(m, b, d) * (1 + lm.cooling) * mod(s, 'thermal.cooling') * margin * (wx ? WEATHER[wx.kind].cooling : 1);
  const maxByCooling = coolingCap * eta / (1 - eta);
  const fuelKWh = (b.tank ?? 0) * FUELS[th.fuel].energyPerUnit;
  const fuelUse = Math.max(0.05, 1 + lm.fuel) * (th.fuel === 'uranium' ? mod(s, 'nuclear.fuel') : 1);
  const maxByFuel = (fuelKWh * eta) / (dt * fuelUse);
  const ramp = rated * th.ramp * (1 + lm.ramp) * dt;
  const prev = b.output / (1 - (th.parasitic ?? 0));
  const minStable = rated * th.minLoad;
  // an ignited plasma starts at its minimum stable load; ramping up from 0 would quench it every time
  const floor = th.parasitic ? minStable : 0;
  let hi = Math.min(max, Math.max(prev + ramp, floor), maxByCooling, maxByFuel);
  let lo = Math.max(0, prev - ramp);
  const wantsOff = b.mode === 'off';
  if (!wantsOff && (prev >= minStable * 0.999 || th.parasitic) && hi >= minStable) lo = Math.max(lo, minStable);
  if (hi < lo) lo = hi = Math.max(0, Math.min(hi, lo));
  if (wantsOff) hi = lo;
  const cands: [number, string][] = [[max, target > 1 ? 'operating target (uprated)' : target < 1 ? 'operating target' : 'rated capacity'], [maxByCooling, 'cooling capacity'], [maxByFuel, 'fuel supply'], [prev + ramp, 'ramp rate']];
  cands.sort((a, b2) => a[0] - b2[0]);
  const limitedBy = cands[0][1];
  const pricePerKWhTh = fuelPrice(s, th.fuel) / FUELS[th.fuel].energyPerUnit;
  const carbon = s.settings.carbonPricing ? FUELS[th.fuel].emissions * STAGES[m.id].retail * BALANCE.carbonPriceFactor : 0;
  const mc = ((pricePerKWhTh + carbon) * fuelUse) / eta;
  return { rated, max, lo, hi: Math.max(lo, hi), minStable, eta, coolingCap, maxByCooling, maxByFuel, mc, limitedBy };
}

/** Burns fuel for an electrical output P over dt; returns heat and fuel used. Never negative inventory. */
export function burnFuel(s: GameState, b: BuildingInstance, d: Def, gross: number, dt: number) {
  const th = d.thermal!;
  const rated = Math.max(1e-9, ratedKW(b, d));
  const eta = thermalEta(s, b, d, gross / rated);
  const lm = localMods(b);
  const fuelUse = Math.max(0.05, 1 + lm.fuel) * (th.fuel === 'uranium' ? mod(s, 'nuclear.fuel') : 1);
  const heat = gross / eta; // kW_th
  const units = Math.min(b.tank ?? 0, (heat * dt * fuelUse) / FUELS[th.fuel].energyPerUnit);
  b.tank = Math.max(0, (b.tank ?? 0) - units);
  b.heat = heat;
  b.waste = heat - gross;
  b.eta = eta;
  return { heat, units, emissions: heat * dt * FUELS[th.fuel].emissions * fuelUse };
}

export function tankCapacity(b: BuildingInstance, d: Def): number {
  const th = d.thermal!;
  return (ratedKW(b, d) / th.eta) * th.tankH / FUELS[th.fuel].energyPerUnit;
}

/**
 * Fuel supply vs demand on a map (fuel units per hour): own production (plantations, mines…),
 * what the plants burn right now, and what they would burn at full load.
 */
export function fuelBalance(s: GameState, m: MapState, f: FuelId) {
  let produced = 0, burnNow = 0, burnMax = 0, plants = 0, producers = 0;
  const E = FUELS[f].energyPerUnit;
  for (const b of Object.values(m.buildings)) {
    const d = defOf(b);
    if (d.infra?.role === 'fuelProducer' && d.infra.fuel === f) {
      producers++;
      if (b.enabled && b.condition >= 0.1) produced += (d.infra.rate ?? 0) * b.units * (0.6 + 0.4 * b.condition) * (b.supplied ?? 1);
    }
    const th = d.thermal;
    if (th?.fuel !== f) continue;
    plants++;
    const fuelUse = Math.max(0.05, 1 + localMods(b).fuel) * (f === 'uranium' ? mod(s, 'nuclear.fuel') : 1);
    burnNow += ((b.heat ?? 0) * fuelUse) / E;
    if (b.enabled) burnMax += (ratedKW(b, d) / thermalEta(s, b, d, 1)) * fuelUse / E;
  }
  return { produced, burnNow, burnMax, plants, producers, stock: m.fuel[f] ?? 0 };
}
