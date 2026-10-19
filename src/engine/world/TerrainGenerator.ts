import { STAGES } from '../data/stages';
import type { StageId, TerrainId } from '../data/types';
import { fbm, mulberry32 } from '../math/rng';
import { idx, neighbors4, xy } from './TileGrid';

export interface GeneratedTerrain {
  terrain: TerrainId[];
  elev: number[];
  riverBase: number[];
  riverNext: number[];
  riverOrder: number[];
  resource: number[];
}

/** Typical river discharge (m³/s) at the mouth for each terrestrial stage. */
export const RIVER_Q: Partial<Record<StageId, number>> = {
  backyard: 0.16, neighborhood: 2.2, city: 130, country: 2400, continent: 7e4, planet: 3e5,
};

/**
 * Deterministic terrain from a seed. Terrestrial maps use fractal elevation + moisture with
 * steepest-descent rivers; space maps place stellar/orbital features procedurally.
 */
export function generateTerrain(stage: StageId, seed: number): GeneratedTerrain {
  const s = STAGES[stage];
  const { w, h } = s;
  const n = w * h;
  const out: GeneratedTerrain = {
    terrain: new Array(n).fill('grass'), elev: new Array(n).fill(0.4), riverBase: new Array(n).fill(0),
    riverNext: new Array(n).fill(-1), riverOrder: [], resource: new Array(n).fill(0),
  };
  const rnd = mulberry32(seed);
  if (s.space) spaceTerrain(stage, out, w, h, seed, rnd);
  else earthTerrain(stage, out, w, h, seed, rnd);
  return out;
}

function earthTerrain(stage: StageId, o: GeneratedTerrain, w: number, h: number, seed: number, rnd: () => number) {
  const cfg = {
    backyard: { sea: -1, hill: 0.72, mountain: 2, desert: -1, forest: 0.68, scale: 0.35, urban: 0 },
    neighborhood: { sea: -1, hill: 0.68, mountain: 2, desert: -1, forest: 0.64, scale: 0.22, urban: 0.18 },
    city: { sea: 0.2, hill: 0.66, mountain: 0.84, desert: -1, forest: 0.66, scale: 0.17, urban: 0.14 },
    country: { sea: 0.24, hill: 0.62, mountain: 0.78, desert: 0.27, forest: 0.62, scale: 0.15, urban: 0.04 },
    continent: { sea: 0.27, hill: 0.62, mountain: 0.78, desert: 0.33, forest: 0.62, scale: 0.14, urban: 0.03 },
    planet: { sea: 0.42, hill: 0.66, mountain: 0.8, desert: 0.35, forest: 0.6, scale: 0.16, urban: 0.02 },
  }[stage as 'backyard']!;
  const [sx, sy, sw, sh] = STAGES[stage].startOwned;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      // elevation: noise plus a gentle slope towards the "sea" edge (right side) for coastal stages
      let e = fbm(x * cfg.scale, y * cfg.scale, seed, 4);
      if (cfg.sea > 0) e = e * 0.8 + (1 - x / (w - 1)) * 0.28 - 0.04;
      if (stage === 'planet') e = fbm(x * 0.13, y * 0.2, seed, 4) * 1.05 - 0.02;
      o.elev[i] = Math.max(0, Math.min(1, e));
      const m = fbm(x * cfg.scale + 50, y * cfg.scale + 50, seed + 7, 3);
      let t: TerrainId = 'grass';
      if (e < cfg.sea) t = 'ocean';
      else if (e < cfg.sea + 0.035) t = 'coast';
      else if (e > cfg.mountain) t = 'mountain';
      else if (e > cfg.hill) t = 'hill';
      else if (m < cfg.desert) t = 'desert';
      else if (m > cfg.forest) t = 'forest';
      o.terrain[i] = t;
    }
  // urban / industrial cores
  if (cfg.urban > 0) {
    const cores = stage === 'neighborhood' ? 3 : stage === 'city' ? 2 : 3;
    for (let c = 0; c < cores; c++) {
      const cx = Math.floor(rnd() * w), cy = Math.floor(rnd() * h);
      const r = stage === 'city' ? 2.6 : 1.8;
      for (let i = 0; i < w * h; i++) {
        const [x, y] = xy(i, w);
        const d = Math.hypot(x - cx, y - cy);
        if (d < r && ['grass', 'forest', 'hill'].includes(o.terrain[i])) o.terrain[i] = c === 1 ? 'industrial' : 'urban';
      }
    }
  }
  // geothermal hot spots
  const geoCount = stage === 'backyard' || stage === 'neighborhood' ? 0 : stage === 'city' ? 2 : 4;
  for (let g = 0, tries = 0; g < geoCount && tries < 200; tries++) {
    const i = Math.floor(rnd() * w * h);
    if (['hill', 'mountain', 'grass', 'desert'].includes(o.terrain[i])) {
      o.terrain[i] = 'geothermal';
      o.resource[i] = 0.6 + rnd() * 0.4;
      g++;
    }
  }
  rivers(stage, o, w, h, rnd);
  // starting plot is always buildable land
  for (let y = sy; y < sy + sh; y++)
    for (let x = sx; x < sx + sw; x++) {
      const i = idx(x, y, w);
      if (o.terrain[i] !== 'river') o.terrain[i] = stage === 'backyard' ? 'grass' : ['urban', 'industrial', 'hill'].includes(o.terrain[i]) ? o.terrain[i] : 'grass';
    }
  if (stage === 'backyard') {
    o.terrain[idx(sx, sy, w)] = 'urban';
    o.terrain[idx(sx + 1, sy, w)] = 'urban';
    o.terrain[idx(sx, sy + 1, w)] = 'urban';
    o.terrain[idx(sx + 1, sy + 1, w)] = 'urban';
  }
}

