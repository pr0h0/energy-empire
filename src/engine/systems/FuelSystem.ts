import { FUELS } from '../data/fuels';
import { KW_TILE, STAGES } from '../data/stages';
import type { FuelId } from '../data/types';
import { defOf, depotCapacityKWh, depotUsedKWh, logisticsSpeed, mapAgg } from '../core/Helpers';
import { hasFeature } from '../core/Modifiers';
import type { FuelPolicy, GameState, MapState } from '../core/State';
import { canAfford, spend } from './FinanceSystem';
import { fuelPrice, tankCapacity } from './ThermalSystem';

/** Fuels consumed by installations on a map. */
export function fuelsUsed(m: MapState): FuelId[] {
  return mapAgg(m).fuels;
}

export function fuelPolicy(m: MapState, f: FuelId): FuelPolicy {
  return (m.policies.fuel[f] ??= { mode: 'refuel', refillAt: 0.4, minInventory: 0.5, budgetPerDay: 0, spentToday: 0, maxPriceFactor: 1.15 });
}

/** Supply availability: each fuel's market opens at a given scale. */
export function fuelAvailable(m: MapState, f: FuelId): boolean {
  return STAGES[m.id].index >= STAGES[FUELS[f].availableFrom].index;
}

export function depotFreeKWh(m: MapState): number {
  return Math.max(0, depotCapacityKWh(m) - depotUsedKWh(m, true));
}

export function bulkDiscount(s: GameState, m: MapState, f: FuelId, qty: number): number {
  if (!hasFeature(s, 'fuel.bulk')) return 1;
  return qty * FUELS[f].energyPerUnit >= KW_TILE[m.id] * 1500 ? 0.92 : 1;
}

export function fuelOrderCost(s: GameState, m: MapState, f: FuelId, qty: number): number {
  // small freight surcharge that grows with the stage's distance abstraction
  return qty * fuelPrice(s, f) * bulkDiscount(s, m, f, qty) * (1 + 0.02 * STAGES[m.id].distance);
}

/** Delivery time grows with distance and (logarithmically) with batch size; hubs/research speed it up. */
export function deliveryHours(s: GameState, m: MapState, f: FuelId, qty: number): number {
  const e = qty * FUELS[f].energyPerUnit;
  const size = 1 + Math.log10(1 + e / (KW_TILE[m.id] * 200));
  return (FUELS[f].deliveryH * Math.sqrt(STAGES[m.id].distance) * size) / logisticsSpeed(s, m);
}

export type OrderResult = { ok: true; cost: number; hours: number } | { ok: false; error: string };

export function orderFuel(s: GameState, m: MapState, f: FuelId, qty: number, auto: boolean, priceOverride?: number): OrderResult {
  if (!FUELS[f]) return { ok: false, error: 'Unknown fuel.' };
  if (!fuelAvailable(m, f)) return { ok: false, error: `${FUELS[f].name} is not traded at ${STAGES[m.id].name} scale (available from ${STAGES[FUELS[f].availableFrom].name}).` };
  if (!(qty > 0) || !Number.isFinite(qty)) return { ok: false, error: 'Quantity must be positive.' };
  const free = depotFreeKWh(m) / FUELS[f].energyPerUnit;
  if (qty > free * 1.0000001) return { ok: false, error: `Not enough depot space (room for ${free.toPrecision(3)} ${FUELS[f].unit}). Build a Fuel Storage Depot.` };
  const cost = priceOverride !== undefined ? qty * priceOverride : fuelOrderCost(s, m, f, qty);
  if (!canAfford(s, cost)) return { ok: false, error: 'Not enough money.' };
  spend(s, m, 'fuel', cost);
  const hours = deliveryHours(s, m, f, qty);
  m.logisticsJobs.push({ id: `l${s.nextId++}`, kind: 'delivery', fuel: f, qty, remainingH: hours, totalH: hours, auto });
  s.lastEvents[`fuelbuy:${m.id}`] = s.time;
  return { ok: true, cost, hours };
}

/** Move fuel from depot into a generator tank (instant, used by manual refuel and job completion). */
export function transferToTank(m: MapState, buildingId: string): number {
  const b = m.buildings[buildingId];
  if (!b) return 0;
  const d = defOf(b);
  if (!d.thermal) return 0;
  const f = d.thermal.fuel;
  const room = Math.max(0, tankCapacity(b, d) - (b.tank ?? 0));
  const q = Math.min(room, m.fuel[f] ?? 0);
  m.fuel[f] = Math.max(0, (m.fuel[f] ?? 0) - q);
  b.tank = (b.tank ?? 0) + q;
  return q;
}

/** Self-produced fuel (plantations, mines, scoops) flows into the depot, capped by capacity. */
export function produceFuel(s: GameState, m: MapState, dt: number) {
  if (!mapAgg(m).producers) return;
  for (const b of Object.values(m.buildings)) {
    const d = defOf(b);
    if (d.infra?.role !== 'fuelProducer' || !d.infra.fuel) continue;
    if (!b.enabled || b.downtimeUntil > s.time || b.condition < 0.1) {
      b.output = 0;
      continue;
    }
    const f = d.infra.fuel;
    const supplied = b.supplied ?? 1;
    const want = (d.infra.rate ?? 0) * b.units * (0.6 + 0.4 * b.condition) * supplied * dt;
    const room = depotFreeKWh(m) / FUELS[f].energyPerUnit;
    const q = Math.max(0, Math.min(want, room));
    m.fuel[f] = (m.fuel[f] ?? 0) + q;
    b.output = -(d.infra.loadKW ?? 0) * b.units * supplied;
    b.status = q < want * 0.99 ? (room <= 0 ? 'Depot full — production paused' : 'Insufficient power') : supplied < 0.99 ? 'Insufficient power' : 'Producing';
  }
}
