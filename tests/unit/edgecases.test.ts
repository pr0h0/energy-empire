import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/engine/core/GameEngine';
import { deserialize, serialize } from '../../src/engine/persistence/SaveManager';
import { deliveryHours } from '../../src/engine/systems/FuelSystem';
import { engine, findSpot, hours, ownAll, place, unlock } from '../helpers';

describe('double-dispatched commands (double clicks)', () => {
  it('placing on the same tile twice builds once and charges once', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e4;
    const m = s.maps.backyard!;
    const [x, y] = findSpot(m, 'pv_rooftop')!;
    const n0 = Object.keys(m.buildings).length;
    const c = { type: 'place', map: 'backyard', def: 'pv_rooftop', x, y, rot: 0 } as const;
    expect(e.dispatch(c).ok).toBe(true);
    const money = s.money;
    expect(e.dispatch(c).ok).toBe(false);
    expect(s.money).toBe(money);
    expect(Object.keys(m.buildings).length).toBe(n0 + 1);
  });
  it('starting research twice charges once; buying the same land twice fails cleanly', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e4;
    expect(e.dispatch({ type: 'startResearch', id: 'solar_1' }).ok).toBe(true);
    const money = s.money;
    expect(e.dispatch({ type: 'startResearch', id: 'solar_1' }).ok).toBe(false);
    expect(s.money).toBe(money);
    const m = s.maps.backyard!;
    const i = m.owned.findIndex((o, k) => !o && [k - 1, k + 1, k - m.w, k + m.w].some((j) => j >= 0 && j < m.owned.length && m.owned[j] && Math.abs((j % m.w) - (k % m.w)) <= 1) && m.terrain[k] === 'grass');
    const buy = { type: 'buyLand', map: 'backyard', x: i % m.w, y: Math.floor(i / m.w) } as const;
    expect(e.dispatch(buy).ok).toBe(true);
    const money2 = s.money;
    expect(e.dispatch(buy).ok).toBe(false);
    expect(s.money).toBe(money2);
  });
});

describe('save and reload mid-delivery', () => {
  it('a fuel delivery in transit survives a save/load round trip and arrives exactly once', () => {
    const run = (reload: boolean) => {
      const e = engine();
      const s = e.state;
      s.money = 1e7;
      const m = unlock(s, 'neighborhood');
      ownAll(m);
      const id = place(e, 'neighborhood', 'diesel_gen');
      e.dispatch({ type: 'configure', map: 'neighborhood', id, patch: { enabled: false } });
      expect(e.dispatch({ type: 'buyFuel', map: 'neighborhood', fuel: 'diesel', qty: 5 }).ok).toBe(true);
      const h = deliveryHours(s, m, 'diesel', 5);
      hours(e, h / 2);
      let g = e;
      if (reload) g = new GameEngine(deserialize(JSON.parse(JSON.stringify(serialize(e.state)))));
      expect(g.state.maps.neighborhood!.logisticsJobs.length).toBe(1);
      hours(g, h);
      return g.state.maps.neighborhood!;
    };
    const a = run(false), b = run(true);
    expect(b.logisticsJobs.length).toBe(0);
    expect(b.fuel.diesel).toBeCloseTo(a.fuel.diesel ?? 0, 6);
    expect(b.fuel.diesel).toBeGreaterThan(0);
  });
});
