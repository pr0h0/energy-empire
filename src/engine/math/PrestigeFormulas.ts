import { PRESTIGE_FORMULA } from '../data/balance';

/**
 * entitled = floor((lifetimeRevenue / divisor) ^ exponent), evaluated in log space so
 * astronomically large revenue never overflows. Constants live in balance config.
 */
export function entitledPoints(lifetimeRevenue: number, f = PRESTIGE_FORMULA): number {
  if (!(lifetimeRevenue > 0)) return 0;
  const v = Math.exp(f.exponent * (Math.log(lifetimeRevenue) - Math.log(f.divisor)));
  // tiny epsilon guards against 2.9999999 when the exact answer is 3
  return Number.isFinite(v) ? Math.floor(v + 1e-9) : Number.MAX_SAFE_INTEGER;
}

export function claimablePoints(lifetimeRevenue: number, previouslyAwarded: number): number {
  return Math.max(0, entitledPoints(lifetimeRevenue) - previouslyAwarded);
}

/** Lifetime revenue needed for `points` entitlement (inverse formula, for UI goals). */
export function revenueForPoints(points: number, f = PRESTIGE_FORMULA): number {
  return f.divisor * Math.pow(points, 1 / f.exponent);
}
