import { buildingsForStage } from '../../src/engine/data/buildings';
import { STAGE_LIST } from '../../src/engine/data/stages';
import { RESEARCH_LIST } from '../../src/engine/data/research';
import { GameEngine } from '../../src/engine/core/GameEngine';
import { newGame } from '../../src/engine/core/NewGame';
import { createMap } from '../../src/engine/world/MapManager';
import { effectiveTerrain } from '../../src/engine/core/Helpers';
import { footprint } from '../../src/engine/world/BuildingFootprints';

/** A late-game company: every map unlocked and filled with a mix of installations. */
export function syntheticLateGame(perMap = 70): GameEngine {
  const s = newGame(1234, 0);
  s.money = 1e40;
  for (const r of RESEARCH_LIST) s.research.done[r.id] = 0;
  const e = new GameEngine(s);
  for (const st of STAGE_LIST) {
    const m = (s.maps[st.id] ??= createMap(st.id, s.seed, 0));
    m.owned = m.owned.map(() => 1);
    m.workforce = { technician: 20, engineer: 10, robot: 5, driver: 5, autofreight: 2 };
    const defs = buildingsForStage(st.id).filter((d) => !d.unique);
    let placed = 0;
    for (let k = 0; placed < perMap && k < perMap * 6; k++) {
      const d = defs[k % defs.length];
      const [w, h] = footprint(d, 0);
      let done = false;
      for (let y = 0; y + h <= m.h && !done; y++)
        for (let x = 0; x + w <= m.w && !done; x++) {
          const i = y * m.w + x;
          if (m.occ[i] || !d.terrain.includes(effectiveTerrain(m, i))) continue;
          if (e.dispatch({ type: 'place', map: st.id, def: d.id, x, y, rot: 0, acceptFlood: false }).ok) {
            placed++;
            done = true;
          }
        }
    }
    for (const b of Object.values(m.buildings)) if (b.tank !== undefined) b.tank = 1e30;
  }
  return e;
}
