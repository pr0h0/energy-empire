import { BALANCE } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { STAGES } from '../data/stages';
import { TERRAIN } from '../data/terrain';
import type { TerrainId } from '../data/types';
import { type Def, defOf, effectiveTerrain, terrainCostMult } from '../core/Helpers';
import { isBuildingUnlocked, mod } from '../core/Modifiers';
import type { BuildingInstance, GameState, MapState } from '../core/State';
import { notify } from '../core/GameEvents';
import { fleetCostFactor, representedUnits } from '../world/BuildingAggregation';
import { footprint } from '../world/BuildingFootprints';
import { newInstance } from '../world/MapManager';
import { idx, inBounds, neighbors4, rectBorder, rectTiles } from '../world/TileGrid';
import { canAfford, earn, spend } from './FinanceSystem';
import { landBlockReason, landPrice, landQuote } from './LandSystem';
import { tankCapacity } from './ThermalSystem';

/** Instant construction: validate → charge → building operates immediately. No timers or queues. */

export interface FloodPreview {
  tiles: number[];
  buildings: string[];
  /** Flooded tiles not yet owned; their land price (landCost) is bought with the dam. */
  unowned: number;
  landCost: number;
  volume: number;
}

export interface PlacementPreview {
  ok: boolean;
  reasons: string[];
  cost: number;
  units: number;
  kw: number;
  tiles: number[];
  w: number;
  h: number;
  notes: string[];
  flood?: FloodPreview;
  /** Unowned footprint tiles bought together with the building (cost is included). */
  land?: { tiles: number[]; cost: number };
}

export function constructionCost(s: GameState, m: MapState, d: Def, units: number, tiles: number[]): number {
  const scale = d.scaled ? STAGES[m.id].scale : 1;
  return d.unitCost * fleetCostFactor(units) * scale * mod(s, 'build.cost') * terrainCostMult(m, tiles);
}

export function maxFloodTiles(d: Def): number {
  return d.id === 'small_dam' ? 6 : d.id === 'large_dam' ? 10 : 14;
}

/** Discrete reservoir model: priority-flood upstream tiles below the crest elevation. */
export function floodArea(s: GameState, m: MapState, d: Def, x: number, y: number, ignoreDam?: string): FloodPreview {
  const st = STAGES[m.id];
  const elevM = (i: number) => m.elev[i] * st.elevRangeM;
  const dam = idx(x, y, m.w);
  const top = elevM(dam) + (d.gen?.crest ?? 0);
  // exclude everything downstream of the dam
  const downstream = new Set<number>();
  for (let c = m.riverNext[dam]; c >= 0 && !downstream.has(c); c = m.riverNext[c]) downstream.add(c);
  const frontier: number[] = [];
  for (let i = 0; i < m.w * m.h; i++) if (m.riverNext[i] === dam) frontier.push(i);
  if (!frontier.length) for (const j of neighbors4(dam, m.w, m.h)) if (!downstream.has(j)) frontier.push(j);
  const seen = new Set<number>([dam]);
  const tiles: number[] = [];
  const limit = maxFloodTiles(d);
  while (frontier.length && tiles.length < limit) {
    frontier.sort((a, b) => elevM(a) - elevM(b));
    const i = frontier.shift()!;
    if (seen.has(i)) continue;
    seen.add(i);
    const t = m.terrain[i];
    if (downstream.has(i) || t === 'ocean' || elevM(i) >= top) continue;
    if (m.flooded[i] && m.flooded[i] !== ignoreDam) continue;
    const occ = m.occ[i] ? m.buildings[m.occ[i]!] : null;
    if (occ && (defOf(occ).gen?.kind === 'dam' || defOf(occ).fixed)) continue;
    tiles.push(i);
    for (const j of neighbors4(i, m.w, m.h)) if (!seen.has(j)) frontier.push(j);
  }
  const cell = st.cellM * st.cellM;
  let volume = cell * Math.max(1, d.gen?.crest ?? 1) * 0.3;
  let landCost = 0, unowned = 0;
  const buildings = new Set<string>();
  for (const i of tiles) {
    volume += Math.max(0, top - elevM(i)) * cell * 0.5;
    if (!m.owned[i]) {
      landCost += landPrice(s, m, i);
      unowned++;
    }
    if (m.occ[i]) buildings.add(m.occ[i]!);
  }
  return { tiles, buildings: [...buildings], unowned, landCost, volume };
}

