import { BUILDINGS } from '../data/buildings';
import { STAGES } from '../data/stages';
import { TERRAIN } from '../data/terrain';
import type { StageId } from '../data/types';
import { defOf, effectiveTerrain } from '../core/Helpers';
import { isBuildingUnlocked, isUpgradeUnlocked } from '../core/Modifiers';
import type { Blueprint, BlueprintItem, GameState, MapState } from '../core/State';
import { footprint } from '../world/BuildingFootprints';
import { inBounds, rectTiles } from '../world/TileGrid';
import { placeBuilding, previewPlacement } from './ConstructionSystem';
import { canAfford, spend } from './FinanceSystem';
import { landBlockReason, landPrice } from './LandSystem';
import { retrofit } from './BuildingSystem';

export const BLUEPRINT_VERSION = 1;

export function saveBlueprint(s: GameState, map: StageId, name: string): string | null {
  const m = s.maps[map];
  if (!m) return 'Map locked.';
  const list = Object.values(m.buildings).filter((b) => !defOf(b).fixed);
  if (!list.length) return 'Nothing to save on this map.';
  const minX = Math.min(...list.map((b) => b.x)), minY = Math.min(...list.map((b) => b.y));
  const items: BlueprintItem[] = list.map((b) => ({
    def: b.def, dx: b.x - minX, dy: b.y - minY, rot: b.rot, upgrades: [...b.upgrades], mode: b.mode, storageMode: b.storageMode, repairThreshold: b.repairThreshold, priority: b.priority,
  }));
  const w = Math.max(...list.map((b) => b.x - minX + footprint(defOf(b), b.rot)[0]));
  const h = Math.max(...list.map((b) => b.y - minY + footprint(defOf(b), b.rot)[1]));
  s.blueprints.push({ id: `bp${s.nextId++}`, name: name.trim().slice(0, 40) || `${STAGES[map].name} layout`, stage: map, createdAt: s.time, version: BLUEPRINT_VERSION, w, h, items });
  return null;
}

export type ItemStatus = 'ok' | 'unknown' | 'stage' | 'locked' | 'bounds' | 'occupied' | 'terrain' | 'land' | 'money' | 'other';

export interface BlueprintAnalysis {
  items: { item: BlueprintItem; status: ItemStatus; reason: string; cost: number; upgradesUnavailable: string[] }[];
  landTiles: number[];
  landCost: number;
  buildCost: number;
  total: number;
  buildable: number;
  conflictsTerrain: number;
  conflictsOccupied: number;
  locked: number;
}

/** Dry-run of a blueprint at an anchor: every incompatibility is reported, nothing throws. */
export function analyzeBlueprint(s: GameState, bp: Blueprint, m: MapState, ox: number, oy: number): BlueprintAnalysis {
  const landTiles = new Set<number>();
  const items = bp.items.map((item) => {
    const d = BUILDINGS[item.def];
    const res = { item, status: 'ok' as ItemStatus, reason: '', cost: 0, upgradesUnavailable: [] as string[] };
    if (!d) return { ...res, status: 'unknown' as ItemStatus, reason: `Building type "${item.def}" no longer exists.` };
    if (!d.stages.includes(m.id)) return { ...res, status: 'stage' as ItemStatus, reason: `${d.name} is not available on ${STAGES[m.id].name}.` };
    if (!isBuildingUnlocked(s, d.id)) return { ...res, status: 'locked' as ItemStatus, reason: `${d.name}: technology locked.` };
    const [w, h] = footprint(d, item.rot);
    const x = ox + item.dx, y = oy + item.dy;
    if (!inBounds(x, y, m.w, m.h) || !inBounds(x + w - 1, y + h - 1, m.w, m.h)) return { ...res, status: 'bounds' as ItemStatus, reason: `${d.name} falls outside the map.` };
    const tiles = rectTiles(x, y, w, h, m.w);
    if (tiles.some((i) => m.occ[i])) return { ...res, status: 'occupied' as ItemStatus, reason: `${d.name}: tiles occupied.` };
    const bad = tiles.find((i) => !d.terrain.includes(effectiveTerrain(m, i)));
    if (bad !== undefined) return { ...res, status: 'terrain' as ItemStatus, reason: `${d.name}: conflicting terrain (${TERRAIN[effectiveTerrain(m, bad)].name}).` };
    for (const i of tiles) if (!m.owned[i]) landTiles.add(i);
    // simulate ownership to price the building
    const saved = tiles.map((i) => m.owned[i]);
    tiles.forEach((i) => (m.owned[i] = 1));
    const p = previewPlacement(s, m, d.id, x, y, item.rot);
    tiles.forEach((i, k) => (m.owned[i] = saved[k]));
    res.cost = p.cost;
    res.upgradesUnavailable = item.upgrades.filter((u) => !isUpgradeUnlocked(s, u));
    const other = p.reasons.filter((r) => r !== 'Not enough money.');
    if (other.length) return { ...res, status: 'other' as ItemStatus, reason: other.join(' ') };
    return res;
  });
  const landCost = [...landTiles].reduce((a, i) => a + landPrice(s, m, i), 0);
  const buildCost = items.reduce((a, i) => a + (i.status === 'ok' ? i.cost : 0), 0);
  return {
    items, landTiles: [...landTiles], landCost, buildCost, total: landCost + buildCost, buildable: items.filter((i) => i.status === 'ok').length,
    conflictsTerrain: items.filter((i) => i.status === 'terrain').length, conflictsOccupied: items.filter((i) => i.status === 'occupied').length,
    locked: items.filter((i) => i.status === 'locked' || i.status === 'unknown' || i.status === 'stage').length,
  };
}

