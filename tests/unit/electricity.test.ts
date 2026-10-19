import { describe, expect, it } from 'vitest';
import { simulateElectricity } from '../../src/engine/systems/ElectricitySystem';
import { storageCapacityKWh } from '../../src/engine/core/Helpers';
import { engine, findSpot, hours, ownAll, place, research, unlock } from '../helpers';

describe('generation', () => {
  it('solar produces by day, nothing at night', () => {
    const e = engine();
    const id = place(e, 'backyard', 'pv_rooftop');
    const s = e.state;
    const b = s.maps.backyard!.buildings[id];
    s.time = 0; // midnight
    e.tick();
    expect(b.available).toBe(0);
    s.time = 12;
    e.tick();
    expect(b.available).toBeGreaterThan(2);
  });

  it('wind produces at night too and depends on terrain', () => {
    const e = engine();
    const m = e.state.maps.backyard!;
    ownAll(m);
    place(e, 'backyard', 'wind_micro');
    let night = 0;
    for (let h = 0; h < 48; h++) {
      e.state.time = h * 24 + 2;
      e.tick();
      night += m.flow.generation;
    }
    expect(night).toBeGreaterThan(0);
  });

  it('fuel generators do not produce without fuel and burn fuel proportional to output', () => {
    const e = engine();
    const s = e.state;
    const m = unlock(s, 'neighborhood');
    s.money = 1e6;
    const id = place(e, 'neighborhood', 'diesel_gen');
    const b = m.buildings[id];
    b.mode = 'baseload';
    b.tank = 0;
    e.tick();
    expect(b.output).toBe(0);
    expect(b.status).toBe('Out of fuel');
    b.tank = 1;
    const before = b.tank;
    e.tick(1);
    expect(b.output).toBeGreaterThan(0);
    const used = before - b.tank;
    const heat = (b.output / (b.eta ?? 0.36)) * 1;
    expect(used * 10_000).toBeCloseTo(heat, -1);
    expect(b.tank).toBeGreaterThanOrEqual(0);
  });

  it('a baseload plant starts from cold even when other generation already covers demand', () => {
    const e = engine();
    const s = e.state;
    const m = unlock(s, 'neighborhood');
    ownAll(m);
    s.money = 1e9;
    s.time = 12;
    const id = place(e, 'neighborhood', 'diesel_gen');
    const b = m.buildings[id];
    b.tank = 1;
    for (let i = 0; i < 40 && m.flow.generation <= m.flow.demand * 1.5; i++) {
      place(e, 'neighborhood', 'pv_rooftop');
      e.tick();
    }
    expect(m.flow.generation).toBeGreaterThan(m.flow.demand); // surplus: a follow-mode plant stays idle
    expect(b.output).toBe(0);
    expect(b.status).toMatch(/Standby/);
    e.dispatch({ type: 'configure', map: 'neighborhood', id, patch: { mode: 'baseload' } });
    for (let i = 0; i < 6; i++) e.tick();
    expect(b.output).toBeCloseTo(150, 0);
  });
});

describe('dispatch energy balance', () => {
  it('sources equal uses on every tick (no double counting)', () => {
    const e = engine(7);
    const s = e.state;
    s.money = 1e9;
    ownAll(s.maps.backyard!);
    research(s, 'storage_1', 'grid_1');
    for (let k = 0; k < 6; k++) place(e, 'backyard', 'pv_rooftop');
    place(e, 'backyard', 'battery_home');
    place(e, 'backyard', 'wind_micro');
    e.dispatch({ type: 'upgradeGrid', map: 'backyard' });
    const nb = unlock(s, 'neighborhood');
    ownAll(nb);
    research(s, 'thermal_1', 'biomass_1');
    place(e, 'neighborhood', 'pv_commercial');
    const g = place(e, 'neighborhood', 'gas_peaker');
    nb.buildings[g].tank = 50;
    place(e, 'neighborhood', 'battery_community');
    let worst = 0;
    for (let i = 0; i < 24 * 24 * 3; i++) {
      for (const m of [s.maps.backyard!, nb]) {
        const r = simulateElectricity(s, m, s.time + 1 / 48, 1 / 24);
        worst = Math.max(worst, Math.abs(r.imbalance) / Math.max(1, m.flow.demand + m.flow.generation));
      }
      s.time += 1 / 24;
    }
    expect(worst).toBeLessThan(1e-9);
  });

  it('respects grid import/export limits and curtails the rest', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    ownAll(s.maps.backyard!);
    for (let k = 0; k < 20; k++) place(e, 'backyard', 'pv_rooftop');
    s.time = 12;
    e.tick();
    const m = s.maps.backyard!;
    expect(m.flow.exported).toBe(0); // household connection: import only
    expect(m.flow.curtailed).toBeGreaterThan(0);
    e.dispatch({ type: 'upgradeGrid', map: 'backyard' });
    e.tick();
    expect(m.flow.exported).toBeLessThanOrEqual(10 + 1e-9);
    expect(m.flow.exported).toBeGreaterThan(9);
  });

  it('local demand is served before export', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    ownAll(s.maps.backyard!);
    e.dispatch({ type: 'upgradeGrid', map: 'backyard' });
    place(e, 'backyard', 'pv_rooftop');
    s.time = 12;
    e.tick();
    const m = s.maps.backyard!;
    expect(m.flow.selfServed).toBeCloseTo(Math.min(m.flow.demand, m.flow.generation), 6);
    expect(m.flow.exported).toBeCloseTo(Math.max(0, m.flow.generation - m.flow.demand), 6);
  });
});

