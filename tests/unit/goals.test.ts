import { describe, expect, it } from 'vitest';
import { goalProgress } from '../../src/engine/systems/GoalSystem';
import { goalReward } from '../../src/engine/data/goals';
import { STAGES } from '../../src/engine/data/stages';
import { gridLimits } from '../../src/engine/core/Helpers';
import { mapWages } from '../../src/engine/systems/FinanceSystem';
import { performPrestige, PRESTIGE_CONFIRM, prestigePreview } from '../../src/engine/systems/PrestigeSystem';
import { previewPlacement } from '../../src/engine/systems/ConstructionSystem';
import { engine, findSpot, ownAll, place, unlock } from '../helpers';

describe('per-map goals', () => {
  it('capacity goal pays out once when reached; streak goals count hours', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    const m = s.maps.backyard!;
    ownAll(m);
    expect(goalProgress(s, m, 'capacity').done).toBe(false);
    for (let k = 0; k < 6; k++) place(e, 'backyard', 'pv_rooftop');
    const before = s.money;
    e.tick();
    expect(goalProgress(s, m, 'capacity').done).toBe(true);
    expect(s.money - before).toBeGreaterThanOrEqual(goalReward(STAGES.backyard) * 0.99);
    m.goalTrack.noImportH = 5;
    m.flow.imported = 1;
    e.tick();
    expect(m.goalTrack.noImportH).toBeLessThan(1);
  });
});

describe('challenge runs', () => {
  it('fossil-free blocks fossil plants; off-grid removes imports; tight raises wages', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e7;
    const m = unlock(s, 'neighborhood');
    ownAll(m);
    const spot = findSpot(m, 'diesel_gen', 0)!;
    s.challenge = 'no_fossil';
    expect(previewPlacement(s, m, 'diesel_gen', spot[0], spot[1], 0).reasons.join()).toMatch(/Fossil-free/);
    s.challenge = 'off_grid';
    expect(gridLimits(s, m).importKW).toBe(0);
    expect(gridLimits(s, s.maps.backyard!).importKW).toBeGreaterThan(0);
    m.workforce = { technician: 2 };
    s.challenge = null;
    const w = mapWages(s, m);
    s.challenge = 'tight';
    expect(mapWages(s, m)).toBeCloseTo(w * 1.5);
  });
  it('a challenge run pays bonus prestige points and the next run starts with the chosen challenge', () => {
    const e = engine();
    const s = e.state;
    s.prestige.lifetimeRevenue = 1e9;
    s.challenge = 'off_grid';
    const p = prestigePreview(s);
    expect(p.bonus).toBe(Math.ceil(p.claimable * 0.4));
    const r = performPrestige(s, PRESTIGE_CONFIRM, 'no_fossil');
    expect(r.ok).toBe(true);
    expect(r.state!.prestige.available).toBe(s.prestige.available + p.claimable + p.bonus);
    expect(r.state!.prestige.awarded).toBe(s.prestige.awarded + p.claimable);
    expect(r.state!.challenge).toBe('no_fossil');
  });
});

describe('achievement definitions', () => {
  it('every def:/family: achievement refers to real buildings, and ids are unique', async () => {
    const { ACHIEVEMENTS } = await import('../../src/engine/data/achievements');
    const { BUILDINGS, BUILDING_LIST } = await import('../../src/engine/data/buildings');
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      if (a.check.kind !== 'custom') continue;
      const [k, v] = a.check.id.split(':');
      if (k === 'def') for (const d of v.split('|')) expect(BUILDINGS[d], `${a.id} → ${d}`).toBeDefined();
      if (k === 'family') expect(BUILDING_LIST.some((b) => b.family === v), `${a.id} → ${v}`).toBe(true);
    }
  });
});