/**
 * Manual reconstruction at normal prices. mode 'all' requires every item to be valid and
 * affordable; 'subset' builds whatever is valid while money lasts. Land is bought when needed
 * and purchasable (adjacency is honoured as tiles are acquired).
 */
export function applyBlueprint(s: GameState, bpId: string, map: StageId, ox: number, oy: number, mode: 'all' | 'subset'): { ok: boolean; error?: string; built: number } {
  const bp = s.blueprints.find((b) => b.id === bpId);
  const m = s.maps[map];
  if (!bp || !m) return { ok: false, error: 'Blueprint or map not found.', built: 0 };
  const a = analyzeBlueprint(s, bp, m, ox, oy);
  if (mode === 'all') {
    if (a.buildable < a.items.length) return { ok: false, error: 'Some items cannot be built — use "build valid subset".', built: 0 };
    if (!canAfford(s, a.total)) return { ok: false, error: 'Not enough money for the full blueprint.', built: 0 };
  }
  let built = 0;
  for (const it of a.items) {
    if (it.status !== 'ok') continue;
    const d = BUILDINGS[it.item.def];
    const [w, h] = footprint(d, it.item.rot);
    const x = ox + it.item.dx, y = oy + it.item.dy;
    const tiles = rectTiles(x, y, w, h, m.w);
    // buy missing land in an order that respects adjacency
    let progress = true;
    while (progress && tiles.some((i) => !m.owned[i])) {
      progress = false;
      for (const i of tiles) {
        if (m.owned[i] || landBlockReason(s, m, i)) continue;
        const price = landPrice(s, m, i);
        if (!canAfford(s, price)) break;
        spend(s, m, 'land', price);
        m.owned[i] = 1;
        progress = true;
      }
    }
    if (tiles.some((i) => !m.owned[i])) continue;
    const r = placeBuilding(s, m, d.id, x, y, it.item.rot, false);
    if (!r.ok || !r.id) continue;
    built++;
    const b = m.buildings[r.id];
    if (it.item.mode && d.thermal) b.mode = it.item.mode;
    if (it.item.storageMode && d.storage) b.storageMode = it.item.storageMode;
    if (it.item.repairThreshold !== undefined) b.repairThreshold = it.item.repairThreshold;
    if (it.item.priority !== undefined) b.priority = it.item.priority;
    for (const u of it.item.upgrades) if (isUpgradeUnlocked(s, u)) retrofit(s, m, b, u);
  }
  return { ok: built > 0, error: built ? undefined : 'Nothing could be built.', built };
}

/** Bring older blueprint records up to the current format. */
export function migrateBlueprint(bp: Blueprint): Blueprint {
  return { ...bp, version: BLUEPRINT_VERSION, items: (bp.items ?? []).filter((i) => typeof i.def === 'string').map((i) => ({ ...i, rot: i.rot === 1 ? 1 : 0, upgrades: Array.isArray(i.upgrades) ? i.upgrades : [] })) };
}
