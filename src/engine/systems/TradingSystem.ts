import { BALANCE } from '../data/balance';
import { FUELS } from '../data/fuels';
import { STAGES } from '../data/stages';
import type { FuelId, StageId } from '../data/types';
import { dayOf } from '../core/GameClock';
import { gridLimits, tradingCapacity, traderBonus } from '../core/Helpers';
import { hasFeature, mod } from '../core/Modifiers';
import type { GameState } from '../core/State';
import { notify } from '../core/GameEvents';
import { orderFuel } from './FuelSystem';
import { fuelPrice } from './ThermalSystem';

/**
 * Power purchase agreements (firm power sold at a fixed premium price, penalties for shortfall)
 * and long-term fuel supply contracts. Traders raise contract prices and the number of PPAs the
 * company can manage; algorithmic trading auto-renews expiring PPAs.
 */
export function ppaOffer(s: GameState, map: StageId) {
  const m = s.maps[map]!;
  const st = STAGES[map];
  const kw = gridLimits(s, m).exportKW * 0.25;
  const price = st.export * 1.18 * mod(s, 'market.price') * (1 + traderBonus(s));
  return { kw, price, durationH: BALANCE.ppaDurationH };
}

export function activePPAs(s: GameState) {
  return s.contracts.filter((c) => c.kind === 'power' && c.endsAt > s.time);
}

export function signPPA(s: GameState, map: StageId, fraction = 1): string | null {
  if (!hasFeature(s, 'market.contracts')) return 'Requires Power Purchase Agreements research.';
  const m = s.maps[map];
  if (!m) return 'Map locked.';
  if (activePPAs(s).length >= Math.floor(tradingCapacity(s))) return 'Not enough trading capacity — hire energy traders.';
  const o = ppaOffer(s, map);
  if (o.kw <= 0) return 'This map has no export capacity.';
  s.contracts.push({ id: `c${s.nextId++}`, kind: 'power', map, price: o.price, amount: o.kw * Math.max(0.05, Math.min(1, fraction)), endsAt: s.time + o.durationH, delivered: 0, shortfall: 0 });
  return null;
}

export function signFuelContract(s: GameState, map: StageId, fuel: FuelId, unitsPerDay: number, days = 10): string | null {
  if (!hasFeature(s, 'fuel.contracts')) return 'Requires Fuel Contracts research.';
  if (!s.maps[map]) return 'Map locked.';
  if (!(unitsPerDay > 0)) return 'Invalid volume.';
  s.contracts.push({ id: `c${s.nextId++}`, kind: 'fuel', map, fuel, price: fuelPrice(s, fuel) * 0.9, amount: unitsPerDay, endsAt: s.time + days * 24, delivered: 0, shortfall: 0 });
  return null;
}

export function cancelContract(s: GameState, id: string): string | null {
  const c = s.contracts.find((x) => x.id === id);
  if (!c) return 'No such contract.';
  c.endsAt = s.time;
  return null;
}

export function simulateTrading(s: GameState) {
  const day = dayOf(s.time);
  for (const c of s.contracts) {
    if (c.kind !== 'fuel' || c.endsAt <= s.time) continue;
    const m = s.maps[c.map];
    if (!m) continue;
    const last = s.lastEvents[`fc:${c.id}`];
    if (last !== undefined && dayOf(last) === day) continue;
    s.lastEvents[`fc:${c.id}`] = s.time;
    const r = orderFuel(s, m, c.fuel!, c.amount, true, c.price);
    if (r.ok) c.delivered += c.amount;
    else c.shortfall += c.amount;
  }
  // expiry, auto-renewal
  const expired = s.contracts.filter((c) => c.endsAt <= s.time);
  if (!expired.length) return;
  s.contracts = s.contracts.filter((c) => c.endsAt > s.time);
  for (const c of expired) {
    if (c.kind === 'power' && hasFeature(s, 'trading.auto') && !s.automationPaused && s.maps[c.map]) {
      signPPA(s, c.map);
      notify(s, `ppa:${c.id}`, 'info', 'market', `PPA on ${STAGES[c.map].name} renewed automatically.`, c.map);
    } else notify(s, `exp:${c.id}`, 'info', 'market', `${c.kind === 'power' ? 'Power purchase agreement' : `${FUELS[c.fuel!].name} supply contract`} on ${STAGES[c.map].name} expired.`, c.map);
  }
}
