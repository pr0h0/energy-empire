import { BALANCE } from '../data/balance';
import { EMPLOYEES } from '../data/employees';
import { LAB_MULT, levelRP, RESEARCH } from '../data/research';
import { mapAgg } from '../core/Helpers';
import { mod } from '../core/Modifiers';
import type { GameState } from '../core/State';
import { notify } from '../core/GameEvents';
import { canAfford, spend } from './FinanceSystem';
import { evalMilestone, milestoneLabel } from './ProgressionSystem';

/** Company-wide research throughput (RP per game hour). */
export function researchThroughput(s: GameState): number {
  let staff = BALANCE.founderRP;
  for (const [tier, n] of Object.entries(s.workforce)) if (EMPLOYEES[tier]?.group === 'research') staff += EMPLOYEES[tier].capacity * n;
  staff *= mod(s, 'workforce.capacity') * (1 + BALANCE.staffTrainingStep * s.staffTraining.research);
  let labs = 0;
  for (const m of Object.values(s.maps)) if (m) labs += mapAgg(m).labRP * LAB_MULT[m.id];
  return (staff + labs) * mod(s, 'research.speed');
}

/** RP for the project, or for the next level of a repeatable. */
export function rpNeeded(s: GameState, id: string): number {
  return levelRP(RESEARCH[id], s.research.levels[id] ?? 0);
}

export type ResearchStatus = 'done' | 'active' | 'paused' | 'available' | 'locked';

export function researchStatus(s: GameState, id: string): ResearchStatus {
  if (s.research.done[id] !== undefined) return 'done';
  if (s.research.active[id] !== undefined) return 'active';
  if (s.research.paid[id]) return 'paused';
  return lockReasons(s, id).length ? 'locked' : 'available';
}

export function lockReasons(s: GameState, id: string): string[] {
  const r = RESEARCH[id];
  if (!r) return ['Unknown project'];
  const out: string[] = [];
  for (const p of r.prereq) if (s.research.done[p] === undefined) out.push(`Requires ${RESEARCH[p]?.name ?? p}`);
  if (!s.maps[r.stage]) out.push(`Requires the ${r.stage[0].toUpperCase() + r.stage.slice(1)} map`);
  if (r.milestone && !evalMilestone(s, r.milestone).done) out.push(`Milestone: ${milestoneLabel(r.milestone)}`);
  return out;
}

/** Normalised share of throughput for each active project (Σ ≤ 1, paused/completed get 0). */
export function researchShares(s: GameState): Record<string, number> {
  const ids = Object.keys(s.research.active).filter((id) => s.research.done[id] === undefined);
  let total = 0;
  for (const id of ids) total += Math.max(0, s.research.active[id]);
  const out: Record<string, number> = {};
  if (total <= 0) return out;
  // allocations are relative weights: when a project finishes or pauses, its share flows to the rest
  for (const id of ids) out[id] = Math.max(0, s.research.active[id]) / total;
  return out;
}

export function startResearch(s: GameState, id: string): string | null {
  const r = RESEARCH[id];
  if (!r) return 'Unknown project.';
  if (s.research.done[id] !== undefined && !r.repeat) return 'Already completed.';
  if (s.research.active[id] !== undefined) return 'Already active.';
  if (!s.research.paid[id]) {
    const why = lockReasons(s, id);
    if (why.length) return why.join('; ');
    if (!canAfford(s, r.cost)) return 'Not enough money.';
    spend(s, null, 'research', r.cost);
    s.research.paid[id] = true;
    s.research.startedAt[id] = s.time;
  }
  const others = Object.keys(s.research.active);
  const used = others.reduce((a, k) => a + s.research.active[k], 0);
  s.research.active[id] = Math.max(0, 100 - used) || 100 / (others.length + 1);
  if (used >= 100) {
    // rebalance evenly so the newcomer gets a fair share
    const n = others.length + 1;
    for (const k of others) s.research.active[k] = 100 / n;
    s.research.active[id] = 100 / n;
  }
  return null;
}

export function setAllocation(s: GameState, id: string, pct: number): string | null {
  if (s.research.active[id] === undefined) return 'Project is not active.';
  if (!Number.isFinite(pct)) return 'Invalid allocation.';
  s.research.active[id] = Math.max(0, Math.min(100, pct));
  return null;
}

export function simulateResearch(s: GameState, dt: number): { rp: number; completed: string[] } {
  const rp = researchThroughput(s) * dt;
  const shares = researchShares(s);
  const completed: string[] = [];
  for (const [id, share] of Object.entries(shares)) {
    const r = RESEARCH[id];
    const need = rpNeeded(s, id);
    s.research.progress[id] = Math.min(need, (s.research.progress[id] ?? 0) + rp * share);
    if (r.repeat) {
      // repeatables level up and keep running; leftover RP this tick is dropped (≤ one tick of share)
      if (s.research.progress[id] >= need) {
        s.research.levels[id] = (s.research.levels[id] ?? 0) + 1;
        s.research.progress[id] = 0;
        notify(s, `rep:${id}`, 'info', 'research', `${r.name} reached level ${s.research.levels[id]}.`, undefined, 24);
      }
      continue;
    }
    const minOk = !r.minH || s.time - (s.research.startedAt[id] ?? 0) >= r.minH;
    if (s.research.progress[id] >= r.rp && minOk) {
      s.research.done[id] = s.time;
      delete s.research.active[id];
      completed.push(id);
      const major = !!r.milestone || r.name.length > 0 && r.desc.startsWith('BREAKTHROUGH');
      notify(s, `res:${id}`, major ? 'success' : 'info', 'research', `${major ? 'Breakthrough' : 'Research complete'}: ${r.name}.`);
    }
  }
  return { rp, completed };
}

export function etaHours(s: GameState, id: string): number {
  const r = RESEARCH[id];
  const share = researchShares(s)[id] ?? 0;
  const rate = researchThroughput(s) * share;
  const left = rpNeeded(s, id) - (s.research.progress[id] ?? 0);
  const byWork = rate > 0 ? left / rate : Infinity;
  const byTime = r.minH ? Math.max(0, r.minH - (s.time - (s.research.startedAt[id] ?? s.time))) : 0;
  return Math.max(byWork, byTime);
}
