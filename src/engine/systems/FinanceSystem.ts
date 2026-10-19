import { EMPLOYEES } from '../data/employees';
import { STAGES } from '../data/stages';
import { mapAgg } from '../core/Helpers';
import { mod } from '../core/Modifiers';
import type { GameState, LedgerKey, MapState } from '../core/State';

/** Income keys that are electricity *sales* (prestige basis). Savings are never sales. */
const SALES: LedgerKey[] = ['sales'];

export function earn(s: GameState, m: MapState | null, key: LedgerKey, amount: number) {
  if (!(amount > 0)) return;
  s.money += amount;
  s.ledger[key] += amount;
  if (m) {
    m.ledger[key] += amount;
    if (key !== 'savings') m.totals.revenue += amount;
  }
  if (SALES.includes(key)) {
    s.prestige.lifetimeRevenue += amount;
    s.run.revenue += amount;
    s.lifetime.revenue += amount;
  }
}

export function spend(s: GameState, m: MapState | null, key: LedgerKey, amount: number) {
  if (!(amount > 0)) return;
  s.money -= amount;
  s.ledger[key] += amount;
  if (m) {
    m.ledger[key] += amount;
    m.totals.expenses += amount;
  }
}

export const canAfford = (s: GameState, amount: number) => Number.isFinite(amount) && amount >= 0 && s.money >= amount;

/** Hourly wage bill of a map's crews (scaled by stage) — $/h. */
/** Tight-margins challenge: running costs +50%. */
const tight = (s: GameState) => (s.challenge === 'tight' ? 1.5 : 1);

export function mapWages(s: GameState, m: MapState): number {
  let w = 0;
  for (const [tier, n] of Object.entries(m.workforce)) if (EMPLOYEES[tier]) w += EMPLOYEES[tier].wage * n;
  return w * STAGES[m.id].scale * mod(s, 'wages') * tight(s);
}

export function globalWages(s: GameState): number {
  let w = 0;
  for (const [tier, n] of Object.entries(s.workforce)) if (EMPLOYEES[tier]) w += EMPLOYEES[tier].wage * n;
  return w * mod(s, 'wages') * tight(s);
}

/** Fixed operating costs ($/h): grid connection + O&M of installations. */
export function mapOpex(s: GameState, m: MapState): number {
  return (STAGES[m.id].grid[m.gridLevel].opex + mapAgg(m).opex) * tight(s);
}
