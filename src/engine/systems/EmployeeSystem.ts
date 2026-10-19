import { BALANCE } from '../data/balance';
import { EMPLOYEES } from '../data/employees';
import { STAGES } from '../data/stages';
import type { StageId } from '../data/types';
import { hasFeature } from '../core/Modifiers';
import type { GameState } from '../core/State';
import { canAfford, spend } from './FinanceSystem';

/**
 * Capacity-based workforce: crews are pooled (per map for maintenance/logistics, company-wide for
 * researchers/traders) — never assigned one-to-one to buildings.
 */
export function hireCost(tierId: string, map?: StageId): number {
  const t = EMPLOYEES[tierId];
  return t.hire * (t.group === 'maintenance' || t.group === 'logistics' ? STAGES[map!].scale : 1);
}

export function tierAvailable(s: GameState, tierId: string): string | null {
  const t = EMPLOYEES[tierId];
  if (!t) return 'Unknown role.';
  if (t.research && s.research.done[t.research] === undefined) return 'Requires research.';
  if (t.group === 'trading' && !hasFeature(s, 'market.spot')) return 'Requires Spot Markets research.';
  return null;
}

export function hire(s: GameState, tierId: string, count: number, map?: StageId): string | null {
  const t = EMPLOYEES[tierId];
  const why = tierAvailable(s, tierId);
  if (why) return why;
  const perMap = t.group === 'maintenance' || t.group === 'logistics';
  if (perMap && (!map || !s.maps[map])) return 'Choose an unlocked map for this crew.';
  if (!(count >= 1) || !Number.isInteger(count)) return 'Invalid count.';
  const cost = hireCost(tierId, map) * count;
  if (!canAfford(s, cost)) return 'Not enough money.';
  spend(s, perMap ? s.maps[map!]! : null, 'hiring', cost);
  const pool = perMap ? s.maps[map!]!.workforce : s.workforce;
  pool[tierId] = (pool[tierId] ?? 0) + count;
  return null;
}

export function fire(s: GameState, tierId: string, count: number, map?: StageId): string | null {
  const t = EMPLOYEES[tierId];
  if (!t) return 'Unknown role.';
  const perMap = t.group === 'maintenance' || t.group === 'logistics';
  const pool = perMap ? s.maps[map!]?.workforce : s.workforce;
  if (!pool || (pool[tierId] ?? 0) < count || !(count >= 1)) return 'Nobody to dismiss.';
  pool[tierId] -= count;
  if (pool[tierId] === 0) delete pool[tierId];
  return null;
}

/** Maintenance/logistics train per map; researchers and traders company-wide (priced at your largest map). */
export type TrainGroup = 'maintenance' | 'logistics' | 'research' | 'trading';
const isGlobal = (g: TrainGroup): g is 'research' | 'trading' => g === 'research' || g === 'trading';

export function trainingLevel(s: GameState, map: StageId, group: TrainGroup): number {
  return isGlobal(group) ? s.staffTraining[group] : s.maps[map]?.training[group] ?? 0;
}

export function trainingCost(s: GameState, map: StageId, group: TrainGroup): number | null {
  const c = BALANCE.trainingCost[trainingLevel(s, map, group)];
  return c === undefined ? null : c * STAGES[isGlobal(group) ? s.run.highestStage : map].scale;
}

export function train(s: GameState, map: StageId, group: TrainGroup): string | null {
  const m = isGlobal(group) ? null : s.maps[map] ?? null;
  if (!isGlobal(group) && !m) return 'Map locked.';
  const c = trainingCost(s, map, group);
  if (c === null) return 'Training already at maximum.';
  if (!canAfford(s, c)) return 'Not enough money.';
  spend(s, m, 'hiring', c);
  if (isGlobal(group)) s.staffTraining[group]++;
  else m!.training[group]++;
  return null;
}

/**
 * Insolvency safeguard: while the company is overdrawn and still losing money, staff are released
 * (most expensive wage bill first) so debt cannot spiral into an unrecoverable dead end.
 * Returns a description of the dismissal, or null.
 */
export function payrollProtection(s: GameState): string | null {
  if (s.money >= 0 || s.rates.net >= 0) return null;
  let best: { pool: Record<string, number>; tier: string; bill: number; map?: StageId } | null = null;
  const consider = (pool: Record<string, number>, map?: StageId) => {
    for (const [tier, n] of Object.entries(pool)) {
      const t = EMPLOYEES[tier];
      if (!t || n <= 0) continue;
      const bill = t.wage * n * (map ? STAGES[map].scale : 1);
      if (!best || bill > best.bill) best = { pool, tier, bill, map };
    }
  };
  consider(s.workforce);
  for (const m of Object.values(s.maps)) if (m) consider(m.workforce, m.id);
  if (!best) return null;
  const b = best as { pool: Record<string, number>; tier: string; bill: number; map?: StageId };
  const n = Math.max(1, Math.ceil(b.pool[b.tier] * 0.25));
  b.pool[b.tier] -= n;
  if (b.pool[b.tier] <= 0) delete b.pool[b.tier];
  return `${n} × ${EMPLOYEES[b.tier].name}${b.map ? ` (${STAGES[b.map].name})` : ''}`;
}
