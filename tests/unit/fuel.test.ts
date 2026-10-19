import { describe, expect, it } from 'vitest';
import { deliveryHours } from '../../src/engine/systems/FuelSystem';
import { fuelBalance, tankCapacity } from '../../src/engine/systems/ThermalSystem';
import { defOf } from '../../src/engine/core/Helpers';
import { engine, hours, ownAll, place, research, unlock } from '../helpers';

function nbWithDiesel() {
  const e = engine();
  const s = e.state;
  s.money = 1e7;
  const m = unlock(s, 'neighborhood');
  ownAll(m);
  const id = place(e, 'neighborhood', 'diesel_gen');
  return { e, s, m, id };
}

describe('fuel and logistics', () => {
  it('deliveries take time and arrive in the depot', () => {
    const { e, m } = nbWithDiesel();
    const r = e.dispatch({ type: 'buyFuel', map: 'neighborhood', fuel: 'diesel', qty: 5 });
    expect(r.ok).toBe(true);
    expect(m.fuel.diesel ?? 0).toBe(0);
    const h = deliveryHours(e.state, m, 'diesel', 5);
    expect(h).toBeGreaterThan(1);
    hours(e, h + 0.5);
    expect(m.fuel.diesel).toBeGreaterThan(0);
  });

  it('logistics capacity limits concurrent deliveries', () => {
    const { e, m } = nbWithDiesel();
    for (let k = 0; k < 3; k++) e.dispatch({ type: 'buyFuel', map: 'neighborhood', fuel: 'diesel', qty: 1 });
    const h = deliveryHours(e.state, m, 'diesel', 1);
    hours(e, h + 0.2);
    // one free contractor slot → only the first has arrived
    expect(m.logisticsJobs.filter((j) => j.kind === 'delivery').length).toBe(2);
    e.dispatch({ type: 'hire', tier: 'driver', count: 2, map: 'neighborhood' });
    hours(e, h + 0.2);
    expect(m.logisticsJobs.filter((j) => j.kind === 'delivery').length).toBe(0);
  });

  it('auto-refuel moves depot fuel into tanks; inventories never go negative', () => {
    const { e, m, id } = nbWithDiesel();
    m.fuel.diesel = 3;
    const b = m.buildings[id];
    b.mode = 'baseload';
    hours(e, 24 * 3, 0.25);
    expect(b.energy).toBeGreaterThan(0);
    expect(m.fuel.diesel!).toBeGreaterThanOrEqual(0);
    expect(b.tank!).toBeGreaterThanOrEqual(0);
    expect(b.tank!).toBeLessThanOrEqual(tankCapacity(b, defOf(b)) + 1e-9);
  });

  it('throttled/stopped generators burn less / no fuel', () => {
    const { e, m, id } = nbWithDiesel();
    const b = m.buildings[id];
    b.tank = 2;
    b.mode = 'off';
    e.tick(1);
    e.tick(1);
    expect(b.tank).toBeCloseTo(2, 9);
  });

  it('refuel jobs for dismantled buildings are cancelled without losing fuel', () => {
    const { e, m, id } = nbWithDiesel();
    m.fuel.diesel = 2;
    e.dispatch({ type: 'refuel', map: 'neighborhood', id });
    const tank = m.buildings[id].tank ?? 0;
    expect(tank).toBeGreaterThan(0);
    e.dispatch({ type: 'demolish', map: 'neighborhood', id });
    expect(m.fuel.diesel).toBeCloseTo(2, 9); // unburnt fuel returned
    expect(m.logisticsJobs.length).toBe(0);
  });

  it('full automation buys within budget and price limits', () => {
    const { e, s, m } = nbWithDiesel();
    research(s, 'logistics_1');
    e.dispatch({ type: 'fuelPolicy', map: 'neighborhood', fuel: 'diesel', patch: { mode: 'full', budgetPerDay: 500, maxPriceFactor: 2 } });
    const m0 = s.money;
    hours(e, 12);
    expect(m.logisticsJobs.some((j) => j.kind === 'delivery') || (m.fuel.diesel ?? 0) > 0).toBe(true);
    expect(m0 - s.money).toBeLessThan(500 + 1e3); // fuel ≤ budget (+ small operating costs)
    e.dispatch({ type: 'automationPaused', paused: true });
    const n = m.logisticsJobs.length;
    hours(e, 24);
    expect(m.logisticsJobs.length).toBeLessThanOrEqual(n);
  });

  it('fuel markets open at their scale (supply availability)', () => {
    const { e } = nbWithDiesel();
    const r = e.dispatch({ type: 'buyFuel', map: 'neighborhood', fuel: 'uranium', qty: 1 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not traded/);
  });

  it('nuclear refuelling is an outage', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e12;
    const m = unlock(s, 'country');
    ownAll(m);
    research(s, 'nuclear_1');
    const id = place(e, 'country', 'smr');
    const b = m.buildings[id];
    m.fuel.uranium = 1e5;
    b.tank = 0;
    e.dispatch({ type: 'refuel', map: 'country', id });
    e.tick();
    expect(b.downtimeUntil).toBeGreaterThan(s.time);
    hours(e, 30);
    expect(b.tank).toBeGreaterThan(0);
  });
});

describe('fuel supply indicators and bulk refuel', () => {
  it('fuelBalance compares own production with plant burn', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e7;
    const m = unlock(s, 'neighborhood');
    ownAll(m);
    research(s, 'biomass_1', 'biomass_2', 'biomass_3');
    place(e, 'neighborhood', 'biomass_burner');
    let fb = fuelBalance(s, m, 'biomass');
    expect(fb.plants).toBe(1);
    expect(fb.producers).toBe(0);
    expect(fb.burnMax).toBeGreaterThan(0);
    place(e, 'neighborhood', 'biomass_plantation');
    fb = fuelBalance(s, m, 'biomass');
    expect(fb.producers).toBe(1);
    expect(fb.produced).toBeGreaterThan(0);
  });
  it('refuelAll tops up every plant from the depot', () => {
    const { e, m, id } = nbWithDiesel();
    const b = m.buildings[id];
    b.tank = 0;
    expect(e.dispatch({ type: 'refuelAll', map: 'neighborhood' }).error).toMatch(/buy fuel/);
    m.fuel.diesel = 100;
    expect(e.dispatch({ type: 'refuelAll', map: 'neighborhood' }).ok).toBe(true);
    expect(b.tank).toBeCloseTo(tankCapacity(b, defOf(b)));
  });
});
