import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../../src/engine/persistence/SaveManager';
import { syntheticLateGame } from './synthetic';

describe('performance (late-game synthetic save)', () => {
  const e = syntheticLateGame();
  const s = e.state;
  const buildings = Object.values(s.maps).reduce((a, m) => a + Object.keys(m!.buildings).length, 0);
  const units = Object.values(s.maps).reduce((a, m) => a + Object.values(m!.buildings).reduce((x, b) => x + b.units, 0), 0);

  it('simulates hundreds of installations representing astronomically many units cheaply', () => {
    expect(buildings).toBeGreaterThan(400);
    expect(units).toBeGreaterThan(1e9); // aggregated — never one object per unit
    for (let i = 0; i < 50; i++) e.tick();
    // best of 4 batches: other test workers share the CPU, the minimum reflects the engine itself
    let ms = Infinity;
    for (let k = 0; k < 4; k++) {
      const t0 = performance.now();
      for (let i = 0; i < 100; i++) e.tick();
      ms = Math.min(ms, (performance.now() - t0) / 100);
    }
    console.log(`[perf] ${buildings} installations (${units.toExponential(2)} units), ${ms.toFixed(3)} ms per tick (budget 250 ms real per tick at 1×)`);
    // ~3 ms alone, ~8 ms while the balance suite runs in parallel; real budget is 250 ms per tick
    expect(ms).toBeLessThan(15);
  });

  it('saves and loads quickly', () => {
    const t0 = performance.now();
    const st = serialize(s);
    const t1 = performance.now();
    deserialize(st);
    const t2 = performance.now();
    console.log(`[perf] save ${(t1 - t0).toFixed(1)} ms, load ${(t2 - t1).toFixed(1)} ms, size ${(st.data.length / 1024).toFixed(0)} KiB`);
    expect(t1 - t0).toBeLessThan(500);
    expect(t2 - t1).toBeLessThan(1000);
  });

  it('reconciles 12 h offline in chunked steps', () => {
    const t0 = performance.now();
    e.simulateOffline(12 * 3600);
    const ms = performance.now() - t0;
    console.log(`[perf] 12 h offline reconciliation: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(20_000);
    expect(Number.isFinite(s.money)).toBe(true);
    const mem = (globalThis as unknown as { process?: { memoryUsage?: () => { heapUsed: number } } }).process?.memoryUsage?.().heapUsed;
    if (mem) console.log(`[perf] heap used ${(mem / 1048576).toFixed(0)} MiB`);
  });
});
