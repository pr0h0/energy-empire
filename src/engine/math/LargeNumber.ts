/**
 * Numeric representation: IEEE-754 doubles. The largest values the game produces
 * (~1e45 W, ~1e30 money) are far below Number.MAX_VALUE (1.8e308), so doubles keep
 * ~15 significant digits everywhere. Formulas that could overflow (prestige power-law)
 * are evaluated in log space. This module centralises sanitising and formatting.
 */
export type NumberFormat = 'short' | 'scientific' | 'engineering';

/** Replace NaN/Infinity with a fallback so a bad calculation can never corrupt a save. */
export function safe(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid'];

export function formatNumber(n: number, fmt: NumberFormat = 'short', digits = 3): string {
  if (!Number.isFinite(n)) return '∞';
  const neg = n < 0;
  const a = Math.abs(n);
  let s: string;
  if (a < 1000) {
    s = a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(1) : a >= 1 ? a.toFixed(2) : a === 0 ? '0' : a >= 0.01 ? a.toFixed(3) : a.toExponential(1);
  } else if (fmt === 'scientific') {
    s = a.toExponential(digits - 1).replace('e+', 'e');
  } else {
    let tier = Math.floor(Math.log10(a) / 3 + 1e-12);
    // guard against log10 rounding and toPrecision rounding up to 1000 (e.g. 999.9K → 1.00M)
    if (Number((a / 10 ** (tier * 3)).toPrecision(digits)) >= 1000) tier++;
    if (fmt === 'engineering' || tier >= SUFFIXES.length) {
      const exp = tier * 3;
      s = `${(a / 10 ** exp).toPrecision(digits)}e${exp}`;
    } else {
      s = `${(a / 10 ** (tier * 3)).toPrecision(digits)}${SUFFIXES[tier]}`;
    }
  }
  return neg ? `-${s}` : s;
}

export function formatMoney(n: number, fmt: NumberFormat = 'short'): string {
  return `${n < 0 ? '-' : ''}$${formatNumber(Math.abs(n), fmt)}`;
}

export function formatPercent(f: number, digits = 0): string {
  return `${(f * 100).toFixed(digits)}%`;
}

export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}
