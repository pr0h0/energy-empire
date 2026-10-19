import { CONTRACTS } from '../data/contracts';
import { STAGES } from '../data/stages';
import { demandProfile } from '../core/GameClock';
import { mod } from '../core/Modifiers';
import type { GameState, MapState } from '../core/State';

export interface DemandNow {
  kw: number;
  /** kW-weighted customer price per kWh (Backyard: avoided retail tariff). */
  price: number;
  household: boolean;
  /** Household income $/h (Backyard only). */
  income: number;
  byCategory: Record<string, number>;
}

/**
 * Local customer demand. Growth comes only from contracts the player signs (or home improvements),
 * so it is predictable and under player control.
 */
export function customerDemand(s: GameState, m: MapState, t: number): DemandNow {
  const st = STAGES[m.id];
  const household = m.id === 'backyard';
  const baseCat = household ? 'household' : 'residential';
  const byCategory: Record<string, number> = { [baseCat]: st.baseDemandKW * demandProfile(baseCat, t) };
  let kw = byCategory[baseCat];
  let value = kw * st.retail;
  let income = st.householdIncome ?? 0;
  for (const id of m.contracts) {
    const c = CONTRACTS[id];
    if (!c) continue;
    const d = c.kw * demandProfile(c.category, t);
    byCategory[c.category] = (byCategory[c.category] ?? 0) + d;
    kw += d;
    value += d * c.price;
    income += c.income ?? 0;
  }
  const price = (kw > 0 ? value / kw : st.retail) * (household ? 1 : mod(s, 'demand.price'));
  return { kw, price, household, income, byCategory };
}

/** Average (daily-mean) contracted demand, for UI. */
export function averageDemandKW(m: MapState): number {
  let kw = STAGES[m.id].baseDemandKW;
  for (const id of m.contracts) kw += CONTRACTS[id]?.kw ?? 0;
  return kw;
}
