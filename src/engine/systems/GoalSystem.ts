import { GOALS, goalReward, type GoalKind } from '../data/goals';
import { STAGES } from '../data/stages';
import { defOf, isGenerator, nameplateKW, storageCapacityKWh } from '../core/Helpers';
import { notify } from '../core/GameEvents';
import type { GameState, MapState } from '../core/State';
import { earn } from './FinanceSystem';

export const goalId = (m: MapState, kind: GoalKind) => `${m.id}:${kind}`;

export function goalProgress(s: GameState, m: MapState, kind: GoalKind): { value: number; target: number; done: boolean } {
  const st = STAGES[m.id];
  const target = GOALS.find((g) => g.kind === kind)!.target(st);
  const done = s.goals[goalId(m, kind)] !== undefined;
  const all = Object.values(m.buildings);
  const value =
    kind === 'capacity' ? all.reduce((a, b) => a + (isGenerator(defOf(b)) ? nameplateKW(b) : 0), 0)
    : kind === 'storage' ? all.reduce((a, b) => a + (defOf(b).storage ? storageCapacityKWh(s, b) : 0), 0)
    : kind === 'offgrid' ? m.goalTrack.noImportH
    : m.goalTrack.cleanH;
  return { value, target, done };
}

/** Advance streaks and pay out goals reached this tick. */
export function simulateGoals(s: GameState, m: MapState, dt: number) {
  const t = m.goalTrack;
  t.noImportH = m.flow.imported > 1e-9 ? 0 : t.noImportH + dt;
  const fossil = Object.values(m.buildings).some((b) => defOf(b).family === 'fossil' && b.output > 0);
  t.cleanH = fossil || m.flow.generation <= 0 ? 0 : t.cleanH + dt;
  for (const g of GOALS) {
    const id = goalId(m, g.kind);
    if (s.goals[id] !== undefined) continue;
    const p = goalProgress(s, m, g.kind);
    if (p.value < p.target) continue;
    s.goals[id] = s.time;
    const reward = goalReward(STAGES[m.id]);
    earn(s, m, 'other', reward);
    notify(s, `goal:${id}`, 'success', 'progression', `Goal reached on ${STAGES[m.id].name}: ${g.name}. Reward credited.`, m.id);
  }
}
