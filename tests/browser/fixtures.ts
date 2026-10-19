import { test as base, expect, type Page } from '@playwright/test';

/** Each test gets a fresh game (IndexedDB cleared) and console-error tracking. */
export const test = base.extend<{ game: Page; errors: string[] }>({
  errors: async ({}, use) => {
    await use([]);
  },
  game: async ({ page, errors }, use) => {
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto('/?debug');
    await page.evaluate(async () => {
      await new Promise<void>((res) => {
        const r = indexedDB.deleteDatabase('energy-empire');
        r.onsuccess = r.onerror = r.onblocked = () => res();
      });
      localStorage.clear();
    });
    await page.reload();
    await page.waitForSelector('[data-testid=map-canvas]');
    await page.waitForFunction(() => !!(window as unknown as { __ee?: unknown }).__ee);
    // deterministic by default; tests that need time flow resume explicitly
    await page.evaluate(() => (window as unknown as { __ee: { cmd: (c: unknown) => void } }).__ee.cmd({ type: 'pause', paused: true }));
    await use(page);
  },
});

export { expect };

export async function clickTile(page: Page, x: number, y: number) {
  const [cx, cy] = await page.evaluate(([x, y]) => (window as unknown as { __eeTile: (x: number, y: number) => [number, number] }).__eeTile(x, y), [x, y]);
  await page.mouse.move(cx, cy);
  await page.mouse.click(cx, cy);
}

export async function state<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(`(() => { const s = window.__ee.engine.state; return (${fn}); })()`) as Promise<T>;
}

export async function dev(page: Page, js: string) {
  await page.evaluate(`(() => { const d = window.__ee.dev; const e = window.__ee.engine; ${js} })()`);
}

/** First owned, free, grass tile on the current map. */
export async function freeTile(page: Page, map = 'backyard', terrain = 'grass'): Promise<[number, number]> {
  return state(page, `(() => { const m = s.maps['${map}']; for (let i = 0; i < m.w * m.h; i++) if (m.owned[i] && !m.occ[i] && m.terrain[i] === '${terrain}') return [i % m.w, Math.floor(i / m.w)]; return null; })()`);
}

export async function resume(page: Page) {
  await page.evaluate(() => (window as unknown as { __ee: { cmd: (c: unknown) => void } }).__ee.cmd({ type: 'pause', paused: false }));
}
