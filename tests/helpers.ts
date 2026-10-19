import { GameEngine } from '../src/engine/core/GameEngine';
import { newGame } from '../src/engine/core/NewGame';
import type { GameState, MapState } from '../src/engine/core/State';
import { BUILDINGS } from '../src/engine/data/buildings';
import type { StageId, TerrainId } from '../src/engine/data/types';
import { createMap } from '../src/engine/world/MapManager';
import { footprint } from '../src/engine/world/BuildingFootprints';
import { effectiveTerrain } from '../src/engine/core/Helpers';

export function engine(seed = 42): GameEngine {
  return new GameEngine(newGame(seed, 0));
}

/** Test-only: unlock a map directly (bypasses milestones). */
export function unlock(s: GameState, stage: StageId): MapState {
  s.maps[stage] ??= createMap(stage, s.seed, s.time);
  return s.maps[stage]!;
}

export function ownAll(m: MapState) {
  m.owned = m.owned.map(() => 1);
}

/** Test-only: mark research complete (bypasses cost/time). */
export function research(s: GameState, ...ids: string[]) {
  for (const id of ids) s.research.done[id] = s.time;
}

/** First top-left anchor where `def` fits on owned, free tiles with suitable terrain. */
export function findSpot(m: MapState, defId: string, rot: 0 | 1 = 0, need?: (i: number) => boolean): [number, number] | null {
  const d = BUILDINGS[defId];
  const [w, h] = footprint(d, rot);
  for (let y = 0; y + h <= m.h; y++)
    for (let x = 0; x + w <= m.w; x++) {
      let ok = true;
      for (let j = 0; j < h && ok; j++)
        for (let i = 0; i < w && ok; i++) {
          const k = (y + j) * m.w + x + i;
          if (!m.owned[k] || m.occ[k] || !d.terrain.includes(effectiveTerrain(m, k)) || (need && !need(k))) ok = false;
        }
      if (ok) return [x, y];
    }
  return null;
}

export function findTerrain(m: MapState, t: TerrainId): number {
  return m.terrain.findIndex((x) => x === t);
}

export function place(e: GameEngine, map: StageId, def: string, rot: 0 | 1 = 0): string {
  const m = e.state.maps[map]!;
  const spot = findSpot(m, def, rot);
  if (!spot) throw new Error(`no spot for ${def} on ${map}`);
  const r = e.dispatch({ type: 'place', map, def, x: spot[0], y: spot[1], rot, acceptFlood: true });
  if (!r.ok) throw new Error(`place ${def} failed: ${r.error}`);
  return r.data as string;
}

export function hours(e: GameEngine, h: number, dt = 1 / 24) {
  const n = Math.round(h / dt);
  for (let i = 0; i < n; i++) e.tick(dt);
}
