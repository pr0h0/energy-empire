import { BALANCE } from '../data/balance';
import { STAGES } from '../data/stages';
import { TERRAIN } from '../data/terrain';
import { hasFeature, mod } from '../core/Modifiers';
import type { GameState, MapState } from '../core/State';
import { inBounds, idx, neighbors4 } from '../world/TileGrid';
import { canAfford, spend } from './FinanceSystem';

/** Land price: stage base × terrain multiplier × gentle growth with owned area. */
export function landPrice(s: GameState, m: MapState, i: number): number {
  return landQuote(s, m, [i]);
}

/** Price of buying `tiles` one after another (each purchase raises the next price). */
export function landQuote(s: GameState, m: MapState, tiles: number[]): number {
  const owned = m.owned.reduce((a, b) => a + b, 0);
  const st = STAGES[m.id];
  const start = st.startOwned[2] * st.startOwned[3];
  return tiles.reduce((c, i, k) => c + st.landBase * TERRAIN[m.terrain[i]].priceMult * Math.pow(BALANCE.landGrowth, Math.max(0, owned + k - start)) * mod(s, 'land.cost'), 0);
}

export function landBlockReason(s: GameState, m: MapState, i: number): string | null {
  if (i < 0 || i >= m.w * m.h) return 'Out of bounds.';
  if (m.owned[i]) return 'Already owned.';
  const t = TERRAIN[m.terrain[i]];
  if (t.priceMult <= 0 || m.flooded[i]) return `${t.name} cannot be purchased.`;
  if (t.requires) {
    const feature = m.terrain[i] === 'ocean' ? 'terrain.ocean' : m.terrain[i] === 'mountain' ? 'terrain.mountain' : null;
    if (feature && !hasFeature(s, feature)) return `${t.name} requires ${feature === 'terrain.ocean' ? 'Offshore Engineering' : 'Mountain Engineering'} research.`;
  }
  if (!neighbors4(i, m.w, m.h).some((j) => m.owned[j])) return 'Must be adjacent to land you own.';
  return null;
}

export function buyLand(s: GameState, m: MapState, x: number, y: number): string | null {
  if (!inBounds(x, y, m.w, m.h)) return 'Out of bounds.';
  const i = idx(x, y, m.w);
  const why = landBlockReason(s, m, i);
  if (why) return why;
  const price = landPrice(s, m, i);
  if (!canAfford(s, price)) return 'Not enough money.';
  spend(s, m, 'land', price);
  m.owned[i] = 1;
  return null;
}

/** Every purchasable tile adjacent to current land, priced sequentially with a bulk discount. */
export function bulkLandQuote(s: GameState, m: MapState): { tiles: number[]; cost: number } {
  const tiles: number[] = [];
  for (let i = 0; i < m.w * m.h; i++) if (!landBlockReason(s, m, i)) tiles.push(i);
  return { tiles, cost: landQuote(s, m, tiles) * BALANCE.bulkLandDiscount };
}

export function buyLandBulk(s: GameState, m: MapState): string | null {
  if (!hasFeature(s, 'land.bulk')) return 'Requires Land Surveying research.';
  const q = bulkLandQuote(s, m);
  if (!q.tiles.length) return 'No purchasable adjacent land.';
  if (!canAfford(s, q.cost)) return 'Not enough money.';
  spend(s, m, 'land', q.cost);
  for (const i of q.tiles) m.owned[i] = 1;
  return null;
}
