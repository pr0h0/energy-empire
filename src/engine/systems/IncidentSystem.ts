import { FUELS } from '../data/fuels';
import { STAGES } from '../data/stages';
import type { FuelId, StageId } from '../data/types';
import { defOf } from '../core/Helpers';
import { notify } from '../core/GameEvents';
import type { GameState } from '../core/State';
import { canAfford, spend } from './FinanceSystem';
import { fuelBalance, fuelPrice } from './ThermalSystem';

/**
 * Occasional business events that ask for a decision. At most one per 6-day block, deterministic per
 * seed; the player has 24 h to choose, after which the "do nothing" option applies (also offline).
 */
export type IncidentKind = 'recall' | 'fuelSpike' | 'demandBoom';
export interface Incident { kind: IncidentKind; map: StageId; fuel?: FuelId; cost: number; targets: string[]; expiresAt: number; block: number }
export interface IncidentEffect { kind: 'fuel' | 'demand'; map?: StageId; fuel?: FuelId; mult: number; until: number }

const BLOCK_H = 144;
const DECIDE_H = 24;
const SPIKE = { mult: 1.6, h: 72 };
const BOOM = { mult: 1.25, h: 120 };
const RECALL_HIT = 0.25;

export const INCIDENTS: Record<IncidentKind, { name: string; yes: string; no: string }> = {
  recall: { name: 'Equipment recall', yes: 'Fix proactively', no: 'Ignore' },
  fuelSpike: { name: 'Fuel price spike', yes: 'Buy a price hedge', no: 'Ride it out' },
  demandBoom: { name: 'Demand boom', yes: 'Accept the new load', no: 'Decline' },
};

const rnd = (seed: number, k: number) => {
  let x = (seed * 2654435761 + k * 40503) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
};

/** Multiplier from active incident effects (1 when none). */
export function incidentMult(s: GameState, kind: 'fuel' | 'demand', key: string, t = s.time): number {
  let k = 1;
  for (const e of s.incidents.active) if (e.kind === kind && e.until > t && (kind === 'fuel' ? e.fuel === key : e.map === key)) k *= e.mult;
  return k;
}

export function incidentText(i: Incident): string {
  const st = STAGES[i.map].name;
  if (i.kind === 'recall') return `A supplier recalled a component used in ${i.targets.length} of your solar, wind and storage installations on ${st}. Fix them now, or they lose ${RECALL_HIT * 100}% condition when the fault shows.`;
  if (i.kind === 'fuelSpike') return `${FUELS[i.fuel!].name} prices are about to jump ${Math.round((SPIKE.mult - 1) * 100)}% for ${SPIKE.h / 24} days. A hedge keeps your price unchanged.`;
  return `A new industrial park on ${st} wants power: +${Math.round((BOOM.mult - 1) * 100)}% customer demand for ${BOOM.h / 24} days. More sales — if you can keep up.`;
}

function roll(s: GameState, block: number): Incident | null {
  if (block < 2 || rnd(s.seed, block) > 0.5) return null;
  const maps = Object.values(s.maps).filter((m) => m && !STAGES[m.id].space);
  if (!maps.length) return null;
  const m = maps[Math.floor(rnd(s.seed, block * 7 + 1) * maps.length)]!;
  const kinds: IncidentKind[] = ['recall', 'fuelSpike', 'demandBoom'];
  const kind = kinds[Math.floor(rnd(s.seed, block * 7 + 2) * 3)];
  const expiresAt = s.time + DECIDE_H;
  if (kind === 'recall') {
    const targets = Object.values(m.buildings).filter((b) => ['solar', 'wind', 'storage'].includes(defOf(b).family)).map((b) => b.id);
    if (targets.length < 3) return null;
    const cost = targets.reduce((a, id) => a + m.buildings[id].invested, 0) * 0.04;
    return { kind, map: m.id, cost, targets, expiresAt, block };
  }
  if (kind === 'fuelSpike') {
    const fuels = [...new Set(Object.values(m.buildings).map((b) => defOf(b).thermal?.fuel).filter((f): f is FuelId => !!f))];
    const fuel = fuels[Math.floor(rnd(s.seed, block * 7 + 3) * fuels.length)];
    if (!fuel) return null;
    const burn = fuelBalance(s, m, fuel).burnNow;
    if (burn <= 0) return null;
    // hedge ≈ a third of the extra the spike would cost at today's burn
    const cost = burn * SPIKE.h * fuelPrice(s, fuel) * (SPIKE.mult - 1) * 0.35;
    return { kind, map: m.id, fuel, cost, targets: [], expiresAt, block };
  }
  if (m.id === 'backyard') return null;
  return { kind, map: m.id, cost: 0, targets: [], expiresAt, block };
}

/** Rolls new incidents, applies defaults when the decision window lapses, and drops expired effects. */
export function simulateIncidents(s: GameState) {
  const inc = s.incidents;
  inc.active = inc.active.filter((e) => e.until > s.time);
  if (inc.pending && s.time >= inc.pending.expiresAt) resolveIncident(s, false);
  const block = Math.floor(s.time / BLOCK_H);
  if (!inc.pending && block > inc.lastBlock) {
    inc.lastBlock = block;
    const i = roll(s, block);
    if (i) {
      inc.pending = i;
      notify(s, `inc:${block}`, 'warning', 'decision', `${INCIDENTS[i.kind].name}: ${incidentText(i)} Decide within ${DECIDE_H} h.`, i.map);
    }
  }
}

export function resolveIncident(s: GameState, accept: boolean): string | null {
  const i = s.incidents.pending;
  if (!i) return 'Nothing to decide.';
  const m = s.maps[i.map];
  if (accept && i.cost > 0) {
    if (!canAfford(s, i.cost)) return 'Not enough money.';
    spend(s, m ?? null, i.kind === 'recall' ? 'repairs' : 'fuel', i.cost);
  }
  if (i.kind === 'recall' && !accept && m)
    for (const id of i.targets) if (m.buildings[id]) m.buildings[id].condition = Math.max(0, m.buildings[id].condition - RECALL_HIT);
  if (i.kind === 'fuelSpike' && !accept) s.incidents.active.push({ kind: 'fuel', fuel: i.fuel, mult: SPIKE.mult, until: s.time + SPIKE.h });
  if (i.kind === 'demandBoom' && accept) s.incidents.active.push({ kind: 'demand', map: i.map, mult: BOOM.mult, until: s.time + BOOM.h });
  s.incidents.pending = null;
  return null;
}