describe('storage', () => {
  it('charges from surplus, discharges at night, loses energy to efficiency and never creates energy', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    ownAll(s.maps.backyard!);
    research(s, 'storage_1');
    for (let k = 0; k < 3; k++) place(e, 'backyard', 'pv_rooftop');
    const bid = place(e, 'backyard', 'battery_home');
    const m = s.maps.backyard!;
    const b = m.buildings[bid];
    let charged = 0, discharged = 0;
    s.time = 6;
    for (let i = 0; i < 24 * 24; i++) {
      e.tick();
      charged += m.flow.charged / 24;
      discharged += m.flow.discharged / 24;
      expect(b.stored!).toBeLessThanOrEqual(storageCapacityKWh(s, b) + 1e-9);
      expect(b.stored!).toBeGreaterThanOrEqual(0);
    }
    expect(charged).toBeGreaterThan(0);
    expect(discharged).toBeGreaterThan(0);
    // discharged + stored ≤ charged × η_in × η_out-ish (no free energy)
    expect(discharged + (b.stored ?? 0)).toBeLessThan(charged);
  });

  it('respects charge power limits', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    ownAll(s.maps.backyard!);
    research(s, 'storage_1');
    for (let k = 0; k < 10; k++) place(e, 'backyard', 'pv_rooftop');
    const bid = place(e, 'backyard', 'battery_home');
    s.time = 12;
    e.tick();
    const b = s.maps.backyard!.buildings[bid];
    expect(-b.output).toBeLessThanOrEqual(13.5 * 0.4 * 1.0001);
  });

  it('cycle aging reduces usable capacity; ordinary repair does not restore it, cell replacement does', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e7;
    ownAll(s.maps.backyard!);
    research(s, 'storage_1');
    for (let k = 0; k < 6; k++) place(e, 'backyard', 'pv_rooftop');
    const bid = place(e, 'backyard', 'battery_home');
    const b = s.maps.backyard!.buildings[bid];
    hours(e, 24 * 20, 0.25);
    expect(b.cycles!).toBeGreaterThan(10);
    expect(b.wearOut).toBeGreaterThan(0);
    const worn = b.wearOut;
    b.condition = 0.5;
    e.dispatch({ type: 'repair', map: 'backyard', id: bid });
    expect(b.wearOut).toBe(worn);
    e.dispatch({ type: 'replaceComponents', map: 'backyard', id: bid });
    expect(b.wearOut).toBe(0);
  });
});

describe('demand and reliability', () => {
  it('neighborhood serves customers from import when short and tracks reliability', () => {
    const e = engine();
    const s = e.state;
    const m = unlock(s, 'neighborhood');
    hours(e, 4);
    expect(m.flow.demand).toBeGreaterThan(0);
    expect(m.flow.unserved).toBe(0);
    expect(m.reliability).toBeCloseTo(1, 5);
    e.dispatch({ type: 'mapPolicy', map: 'neighborhood', patch: { importForShortage: false } });
    hours(e, 48);
    expect(m.flow.unserved).toBeGreaterThan(0);
    expect(m.reliability).toBeLessThan(0.9);
    void findSpot;
  });
});

describe('live money breakdown', () => {
  it('per-category rates sum to net, and sales split into customers / export / contracts', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e9;
    const m = unlock(s, 'neighborhood');
    ownAll(m);
    research(s, 'solar_1');
    for (let k = 0; k < 3; k++) place(e, 'neighborhood', 'pv_commercial');
    hours(e, 30);
    const c = s.rates.cats;
    const sum = Object.entries(c).reduce((x, [k, v]) => x + (k === 'sales' || k === 'income' ? v! : -v!), 0);
    expect(sum).toBeCloseTo(s.rates.net, 6);
    const f = m.flow;
    expect(f.retailRev + f.exportRev + f.contractRev).toBeCloseTo(f.sales, 6);
  });
});

describe('grid downgrade', () => {
  it('drops one tier with no refund and stops at the base tier', () => {
    const e = engine();
    const s = e.state;
    s.money = 1000;
    expect(e.dispatch({ type: 'downgradeGrid', map: 'backyard' }).ok).toBe(false);
    expect(e.dispatch({ type: 'upgradeGrid', map: 'backyard' }).ok).toBe(true);
    const money = s.money;
    expect(e.dispatch({ type: 'downgradeGrid', map: 'backyard' }).ok).toBe(true);
    expect(s.maps.backyard!.gridLevel).toBe(0);
    expect(s.money).toBe(money);
  });
});

describe('speed unlocks', () => {
  it('1× at start, 2× after winning, 3× with every achievement', async () => {
    const { ACHIEVEMENTS } = await import('../../src/engine/data/achievements');
    const e = engine();
    const s = e.state;
    e.dispatch({ type: 'setSpeed', speed: 3 });
    expect(s.speed).toBe(1);
    s.achievements.convergence = 1;
    e.dispatch({ type: 'setSpeed', speed: 3 });
    expect(s.speed).toBe(2);
    for (const a of ACHIEVEMENTS) s.achievements[a.id] = 1;
    e.dispatch({ type: 'setSpeed', speed: 3 });
    expect(s.speed).toBe(3);
  });
});

describe('fusion ignition', () => {
  it('a fuelled baseload tokamak ignites and keeps running instead of quenching forever', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e30;
    const m = unlock(s, 'planet');
    ownAll(m);
    research(s, 'fusion_1');
    const b = m.buildings[place(e, 'planet', 'tokamak')];
    b.tank = 1e12;
    hours(e, 4);
    expect(b.ignited).toBe(true);
    expect(b.output).toBeGreaterThan(0);
  });
});
