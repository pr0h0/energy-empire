import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { deserialize, exportSave, importSave, SaveManager, serialize } from '../../src/engine/persistence/SaveManager';
import { migrate } from '../../src/engine/persistence/SaveMigration';
import { validateSave } from '../../src/engine/persistence/SaveSchema';
import { SAVE_VERSION } from '../../src/engine/core/NewGame';
import { GameEngine } from '../../src/engine/core/GameEngine';
import { SimulationScheduler } from '../../src/engine/core/SimulationScheduler';
import { engine, hours, place } from '../helpers';

describe('saves', () => {
  it('round-trips the complete state', () => {
    const e = engine();
    e.state.money = 1e5;
    place(e, 'backyard', 'pv_rooftop');
    hours(e, 10);
    const st = serialize(e.state);
    const back = deserialize(st);
    expect(JSON.parse(JSON.stringify(back))).toEqual(JSON.parse(JSON.stringify({ ...e.state, offlineSummary: null })));
  });

  it('detects corruption via checksum', () => {
    const st = serialize(engine().state);
    st.data = st.data.replace('"money":60', '"money":6000000');
    expect(() => deserialize(st)).toThrow(/Checksum/);
  });

  it('rejects invalid imports without touching state', () => {
    expect(() => importSave('not json')).toThrow();
    expect(() => importSave(JSON.stringify({ format: 'other' }))).toThrow(/Not an Energy Empire/);
    const bad = engine().state as unknown as Record<string, unknown>;
    bad.money = 'lots';
    const data = JSON.stringify(bad);
    const env = JSON.stringify({ format: 'energy-empire-save', data, checksum: (serialize as unknown as (s: unknown) => { checksum: string })({ ...bad }).checksum, savedAt: 0, version: SAVE_VERSION });
    expect(() => importSave(env)).toThrow();
    expect(validateSave({ ...bad })).not.toHaveLength(0);
  });

  it('export → import yields an identical game (no duplication)', () => {
    const e = engine();
    e.state.money = 12345;
    const s2 = importSave(exportSave(e.state));
    expect(s2.money).toBe(12345);
    const e2 = new GameEngine(s2);
    e2.tick();
    expect(e.state.money).toBe(12345);
  });

  it('migrates old schema versions without losing progress', () => {
    const old = JSON.parse(JSON.stringify(engine().state));
    old.version = 1;
    delete old.defaultRepairThreshold;
    delete old.convergence;
    for (const m of Object.values(old.maps) as Record<string, unknown>[]) delete m.training;
    old.money = 777;
    const s = migrate(old);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.money).toBe(777);
    expect(s.defaultRepairThreshold).toBe(0.7);
    expect(s.maps.backyard!.training).toEqual({ maintenance: 0, logistics: 0 });
    expect(validateSave(s)).toEqual([]);
  });

  it('real play time: old saves start at 0 and the scheduler counts open time, paused included', () => {
    const e = engine();
    const old = JSON.parse(JSON.stringify(e.state));
    delete old.lifetime.realH;
    delete old.run.realH;
    const m = migrate(old) as typeof e.state;
    expect(m.lifetime.realH).toBe(0);
    expect(m.run.realH).toBe(0);
    e.state.paused = true;
    const sch = new SimulationScheduler(e) as unknown as { last: number; loop: () => void };
    sch.last = Date.now() - 3600;
    sch.loop();
    expect(e.state.run.realH * 3.6e6).toBeGreaterThanOrEqual(3600);
    expect(e.state.lifetime.realH).toBe(e.state.run.realH);
  });

  it('a long hidden-tab absence is reconciled once, as one capped offline summary', async () => {
    const e = engine();
    const doc = { visibilityState: 'hidden' };
    (globalThis as { document?: unknown }).document = doc;
    try {
      const sch = new SimulationScheduler(e) as unknown as { last: number; loop: () => void; catchingUp: boolean };
      const t0 = e.state.time;
      sch.last = Date.now() - 20 * 3600 * 1000; // hidden for 20 real hours, throttled timers firing
      for (let k = 0; k < 5; k++) sch.loop();
      expect(e.state.time).toBe(t0); // nothing simulated while hidden
      doc.visibilityState = 'visible';
      sch.loop();
      while (sch.catchingUp) await new Promise((r) => setTimeout(r, 5));
      const sum = e.state.offlineSummary!;
      expect(sum.realSeconds).toBe(e.offlineCapSeconds());
      expect(sum.capped).toBe(true);
      expect(e.state.time - t0).toBeCloseTo(sum.hours, 6);
    } finally {
      delete (globalThis as { document?: unknown }).document;
    }
  });

  it('IndexedDB save/load with backup recovery when the primary is corrupted', async () => {
    const sm = new SaveManager();
    await sm.reset();
    const e = engine();
    e.state.money = 111;
    await sm.save(e.state);
    // force rotation by aging the primary
    const db = (sm as unknown as { kv: { get: (k: string) => Promise<{ savedAt: number }>; set: (k: string, v: unknown) => Promise<void> } }).kv;
    const p = await db.get('primary');
    p.savedAt -= 10 * 60_000;
    await db.set('primary', p);
    e.state.money = 222;
    await sm.save(e.state);
    expect((await sm.load())!.state.money).toBe(222);
    const prim = await db.get('primary');
    await db.set('primary', { ...prim, data: '{"broken":' });
    const r = await sm.load();
    expect(r!.slot).toBe('backup1');
    expect(r!.state.money).toBe(111);
  });
});
