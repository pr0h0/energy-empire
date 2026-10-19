import { dev, expect, test } from './fixtures';

/** Rendering benchmark: idle, panning and zooming frame rates on a large, busy map. */
test('frame rate while idle, panning and zooming', async ({ game }) => {
  await dev(game, `d.money(1e40); d.unlock('planet'); d.ownAll('planet'); d.research('orbital_1','wind_6','fusion_1','geo_4'); e.state.settings.productionValues = true; e.state.settings.electricalOverlay = true;`);
  await game.evaluate(() => {
    const w = window as unknown as { __ee: { cmd: (c: unknown) => { ok: boolean }; engine: { state: { maps: Record<string, { w: number; h: number; occ: (string | null)[] }> } } } };
    const m = w.__ee.engine.state.maps.planet;
    for (const def of ['pv_planetary', 'kite', 'tokamak', 'orbital_solar', 'wind_mega', 'pv_mega', 'research_lab', 'maint_depot'])
      for (let k = 0; k < 6; k++)
        for (let i = 0; i < m.w * m.h; i++) if (!m.occ[i] && w.__ee.cmd({ type: 'place', map: 'planet', def, x: i % m.w, y: Math.floor(i / m.w), rot: 0 }).ok) break;
    (w.__ee as unknown as { ui: { getState: () => { setMap: (m: string) => void } } }).ui.getState().setMap('planet');
  });
  await game.evaluate(() => (window as unknown as { __ee: { cmd: (c: unknown) => void } }).__ee.cmd({ type: 'pause', paused: false }));
  await game.waitForTimeout(800);
  const fps = async (action?: () => Promise<void>) => {
    await game.evaluate(() => {
      const w = window as unknown as { __frames: number; __stop: boolean };
      w.__frames = 0;
      w.__stop = false;
      const f = () => {
        if (w.__stop) return;
        w.__frames++;
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    const t0 = Date.now();
    if (action) await action();
    else await game.waitForTimeout(2000);
    const dt = (Date.now() - t0) / 1000;
    return game.evaluate((dt) => {
      const w = window as unknown as { __frames: number; __stop: boolean };
      w.__stop = true;
      return w.__frames / dt;
    }, dt);
  };
  const box = (await game.getByTestId('map-canvas').boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const idle = await fps();
  const pan = await fps(async () => {
    await game.mouse.move(cx, cy);
    await game.mouse.down();
    for (let k = 0; k < 60; k++) await game.mouse.move(cx + Math.sin(k / 6) * 200, cy + Math.cos(k / 6) * 120);
    await game.mouse.up();
  });
  const zoom = await fps(async () => {
    await game.mouse.move(cx, cy);
    for (let k = 0; k < 40; k++) await game.mouse.wheel(0, k % 20 < 10 ? -120 : 120);
  });
  const renderMs = await game.evaluate(() => (window as unknown as { __eeRenderer: { frameMs: number } }).__eeRenderer.frameMs);
  const memory = await game.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);
  console.log(`[fps] idle ${idle.toFixed(1)} · panning ${pan.toFixed(1)} · zooming ${zoom.toFixed(1)} · last render ${renderMs.toFixed(2)} ms · JS heap ${(memory / 1048576).toFixed(0)} MiB`);
  expect(idle).toBeGreaterThan(20);
  expect(pan).toBeGreaterThan(15);
  expect(zoom).toBeGreaterThan(15);
});
