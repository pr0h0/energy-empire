import { describe, expect, it } from 'vitest';
import { jobPriority, manualRepairCost } from '../../src/engine/systems/MaintenanceSystem';
import { engine, hours, ownAll, place, research } from '../helpers';

describe('wear and repairs', () => {
  it('condition declines with use and wind shuts down when critical', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    ownAll(s.maps.backyard!);
    const id = place(e, 'backyard', 'wind_micro');
    const b = s.maps.backyard!.buildings[id];
    hours(e, 48, 0.25);
    expect(b.condition).toBeLessThan(1);
    b.condition = 0.2;
    e.tick();
    expect(b.output).toBe(0);
    expect(b.status).toMatch(/condition critical/);
  });

  it('queues a repair job at the threshold (default 70%)', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    const id = place(e, 'backyard', 'pv_rooftop');
    const m = s.maps.backyard!;
    m.buildings[id].condition = 0.69;
    e.tick();
    expect(m.repairJobs.some((j) => j.building === id)).toBe(true);
  });

  it('manual repair restores condition and costs money', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    const id = place(e, 'backyard', 'pv_rooftop');
    const b = s.maps.backyard!.buildings[id];
    b.condition = 0.5;
    const cost = manualRepairCost(s, b);
    const m0 = s.money;
    expect(e.dispatch({ type: 'repair', map: 'backyard', id }).ok).toBe(true);
    expect(b.condition).toBe(1);
    expect(m0 - s.money).toBeCloseTo(cost, 6);
    b.condition = 0.5;
    b.invested = 0.01;
    expect(manualRepairCost(s, b)).toBe(1);
    const m1 = s.money;
    expect(e.dispatch({ type: 'repair', map: 'backyard', id }).ok).toBe(true);
    expect(m1 - s.money).toBeCloseTo(1, 9);
  });

  it('technicians repair automatically; without crews jobs wait while equipment keeps wearing', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    ownAll(s.maps.backyard!);
    const ids = [place(e, 'backyard', 'wind_micro'), place(e, 'backyard', 'wind_micro')];
    const m = s.maps.backyard!;
    for (const id of ids) m.buildings[id].condition = 0.6;
    hours(e, 6);
    expect(m.buildings[ids[0]].condition).toBeLessThan(0.6);
    e.dispatch({ type: 'hire', tier: 'technician', count: 1, map: 'backyard' });
    hours(e, 24);
    for (const id of ids) expect(m.buildings[id].condition).toBeGreaterThan(0.95);
  });

  it('repair priority ages with waiting time so low-value jobs never starve', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    ownAll(s.maps.backyard!);
    const a = place(e, 'backyard', 'pv_rooftop');
    const b = place(e, 'backyard', 'wind_micro');
    const m = s.maps.backyard!;
    m.buildings[a].condition = 0.6;
    m.buildings[b].condition = 0.6;
    m.buildings[b].rRevenue = 1000; // very valuable
    e.tick();
    const ja = m.repairJobs.find((j) => j.building === a)!;
    const jb = m.repairJobs.find((j) => j.building === b)!;
    expect(jobPriority(s, m, jb, 1000)).toBeGreaterThan(jobPriority(s, m, ja, 1000));
    ja.waitedH = 200;
    expect(jobPriority(s, m, ja, 1000)).toBeGreaterThan(jobPriority(s, m, jb, 1000));
  });

  it('threshold overrides resolve installation → type → map → global', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    const id = place(e, 'backyard', 'pv_rooftop');
    const m = s.maps.backyard!;
    e.dispatch({ type: 'globalThreshold', value: 0.5 });
    m.buildings[id].condition = 0.6;
    e.tick();
    expect(m.repairJobs.length).toBe(0);
    e.dispatch({ type: 'typeThreshold', map: 'backyard', def: 'pv_rooftop', value: 0.8 });
    e.tick();
    expect(m.repairJobs.length).toBe(1);
    e.dispatch({ type: 'configure', map: 'backyard', id, patch: { repairThreshold: 0.3 } });
    m.repairJobs = [];
    e.tick();
    expect(m.repairJobs.length).toBe(0);
  });

  it('repairs targeting removed equipment are dropped', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    const id = place(e, 'backyard', 'pv_rooftop');
    const m = s.maps.backyard!;
    m.buildings[id].condition = 0.5;
    e.tick();
    expect(m.repairJobs.length).toBe(1);
    e.dispatch({ type: 'demolish', map: 'backyard', id });
    expect(m.repairJobs.length).toBe(0);
    e.dispatch({ type: 'hire', tier: 'technician', count: 1, map: 'backyard' });
    hours(e, 2);
    expect(m.repairJobs.length).toBe(0);
  });

  it('preventive servicing uses idle crews once researched', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    research(s, 'maintenance_1', 'maintenance_2', 'maintenance_3');
    const id = place(e, 'backyard', 'pv_rooftop');
    const b = s.maps.backyard!.buildings[id];
    e.dispatch({ type: 'hire', tier: 'technician', count: 1, map: 'backyard' });
    b.condition = 0.85; // above the 70% threshold: no repair job, but idle crews top it up
    hours(e, 12);
    expect(e.state.maps.backyard!.repairJobs.length).toBe(0);
    expect(b.condition).toBeGreaterThan(0.94);
  });
});
