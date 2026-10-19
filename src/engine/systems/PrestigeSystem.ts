import { CHALLENGES, type ChallengeId } from '../data/goals';
import { BALANCE } from '../data/balance';
import { PRESTIGE_UPGRADES, prestigeCost } from '../data/prestige';
import { RESEARCH } from '../data/research';
import { newGame } from '../core/NewGame';
import type { GameState } from '../core/State';
import { notify } from '../core/GameEvents';
import { claimablePoints, entitledPoints } from '../math/PrestigeFormulas';

export interface PrestigePreview {
  lifetimeRevenue: number;
  entitled: number;
  awarded: number;
  claimable: number;
  /** Extra points from this run's challenge. */
  bonus: number;
  availableAfter: number;
  lost: string[];
  kept: string[];
}

export const PRESTIGE_CONFIRM = 'PRESTIGE';

export function prestigePreview(s: GameState): PrestigePreview {
  const entitled = entitledPoints(s.prestige.lifetimeRevenue);
  const claimable = claimablePoints(s.prestige.lifetimeRevenue, s.prestige.awarded);
  const kept = ['Prestige points and purchased prestige upgrades', 'Prestige accounting (lifetime revenue, awarded points)', 'Lifetime statistics and run history', 'Achievements', 'Saved blueprints', 'Settings'];
  const lost = ['Money', 'All buildings on every map', 'Land purchases', 'Map-scale unlocks (restart at Backyard)', 'Fuel inventories', 'Employees and training', 'Research progress and discoveries', 'Equipment upgrades', 'Active contracts'];
  if (s.prestige.upgrades.p_keepland) kept.push('Backyard land (Family Homestead)');
  if (s.prestige.upgrades.p_memory) kept.push('Backyard & Neighborhood research (Institutional Memory)');
  const bonus = s.challenge && claimable > 0 ? Math.ceil(claimable * CHALLENGES[s.challenge].bonus) : 0;
  return { lifetimeRevenue: s.prestige.lifetimeRevenue, entitled, awarded: s.prestige.awarded, claimable, bonus, availableAfter: s.prestige.available + claimable + bonus, lost, kept };
}

export function startMoney(s: GameState): number {
  const lvl = s.prestige.upgrades.p_capital ?? 0;
  return BALANCE.startMoney * Math.pow(10, lvl);
}

/**
 * Full economic reset. Points awarded = entitled − previously awarded (high-water mark), so the
 * same revenue can never be paid out twice; spending points does not touch `awarded`.
 */
export function performPrestige(s: GameState, confirm: string, challenge: ChallengeId | null = null): { ok: boolean; error?: string; state?: GameState; points?: number } {
  if (confirm !== PRESTIGE_CONFIRM) return { ok: false, error: `Type ${PRESTIGE_CONFIRM} to confirm.` };
  const p = prestigePreview(s);
  if (p.claimable <= 0) return { ok: false, error: 'No prestige points to claim yet.' };
  const now = Date.now();
  const n = newGame(s.seed, now);
  n.prestige = { ...s.prestige, upgrades: { ...s.prestige.upgrades }, awarded: s.prestige.awarded + p.claimable, available: s.prestige.available + p.claimable + p.bonus, resets: s.prestige.resets + 1 };
  n.lifetime = { ...s.lifetime, playH: s.lifetime.playH };
  n.achievements = { ...s.achievements };
  n.blueprints = s.blueprints.map((b) => ({ ...b, items: b.items.map((i) => ({ ...i, upgrades: [...i.upgrades] })) }));
  n.settings = { ...s.settings };
  n.defaultRepairThreshold = s.defaultRepairThreshold;
  n.runHistory = [...s.runHistory, { index: s.run.index, startedAt: s.run.startedAt, endedAt: now, revenue: s.run.revenue, highestStage: s.run.highestStage, pointsEarned: p.claimable + p.bonus }];
  n.run.index = s.run.index + 1;
  n.lastEvents = {};
  n.challenge = challenge && CHALLENGES[challenge] ? challenge : null;
  applyStartBonuses(n, s);
  notify(n, 'prestige', 'success', 'prestige', `Prestige complete: +${p.claimable + p.bonus} points${p.bonus ? ` (incl. +${p.bonus} challenge bonus)` : ''}. Run #${n.run.index} begins in the Backyard${n.challenge ? ` — challenge: ${CHALLENGES[n.challenge].name}` : ''}.`);
  return { ok: true, state: n, points: p.claimable + p.bonus };
}

function applyStartBonuses(n: GameState, old: GameState) {
  n.money = startMoney(n);
  const up = n.prestige.upgrades;
  if (up.p_keepland && old.maps.backyard) n.maps.backyard!.owned = old.maps.backyard.owned.slice();
  if (up.p_memory) for (const [id, t] of Object.entries(old.research.done)) if (RESEARCH[id] && ['backyard', 'neighborhood'].includes(RESEARCH[id].stage)) n.research.done[id] = t;
  if (up.p_starter) {
    n.maps.backyard!.workforce.technician = 1;
    n.research.done.maintenance_1 ??= 0;
    n.research.done.storage_1 ??= 0;
  }
}

export function buyPrestigeUpgrade(s: GameState, id: string): string | null {
  const d = PRESTIGE_UPGRADES[id];
  if (!d) return 'Unknown upgrade.';
  const lvl = s.prestige.upgrades[id] ?? 0;
  if (lvl >= d.maxLevel) return 'Already at maximum level.';
  const cost = prestigeCost(id, lvl);
  if (s.prestige.available < cost) return 'Not enough prestige points.';
  s.prestige.available -= cost;
  s.prestige.spent += cost;
  s.prestige.upgrades[id] = lvl + 1;
  if (d.special === 'starterTech' && s.maps.backyard && !s.maps.backyard.workforce.technician) s.maps.backyard.workforce.technician = 1;
  return null;
}