export function previewPlacement(s: GameState, m: MapState, defId: string, x: number, y: number, rot: 0 | 1): PlacementPreview {
  const d = BUILDINGS[defId];
  const reasons: string[] = [];
  const notes: string[] = [];
  if (!d) return { ok: false, reasons: ['Unknown building.'], cost: 0, units: 0, kw: 0, tiles: [], w: 1, h: 1, notes };
  const [w, h] = footprint(d, rot);
  if (d.fixed) reasons.push('This structure cannot be built.');
  if (!d.stages.includes(m.id)) reasons.push(`${d.name} cannot be built at ${STAGES[m.id].name} scale.`);
  if (!isBuildingUnlocked(s, defId)) reasons.push('Technology not yet researched.');
  if (s.challenge === 'no_fossil' && d.family === 'fossil') reasons.push('Fossil-free challenge: fossil plants cannot be built this run.');
  if (d.unique && Object.values(m.buildings).some((b) => b.def === defId)) reasons.push('Only one per map.');
  const oob = !inBounds(x, y, m.w, m.h) || !inBounds(x + w - 1, y + h - 1, m.w, m.h);
  if (oob) {
    reasons.push('Footprint extends beyond the map.');
    return { ok: false, reasons, cost: 0, units: 0, kw: 0, tiles: [], w, h, notes };
  }
  const tiles = rectTiles(x, y, w, h, m.w);
  let unowned = 0, occupied = 0, flooded = 0;
  const badTerrain = new Set<TerrainId>();
  for (const i of tiles) {
    if (!m.owned[i]) unowned++;
    if (m.occ[i]) occupied++;
    if (m.flooded[i]) flooded++;
    const t = effectiveTerrain(m, i);
    if (!d.terrain.includes(t)) badTerrain.add(t);
  }
  let land: PlacementPreview['land'];
  if (unowned) {
    const toBuy = tiles.filter((i) => !m.owned[i]);
    const ADJ = 'Must be adjacent to land you own.';
    const blocked = new Set(toBuy.map((i) => landBlockReason(s, m, i)).filter((r): r is string => !!r && r !== ADJ));
    // the footprint is a rectangle: if any of it touches owned land, all of it can be bought in one go
    const touches = unowned < tiles.length || toBuy.some((i) => neighbors4(i, m.w, m.h).some((j) => m.owned[j]));
    if (blocked.size) reasons.push(`Land can't be bought: ${[...blocked].join(' ')}`);
    else if (!touches) reasons.push(`${unowned} tile${unowned > 1 ? 's' : ''} not owned — the footprint must touch land you own to buy it.`);
    else land = { tiles: toBuy, cost: landQuote(s, m, toBuy) };
  }
  if (occupied) reasons.push('Tiles are occupied by another installation.');
  if (flooded && !badTerrain.size) reasons.push('Tiles are flooded by a reservoir.');
  if (badTerrain.size) reasons.push(`Unsuitable terrain: ${[...badTerrain].map((t) => TERRAIN[t].name).join(', ')}. Needs ${d.terrain.map((t) => TERRAIN[t].name).join(' / ')}.`);
  if (d.adjacent) {
    const border = rectBorder(x, y, w, h, m.w, m.h);
    if (!border.some((i) => d.adjacent!.includes(effectiveTerrain(m, i)))) reasons.push(`Must be next to ${d.adjacent.map((t) => TERRAIN[t].name).join(' / ')}.`);
  }
  const units = representedUnits(d, m.id, tiles.length, mod(s, 'density'));
  if (units < 1) reasons.push(`Footprint too small at this scale: one ${d.unit.label} needs ${d.unit.areaM2.toExponential(1)} m² of operating space.`);
  // terrain bonus notes for the tooltip/preview
  if (d.gen?.kind === 'solar' || d.gen?.kind === 'csp') {
    const k = tiles.reduce((a, i) => a + TERRAIN[m.terrain[i]].solar, 0) / tiles.length;
    if (Math.abs(k - 1) > 0.01) notes.push(`${k > 1 ? '+' : ''}${Math.round((k - 1) * 100)}% solar from terrain`);
  }
  if (d.gen?.kind === 'wind') {
    const k = tiles.reduce((a, i) => a + TERRAIN[m.terrain[i]].wind, 0) / tiles.length;
    if (Math.abs(k - 1) > 0.01) notes.push(`${k > 1 ? '+' : ''}${Math.round((k - 1) * 100)}% wind speed from terrain`);
  }
  if (d.terrainBonus) for (const i of tiles) if (d.terrainBonus[m.terrain[i]]) notes.push(`×${d.terrainBonus[m.terrain[i]]} output on ${TERRAIN[m.terrain[i]].name}`);
  if (d.thermal) {
    const border = rectBorder(x, y, w, h, m.w, m.h);
    const cool = Math.max(1, ...border.map((i) => TERRAIN[effectiveTerrain(m, i)].cooling ?? 1));
    notes.push(cool > 1 ? `Water cooling available (+${Math.round((cool - 1) * 100)}% cooling)` : 'No adjacent water: cooling may throttle output');
  }
  if (d.aggregate && units > 1) notes.push(`Represents ${units.toLocaleString()} × ${d.unit.label}`);
  let cost = (units >= 1 ? constructionCost(s, m, d, units, tiles) : 0) + (land?.cost ?? 0);
  let flood: FloodPreview | undefined;
  if (d.gen?.kind === 'dam' && !reasons.length) {
    flood = floodArea(s, m, d, x, y);
    cost += flood.landCost;
    if (flood.buildings.length) notes.push(`WARNING: flooding will remove ${flood.buildings.length} installation(s) (salvaged).`);
    notes.push(`Reservoir floods ${flood.tiles.length} tile(s), ${flood.volume.toExponential(2)} m³`);
  }
  if (!reasons.length && !canAfford(s, cost)) reasons.push('Not enough money.');
  const kw = d.unit.kw * Math.max(0, units);
  return { ok: reasons.length === 0, reasons, cost, units, kw, tiles, w, h, notes, flood, land };
}

