import { describe, expect, it } from 'vitest';
import { TIME } from '../../src/engine/data/balance';
import { GameEngine } from '../../src/engine/core/GameEngine';
import { engine, ownAll, place, research, unlock } from '../helpers';

function setup() {
  const e = engine(77);
  const s = e.state;
  s.money = 1e6;
  ownAll(s.maps.backyard!);
  research(s, 'storage_1', 'thermal_1', 'logistics_1');
  e.dispatch({ type: 'upgradeGrid', map: 'backyard' });
  for (let k = 0; k < 6; k++) place(e, 'backyard', 'pv_rooftop');
  place(e, 'backyard', 'wind_micro');
  place(e, 'backyard', 'battery_home');
  e.dispatch({ type: 'hire', tier: 'technician', count: 1, map: 'backyard' });
  const nb = unlock(s, 'neighborhood');
  ownAll(nb);
  place(e, 'neighborhood', 'pv_commercial');
  place(e, 'neighborhood', 'gas_peaker');
  e.dispatch({ type: 'fuelPolicy', map: 'neighborhood', fuel: 'gas', patch: { mode: 'full' } });
  e.dispatch({ type: 'hire', tier: 'scientist', count: 1 });
  e.dispatch({ type: 'startResearch', id: 'solar_1' });
  return e;
}

describe('offline progression', () => {
  it('agrees with online simulation within 3% over two game weeks', () => {
    const a = setup();
    const b = new GameEngine(structuredClone(a.state));
    const hours = 24 * 14;
    for (let i = 0; i < hours * 24; i++) a.tick(TIME.tickH);
    b.simulateOffline(hours / TIME.gameHoursPerRealSecond);
    const rel = (x: number, y: number) => Math.abs(x - y) / Math.max(1, Math.abs(x));
    expect(rel(a.state.run.produced, b.state.run.produced)).toBeLessThan(0.03);
    expect(rel(a.state.ledger.sales, b.state.ledger.sales)).toBeLessThan(0.03);
    expect(rel(a.state.money, b.state.money)).toBeLessThan(0.03);
    expect(rel(a.state.ledger.wages, b.state.ledger.wages)).toBeLessThan(0.01);
    expect(rel(a.state.research.progress.solar_1 ?? a.state.research.done.solar_1 ?? 0, b.state.research.progress.solar_1 ?? 0)).toBeLessThan(0.05);
  });

  it('includes fuel, wages, maintenance and research in the summary; caps long absences', () => {
    const e = setup();
    const sum = e.simulateOffline(5 * 24 * 3600)!; // five real days
    expect(sum.capped).toBe(true);
    expect(sum.hours).toBeCloseTo(TIME.offlineCapRealH * 3600 * TIME.gameHoursPerRealSecond, 6);
    expect(sum.produced).toBeGreaterThan(0);
    expect(sum.revenue).toBeGreaterThan(0);
    expect(sum.expenses).toBeGreaterThan(0);
    expect(sum.fuelUsed).toBeGreaterThan(0);
    expect(sum.researchRP + sum.researchCompleted.length).toBeGreaterThan(0);
    expect(e.state.offlineSummary).not.toBeNull();
  });

  it('reconciles a 12 h absence quickly (chunked, not per-millisecond)', () => {
    const e = setup();
    const t0 = performance.now();
    e.simulateOffline(12 * 3600);
    expect(performance.now() - t0).toBeLessThan(15_000);
  });
});
