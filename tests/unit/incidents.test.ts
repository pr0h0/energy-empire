import { describe, expect, it } from 'vitest';
import { incidentMult, resolveIncident } from '../../src/engine/systems/IncidentSystem';
import { engine, hours, ownAll, place, research, unlock } from '../helpers';

const setup = () => {
  const e = engine(9);
  const s = e.state;
  s.money = 1e9;
  const m = unlock(s, 'neighborhood');
  ownAll(m);
  research(s, 'storage_1', 'thermal_1');
  for (let k = 0; k < 4; k++) place(e, 'neighborhood', 'pv_commercial');
  return { e, s, m };
};

describe('business incidents', () => {
  it('occur deterministically, ask for a decision, and lapse to the default after 24 h', () => {
    const { e, s } = setup();
    const kinds = new Set<string>();
    for (let d = 0; d < 120; d++) {
      hours(e, 24);
      if (s.incidents.pending) {
        kinds.add(s.incidents.pending.kind);
        const until = s.incidents.pending.expiresAt;
        hours(e, until - s.time + 0.1);
        expect(s.incidents.pending?.expiresAt === until).toBe(false);
      }
    }
    expect(kinds.size).toBeGreaterThan(0);
    const again = setup();
    hours(again.e, 24 * 20);
    const first = setup();
    hours(first.e, 24 * 20);
    expect(again.s.incidents.lastBlock).toBe(first.s.incidents.lastBlock);
  });
  it('recall: paying protects condition, ignoring costs 25%; a boom raises demand only when accepted', () => {
    const { s, m } = setup();
    const ids = Object.keys(m.buildings).filter((id) => m.buildings[id].def === 'pv_commercial');
    s.incidents.pending = { kind: 'recall', map: 'neighborhood', cost: 100, targets: ids, expiresAt: s.time + 24, block: 3 };
    const c0 = m.buildings[ids[0]].condition;
    expect(resolveIncident(s, false)).toBeNull();
    expect(m.buildings[ids[0]].condition).toBeCloseTo(c0 - 0.25, 6);
    s.incidents.pending = { kind: 'recall', map: 'neighborhood', cost: 100, targets: ids, expiresAt: s.time + 24, block: 4 };
    const money = s.money;
    resolveIncident(s, true);
    expect(s.money).toBeCloseTo(money - 100, 6);
    s.incidents.pending = { kind: 'demandBoom', map: 'neighborhood', cost: 0, targets: [], expiresAt: s.time + 24, block: 5 };
    resolveIncident(s, true);
    expect(incidentMult(s, 'demand', 'neighborhood')).toBeCloseTo(1.25);
    expect(incidentMult(s, 'demand', 'neighborhood', s.time + 200)).toBe(1);
  });
});
