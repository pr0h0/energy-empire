import { describe, expect, it } from 'vitest';
import { entitledPoints } from '../../src/engine/math/PrestigeFormulas';
import { PRESTIGE_CONFIRM, prestigePreview } from '../../src/engine/systems/PrestigeSystem';
import { engine, place, research, unlock } from '../helpers';

describe('prestige', () => {
  it('requires explicit confirmation', () => {
    const e = engine();
    e.state.prestige.lifetimeRevenue = 1e9;
    expect(e.dispatch({ type: 'prestige', confirm: 'yes' }).ok).toBe(false);
    expect(e.state.prestige.resets).toBe(0);
  });

  it('awards entitled − previously awarded, resets the economy and preserves permanent progress', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e9;
    place(e, 'backyard', 'pv_rooftop');
    unlock(s, 'neighborhood');
    research(s, 'solar_1');
    s.prestige.lifetimeRevenue = 1e9; // 10 points
    s.achievements.first_light = 1;
    e.dispatch({ type: 'saveBlueprint', map: 'backyard', name: 'BP' });
    const r = e.dispatch({ type: 'prestige', confirm: PRESTIGE_CONFIRM });
    expect(r.ok).toBe(true);
    expect(r.data).toBe(10);
    const n = e.state;
    expect(n.prestige.awarded).toBe(10);
    expect(n.prestige.available).toBe(10);
    expect(n.prestige.resets).toBe(1);
    expect(n.maps.neighborhood).toBeUndefined();
    expect(Object.keys(n.maps.backyard!.buildings)).toEqual(['house_0']);
    expect(n.research.done.solar_1).toBeUndefined();
    expect(n.achievements.first_light).toBe(1);
    expect(n.blueprints.length).toBe(1);
    expect(n.money).toBeLessThan(1000);
    // the same revenue cannot be claimed twice
    expect(prestigePreview(n).claimable).toBe(0);
    expect(e.dispatch({ type: 'prestige', confirm: PRESTIGE_CONFIRM }).ok).toBe(false);
  });

  it('spending points does not reduce the awarded high-water mark', () => {
    const e = engine();
    const s = e.state;
    s.prestige.lifetimeRevenue = 1e9;
    e.dispatch({ type: 'prestige', confirm: PRESTIGE_CONFIRM });
    const n = e.state;
    expect(e.dispatch({ type: 'buyPrestige', id: 'p_revenue' }).ok).toBe(true);
    expect(n.prestige.spent).toBe(1);
    expect(n.prestige.available).toBe(9);
    expect(n.prestige.awarded).toBe(10);
    n.prestige.lifetimeRevenue = 1.6e10; // entitled 20
    expect(prestigePreview(n).claimable).toBe(entitledPoints(1.6e10) - 10);
  });

  it('permanent bonuses apply in the next run', () => {
    const e = engine();
    e.state.prestige.lifetimeRevenue = 1e12; // 56 points
    e.dispatch({ type: 'prestige', confirm: PRESTIGE_CONFIRM });
    for (const id of ['p_capital', 'p_starter', 'p_keepland', 'p_revenue']) expect(e.dispatch({ type: 'buyPrestige', id }).ok, id).toBe(true);
    const owned = e.state.maps.backyard!.owned.slice();
    owned[0] = 1;
    e.state.maps.backyard!.owned = owned;
    e.state.prestige.lifetimeRevenue = 1e14;
    e.dispatch({ type: 'prestige', confirm: PRESTIGE_CONFIRM });
    const n = e.state;
    expect(n.money).toBe(60 * 10);
    expect(n.maps.backyard!.workforce.technician).toBe(1);
    expect(n.research.done.maintenance_1).toBeDefined();
    expect(n.maps.backyard!.owned[0]).toBe(1);
    // revenue multiplier is live
    expect(n.prestige.upgrades.p_revenue).toBe(1);
  });

  it('prestige is optional — expansion never requires it', () => {
    const e = engine();
    expect(e.state.prestige.resets).toBe(0);
    // stage milestone kinds never reference prestige
    import('../../src/engine/data/stages').then(({ STAGE_LIST }) => {
      for (const st of STAGE_LIST) for (const m of st.unlock?.milestones ?? []) expect(JSON.stringify(m)).not.toMatch(/prestige/);
    });
  });
});