/** Steepest-descent rivers from high ground to the sea or map edge, plus lakes in basins. */
function rivers(stage: StageId, o: GeneratedTerrain, w: number, h: number, rnd: () => number) {
  const Q = RIVER_Q[stage] ?? 0;
  const [sx, sy, sw, sh] = STAGES[stage].startOwned;
  const inStart = (i: number) => {
    const [x, y] = xy(i, w);
    return x >= sx && x < sx + sw && y >= sy && y < sy + sh;
  };
  const count = stage === 'backyard' ? 1 : stage === 'neighborhood' ? 1 : stage === 'planet' ? 3 : 2;
  const paths: number[][] = [];
  if (stage === 'backyard' || stage === 'neighborhood') {
    // a single garden stream / creek running top→bottom just outside the starting plot
    const x0 = stage === 'backyard' ? sx + sw + 1 : sx + sw + 2;
    const path: number[] = [];
    let x = Math.min(w - 2, x0);
    for (let y = 0; y < h; y++) {
      path.push(idx(x, y, w));
      if (rnd() < 0.25 && y < h - 1) {
        const nx = Math.max(sx + sw, Math.min(w - 1, x + (rnd() < 0.5 ? -1 : 1)));
        if (nx !== x) {
          x = nx;
          path.push(idx(x, y, w));
        }
      }
    }
    paths.push(path);
  } else {
    // rivers run from the high (left/top) side towards the sea side, following low ground
    for (let r = 0; r < count; r++) {
      const fromTop = r % 2 === 1;
      let cur = fromTop ? idx(Math.floor(w * (0.25 + rnd() * 0.4)), 0, w) : idx(0, Math.floor(h * (0.2 + rnd() * 0.6)), w);
      const path = [cur];
      const seen = new Set(path);
      for (let step = 0; step < w * h; step++) {
        const [cx, cy] = xy(cur, w);
        if (o.terrain[cur] === 'ocean' || cx === w - 1 || (fromTop && cy === h - 1)) break;
        const nb = neighbors4(cur, w, h).filter((j) => !seen.has(j) && !inStart(j));
        if (!nb.length) break;
        // prefer low elevation; strong bias to keep flowing towards the sea (right) / down
        const score = (j: number) => {
          const [jx, jy] = xy(j, w);
          return o.elev[j] - (jx - cx) * 0.12 - (fromTop ? (jy - cy) * 0.08 : 0) + rnd() * 0.04;
        };
        nb.sort((a, b) => score(a) - score(b));
        const next = nb[0];
        // carve: water flows downhill
        o.elev[next] = Math.min(o.elev[next], o.elev[cur] - 0.004);
        path.push(next);
        seen.add(next);
        cur = next;
        if (paths.some((p) => p.includes(next))) break; // joined another river
      }
      paths.push(path);
    }
  }
  // assign river tiles and flow (accumulating downstream)
  const order: number[] = [];
  paths.forEach((path, pi) => {
    path.forEach((i, k) => {
      if (o.terrain[i] === 'ocean') return;
      if (inStart(i) && stage !== 'backyard') return;
      if (o.terrain[i] !== 'lake') o.terrain[i] = 'river';
      const share = (0.35 + 0.65 * (k / Math.max(1, path.length - 1))) * (pi === 0 ? 1 : 0.6);
      o.riverBase[i] = Math.max(o.riverBase[i], Q * share * 0.5);
      const nxt = path[k + 1];
      if (nxt !== undefined && o.terrain[nxt] !== 'ocean' && !(inStart(nxt) && stage !== 'backyard')) o.riverNext[i] = nxt;
      if (!order.includes(i)) order.push(i);
    });
  });
  // lakes adjacent to rivers get a little inflow share; ensure monotone flow downstream
  for (const i of order) {
    const nx = o.riverNext[i];
    if (nx >= 0) o.riverBase[nx] = Math.max(o.riverBase[nx], o.riverBase[i]);
  }
  o.riverOrder = order;
  
}

