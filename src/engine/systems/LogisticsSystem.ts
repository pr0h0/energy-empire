import { FUELS } from '../data/fuels';
import { STAGES } from '../data/stages';
import { dayOf } from '../core/GameClock';
import { defOf, depotCapacityKWh, depotUsedKWh, logisticsSlots, logisticsSpeed } from '../core/Helpers';
import { hasFeature } from '../core/Modifiers';
import type { GameState, MapState } from '../core/State';
import { notify } from '../core/GameEvents';
import { fuelOrderCost, fuelPolicy, fuelsUsed, orderFuel, transferToTank } from './FuelSystem';
import { fuelPrice, tankCapacity } from './ThermalSystem';

/**
 * Timed deliveries (market → depot) and refuelling runs (depot → generator tanks) share the
 * map's Logistics Capacity (slots). Jobs beyond capacity wait in FIFO order. Nuclear refuelling
 * is an outage: the reactor is offline while its job is active.
 */
export function refuelDuration(s: GameState, m: MapState, buildingId: string): number {
  const d = defOf(m.buildings[buildingId]);
  return (d.thermal?.refuelOutageH ?? 0.5) / (d.thermal?.refuelOutageH ? 1 : logisticsSpeed(s, m));
}

export function requestRefuel(s: GameState, m: MapState, buildingId: string, auto: boolean): boolean {
  const b = m.buildings[buildingId];
  if (!b || !defOf(b).thermal) return false;
  if (m.logisticsJobs.some((j) => j.kind === 'refuel' && j.building === buildingId)) return false;
  const f = defOf(b).thermal!.fuel;
  const h = refuelDuration(s, m, buildingId);
  m.logisticsJobs.push({ id: `l${s.nextId++}`, kind: 'refuel', fuel: f, qty: 0, remainingH: h, totalH: h, building: buildingId, auto });
  return true;
}

export function simulateLogistics(s: GameState, m: MapState, dt: number): { delivered: number } {
  // cancel refuels for removed buildings (fuel never leaves the depot, nothing is lost)
  m.logisticsJobs = m.logisticsJobs.filter((j) => j.kind !== 'refuel' || (j.building && m.buildings[j.building]));
  const slots = logisticsSlots(s, m);
  let active = 0;
  let delivered = 0;
  for (const j of m.logisticsJobs) {
    if (active >= slots) break;
    if (j.kind === 'refuel') {
      const b = m.buildings[j.building!];
      const d = defOf(b);
      if ((m.fuel[j.fuel] ?? 0) <= 0) continue; // nothing to load yet; does not block a slot
      if (d.thermal?.refuelOutageH) {
        b.downtimeUntil = Math.max(b.downtimeUntil, s.time + j.remainingH);
        b.downtimeReason = 'Refuelling outage';
      }
    }
    active++;
    j.remainingH -= dt;
  }
  const done = m.logisticsJobs.filter((j) => j.remainingH <= 0);
  m.logisticsJobs = m.logisticsJobs.filter((j) => j.remainingH > 0);
  const cap = depotCapacityKWh(m);
  for (const j of done) {
    if (j.kind === 'delivery') {
      const room = Math.max(0, (cap - depotUsedKWh(m)) / FUELS[j.fuel].energyPerUnit);
      const q = Math.min(j.qty, room);
      m.fuel[j.fuel] = (m.fuel[j.fuel] ?? 0) + q;
      delivered += q;
      if (!j.auto) notify(s, `deliv:${j.id}`, 'info', 'fuel', `${FUELS[j.fuel].name} delivery arrived on ${STAGES[m.id].name}.`, m.id);
    } else if (j.building) {
      transferToTank(m, j.building);
      const b = m.buildings[j.building];
      if (b && b.downtimeReason === 'Refuelling outage') b.downtimeUntil = s.time;
    }
  }
  return { delivered };
}

/** Fuel automation: auto-refuel from depot and (if researched) budgeted auto-purchasing. */
export function simulateFuelAutomation(s: GameState, m: MapState) {
  if (s.automationPaused) return;
  const fuels = fuelsUsed(m);
  if (!fuels.length) return;
  const day = dayOf(s.time);
  const thermals = Object.values(m.buildings).filter((b) => defOf(b).thermal);
  for (const f of fuels) {
    const p = fuelPolicy(m, f);
    if (p.day !== day) {
      p.day = day;
      p.spentToday = 0;
    }
    if (p.mode === 'manual') continue;
    if ((m.fuel[f] ?? 0) > 0) {
      const pending = new Set(m.logisticsJobs.filter((j) => j.kind === 'refuel').map((j) => j.building));
      for (const b of thermals) {
        const d = defOf(b);
        if (d.thermal!.fuel !== f || !b.enabled || pending.has(b.id)) continue;
        const low = d.thermal!.refuelOutageH ? 0.04 : p.refillAt;
        if ((b.tank ?? 0) < tankCapacity(b, d) * low) requestRefuel(s, m, b.id, true);
      }
    }
    if (p.mode !== 'full' || !hasFeature(s, 'fuel.autoBuy') || s.money <= 0) continue;
    const share = depotCapacityKWh(m) / fuels.length / FUELS[f].energyPerUnit;
    const inTransit = m.logisticsJobs.filter((j) => j.kind === 'delivery' && j.fuel === f).reduce((a, j) => a + j.qty, 0);
    const level = (m.fuel[f] ?? 0) + inTransit;
    if (level >= share * p.minInventory) continue;
    if (fuelPrice(s, f) > FUELS[f].price * p.maxPriceFactor) continue;
    let qty = share * 0.95 - level;
    const unitCost = fuelOrderCost(s, m, f, 1);
    const budget = p.budgetPerDay > 0 ? Math.min(p.budgetPerDay - p.spentToday, s.money * 0.5) : s.money * 0.5;
    qty = Math.min(qty, budget / unitCost);
    if (qty * FUELS[f].energyPerUnit < share * FUELS[f].energyPerUnit * 0.02) continue;
    const r = orderFuel(s, m, f, qty, true);
    if (r.ok) p.spentToday += r.cost;
  }
  for (const b of thermals) {
    const f = defOf(b).thermal!.fuel;
    if (b.enabled && (b.tank ?? 0) <= 0 && (m.fuel[f] ?? 0) <= 0)
      notify(s, `nofuel:${m.id}:${f}`, 'warning', 'fuel', `Fuel shortage on ${STAGES[m.id].name}: ${FUELS[f].name} depleted.`, m.id, 24);
  }
}
