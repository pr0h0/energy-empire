import { describe, expect, it } from 'vitest';
import { advise } from '../../src/engine/systems/AdvisorSystem';
import { engine, ownAll, place, unlock } from '../helpers';

describe('advisor', () => {
  it('flags fuel-less plants, idle research and unserved demand, most urgent first', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e7;
    const m = unlock(s, 'neighborhood');
    ownAll(m);
    const id = place(e, 'neighborhood', 'diesel_gen');
    m.buildings[id].tank = 0;
    m.flow.demand = 100;
    m.flow.unserved = 50;
    const h = advise(s, m);
    const ids = h.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['unserved', 'nofuel', 'research']));
    expect(h[0].level).toBe('bad');
    expect(h.find((x) => x.id === 'nofuel')!.screen).toBe('fuel');
  });
  it('is quiet when nothing is wrong', () => {
    const e = engine();
    e.state.research.active = { x: 100 };
    expect(advise(e.state, e.state.maps.backyard!).filter((x) => x.level !== 'tip')).toEqual([]);
  });
});
