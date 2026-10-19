import { TERRAIN } from '../data/terrain';
import type { TerrainId } from '../data/types';
import { orbitalFactor, pulsarFactor, riverFactor, seasonName, solarFactor, tidalFactor, windPower, windSpeed } from '../core/GameClock';
import { STAGES } from '../data/stages';
import type { MapState } from '../core/State';
import { rectTiles } from '../world/TileGrid';
import { footprint } from '../world/BuildingFootprints';
import type { BuildingInstance } from '../core/State';
import type { Def } from '../core/Helpers';

/**
 * Weather events: heatwaves, storms and droughts on terrestrial maps. They are deterministic
 * (seeded per map and 4-day block), so they're announced ahead and online/offline agree.
 */
export type WeatherKind = 'heatwave' | 'storm' | 'drought';
export interface WeatherEvent { kind: WeatherKind; start: number; end: number }
export interface WeatherDef {
  name: string;
  desc: string;
  /** multipliers */
  solar: number;
  wind: number;
  river: number;
  demand: number;
  cooling: number;
  /** condition-loss multiplier for wind and solar installations */
  wear: number;
}
export const WEATHER: Record<WeatherKind, WeatherDef> = {
  heatwave: { name: 'Heatwave', desc: 'Air conditioning pushes demand up ~12%; hot panels lose a little output and warm water weakens thermal cooling.', solar: 0.94, wind: 1, river: 0.9, demand: 1.12, cooling: 0.88, wear: 1 },
  storm: { name: 'Storm', desc: 'Gusts force turbines to feather (~50% output), clouds halve solar, and wind/solar gear wears 2.5× faster. Rivers swell.', solar: 0.5, wind: 0.5, river: 1.15, demand: 1.03, cooling: 1, wear: 2.5 },
  drought: { name: 'Drought', desc: 'River flow drops to ~60% (hydro output falls) and low, warm water weakens thermal cooling.', solar: 1.05, wind: 0.95, river: 0.6, demand: 1.03, cooling: 0.85, wear: 1 },
};
const BLOCK_H = 96;
const DUR: Record<WeatherKind, [number, number]> = { heatwave: [24, 48], storm: [6, 14], drought: [48, 80] };
const ODDS: Record<string, [WeatherKind, number][]> = {
  Spring: [['storm', 0.5], ['drought', 0.25], ['heatwave', 0.25]],
  Summer: [['heatwave', 0.5], ['drought', 0.3], ['storm', 0.2]],
  Autumn: [['storm', 0.65], ['drought', 0.25], ['heatwave', 0.1]],
  Winter: [['storm', 1]],
};
function rnd(seed: number, k: number, salt: number): number {
  let h = (seed * 374761393 + k * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** The (at most one) event of a 4-day block; none in the first block of a map's life. */
function blockEvent(seed: number, k: number): WeatherEvent | null {
  if (k < 1 || rnd(seed, k, 1) > 0.4) return null;
  const t0 = k * BLOCK_H;
  const odds = ODDS[seasonName(t0 + BLOCK_H / 2)];
  let r = rnd(seed, k, 2), kind = odds[0][0];
  for (const [kd, p] of odds) if ((r -= p) <= 0) { kind = kd; break; }
  const [lo, hi] = DUR[kind];
  const dur = lo + (hi - lo) * rnd(seed, k, 3);
  const start = t0 + (BLOCK_H - dur) * rnd(seed, k, 4);
  return { kind, start, end: start + dur };
}
const hasWeather = (m: MapState) => !STAGES[m.id].space;
export function weatherAt(m: MapState, t: number): WeatherEvent | null {
  if (!hasWeather(m)) return null;
  const ev = blockEvent(m.seed, Math.floor(t / BLOCK_H));
  return ev && t >= ev.start && t < ev.end ? ev : null;
}
/** Next event starting within `horizonH` (for warnings and the forecast chip). */
export function nextWeather(m: MapState, t: number, horizonH = 24): WeatherEvent | null {
  if (!hasWeather(m)) return null;
  const k = Math.floor(t / BLOCK_H);
  for (const ev of [blockEvent(m.seed, k), blockEvent(m.seed, k + 1)]) if (ev && ev.start > t && ev.start <= t + horizonH) return ev;
  return null;
}

/** Deterministic environment for a map at time t (incl. the active weather event). */
export interface Env {
  solar: number;
  solarSmooth: number;
  wind: number;
  /** Turbine output multiplier from weather (storms feather the blades). */
  windOut: number;
  river: number;
  tide: number;
  orbital: number;
  demand: number;
  t: number;
  event: WeatherEvent | null;
}

export function envAt(m: MapState, t: number): Env {
  const event = weatherAt(m, t);
  const w = event ? WEATHER[event.kind] : null;
  return {
    solar: solarFactor(t) * (w?.solar ?? 1), solarSmooth: solarFactor(t, true) * (w?.solar ?? 1), wind: windSpeed(t, m.seed), windOut: w?.wind ?? 1,
    river: riverFactor(t) * (w?.river ?? 1), tide: tidalFactor(t), orbital: orbitalFactor(t), demand: w?.demand ?? 1, t, event,
  };
}

const tileCache = new WeakMap<BuildingInstance, { k: number; t: number[]; solar: number; wind: number }>();
function site(m: MapState, b: BuildingInstance, d: Def) {
  const k = b.x * 1e6 + b.y * 10 + b.rot + m.w * 1e9 + (d.size[0] * 7 + d.size[1]) * 1e12;
  let c = tileCache.get(b);
  if (!c || c.k !== k) {
    const [w, h] = footprint(d, b.rot);
    const t = rectTiles(b.x, b.y, w, h, m.w);
    c = { k, t, solar: avgTerrain(m, t, (x) => TERRAIN[x].solar), wind: avgTerrain(m, t, (x) => TERRAIN[x].wind) };
    tileCache.set(b, c);
  }
  return c;
}
export const tilesOf = (m: MapState, b: BuildingInstance, d: Def) => site(m, b, d).t;
export const siteSolar = (m: MapState, b: BuildingInstance, d: Def) => site(m, b, d).solar;
export const siteWind = (m: MapState, b: BuildingInstance, d: Def) => site(m, b, d).wind;

export function avgTerrain(m: MapState, tiles: number[], f: (t: TerrainId) => number): number {
  let s = 0;
  for (const i of tiles) s += f(m.terrain[i]);
  return s / Math.max(1, tiles.length);
}

/** Solar resource multiplier for a footprint (desert +30%, forest −25%…). */
export const solarSite = (m: MapState, tiles: number[]) => avgTerrain(m, tiles, (t) => TERRAIN[t].solar);
export const windSite = (m: MapState, tiles: number[]) => avgTerrain(m, tiles, (t) => TERRAIN[t].wind);

export { windPower, pulsarFactor };
