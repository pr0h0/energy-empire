import { RESEARCH } from '../data/research';
import { STAGE_LIST, STAGES } from '../data/stages';
import type { Milestone, StageId } from '../data/types';
import { installedCapacity, installedStorage, workerCount } from '../core/Helpers';
import type { GameState } from '../core/State';
import { notify } from '../core/GameEvents';
import { formatMoney, formatPercent } from '../math/LargeNumber';
import { formatEnergy, formatPower } from '../math/EnergyUnits';
import { createMap } from '../world/MapManager';
import { canAfford, spend } from './FinanceSystem';

export interface MilestoneEval {
  done: boolean;
  progress: number;
  current: string;
}

const ratio = (a: number, b: number) => (b > 0 ? Math.min(1, a / b) : 1);

/** Milestones use current-run statistics, so prestige resets them along with the economy. */
export function evalMilestone(s: GameState, m: Milestone): MilestoneEval {
  switch (m.kind) {
    case 'energySold': return { done: s.run.sold >= m.kwh, progress: ratio(s.run.sold, m.kwh), current: formatEnergy(s.run.sold) };
    case 'produced': return { done: s.run.produced >= m.kwh, progress: ratio(s.run.produced, m.kwh), current: formatEnergy(s.run.produced) };
    case 'revenue': return { done: s.run.revenue >= m.amount, progress: ratio(s.run.revenue, m.amount), current: formatMoney(s.run.revenue) };
    case 'capacity': {
      const c = installedCapacity(s, m.stage);
      return { done: c >= m.kw, progress: ratio(c, m.kw), current: formatPower(c) };
    }
    case 'reliability': {
      const map = s.maps[m.stage];
      const r = map ? map.reliability : 0;
      const ok = !!map && r >= m.value && map.flow.demand > 0;
      return { done: ok, progress: map ? Math.min(1, r / m.value) : 0, current: map ? formatPercent(r, 1) : 'locked' };
    }
    case 'research': {
      const n = Object.keys(s.research.done).length;
      return { done: n >= m.count, progress: ratio(n, m.count), current: `${n}` };
    }
    case 'researchDone': return { done: s.research.done[m.id] !== undefined, progress: s.research.done[m.id] !== undefined ? 1 : 0, current: s.research.done[m.id] !== undefined ? 'done' : 'not yet' };
    case 'workers': {
      const n = workerCount(s);
      return { done: n >= m.count, progress: ratio(n, m.count), current: `${n}` };
    }
    case 'storage': {
      const k = installedStorage(s);
      return { done: k >= m.kwh, progress: ratio(k, m.kwh), current: formatEnergy(k) };
    }
    case 'buildings': {
      const n = Object.values(s.maps).reduce((a, mm) => a + (mm && (!m.stage || mm.id === m.stage) ? Object.keys(mm.buildings).length : 0), 0);
      return { done: n >= m.count, progress: ratio(n, m.count), current: `${n}` };
    }
    case 'contracts': {
      const n = s.maps[m.stage]?.contracts.length ?? 0;
      return { done: n >= m.count, progress: ratio(n, m.count), current: `${n}` };
    }
    case 'gridLevel': {
      const n = s.maps[m.stage]?.gridLevel ?? 0;
      return { done: n >= m.level, progress: ratio(n, m.level), current: `${n}` };
    }
  }
}

export function milestoneLabel(m: Milestone): string {
  const sn = (id?: StageId) => (id ? ` on ${STAGES[id].name}` : '');
  switch (m.kind) {
    case 'energySold': return `Sell ${formatEnergy(m.kwh)} of electricity`;
    case 'produced': return `Generate ${formatEnergy(m.kwh)} in total`;
    case 'revenue': return `Earn ${formatMoney(m.amount)} electricity sales revenue`;
    case 'capacity': return `Install ${formatPower(m.kw)} generation capacity${sn(m.stage)}`;
    case 'reliability': return `Keep supply reliability ≥ ${formatPercent(m.value, 1)}${sn(m.stage)}`;
    case 'research': return `Complete ${m.count} research projects`;
    case 'researchDone': return `Research ${RESEARCH[m.id]?.name ?? m.id}`;
    case 'workers': return `Employ ${m.count} worker${m.count > 1 ? 's' : ''}`;
    case 'storage': return `Install ${formatEnergy(m.kwh)} of energy storage`;
    case 'buildings': return `Operate ${m.count} installations${sn(m.stage)}`;
    case 'contracts': return `Sign ${m.count} customer contracts${sn(m.stage)}`;
    case 'gridLevel': return `Upgrade the grid connection to tier ${m.level}${sn(m.stage)}`;
  }
}

export function nextStage(s: GameState): StageId | null {
  for (const st of STAGE_LIST) if (!s.maps[st.id]) return st.id;
  return null;
}

export function stageUnlockStatus(s: GameState, id: StageId) {
  const st = STAGES[id];
  const prevUnlocked = st.index === 0 || !!s.maps[STAGE_LIST[st.index - 1].id];
  const milestones = (st.unlock?.milestones ?? []).map((m) => ({ m, label: milestoneLabel(m), ...evalMilestone(s, m) }));
  const allDone = milestones.every((x) => x.done);
  const cost = st.unlock?.cost ?? 0;
  return { unlocked: !!s.maps[id], prevUnlocked, milestones, allDone, cost, canUnlock: prevUnlocked && allDone && s.money >= cost && !s.maps[id] };
}

export function unlockStage(s: GameState, id: StageId): string | null {
  const u = stageUnlockStatus(s, id);
  if (u.unlocked) return 'Already unlocked.';
  if (!u.prevUnlocked) return 'Unlock the previous scale first.';
  if (!u.allDone) return 'Milestones not yet satisfied.';
  if (!canAfford(s, u.cost)) return 'Not enough money for the expansion.';
  spend(s, null, 'infrastructure', u.cost);
  s.maps[id] = createMap(id, s.seed, s.time);
  if (STAGES[id].index > STAGES[s.run.highestStage].index) s.run.highestStage = id;
  notify(s, `stage:${id}`, 'success', 'progression', `Expanded to ${STAGES[id].name}! ${STAGES[id].tagline}`, id);
  return null;
}

/** Announce (once) when every milestone for the next stage is met. */
export function checkProgression(s: GameState) {
  const id = nextStage(s);
  if (!id) return;
  const u = stageUnlockStatus(s, id);
  if (u.prevUnlocked && u.allDone && s.lastEvents[`ms:${id}:${s.run.index}`] === undefined) {
    s.lastEvents[`ms:${id}:${s.run.index}`] = s.time;
    notify(s, `msn:${id}`, 'success', 'progression', `All milestones for ${STAGES[id].name} satisfied — expansion available for ${formatMoney(u.cost)}.`);
  }
}
