import { ACHIEVEMENTS } from '../data/achievements';
import { RESEARCH_LIST } from '../data/research';
import { GOALS } from '../data/goals';
import { defOf, installedCapacity } from '../core/Helpers';
import type { GameState } from '../core/State';
import { notify } from '../core/GameEvents';
import { evalMilestone } from './ProgressionSystem';

function custom(s: GameState, id: string): boolean {
  const [k, v] = id.split(':');
  switch (k) {
    case 'allResearch': return RESEARCH_LIST.every((r) => s.research.done[r.id] !== undefined);
    case 'stage': return !!s.maps[v as keyof GameState['maps']];
    case 'family': return Object.values(s.maps).some((m) => m && Object.values(m.buildings).some((b) => defOf(b).family === v));
    case 'def': return Object.values(s.maps).some((m) => m && Object.values(m.buildings).some((b) => v.split('|').includes(b.def)));
    case 'clean': return s.run.emissions <= 0 && installedCapacity(s) >= 1e6;
    case 'money': return s.money >= Number(v);
    case 'prestige': return s.prestige.resets >= Number(v);
    case 'won': return s.won > 0;
    case 'goalsMap': return Object.keys(s.maps).some((id) => GOALS.every((g) => s.goals[`${id}:${g.kind}`] !== undefined));
    case 'repLevel': return Object.values(s.research.levels).some((l) => l >= Number(v));
    case 'repTotal': return Object.values(s.research.levels).reduce((a, l) => a + l, 0) >= Number(v);
  }
  return false;
}

/** Lifetime-style achievements: milestone checks use lifetime totals where meaningful. */
export function checkAchievements(s: GameState) {
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id] !== undefined) continue;
    const c = a.check;
    let ok: boolean;
    if (c.kind === 'custom') ok = custom(s, c.id);
    else if (c.kind === 'energySold') ok = s.lifetime.sold >= c.kwh || evalMilestone(s, c).done;
    else if (c.kind === 'produced') ok = s.lifetime.produced >= c.kwh || evalMilestone(s, c).done;
    else ok = evalMilestone(s, c).done;
    if (ok) {
      s.achievements[a.id] = s.time;
      notify(s, `ach:${a.id}`, 'success', 'achievement', `Achievement unlocked: ${a.name} — ${a.desc}`);
    }
  }
}
