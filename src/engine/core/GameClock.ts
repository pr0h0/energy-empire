import { TIME } from '../data/balance';

/**
 * Deterministic environment clock. All curves are smooth closed-form functions of game time so
 * production is forecastable and online/offline simulation agree.
 */
export const hourOfDay = (t: number) => ((t % 24) + 24) % 24;
export const dayOf = (t: number) => Math.floor(t / 24);
export const seasonPhase = (t: number) => ((t / 24) % TIME.daysPerYear) / TIME.daysPerYear;
const TAU = Math.PI * 2;

export function seasonName(t: number): string {
  const p = seasonPhase(t);
  return p < 0.25 ? 'Spring' : p < 0.5 ? 'Summer' : p < 0.75 ? 'Autumn' : 'Winter';
}

export function formatClock(t: number): string {
  const h = hourOfDay(t);
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `Day ${dayOf(t) + 1} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Solar availability 0..~1.12 (day/night with modest seasonal day length and intensity). */
export function solarFactor(t: number, smooth = false): number {
  const s = Math.sin(TAU * (seasonPhase(t) - 0.125)); // peaks mid-summer
  const intensity = 1 + 0.1 * s;
  if (smooth) return 0.33 * intensity * (1 + 0.08 * Math.sin(TAU * hourOfDay(t) / 24)); // planetary belt across longitudes
  const dayLen = 12 + 1.6 * s;
  const rise = 12 - dayLen / 2;
  const h = hourOfDay(t);
  if (h <= rise || h >= rise + dayLen) return 0;
  return intensity * Math.sin((Math.PI * (h - rise)) / dayLen);
}

/** Normalised wind speed (mean ≈ 1). Sum of slow sinusoids: smooth and forecastable. */
export function windSpeed(t: number, seed: number): number {
  const p1 = (seed % 97) / 97, p2 = (seed % 53) / 53;
  return Math.max(0, 1 + 0.38 * Math.sin(TAU * (t / 31 + p1)) + 0.22 * Math.sin(TAU * (t / 7.3 + p2)) + 0.1 * Math.sin(TAU * ((hourOfDay(t) - 15) / 24)) + 0.08 * Math.sin(TAU * seasonPhase(t) + 1));
}

/** Turbine power curve: cut-in 0.3, rated 1.2, cut-out 2.4 (in units of mean wind speed). */
export function windPower(u: number): number {
  if (u < 0.3 || u > 2.4) return 0;
  if (u >= 1.2) return 1;
  const x = (u - 0.3) / 0.9;
  return x * x * x;
}

/** Seasonal river flow multiplier (spring melt peak). */
export function riverFactor(t: number): number {
  return Math.max(0.3, 1 + 0.35 * Math.sin(TAU * (seasonPhase(t) + 0.1)) + 0.05 * Math.sin(TAU * (t / 53)));
}

/** Tides: two highs and lows per 12.42 h, spring-neap modulation over ~14.8 days. */
export function tidalFactor(t: number): number {
  const base = Math.pow(Math.abs(Math.sin((TAU * t) / 12.42)), 1.5);
  return base * (0.85 + 0.15 * Math.cos((TAU * t) / (14.77 * 24)));
}

export function pulsarFactor(t: number, period: number): number {
  return 0.5 + 0.5 * Math.sin((TAU * t) / period);
}

/** Orbital collectors: near-continuous, brief eclipse dips around equinoxes. */
export function orbitalFactor(t: number): number {
  const eq = Math.abs(Math.cos(TAU * seasonPhase(t)));
  const h = hourOfDay(t);
  const eclipse = eq > 0.85 && Math.abs(h - 0) < 0.6 ? 0.3 : 0;
  return 0.97 - eclipse;
}

const g = (h: number, mu: number, sd: number) => Math.exp(-(((h - mu) / sd) ** 2));
const win = (h: number, a: number, b: number) => 1 / (1 + Math.exp(-(h - a) * 2)) - 1 / (1 + Math.exp(-(h - b) * 2));

const RAW: Record<string, (h: number) => number> = {
  household: (h) => 0.5 + 0.45 * g(h, 7.5, 1.6) + 0.85 * g(h, 19.5, 2.4),
  residential: (h) => 0.55 + 0.4 * g(h, 7.5, 1.8) + 0.75 * g(h, 19.5, 2.6),
  commercial: (h) => 0.35 + 0.95 * win(h, 8, 18),
  industrial: (h) => 0.85 + 0.2 * win(h, 6, 22),
  infrastructure: (h) => 0.85 + 0.3 * g(h, 18, 3) + 0.15 * g(h, 8, 2),
  advanced: (h) => 0.97 + 0.03 * Math.sin((TAU * h) / 24),
  planetary: (h) => 0.95 + 0.05 * Math.sin((TAU * h) / 24),
  interstellar: () => 1,
};
const MEAN: Record<string, number> = Object.fromEntries(
  Object.entries(RAW).map(([k, f]) => {
    let s = 0;
    for (let i = 0; i < 240; i++) s += f(i / 10);
    return [k, s / 240];
  }),
);

/** Demand profile with daily mean exactly 1. */
export function demandProfile(category: string, t: number): number {
  const f = RAW[category] ?? RAW.interstellar;
  return f(hourOfDay(t)) / MEAN[category];
}

/** Smooth spot price multiplier (daily mean ≈ 1): evening peak, midday solar dip, slow drift. */
export function spotFactor(t: number, seed: number, amplitude: number): number {
  const h = hourOfDay(t);
  const shape = 0.9 * g(h, 19, 2.5) + 0.35 * g(h, 8, 1.8) - 0.55 * g(h, 13, 2.5) - 0.25;
  const drift = 0.07 * Math.sin(TAU * (dayOf(t) / 9.3 + (seed % 11) / 11));
  return Math.max(0.4, 1 + amplitude * shape + drift);
}

export function fuelPriceFactor(t: number, volatility: number, phase: number): number {
  return 1 + volatility * (0.6 * Math.sin(TAU * (t / (24 * 17) + phase)) + 0.4 * Math.sin(TAU * (t / (24 * 5.3) + phase * 1.7)));
}
