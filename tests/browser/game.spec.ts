import { clickTile, dev, expect, freeTile, resume, state, test } from './fixtures';

test.describe('core gameplay in the browser', () => {
  test('loads cleanly with all main regions', async ({ game, errors }) => {
    await expect(game.getByTestId('topbar')).toBeVisible();
    await expect(game.getByTestId('stage-backyard')).toBeVisible();
    await expect(game.getByTestId('map-canvas')).toBeVisible();
    await expect(game.getByTestId('catalog')).toBeVisible();
    await expect(game.getByTestId('onboarding')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('place a building, select it, see the inspector; invalid placement fails safely', async ({ game }) => {
    const money0 = await state<number>(game, 's.money');
    await game.getByTestId('catalog-pv_rooftop').click();
    const [x, y] = await freeTile(game);
    await clickTile(game, x, y);
    await expect(game.getByTestId('toast').first()).toContainText('Built Rooftop PV Array');
    expect(await state<number>(game, 'Object.keys(s.maps.backyard.buildings).length')).toBe(2);
    expect(await state<number>(game, 's.money')).toBeLessThan(money0);
    // invalid: unowned tile
    const money1 = await state<number>(game, 's.money');
    const [ux, uy] = await state<[number, number]>(game, '(() => { const m = s.maps.backyard; const i = m.owned.findIndex((o) => !o); return [i % m.w, Math.floor(i / m.w)]; })()');
    await clickTile(game, ux, uy);
    await expect(game.getByText(/Cannot build here/)).toBeVisible();
    expect(await state<number>(game, 's.money')).toBe(money1);
    // unowned but adjacent: confirm buys the land and builds
    const [ax, ay] = await state<[number, number]>(game, `(() => { const m = s.maps.backyard; const ok = (i) => i >= 0 && i < m.w * m.h; const i = m.owned.findIndex((o, k) => !o && !m.occ[k] && ['grass', 'urban'].includes(m.terrain[k]) && [k - 1, k + 1, k - m.w, k + m.w].some((j) => ok(j) && m.owned[j] && Math.abs((j % m.w) - (k % m.w)) <= 1)); return [i % m.w, Math.floor(i / m.w)]; })()`);
    await clickTile(game, ax, ay);
    await expect(game.getByTestId('build-cost-breakdown')).toContainText('1 tile of land');
    await game.getByTestId('confirm-build').click();
    expect(await state<number>(game, `s.maps.backyard.owned[${ay} * s.maps.backyard.w + ${ax}]`)).toBe(1);
    expect(await state<number>(game, 'Object.keys(s.maps.backyard.buildings).length')).toBe(3);
    // select it
    await game.keyboard.press('Escape');
    await clickTile(game, x, y);
    await expect(game.getByTestId('inspector-name')).toHaveText('Rooftop PV Array');
    // selecting from the Map tab also switches to the inspector
    await game.getByTestId('tab-overview').click();
    await expect(game.getByTestId('inspector-name')).toHaveCount(0);
    await game.keyboard.press('Escape');
    await clickTile(game, x, y);
    await expect(game.getByTestId('inspector-name')).toHaveText('Rooftop PV Array');
    // hovering an installation shows the building, not the ground
    await expect(game.getByTestId('tile-tooltip')).toContainText('Rooftop PV Array');
    await expect(game.getByTestId('tile-tooltip')).toContainText('Condition');
    await expect(game.getByTestId('tile-tooltip')).not.toContainText('Elevation');
  });

  test('hover tooltip shows terrain information', async ({ game }) => {
    const [x, y] = await freeTile(game);
    const [cx, cy] = await game.evaluate(([x, y]) => (window as unknown as { __eeTile: (x: number, y: number) => [number, number] }).__eeTile(x, y), [x, y]);
    await game.mouse.move(cx, cy);
    await expect(game.getByTestId('tile-tooltip')).toContainText('Open land');
  });

  test('buy adjacent land in land mode; panning does not buy', async ({ game }) => {
    await dev(game, 'd.money(1000)');
    const [tx, ty] = await state<[number, number]>(game, `(() => { const m = s.maps.backyard; for (let i = 0; i < m.w*m.h; i++) { const x = i % m.w, y = Math.floor(i / m.w); if (!m.owned[i] && m.terrain[i] !== 'river' && ((x > 0 && m.owned[i-1]) || (x < m.w-1 && m.owned[i+1]) || (y > 0 && m.owned[i-m.w]) || (y < m.h-1 && m.owned[i+m.w]))) return [x, y]; } })()`);
    await game.getByTestId('mode-land').click();
    // drag across the tile: no purchase
    const [cx, cy] = await game.evaluate(([x, y]) => (window as unknown as { __eeTile: (x: number, y: number) => [number, number] }).__eeTile(x, y), [tx, ty]);
    await game.mouse.move(cx, cy);
    await game.mouse.down();
    await game.mouse.move(cx + 60, cy + 40, { steps: 5 });
    await game.mouse.up();
    expect(await state<number>(game, `s.maps.backyard.owned[${ty} * s.maps.backyard.w + ${tx}]`)).toBe(0);
    await game.getByTestId('map-screen').locator('button[aria-label="Fit map to view"]').click();
    await clickTile(game, tx, ty);
    expect(await state<number>(game, `s.maps.backyard.owned[${ty} * s.maps.backyard.w + ${tx}]`)).toBe(1);
  });

  test('weather layer, forecast, event mutes, incident decision, fleet confirm and new charts', async ({ game, errors }) => {
    await dev(game, `d.money(1e6); d.research('wind_1', 'solar_2', 'maintenance_1', 'fleet_1'); for (let k = 0; k < 3; k++) for (const def of ['pv_rooftop', 'wind_residential']) { const m = e.state.maps.backyard; for (let i = 0; i < m.w * m.h; i++) if (m.owned[i] && !m.occ[i] && e.dispatch({ type: 'place', map: 'backyard', def, x: i % m.w, y: Math.floor(i / m.w), rot: 0 }).ok) break; } e.emit();`);
    // weather layer cycles Wind → Solar → Hydro → off with a legend
    await game.getByTestId('overlay-weather').click();
    await expect(game.getByTestId('weather-legend')).toContainText('Wind layer');
    await game.getByTestId('overlay-weather').click();
    await expect(game.getByTestId('weather-legend')).toContainText('Solar layer');
    await game.getByTestId('overlay-weather').click();
    await game.getByTestId('overlay-weather').click();
    await expect(game.getByTestId('weather-legend')).toHaveCount(0);
    // forecast card in the Map tab
    await game.getByTestId('tab-overview').click();
    await expect(game.getByTestId('forecast')).toContainText('Next 24 h');
    // incident: decide from the prompt
    await dev(game, `e.state.incidents.pending = { kind: 'demandBoom', map: 'backyard', cost: 0, targets: [], expiresAt: e.state.time + 24, block: 9 }; e.emit();`);
    await expect(game.getByTestId('incident')).toBeVisible();
    await game.getByTestId('incident-no').click();
    await expect(game.getByTestId('incident')).toHaveCount(0);
    // mute a notification category
    await dev(game, `e.state.notifications.push({ id: 99901, t: e.state.time, level: 'warning', category: 'weather', text: 'Storm expected in 3 h' }, { id: 99902, t: e.state.time, level: 'warning', category: 'weather', text: 'Storm expected in 2 h' }); e.emit();`);
    await game.getByTestId('alerts').click();
    await expect(game.getByTestId('event-count').first()).toHaveText('×2');
    await game.getByTestId('mute-weather').click();
    expect(await state<string[]>(game, 's.settings.mutedCategories')).toEqual(['weather']);
    await expect(game.getByTestId('events').getByText('Storm expected')).toHaveCount(0);
    await game.getByTestId('alerts').click();
    // fleet upgrade asks for confirmation
    await game.getByTestId('tab-operations').click();
    const fleet = game.getByTestId('fleet-solar_clean');
    await fleet.click();
    await expect(fleet).toContainText('Confirm');
    expect(await state<number>(game, `Object.values(s.maps.backyard.buildings).filter((b) => b.upgrades.includes('solar_clean')).length`)).toBe(0);
    await fleet.click();
    expect(await state<number>(game, `Object.values(s.maps.backyard.buildings).filter((b) => b.upgrades.includes('solar_clean')).length`)).toBeGreaterThan(0);
    // new statistics charts
    await game.getByTestId('tab-stats').click();
    for (const t of ['Sales revenue', 'Reliability', 'Generation mix']) await expect(game.getByText(t, { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('every management screen opens', async ({ game }) => {
    for (const id of ['research', 'workforce', 'operations', 'automation', 'fuel', 'market', 'thermal', 'finance', 'stats', 'progress', 'blueprints', 'prestige', 'achievements', 'settings']) {
      await game.getByTestId(`tab-${id}`).click();
      await expect(game.getByTestId(`${id === 'stats' ? 'stats' : id}-screen`)).toBeVisible();
    }
    await game.getByTestId('tab-map').click();
    await expect(game.getByTestId('map-canvas')).toBeVisible();
  });

  test('repair a generator from the inspector and hire a technician', async ({ game }) => {
    await dev(game, 'd.money(1000)');
    await game.getByTestId('catalog-wind_micro').click();
    const [x, y] = await freeTile(game);
    await clickTile(game, x, y);
    await game.keyboard.press('Escape');
    await dev(game, `const m = e.state.maps.backyard; Object.values(m.buildings).find((b) => b.def === 'wind_micro').condition = 0.5; e.emit();`);
    await clickTile(game, x, y);
    await game.getByTestId('repair').click();
    expect(await state<number>(game, `Object.values(s.maps.backyard.buildings).find((b) => b.def === 'wind_micro').condition`)).toBe(1);
    await game.getByTestId('tab-workforce').click();
    await game.getByTestId('hire-technician-backyard').click();
    expect(await state<number>(game, 's.maps.backyard.workforce.technician')).toBe(1);
  });

  test('keyboard: speed, screens, maps and side-panel tabs', async ({ game }) => {
    await game.keyboard.press('t');
    expect(await state<number>(game, 's.speed')).toBe(1); // locked until the game is won
    await dev(game, `e.state.achievements.convergence = 1; e.emit();`);
    await game.keyboard.press('t');
    expect(await state<number>(game, 's.speed')).toBe(2);
    await game.keyboard.press('t');
    expect(await state<number>(game, 's.speed')).toBe(1);
    await game.keyboard.press('2');
    await expect(game.getByTestId('research-screen')).toBeVisible();
    await game.keyboard.press('ArrowLeft');
    await expect(game.getByTestId('tab-map')).toHaveAttribute('aria-selected', 'true');
    await game.keyboard.press('ArrowLeft'); // wraps past Map to the last tab
    await expect(game.getByTestId('shortcuts-screen')).toBeVisible();
    await game.keyboard.press('ArrowLeft');
    await expect(game.getByTestId('help-screen')).toBeVisible();
    await game.getByLabel('Search help').fill('reservoir');
    await expect(game.getByTestId('help-screen').getByText('Dams & flooding')).toHaveCount(2); // topic chip + card
    await game.getByLabel('Search help').blur();
    await game.keyboard.press('ArrowRight');
    await game.keyboard.press('ArrowRight');
    await expect(game.getByTestId('tab-map')).toHaveAttribute('aria-selected', 'true');
    await game.keyboard.press('1');
    await game.keyboard.press('ArrowDown'); // only the Backyard is open → requirements for the next map
    await expect(game.getByTestId('tab-progress')).toHaveAttribute('aria-selected', 'true');
    await dev(game, `d.unlock('neighborhood')`);
    await game.keyboard.press('1');
    await game.keyboard.press('ArrowDown');
    await expect(game.getByTestId('stage-neighborhood')).toHaveAttribute('aria-current', 'true');
    await game.keyboard.press('ArrowUp');
    await expect(game.getByTestId('stage-backyard')).toHaveAttribute('aria-current', 'true');
    await game.keyboard.press('q');
    await expect(game.getByTestId('tab-overview')).toHaveAttribute('aria-selected', 'true');
    await game.keyboard.press('q');
    await expect(game.getByTestId('tab-build')).toHaveAttribute('aria-selected', 'true');
  });

  test('shift+drag places a row of buildings', async ({ game }) => {
    await dev(game, `d.money(1e6); d.ownAll('backyard');`);
    const row = await state<[number, number, number]>(game, `(() => { const m = s.maps.backyard; for (let y = 0; y < m.h; y++) for (let x = 0; x + 3 < m.w; x++) { let ok = true; for (let k = 0; k < 4; k++) { const i = y * m.w + x + k; if (m.occ[i] || m.terrain[i] !== 'grass') ok = false; } if (ok) return [x, y, Object.keys(m.buildings).length]; } return null; })()`);
    await game.getByTestId('catalog-pv_rooftop').click();
    const a = await game.evaluate(([x, y]) => (window as unknown as { __eeTile: (x: number, y: number) => [number, number] }).__eeTile(x, y), [row[0], row[1]]);
    const b = await game.evaluate(([x, y]) => (window as unknown as { __eeTile: (x: number, y: number) => [number, number] }).__eeTile(x, y), [row[0] + 3, row[1]]);
    await game.mouse.move(a[0], a[1]);
    await game.keyboard.down('Shift');
    await game.mouse.down();
    await game.mouse.move(b[0], b[1], { steps: 5 });
    await expect(game.getByTestId('row-preview')).toContainText('4 ×');
    await game.mouse.up();
    await game.keyboard.up('Shift');
    expect(await state<number>(game, 'Object.keys(s.maps.backyard.buildings).length')).toBe(row[2] + 4);
  });

  test('styled tooltips replace native titles', async ({ game }) => {
    await game.getByLabel('Zoom in').hover();
    await expect(game.getByTestId('tip')).toHaveText('Zoom in (+)');
    await game.getByTestId('stage-city').hover();
    await expect(game.getByTestId('tip')).toContainText('City — locked');
    await game.mouse.move(600, 600);
    await expect(game.getByTestId('tip')).toHaveCount(0);
  });

  test('build catalog hover card shows details', async ({ game }) => {
    await game.getByTestId('catalog-pv_rooftop').hover();
    await expect(game.getByTestId('catalog-tip')).toContainText('Follows daylight');
    await expect(game.getByTestId('catalog-tip')).toContainText('Capacity');
    await game.getByTestId('catalog-battery_home').hover();
    await expect(game.getByTestId('catalog-tip')).toContainText('Round-trip efficiency');
    await game.mouse.move(600, 600);
    await expect(game.getByTestId('catalog-tip')).toHaveCount(0);
  });

  test('top bar pills show live breakdown tooltips', async ({ game }) => {
    await game.getByTestId('money').hover();
    await expect(game.getByTestId('money-tip')).toContainText('Net');
    await game.getByTestId('power').hover();
    await expect(game.getByTestId('power-tip')).toContainText('Producing now');
    await game.mouse.move(600, 600);
    await expect(game.getByTestId('power-tip')).toHaveCount(0);
  });

  test('automation settings change policy', async ({ game }) => {
    await game.getByTestId('tab-automation').click();
    await game.getByLabel('Pause all automation (repairs, refuelling, purchasing, PPA renewal)').check();
    expect(await state<boolean>(game, 's.automationPaused')).toBe(true);
  });

  test('research: start a project from the research screen', async ({ game }) => {
    await dev(game, 'd.money(500)');
    await game.getByTestId('tab-research').click();
    await expect(game.getByTestId('research-tree')).toBeVisible();
    await game.getByTestId('node-solar_1').click();
    await game.getByTestId('start-solar_1').click();
    expect(await state<boolean>(game, `s.research.active.solar_1 !== undefined`)).toBe(true);
    await expect(game.getByTestId('node-solar_1')).toContainText('%');
    // repeatable research for the area levels up and keeps running
    await game.getByTestId('node-rep_backyard').click();
    await game.getByTestId('start-rep_backyard').click();
    await dev(game, `e.state.research.progress.rep_backyard = 1e9; e.tick(); e.emit();`);
    expect(await state<number>(game, 's.research.levels.rep_backyard')).toBe(1);
    expect(await state<boolean>(game, `s.research.active.rep_backyard !== undefined`)).toBe(true);
    await expect(game.getByTestId('node-rep_backyard')).toContainText('Lv 1');
    // view and filters persist across tab switches and reloads
    await game.getByTestId('view-list').click();
    await game.getByLabel('Filter by status').selectOption('available');
    await game.getByTestId('tab-map').click();
    await game.getByTestId('tab-research').click();
    await expect(game.getByTestId('research-tree')).toHaveCount(0);
    await expect(game.getByLabel('Filter by status')).toHaveValue('available');
    await game.reload();
    await game.getByTestId('tab-research').click();
    await expect(game.getByLabel('Filter by status')).toHaveValue('available');
    await expect(game.getByTestId('view-list')).toHaveClass(/active/);
  });

  test('prerequisite links open the required research and building', async ({ game }) => {
    await game.getByTestId('tab-research').click();
    await game.getByTestId('view-list').click();
    await game.getByLabel('Search research').fill('Panel Cleaning');
    await expect(game.getByTestId('research-solar_1')).toHaveCount(0);
    await game.getByTestId('research-solar_2').getByTestId('goto-research-solar_1').first().click();
    await expect(game.getByTestId('research-solar_1')).toBeVisible();
    await expect(game.getByLabel('Search research')).toHaveValue('');
    // a research effect links to the building it unlocks; once researched the link arms placement
    await dev(game, `d.research('solar_1')`);
    await game.getByTestId('research-solar_1').getByTestId('goto-building-pv_improved').click();
    await expect(game.getByTestId('catalog-pv_improved')).toBeVisible();
    await expect(game.getByTestId('catalog-pv_improved')).toHaveAttribute('aria-pressed', 'true');
  });

  test('battery: build storage and change its operating mode', async ({ game }) => {
    await dev(game, `d.money(1000); d.research('storage_1', 'storage_2', 'storage_3');`);
    await game.getByTestId('catalog-battery_home').click();
    const [x, y] = await freeTile(game);
    await clickTile(game, x, y);
    await game.keyboard.press('Escape');
    await clickTile(game, x, y);
    await game.getByLabel('Storage mode').selectOption('peak');
    expect(await state<string>(game, `Object.values(s.maps.backyard.buildings).find((b) => b.def === 'battery_home').storageMode`)).toBe('peak');
  });

  test('fuel: unlock neighborhood, build diesel, order a timed delivery', async ({ game }) => {
    await dev(game, `d.money(1e6); d.unlock('neighborhood'); d.ownAll('neighborhood');`);
    await game.getByTestId('stage-neighborhood').click();
    await game.getByTestId('catalog-diesel_gen').click();
    const [x, y] = await freeTile(game, 'neighborhood');
    await clickTile(game, x, y);
    await game.keyboard.press('Escape');
    await game.getByTestId('tab-fuel').click();
    await game.getByLabel('Fuel', { exact: true }).selectOption('diesel');
    await game.getByTestId('buy-fuel').click();
    expect(await state<number>(game, `s.maps.neighborhood.logisticsJobs.length`)).toBe(1);
    await expect(game.getByText('Delivery', { exact: true })).toBeVisible();
  });

  test('switching maps keeps every map simulating', async ({ game }) => {
    await dev(game, `d.unlock('neighborhood');`);
    await resume(game);
    await game.getByTestId('stage-neighborhood').click();
    const t0 = await state<number>(game, 's.time');
    await game.waitForTimeout(1500);
    expect(await state<number>(game, 's.maps.neighborhood.flow.demand')).toBeGreaterThan(0);
    expect(await state<number>(game, 's.maps.backyard.flow.demand')).toBeGreaterThan(0);
    await game.getByTestId('stage-backyard').click();
    await game.waitForTimeout(800);
    expect(await state<number>(game, 's.time')).toBeGreaterThan(t0 + 0.1);
    expect(await state<number>(game, 's.maps.neighborhood.totals.revenue')).toBeGreaterThan(0);
  });

  test('progression: milestones met → expand to the Neighborhood via the UI', async ({ game }) => {
    await dev(game, `d.money(5000); d.research('solar_1', 'storage_1'); e.state.run.sold = 1000; const m = e.state.maps.backyard; m.workforce.technician = 1; m.owned = m.owned.map(() => 1); e.emit();`);
    for (let k = 0; k < 8; k++) {
      const [x, y] = await freeTile(game);
      await game.evaluate(([x, y]) => (window as unknown as { __ee: { cmd: (c: unknown) => unknown } }).__ee.cmd({ type: 'place', map: 'backyard', def: 'pv_improved', x, y, rot: 0 }), [x, y]);
    }
    await game.getByTestId('tab-progress').click();
    await game.getByTestId('unlock-neighborhood').click();
    expect(await state<boolean>(game, '!!s.maps.neighborhood')).toBe(true);
  });

  test('save, reload and keep progress (offline summary appears after an absence)', async ({ game }) => {
    await dev(game, 'd.money(4321)');
    await game.getByTestId('tab-settings').click();
    await game.getByTestId('save-now').click();
    await game.waitForTimeout(300);
    // pretend the save is 10 minutes old
    await game.evaluate(async () => {
      const w = window as unknown as { __ee: { engine: { state: { savedAt: number } }; saves: { save: (s: unknown) => Promise<void> } } };
      const st = w.__ee.engine.state;
      await w.__ee.saves.save(st);
      const req = indexedDB.open('energy-empire', 1);
      await new Promise<void>((res) => (req.onsuccess = () => res()));
      const db = req.result;
      const tx = db.transaction('saves', 'readwrite');
      const os = tx.objectStore('saves');
      const g = os.get('primary');
      await new Promise<void>((res) => (g.onsuccess = () => res()));
      const v = g.result;
      const data = JSON.parse(v.data);
      data.savedAt -= 600_000;
      v.data = JSON.stringify(data);
      // recompute checksum like the game does (FNV-1a)
      let h = 0x811c9dc5;
      for (let i = 0; i < v.data.length; i++) {
        h ^= v.data.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      v.checksum = (h >>> 0).toString(16).padStart(8, '0');
      os.put(v, 'primary');
      await new Promise<void>((res) => (tx.oncomplete = () => res()));
    });
    await game.reload();
    await game.waitForSelector('[data-testid=map-canvas]');
    await expect(game.getByTestId('offline-summary')).toBeVisible();
    await expect(game.getByTestId('offline-summary')).toContainText('Electricity produced');
    await game.getByTestId('offline-dismiss').click();
    expect(await state<number>(game, 's.money')).toBeGreaterThan(4000);
  });

  test('export and import a save file', async ({ game }, info) => {
    await dev(game, 'd.money(98765)');
    await game.getByTestId('tab-settings').click();
    const [download] = await Promise.all([game.waitForEvent('download'), game.getByTestId('export-save').click()]);
    const path = info.outputPath('save.json');
    await download.saveAs(path);
    await dev(game, 'd.money(1)');
    await game.getByTestId('import-input').setInputFiles(path);
    await expect(game.getByText('Save imported.')).toBeVisible();
    expect(await state<number>(game, 's.money')).toBe(98765);
    // invalid file is rejected
    await game.getByTestId('import-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}') });
    await expect(game.getByText(/Import failed/)).toBeVisible();
    expect(await state<number>(game, 's.money')).toBe(98765);
  });

  test('prestige with typed confirmation, then buy an upgrade', async ({ game }) => {
    await dev(game, 'e.state.prestige.lifetimeRevenue = 1e9; e.emit();');
    await game.getByTestId('tab-prestige').click();
    await game.getByTestId('prestige-open').click();
    await expect(game.getByTestId('prestige-confirm')).toBeDisabled();
    await game.getByTestId('prestige-typed').fill('PRESTIGE');
    await game.getByTestId('prestige-confirm').click();
    expect(await state<number>(game, 's.prestige.available')).toBe(10);
    await game.getByTestId('tab-prestige').click();
    await game.getByTestId('pbuy-p_revenue').click();
    expect(await state<number>(game, 's.prestige.upgrades.p_revenue')).toBe(1);
  });

  test('blueprints: save a layout, prestige, rebuild a valid subset manually', async ({ game }) => {
    await dev(game, 'd.money(1000)');
    for (let k = 0; k < 3; k++) {
      const [x, y] = await freeTile(game);
      await game.evaluate(([x, y]) => (window as unknown as { __ee: { cmd: (c: unknown) => unknown } }).__ee.cmd({ type: 'place', map: 'backyard', def: 'pv_rooftop', x, y, rot: 0 }), [x, y]);
    }
    await game.getByTestId('tab-blueprints').click();
    await game.getByTestId('bp-name').fill('Starter');
    await game.getByTestId('bp-save').click();
    await dev(game, `e.state.prestige.lifetimeRevenue = 1e8; e.dispatch({ type: 'prestige', confirm: 'PRESTIGE' }); d.money(1000);`);
    await game.getByTestId('tab-blueprints').click();
    await game.locator('[data-testid^=bp-place-]').first().click();
    const anchor = await state<[number, number]>(game, '[s.blueprints[0].items.reduce((a, i) => Math.min(a, i.dx), 9) + 5, 2]');
    await clickTile(game, anchor[0], anchor[1]);
    await game.getByTestId('bp-apply-subset').click();
    expect(await state<number>(game, 'Object.keys(s.maps.backyard.buildings).length')).toBeGreaterThan(1);
  });

  test('fullscreen enters and exits; layout stays interactive', async ({ game }) => {
    await game.getByTestId('fullscreen').click();
    await game.waitForTimeout(300);
    const fs = await game.evaluate(() => !!document.fullscreenElement);
    if (fs) {
      await expect(game.getByLabel('Exit fullscreen')).toBeVisible();
      await game.getByLabel('Exit fullscreen').click();
      await game.waitForTimeout(300);
      expect(await game.evaluate(() => !!document.fullscreenElement)).toBe(false);
    } else {
      await expect(game.getByTestId('toast')).toContainText(/Fullscreen/);
    }
    await game.getByTestId('catalog-pv_rooftop').click();
    const [x, y] = await freeTile(game);
    await clickTile(game, x, y);
    expect(await state<number>(game, 'Object.keys(s.maps.backyard.buildings).length')).toBe(2);
  });

  test('responsive: no horizontal page scroll at common sizes, resizing during placement', async ({ game }) => {
    await game.getByTestId('catalog-pv_rooftop').click();
    for (const [w, h] of [[1280, 720], [1366, 768], [1920, 1080], [2560, 1440], [390, 844], [820, 1180]]) {
      await game.setViewportSize({ width: w, height: h });
      await game.waitForTimeout(150);
      const over = await game.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over, `${w}x${h}`).toBeLessThanOrEqual(0);
      await expect(game.getByTestId('map-canvas')).toBeVisible();
    }
    await game.setViewportSize({ width: 1440, height: 900 });
    expect(await state<string>(game, 'window.__ee.ui.getState().mode.kind')).toBe('build');
  });
});
