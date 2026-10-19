import { describe, expect, it } from 'vitest';
import { STAGE_LIST } from '../../src/engine/data/stages';
import { BALANCE } from '../../src/engine/data/balance';
import { GameEngine } from '../../src/engine/core/GameEngine';
import { newGame } from '../../src/engine/core/NewGame';
import { PRESTIGE_CONFIRM } from '../../src/engine/systems/PrestigeSystem';
import { AutoPlayer } from './AutoPlayer';

/**
 * Full-progression validation: a rules-abiding greedy bot plays from the Backyard to the
 * Universe and completes the Convergence Engine. Only normal commands are used; time is advanced
 * with the regular simulation step (0.25 h). Writes a pacing report to the console.
 */
describe('full progression', () => {
  it('reaches every stage and wins without cheats', { timeout: 1_800_000 }, () => {
    const e = new GameEngine(newGame(7, 0));
    const bot = new AutoPlayer(e);
    bot.run(40_000, 2, () => e.state.won > 0);
    const s = e.state;
    const report = STAGE_LIST.map((st) => `${st.id}: ${bot.stageTimes[st.id] !== undefined ? (bot.stageTimes[st.id]! / 10).toFixed(0) + ' real min' : '—'}`);
    console.log(`[progression] ${report.join(' | ')} | won at ${(s.won / 10).toFixed(0)} real min | research ${Object.keys(s.research.done).length}`);
    for (const st of STAGE_LIST) expect(s.maps[st.id], st.id).toBeDefined();
    expect(s.won).toBeGreaterThan(0);
    expect(s.convergence).toBeGreaterThanOrEqual(BALANCE.winEnergyKWh);
    expect(s.achievements.convergence).toBeDefined();
    // sandbox continues after winning
    const t = s.time;
    e.tick();
    expect(s.time).toBeGreaterThan(t);
  });

  it('prestige accelerates the next run', { timeout: 1_200_000 }, () => {
    // compares time to reach the City — the early stages where a reset is most noticeable
    const run = (e: GameEngine, hours: number) => {
      const bot = new AutoPlayer(e);
      bot.run(hours, 2, () => !!e.state.maps.city);
      return { t: e.state.time, bot };
    };
    const a = new GameEngine(newGame(9, 0));
    const r1 = run(a, 12_000);
    expect(a.state.maps.city).toBeDefined();
    // keep going to the Country to earn points, then prestige
    new AutoPlayer(a).run(12_000, 2, () => !!a.state.maps.country);
    const pts = a.dispatch({ type: 'prestige', confirm: PRESTIGE_CONFIRM });
    expect(pts.ok).toBe(true);
    expect(a.state.prestige.available).toBeGreaterThan(0);
    const t0 = a.state.time;
    const r2 = run(a, 12_000);
    expect(a.state.maps.city).toBeDefined();
    console.log(`[prestige] run1 reached City at ${(r1.t / 10).toFixed(0)} real min; run2 (with ${a.state.prestige.awarded} pts) at ${((r2.t - t0) / 10).toFixed(0)} real min`);
    expect(r2.t - t0).toBeLessThan(r1.t);
    // a second and third reset still never double-award
    new AutoPlayer(a).run(800, 2);
    const awarded = a.state.prestige.awarded;
    a.dispatch({ type: 'prestige', confirm: PRESTIGE_CONFIRM });
    a.dispatch({ type: 'prestige', confirm: PRESTIGE_CONFIRM });
    expect(a.state.prestige.awarded).toBeGreaterThanOrEqual(awarded);
    expect(a.state.prestige.available + a.state.prestige.spent).toBe(a.state.prestige.awarded);
  });
});
