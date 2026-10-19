import { BALANCE } from '../data/balance';
import { STAGES } from '../data/stages';
import { spotFactor } from '../core/GameClock';
import { hasFeature, mod } from '../core/Modifiers';
import { traderBonus } from '../core/Helpers';
import type { GameState, MapState } from '../core/State';

export interface PriceNow {
  export: number;
  import: number;
  spot: boolean;
  factor: number;
}

/** Fixed tariffs by default; smooth dynamic spot prices once researched and selected per map. */
export function pricesAt(s: GameState, m: MapState, t: number): PriceNow {
  const st = STAGES[m.id];
  const spot = m.policies.tariff === 'spot' && m.id !== 'backyard' && hasFeature(s, 'market.spot');
  const f = spot ? spotFactor(t, m.seed, BALANCE.spotAmplitude) : 1;
  const uplift = mod(s, 'market.price') * (1 + traderBonus(s));
  return { export: st.export * f * uplift, import: st.import * f, spot, factor: f };
}

export function nextGridLevel(m: MapState) {
  return STAGES[m.id].grid[m.gridLevel + 1] ?? null;
}
