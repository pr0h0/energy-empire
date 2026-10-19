import { describe, expect, it } from 'vitest';
import { RESEARCH, RESEARCH_LIST } from '../../src/engine/data/research';
import { BUILDING_LIST } from '../../src/engine/data/buildings';
import { UPGRADE_RESEARCH, UPGRADES } from '../../src/engine/data/upgrades';
import { EMPLOYEE_LIST } from '../../src/engine/data/employees';
import { STAGE_LIST } from '../../src/engine/data/stages';
import { researchShares, researchThroughput } from '../../src/engine/systems/ResearchSystem';
import { engine, hours, research } from '../helpers';

describe('research tree integrity', () => {
  it('has no unknown prerequisites and no cycles; every project is reachable', () => {
    const done = new Set<string>();
    let progress = true;
    while (progress) {
      progress = false;
      for (const r of RESEARCH_LIST) {
        for (const p of r.prereq) expect(RESEARCH[p], `${r.id} → ${p}`).toBeDefined();
        if (!done.has(r.id) && r.prereq.every((p) => done.has(p))) {
          done.add(r.id);
          progress = true;
        }
      }
    }
    expect(done.size).toBe(RESEARCH_LIST.length);
  });
  it('every research-gated building, upgrade and employee tier references real research with an unlock effect', () => {
    for (const b of BUILDING_LIST) if (b.research) expect(RESEARCH[b.research], b.id).toBeDefined();
    for (const [u, r] of Object.entries(UPGRADE_RESEARCH)) {
      expect(UPGRADES[u]).toBeDefined();
      expect(RESEARCH[r].effects.some((e) => e.type === 'upgrade' && e.upgrade === u), `${r} unlocks ${u}`).toBe(true);
    }
    for (const t of EMPLOYEE_LIST) if (t.research) expect(RESEARCH[t.research]).toBeDefined();
  });
  it('covers all required branches', () => {
    const branches = new Set(RESEARCH_LIST.map((r) => r.branch));
    for (const b of ['solar', 'wind', 'hydro', 'thermal', 'geothermal', 'nuclear', 'fusion', 'storage', 'grid', 'materials', 'maintenance', 'logistics', 'workforce', 'markets', 'research', 'orbital', 'stellar', 'universal'])
      expect(branches.has(b as never), b).toBe(true);
    expect(STAGE_LIST.every((st) => RESEARCH_LIST.some((r) => r.stage === st.id))).toBe(true);
  });
});

describe('research progress', () => {
  it('charges money on start, progresses with throughput, completes and unlocks', () => {
    const e = engine();
    const s = e.state;
    s.money = 1000;
    const r = RESEARCH.solar_1;
    expect(e.dispatch({ type: 'startResearch', id: 'solar_1' }).ok).toBe(true);
    expect(s.money).toBe(1000 - r.cost);
    hours(e, r.rp / researchThroughput(s) + 1);
    expect(s.research.done.solar_1).toBeDefined();
  });
  it('allocations are normalised so total never exceeds capacity; paused projects get nothing', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    for (const id of ['solar_1', 'wind_1', 'storage_1']) e.dispatch({ type: 'startResearch', id });
    e.dispatch({ type: 'allocate', id: 'solar_1', pct: 100 });
    e.dispatch({ type: 'allocate', id: 'wind_1', pct: 100 });
    e.dispatch({ type: 'allocate', id: 'storage_1', pct: 100 });
    const sh = researchShares(s);
    expect(Object.values(sh).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    e.dispatch({ type: 'pauseResearch', id: 'wind_1' });
    const before = s.research.progress.wind_1 ?? 0;
    hours(e, 3);
    expect(s.research.progress.wind_1 ?? 0).toBe(before);
    // the paused project's share is redistributed: 50/50 weights → the remaining one gets everything
    e.dispatch({ type: 'allocate', id: 'solar_1', pct: 50 });
    e.dispatch({ type: 'pauseResearch', id: 'storage_1' });
    expect(researchShares(s).solar_1).toBeCloseTo(1, 9);
    e.dispatch({ type: 'startResearch', id: 'storage_1' });
    e.dispatch({ type: 'allocate', id: 'storage_1', pct: 50 });
    // resuming a paused project does not charge again
    const m0 = s.money;
    e.dispatch({ type: 'startResearch', id: 'wind_1' });
    expect(s.money).toBe(m0);
  });
  it('locked projects explain why and cannot start', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e12;
    const r = e.dispatch({ type: 'startResearch', id: 'solar_2' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Requires/);
    research(s, 'solar_1');
    expect(e.dispatch({ type: 'startResearch', id: 'solar_2' }).error).toMatch(/Neighborhood/);
  });
  it('breakthroughs need milestones', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e30;
    research(s, ...Object.keys(RESEARCH).filter((id) => id !== 'fusion_1' && RESEARCH[id].stage !== 'solar'));
    s.maps.planet = s.maps.backyard; // test shortcut: stage map present
    const r = e.dispatch({ type: 'startResearch', id: 'fusion_1' });
    expect(r.error).toMatch(/Milestone/);
  });
});

describe('repeatable research', () => {
  it('one per map plus Beyond, outside the one-off list, 10× an average project, growing per level', async () => {
    const { REPEATABLE_LIST, levelRP } = await import('../../src/engine/data/research');
    for (const st of STAGE_LIST) expect(REPEATABLE_LIST.some((r) => r.stage === st.id && !r.beyond), st.id).toBe(true);
    expect(REPEATABLE_LIST.some((r) => r.beyond)).toBe(true);
    for (const r of REPEATABLE_LIST) expect(RESEARCH_LIST).not.toContain(r);
    const r = RESEARCH.rep_backyard;
    const avg = RESEARCH_LIST.filter((x) => x.stage === 'backyard').reduce((a, x) => a + x.rp, 0) / RESEARCH_LIST.filter((x) => x.stage === 'backyard').length;
    expect(r.rp).toBeCloseTo(avg * 10, -1);
    expect(levelRP(r, 10)).toBeGreaterThan(r.rp * 13);
  });
  it('levels up, keeps running, and reductions never pass the 25% cap', async () => {
    const { mod } = await import('../../src/engine/core/Modifiers');
    const e = engine();
    const s = e.state;
    expect(e.dispatch({ type: 'startResearch', id: 'rep_backyard' }).ok).toBe(true);
    s.research.progress.rep_backyard = 1e9;
    e.tick();
    expect(s.research.levels.rep_backyard).toBe(1);
    expect(s.research.active.rep_backyard).toBeDefined();
    expect(mod(s, 'solar.output')).toBeCloseTo(1.01, 6);
    s.research.levels.rep_entropy = 10_000;
    expect(mod(s, 'build.cost')).toBeGreaterThanOrEqual(0.75 - 1e-9);
  });
});

describe('company-wide staff training', () => {
  it('raises researcher output 10% per level, charges money and caps', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e9;
    const rp0 = researchThroughput(s);
    expect(e.dispatch({ type: 'train', map: 'backyard', group: 'research' }).ok).toBe(true);
    expect(researchThroughput(s)).toBeCloseTo(rp0 * 1.1, 6);
    expect(s.money).toBeLessThan(1e9);
    for (let k = 0; k < 3; k++) e.dispatch({ type: 'train', map: 'backyard', group: 'research' });
    expect(e.dispatch({ type: 'train', map: 'backyard', group: 'research' }).ok).toBe(false);
  });
});
