import { dev, expect, test } from './fixtures';

/** Visual inspection captures at the required viewports (saved under test-results/screens). */
const SIZES: [string, number, number][] = [['1280x720', 1280, 720], ['1366x768', 1366, 768], ['1440x900', 1440, 900], ['1920x1080', 1920, 1080], ['2560x1440', 2560, 1440], ['4k-3840x2160', 3840, 2160], ['mobile-390x844', 390, 844]];

test('screenshots at multiple resolutions with a developed game', async ({ game, errors }) => {
  await dev(game, `d.money(1e9); d.unlock('neighborhood'); d.unlock('city'); d.ownAll('backyard'); d.research('storage_1','solar_1','thermal_1','biomass_1','hydro_1','wind_1');`);
  await game.evaluate(() => {
    const w = window as unknown as { __ee: { engine: { dispatch: (c: unknown) => { ok: boolean }; state: { maps: Record<string, { w: number; h: number; owned: number[]; occ: (string | null)[]; terrain: string[] }> } } } };
    const s = w.__ee.engine.state;
    const plan: [string, string[]][] = [['backyard', ['pv_rooftop', 'pv_improved', 'wind_micro', 'battery_home', 'pv_rooftop', 'wind_residential', 'pv_improved', 'garage_lab', 'waterwheel']], ['neighborhood', ['pv_commercial', 'diesel_gen', 'gas_peaker', 'biomass_burner', 'battery_community', 'pv_commercial', 'micro_hydro', 'wind_commercial']]];
    for (const [map, defs] of plan) {
      const m = s.maps[map];
      m.owned = m.owned.map(() => 1);
      for (const def of defs)
        for (let i = 0; i < m.w * m.h; i++) if (!m.occ[i] && w.__ee.engine.dispatch({ type: 'place', map, def, x: i % m.w, y: Math.floor(i / m.w), rot: 0 }).ok) break;
    }
  });
  await game.waitForTimeout(1500);
  for (const [name, w, h] of SIZES) {
    await game.setViewportSize({ width: w, height: h });
    await game.waitForTimeout(400);
    await game.screenshot({ path: `test-results/screens/${name}-backyard.png` });
    // no horizontal page scroll at any supported size
    expect(await game.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), name).toBe(true);
  }
  await game.setViewportSize({ width: 1920, height: 1080 });
  await game.getByTestId('stage-neighborhood').click();
  await game.waitForTimeout(400);
  await game.screenshot({ path: 'test-results/screens/1920x1080-neighborhood.png' });
  for (const t of ['research', 'finance', 'stats', 'thermal', 'prestige', 'progress', 'help', 'shortcuts']) {
    await game.getByTestId(`tab-${t}`).click();
    await game.waitForTimeout(250);
    await game.screenshot({ path: `test-results/screens/1920x1080-${t}.png` });
  }
  await game.getByTestId('tab-map').click();
  await game.getByTestId('fullscreen').click();
  await game.waitForTimeout(500);
  await game.screenshot({ path: 'test-results/screens/fullscreen.png' });
  expect(errors).toEqual([]);
});
