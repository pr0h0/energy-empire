import { describe, expect, it } from 'vitest';
import { RESEARCH } from '../../src/engine/data/research';
import { entitledPoints } from '../../src/engine/math/PrestigeFormulas';
import { stageUnlockStatus } from '../../src/engine/systems/ProgressionSystem';
import { PRESTIGE_CONFIRM } from '../../src/engine/systems/PrestigeSystem';
import { deliveryHours } from '../../src/engine/systems/FuelSystem';
import { landBlockReason } from '../../src/engine/systems/LandSystem';
import { engine, findSpot, hours } from '../helpers';


/** The 25-step workflow from the specification, played with normal commands. */
describe('complete gameplay workflow', () => {
  it('backyard → neighborhood → thermal → city → prestige → next run', () => {
    const e = engine(2024);
    const s = e.state;
    const by = s.maps.backyard!;
    const build = (map: 'backyard' | 'neighborhood' | 'city', def: string) => {
      const m = s.maps[map]!;
      const spot = findSpot(m, def);
      expect(spot, `${def} spot on ${map}`).not.toBeNull();
      const r = e.dispatch({ type: 'place', map, def, x: spot![0], y: spot![1], rot: 0 });
      expect(r.ok, r.error).toBe(true);
      return r.data as string;
    };
    // 1–3: first panel reduces household imports
    hours(e, 1);
    s.time = 11.5;
    e.tick();
    const importBefore = by.flow.imported;
    const pv = build('backyard', 'pv_rooftop');
    e.tick();
    expect(by.buildings[pv].output).toBeGreaterThan(0);
    expect(by.flow.imported).toBeLessThan(importBefore);
    // 4–6: export connection, surplus sells, revenue accumulates
    hours(e, 30);
    expect(e.dispatch({ type: 'upgradeGrid', map: 'backyard' }).ok).toBe(true);
    build('backyard', 'pv_rooftop');
    const sales0 = s.ledger.sales;
    hours(e, 24);
    expect(s.ledger.sales).toBeGreaterThan(sales0);
    expect(s.prestige.lifetimeRevenue).toBe(s.ledger.sales);
    // 7–8: buy adjacent land, place more generation
    hours(e, 48);
    const tile = by.owned.findIndex((o, i) => !o && !landBlockReason(s, by, i));
    expect(e.dispatch({ type: 'buyLand', map: 'backyard', x: tile % by.w, y: Math.floor(tile / by.w) }).ok).toBe(true);
    build('backyard', 'wind_micro');
    // 9: repair deteriorating equipment manually
    by.buildings[pv].condition = 0.55;
    hours(e, 2);
    expect(e.dispatch({ type: 'repair', map: 'backyard', id: pv }).ok).toBe(true);
    expect(by.buildings[pv].condition).toBe(1);
    // 10–11: hire a technician; repairs become automatic
    hours(e, 24);
    expect(e.dispatch({ type: 'hire', tier: 'technician', count: 1, map: 'backyard' }).ok).toBe(true);
    by.buildings[pv].condition = 0.6;
    hours(e, 24);
    expect(by.buildings[pv].condition).toBeGreaterThan(0.9);
    // 13–14: fund research, complete it, unlock equipment
    while (s.money < RESEARCH.storage_1.cost) hours(e, 4);
    expect(e.dispatch({ type: 'startResearch', id: 'storage_1' }).ok).toBe(true);
    while (s.research.done.storage_1 === undefined) hours(e, 4);
    // 12: purchase and operate storage
    while (s.money < 10) hours(e, 4);
    const bat = build('backyard', 'battery_home');
    hours(e, 24);
    expect(by.buildings[bat].cycles!).toBeGreaterThan(0);
    // grow until Neighborhood milestones are genuinely met
    e.dispatch({ type: 'startResearch', id: 'solar_1' });
    for (let k = 0; k < 400 && !stageUnlockStatus(s, 'neighborhood').canUnlock; k++) {
      hours(e, 6);
      if (s.money > 120 && e.state.maps.backyard!.gridLevel < 2) e.dispatch({ type: 'upgradeGrid', map: 'backyard' });
      const t2 = by.owned.findIndex((o, i) => !o && !landBlockReason(s, by, i) && by.terrain[i] !== 'river');
      if (s.money > 60 && !findSpot(by, 'pv_rooftop') && t2 >= 0) e.dispatch({ type: 'buyLand', map: 'backyard', x: t2 % by.w, y: Math.floor(t2 / by.w) });
      if (s.money > 30 && findSpot(by, 'pv_rooftop')) build('backyard', 'pv_rooftop');
    }
    // 15: expand to the Neighborhood
    expect(e.dispatch({ type: 'unlockStage', stage: 'neighborhood' }).ok).toBe(true);
    const nb = s.maps.neighborhood!;
    // 16: both maps operate simultaneously
    const byProd = by.totals.produced;
    hours(e, 12);
    expect(by.totals.produced).toBeGreaterThan(byProd);
    expect(nb.flow.demand).toBeGreaterThan(0);
    // 17–19: buy fuel, timed delivery, operate a thermal generator
    s.money += 1e5; // test acceleration
    nb.owned = nb.owned.map(() => 1);
    const dg = build('neighborhood', 'diesel_gen');
    expect(e.dispatch({ type: 'buyFuel', map: 'neighborhood', fuel: 'diesel', qty: 4 }).ok).toBe(true);
    expect(nb.logisticsJobs.length).toBe(1);
    hours(e, deliveryHours(s, nb, 'diesel', 4) + 1);
    expect(nb.fuel.diesel ?? 0).toBeGreaterThan(0);
    e.dispatch({ type: 'refuel', map: 'neighborhood', id: dg });
    e.dispatch({ type: 'configure', map: 'neighborhood', id: dg, patch: { mode: 'baseload' } });
    hours(e, 2);
    expect(nb.buildings[dg].energy).toBeGreaterThan(0);
    // 20–21: research milestones and an advanced stage
    s.money += 1e7;
    for (const id of ['thermal_1', 'biomass_1', 'hydro_1', 'logistics_1', 'storage_2', 'maintenance_1']) e.dispatch({ type: 'startResearch', id });
    for (let k = 0; k < 200 && !stageUnlockStatus(s, 'city').canUnlock; k++) {
      hours(e, 6);
      for (const c of ['nb_cafe', 'nb_school', 'nb_homes2']) e.dispatch({ type: 'signContract', map: 'neighborhood', contract: c });
      if (findSpot(nb, 'pv_commercial')) build('neighborhood', 'pv_commercial');
      for (const id of ['grid_1', 'research_1', 'workforce_1', 'materials_1', 'wind_1', 'solar_2']) e.dispatch({ type: 'startResearch', id });
    }
    expect(e.dispatch({ type: 'unlockStage', stage: 'city' }).ok).toBe(true);
    // keep operating until the first prestige point is earned from sales
    s.maps.city!.owned = s.maps.city!.owned.map(() => 1);
    for (let k = 0; k < 6; k++) if (findSpot(s.maps.city!, 'pv_commercial')) build('city', 'pv_commercial');
    for (let k = 0; k < 100 && entitledPoints(s.prestige.lifetimeRevenue) < 1; k++) hours(e, 12, 0.25);
    // 22–25: prestige, correct currency, shop, restart with bonuses
    const lifetime = s.prestige.lifetimeRevenue;
    const expected = entitledPoints(lifetime);
    expect(expected).toBeGreaterThan(0);
    const r = e.dispatch({ type: 'prestige', confirm: PRESTIGE_CONFIRM });
    expect(r.ok).toBe(true);
    expect(r.data).toBe(expected);
    const n = e.state;
    expect(n.prestige.awarded).toBe(expected);
    expect(n.maps.city).toBeUndefined();
    expect(e.dispatch({ type: 'buyPrestige', id: 'p_revenue' }).ok).toBe(true);
    expect(n.prestige.upgrades.p_revenue).toBe(1);
    // bonus applies: same setup sells 10% more
    n.money = 1e5;
    const b2 = n.maps.backyard!;
    e.dispatch({ type: 'upgradeGrid', map: 'backyard' });
    const spot = findSpot(b2, 'pv_rooftop')!;
    e.dispatch({ type: 'place', map: 'backyard', def: 'pv_rooftop', x: spot[0], y: spot[1], rot: 0 });
    n.time = 12;
    e.tick();
    const exported = b2.flow.exported * (1 - 0.02) * 0.4;
    expect(b2.flow.sales).toBeCloseTo(exported * 1.15, 6);
  });
});