export function placeBuilding(s: GameState, m: MapState, defId: string, x: number, y: number, rot: 0 | 1, acceptFlood = true, buyLand = false): { ok: boolean; error?: string; id?: string } {
  const p = previewPlacement(s, m, defId, x, y, rot);
  if (!p.ok) return { ok: false, error: p.reasons.join(' ') };
  if (p.flood?.buildings.length && !acceptFlood) return { ok: false, error: 'Flooding would remove installations; confirm to proceed.' };
  if (p.land && !buyLand) return { ok: false, error: `${p.land.tiles.length} tile(s) not owned; confirm the land purchase to build here.` };
  const d = BUILDINGS[defId];
  const landCost = p.land?.cost ?? 0;
  if (p.land) {
    spend(s, m, 'land', landCost);
    for (const i of p.land.tiles) m.owned[i] = 1;
  }
  spend(s, m, d.category === 'generation' || d.category === 'storage' ? 'construction' : 'infrastructure', p.cost - landCost);
  const id = `b${s.nextId++}`;
  const b = newInstance(id, defId, x, y, rot, p.units, p.cost - landCost);
  if (d.storage) {
    b.stored = 0;
    b.storageMode = m.policies.defaultStorageMode;
    b.reserve = 0.2;
    b.cycles = 0;
  }
  if (d.thermal) {
    b.tank = 0;
    b.target = 1;
    b.coolingMode = 'safe';
    b.mode = d.family === 'nuclear' || d.family === 'fusion' || d.family === 'stellar' || d.family === 'exotic' ? 'baseload' : 'follow';
    // first fill comes from the depot if available
    const f = d.thermal.fuel;
    const q = Math.min(tankCapacity(b, d), m.fuel[f] ?? 0);
    b.tank = q;
    m.fuel[f] = (m.fuel[f] ?? 0) - q;
  }
  if (p.flood) {
    for (const bid of p.flood.buildings) demolish(s, m, bid, true);
    for (const i of p.flood.tiles) {
      m.owned[i] = 1;
      m.flooded[i] = id;
    }
    b.reservoirMax = p.flood.volume;
    b.reservoir = 0;
    b.reservoirTarget = 0.75;
  }
  for (const i of p.tiles) m.occ[i] = id;
  m.buildings[id] = b;
  s.lifetime.buildings++;
  return { ok: true, id };
}

/** Salvage: depends on category, condition, age, aging, upgrades (in invested), research and prestige. */
export function salvageValue(s: GameState, b: BuildingInstance): number {
  const d = defOf(b);
  if (d.fixed) return 0;
  const age = 1 / (1 + b.ageH / 4000);
  const gross = b.invested * d.salvage * (0.4 + 0.6 * b.condition) * (1 - b.wearOut) * (0.5 + 0.5 * age) * mod(s, 'salvage');
  const value = Math.min(gross, b.invested * BALANCE.salvageCap) - b.invested * (d.decommission ?? 0);
  return value;
}

export function demolish(s: GameState, m: MapState, id: string, forced = false): { ok: boolean; error?: string; value?: number } {
  const b = m.buildings[id];
  if (!b) return { ok: false, error: 'No such installation.' };
  const d = defOf(b);
  if (d.fixed) return { ok: false, error: 'This structure cannot be demolished.' };
  const value = salvageValue(s, b);
  if (value < 0 && !forced && !canAfford(s, -value)) return { ok: false, error: `Decommissioning costs ${(-value).toFixed(0)} — not enough money.` };
  if (value >= 0) earn(s, m, 'salvage', value);
  else spend(s, m, 'salvage', -value);
  // return unburnt fuel to the depot
  if (d.thermal && (b.tank ?? 0) > 0) m.fuel[d.thermal.fuel] = (m.fuel[d.thermal.fuel] ?? 0) + (b.tank ?? 0);
  for (let i = 0; i < m.occ.length; i++) if (m.occ[i] === id) m.occ[i] = null;
  for (let i = 0; i < m.flooded.length; i++) if (m.flooded[i] === id) m.flooded[i] = null;
  delete m.buildings[id];
  // reconcile linked jobs
  m.repairJobs = m.repairJobs.filter((j) => j.building !== id);
  m.logisticsJobs = m.logisticsJobs.filter((j) => j.building !== id);
  s.lifetime.demolished++;
  if (forced) notify(s, `flood:${id}`, 'warning', 'construction', `${d.name} was removed by reservoir flooding (salvaged).`, m.id);
  return { ok: true, value };
}
