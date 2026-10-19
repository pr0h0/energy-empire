import { BALANCE } from '../data/balance';
import { STAGES } from '../data/stages';
import { defOf, isGenerator, isStorage, maintenanceCapacity, repairThreshold, ratedKW, type Def } from '../core/Helpers';
import { hasFeature, localMods, mod } from '../core/Modifiers';
import type { BuildingInstance, GameState, MapState, RepairJob } from '../core/State';
import { notify } from '../core/GameEvents';
import { fleetMaintFactor } from '../world/BuildingAggregation';
import { spend } from './FinanceSystem';
import { WEATHER, weatherAt } from './WeatherSystem';

/**
 * Condition, aging and the capacity-based repair queue.
 *
 *  • Wear: condition falls with use (load-based for rotating/thermal plant, time-based for PV).
 *  • Aging: irreversible capacity loss (wearOut) — ordinary repair never reverses it;
 *    component replacement / cell replacement does.
 *  • Jobs: buildings below their threshold enter a queue. Crews (Maintenance Capacity, WU/h)
 *    work the highest-priority jobs; priority ages with waiting time so nothing starves.
 */

export function maintLoad(b: BuildingInstance, d: Def): number {
  return d.maint * fleetMaintFactor(d, b.units) * Math.max(0.2, 1 + localMods(b).maint);
}

/** Work (WU·h) to restore one full unit of condition. */
export const workPerCondition = (b: BuildingInstance, d: Def) => maintLoad(b, d) * BALANCE.repairWorkPerLoad;

/** Materials cost to restore `dc` condition. */
export function repairMaterialCost(s: GameState, b: BuildingInstance, dc: number): number {
  return Math.max(0, dc) * BALANCE.repairCostFrac * b.invested * mod(s, 'repair.cost');
}

/** Manual repairs bill at least $1 so tiny jobs don't show/charge fractions of a cent. */
export function manualRepairCost(s: GameState, b: BuildingInstance): number {
  const c = repairMaterialCost(s, b, 1 - b.condition) * BALANCE.manualRepairPremium;
  return c > 0 ? Math.max(1, c) : 0;
}

function usage(b: BuildingInstance, d: Def): number {
  if (d.storage) return 0.2 + (b.act ?? 0);
  if (!isGenerator(d)) return 1;
  const k = d.gen?.kind;
  if (k === 'solar' || k === 'orbital' || k === 'stellar' || k === 'dyson' || k === 'constant') return 1;
  const r = ratedKW(b, d);
  return 0.25 + 0.75 * Math.min(1.2, r > 0 ? Math.max(0, b.output) / r : 0);
}

/** Expected work demand (WU) to keep a building at steady state. */
export function expectedLoad(s: GameState, b: BuildingInstance, d: Def): number {
  return d.wear * mod(s, 'wear') * Math.max(0.1, 1 + localMods(b).wear) * usage(b, d) * workPerCondition(b, d);
}

export function jobPriority(s: GameState, m: MapState, j: RepairJob, maxRev: number): number {
  const b = m.buildings[j.building];
  if (!b) return -Infinity;
  const d = defOf(b);
  const th = repairThreshold(s, m, b);
  const urgency = Math.max(0, (th - b.condition) / Math.max(0.05, th)) * 3;
  const shutdownRisk = b.condition < (d.shutdownBelow ?? 0.1) + 0.08 ? 5 : 0;
  const economic = maxRev > 0 ? (Math.log10(1 + Math.max(0, b.rRevenue)) / Math.log10(1 + maxRev)) * 2 : 0;
  const player = (b.priority ?? 0) * 3 + j.priority * 3;
  const preventive = j.kind === 'preventive' ? -6 : 0;
  return urgency + shutdownRisk + economic + player + preventive + j.waitedH * 0.15;
}