function spaceTerrain(stage: StageId, o: GeneratedTerrain, w: number, h: number, seed: number, rnd: () => number) {
  const [sx, sy, sw, sh] = STAGES[stage].startOwned;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      const nz = fbm(x * 0.25, y * 0.25, seed, 3);
      let t: TerrainId = 'void';
      if (stage === 'solar') {
        // Sun sits just off the left edge at mid-height
        const d = Math.hypot(x + 2.5, (y - h / 2 + 0.5) * 1.15);
        if (d < 4.2) t = 'corona';
        else if (d < 8) t = 'inner';
        else if (Math.abs(d - 11) < 0.7 && nz > 0.35) t = 'orbit';
        else if (Math.abs(d - 15.5) < 0.6 && nz > 0.4) t = 'orbit';
        else if (Math.abs(d - 19) < 1.1) t = nz > 0.45 ? 'asteroid' : 'void';
        else if (Math.abs(d - 24) < 1 && nz > 0.5) t = 'gasgiant';
        o.resource[i] = Math.min(1, 6 / Math.max(1, d));
      } else if (stage === 'galaxy') {
        const cx = (w - 1) / 2, cy = (h - 1) / 2;
        const dx = x - cx, dy = (y - cy) * 1.6;
        const r = Math.hypot(dx, dy);
        const th = Math.atan2(dy, dx);
        const arm = Math.cos(2 * th - r * 0.55);
        if (r < 1.6) t = 'galactic_core';
        else if (arm > 0.35 - nz * 0.4) {
          const k = fbm(x * 0.6 + 9, y * 0.6, seed + 3, 2);
          t = k > 0.72 ? 'star_blue' : k > 0.45 ? 'star_yellow' : 'star_red';
          if (nz > 0.72) t = 'nebula';
        } else if (nz > 0.78) t = 'nebula';
        if (t === 'void' && rnd() < 0.04) t = 'neutron';
        o.resource[i] = Math.max(0, 1 - r / 14);
      } else {
        // cosmic web: ridged noise filaments with galaxies strung along them
        const ridge = 1 - Math.abs(fbm(x * 0.18, y * 0.18, seed, 3) * 2 - 1);
        if (ridge > 0.82) t = 'filament';
        if (ridge > 0.7 && nz > 0.45) t = nz > 0.62 ? 'galaxy_elliptical' : 'galaxy_spiral';
        if (ridge < 0.25) t = 'supervoid';
        o.resource[i] = ridge;
      }
      o.terrain[i] = t;
    }
  // special singular features
  const special: [TerrainId, number][] = stage === 'solar' ? [['lunar', 3], ['martian', 3]] : stage === 'universe' ? [['quasar', 3], ['smbh', 3]] : [['neutron', 3]];
  for (const [t, cnt] of special) {
    for (let c = 0, tries = 0; c < cnt && tries < 300; tries++) {
      const i = Math.floor(rnd() * w * h);
      const [x, y] = xy(i, w);
      if (x >= sx - 1 && x <= sx + sw && y >= sy - 1 && y <= sy + sh) continue;
      if (t === 'lunar' || t === 'martian') {
        const d = Math.hypot(x + 2.5, (y - h / 2 + 0.5) * 1.15);
        if (t === 'lunar' && Math.abs(d - 11) > 1.6) continue;
        if (t === 'martian' && Math.abs(d - 15.5) > 1.6) continue;
      }
      if (['corona', 'galactic_core'].includes(o.terrain[i])) continue;
      o.terrain[i] = t;
      o.resource[i] = 1;
      c++;
    }
  }
  // starting sector: something buildable
  const startTerrain: TerrainId[] = stage === 'solar' ? ['orbit', 'inner'] : stage === 'galaxy' ? ['star_yellow', 'star_red'] : ['galaxy_spiral', 'galaxy_elliptical'];
  for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) o.terrain[idx(x, y, w)] = startTerrain[(x + y) % 2];
}