export function simulateMaintenance(s: GameState, m: MapState, dt: number): { repairs: number } {
  const wearMod = mod(s, 'wear');
  const wx = weatherAt(m, s.time);
  const stormWear = wx ? WEATHER[wx.kind].wear : 1;
  let repairsDone = 0;
  const buildings = Object.values(m.buildings);
  const queued = new Set(m.repairJobs.map((j) => j.building));
  for (const b of buildings) {
    const d = defOf(b);
    if (d.fixed) continue;
    const lm = localMods(b);
    const overdrive = (b.target ?? 1) > 1 ? 1 + ((b.target ?? 1) - 1) * 5 : 1;
    const before = b.condition;
    const exposed = d.family === 'wind' || d.family === 'solar' ? stormWear : 1;
    b.condition = Math.max(0, b.condition - d.wear * wearMod * Math.max(0.1, 1 + lm.wear) * Math.max(usage(b, d), exposed > 1 ? 0.5 : 0) * exposed * overdrive * dt);
    if (!isStorage(d) && d.gen?.kind !== 'geothermal') b.wearOut = Math.min(0.6, b.wearOut + d.aging * Math.max(0.1, 1 + lm.aging) * dt);
    const th = repairThreshold(s, m, b);
    if (before >= th && b.condition < th && !queued.has(b.id)) {
      queued.add(b.id);
      m.repairJobs.push({ id: `j${s.nextId++}`, building: b.id, kind: 'repair', work: 0, done: 0, waitedH: 0, paid: false, priority: 0 });
      if (maintenanceCapacity(s, m) <= 0) notify(s, `maint:${m.id}`, 'warning', 'maintenance', `${d.name} on ${STAGES[m.id].name} needs maintenance (${Math.round(b.condition * 100)}%). Hire technicians or repair manually.`, m.id, 24);
    }
    const sd = d.shutdownBelow ?? 0.1;
    if (before >= sd && b.condition < sd) notify(s, `shutdown:${b.id}`, 'critical', 'maintenance', `${d.name} on ${STAGES[m.id].name} shut down — condition critical.`, m.id, 24);
  }
  // also queue anything below threshold that lost its job (threshold changes, loads)
  for (const b of buildings) {
    if (defOf(b).fixed) continue;
    if (b.condition < repairThreshold(s, m, b) && !queued.has(b.id) && (queued.add(b.id), true))
      m.repairJobs.push({ id: `j${s.nextId++}`, building: b.id, kind: 'repair', work: 0, done: 0, waitedH: 0, paid: false, priority: 0 });
  }
  // drop jobs whose building was removed
  m.repairJobs = m.repairJobs.filter((j) => m.buildings[j.building]);

  let capacity = maintenanceCapacity(s, m) * dt;
  if (capacity > 0 && !s.automationPaused) {
    const maxRev = buildings.reduce((a, b) => Math.max(a, b.rRevenue), 0);
    const jobs = m.repairJobs.filter((j) => j.kind === 'repair').sort((a, b) => jobPriority(s, m, b, maxRev) - jobPriority(s, m, a, maxRev));
    for (const j of jobs) {
      if (capacity <= 1e-12) break;
      const b = m.buildings[j.building];
      const d = defOf(b);
      const wpc = Math.max(1e-9, workPerCondition(b, d));
      const crewMax = Math.max(2, maintLoad(b, d) * 1.5) * dt;
      const need = (1 - b.condition) * wpc;
      const work = Math.min(capacity, crewMax, need);
      const dc = work / wpc;
      const cost = repairMaterialCost(s, b, dc);
      if (cost > 0 && s.money < cost) continue; // waits for funds; keeps queue position via waitedH
      spend(s, m, 'repairs', cost);
      b.opCost += cost;
      b.condition = Math.min(1, b.condition + dc);
      j.done += work;
      capacity -= work;
      if (b.condition >= 0.999) {
        b.condition = 1;
        j.work = -1;
        repairsDone++;
      }
    }
    // idle crews perform preventive servicing (research)
    if (capacity > 1e-9 && hasFeature(s, 'repair.preventive')) {
      const active = new Set(m.repairJobs.filter((j) => j.work >= 0).map((j) => j.building));
      const cands = buildings.filter((b) => !defOf(b).fixed && b.condition < 0.95 && !active.has(b.id)).sort((a, b) => a.condition - b.condition);
      for (const b of cands) {
        if (capacity <= 1e-12) break;
        const d = defOf(b);
        const wpc = Math.max(1e-9, workPerCondition(b, d));
        const work = Math.min(capacity, (1 - b.condition) * wpc, Math.max(2, maintLoad(b, d)) * dt);
        const dc = work / wpc;
        const cost = repairMaterialCost(s, b, dc);
        if (s.money < cost) break;
        spend(s, m, 'maintenance', cost);
        b.opCost += cost;
        b.condition = Math.min(1, b.condition + dc);
        capacity -= work;
      }
    }
  }
  for (const j of m.repairJobs) j.waitedH += dt;
  m.repairJobs = m.repairJobs.filter((j) => j.work >= 0);
  s.run.repairs += repairsDone;
  s.lifetime.repairs += repairsDone;
  return { repairs: repairsDone };
}

export function mapMaintenanceLoad(s: GameState, m: MapState): number {
  let l = 0;
  for (const b of Object.values(m.buildings)) {
    const d = defOf(b);
    if (!d.fixed) l += expectedLoad(s, b, d);
  }
  return l;
}
