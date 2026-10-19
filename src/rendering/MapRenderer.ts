import { BUILDINGS } from '../engine/data/buildings';
import { TERRAIN } from '../engine/data/terrain';
import { footprint } from '../engine/world/BuildingFootprints';
import { STAGES } from '../engine/data/stages';
import type { GameState, MapState } from '../engine/core/State';
import { repairThreshold } from '../engine/core/Helpers';
import type { FuelId } from '../engine/data/types';
import { fuelBalance } from '../engine/systems/ThermalSystem';
import { solarFactor, windPower } from '../engine/core/GameClock';
import { envAt, WEATHER } from '../engine/systems/WeatherSystem';
import { CameraController } from './CameraController';
import { drawOwnership, drawTile, hatchPattern } from './TileRenderer';
import { drawBuilding, drawBuildingArt } from './BuildingRenderer';

export interface PlacementGhost {
  def: string;
  x: number;
  y: number;
  w: number;
  h: number;
  ok: boolean;
  flood?: number[];
}

export interface RenderInput {
  state: GameState;
  map: MapState;
  hover: number;
  selectedBuilding: string | null;
  selectedTile: number;
  ghost: PlacementGhost | null;
  ghosts?: PlacementGhost[];
  landMode: boolean;
  purchasable?: Set<number>;
  eligible?: (i: number) => boolean;
  /** Weather layer: per-tile wind capacity factor, solar potential or river flow. */
  weather?: 'off' | 'wind' | 'solar' | 'hydro';
  now: number;
}

/**
 * Canvas-2D renderer: viewport culling, DPR-aware backing store, SVG art rasterised per pixel
 * size. Drawing is decoupled from React — it runs on requestAnimationFrame.
 */
export class MapRenderer {
  readonly camera = new CameraController();
  private ctx: CanvasRenderingContext2D;
  dpr = 1;
  frameMs = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * this.dpr)), h = Math.max(1, Math.round(r.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    // keep the same share of the map visible when the viewport changes (fullscreen, window resize)
    const before = this.camera.fitZoom();
    const hadViewport = this.camera.vw > 1;
    this.camera.setViewport(r.width, r.height);
    const after = this.camera.fitZoom();
    if (hadViewport && before > 0 && Math.abs(after - before) > 1e-6) this.camera.cam.zoom = Math.max(10, Math.min(220, this.camera.cam.zoom * (after / before)));
    this.camera.clamp();
  }

  tileAt(sx: number, sy: number, m: MapState): number {
    const [wx, wy] = this.camera.toWorld(sx, sy);
    const x = Math.floor(wx), y = Math.floor(wy);
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return -1;
    return y * m.w + x;
  }

  /** Tints tiles red (poor) → green (strong) for the chosen resource under the current weather. */
  private drawWeather(ctx: CanvasRenderingContext2D, s: GameState, m: MapState, layer: 'wind' | 'solar' | 'hydro', toScreen: (x: number, y: number) => [number, number], z: number, range: { x0: number; y0: number; x1: number; y1: number }, now: number) {
    const env = envAt(m, s.time);
    const w = env.event ? WEATHER[env.event.kind] : null;
    let maxFlow = 0;
    if (layer === 'hydro') for (const q of m.riverFlow) maxFlow = Math.max(maxFlow, q);
    ctx.font = `600 ${Math.min(12, z * 0.22)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (let y = range.y0; y <= range.y1; y++)
      for (let x = range.x0; x <= range.x1; x++) {
        const i = y * m.w + x;
        const tt = TERRAIN[m.flooded[i] ? 'reservoir' : m.terrain[i]];
        // colour = site quality under the current weather (terrain × event); label = that multiplier
        let v: number, k: number;
        if (layer === 'wind') { k = tt.wind * env.windOut; v = k / 1.4; }
        else if (layer === 'solar') { k = tt.solar * (w?.solar ?? 1); v = k / 1.2; }
        else {
          if (!(m.riverFlow[i] > 0) || maxFlow <= 0) continue;
          k = m.riverFlow[i] / maxFlow;
          v = k;
        }
        const [sx, sy] = toScreen(x, y);
        ctx.fillStyle = `hsla(${Math.round(120 * Math.max(0, Math.min(1, v)))}, 80%, 45%, 0.4)`;
        ctx.fillRect(sx, sy, z, z);
        const live = layer === 'wind' ? windPower(env.wind * tt.wind * 0.92) * env.windOut : 0;
        if (layer === 'wind' && now && k > 0.05) {
          // moving streaks: speed follows the actual wind right now, length the site quality
          const off = ((now / 1000) * (0.2 + env.wind / 6) * z + ((i * 37) % 97) / 97 * z) % z;
          ctx.strokeStyle = 'rgba(248,250,252,0.55)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const ly = sy + z * (0.3 + ((i * 13) % 5) / 10);
          ctx.moveTo(sx + off, ly);
          ctx.lineTo(Math.min(sx + z, sx + off + z * 0.4 * (0.3 + Math.min(1, v))), ly);
          ctx.stroke();
        }
        if (z >= 36) {
          ctx.fillStyle = 'rgba(248,250,252,0.9)';
          ctx.fillText(layer === 'hydro' ? `${Math.round(k * 100)}%` : layer === 'wind' ? `×${k.toFixed(2)} · ${Math.round(live * 100)}%` : `×${k.toFixed(2)}`, sx + z / 2, sy + z - 5);
        }
      }
  }

  render(inp: RenderInput) {
    const t0 = performance.now();
    const { ctx, camera } = this;
    const { map: m, state: s } = inp;
    const set = s.settings;
    const z = camera.cam.zoom;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const space = STAGES[m.id].space;
    ctx.fillStyle = space ? '#020617' : set.theme === 'light' ? '#cbd5e1' : '#0b1220';
    ctx.fillRect(0, 0, camera.vw, camera.vh);
    const range = camera.visible();
    const tick = set.animations && !set.reducedMotion && !s.paused ? Math.floor(inp.now / 180) : -1;
    const toScreen = (x: number, y: number) => camera.toScreen(x, y);
    // terrain
    for (let y = range.y0; y <= range.y1; y++)
      for (let x = range.x0; x <= range.x1; x++) {
        const [sx, sy] = toScreen(x, y);
        drawTile(ctx, m, y * m.w + x, sx, sy, z + 0.5, this.dpr, tick < 0 ? -1 : Math.floor(tick / 2));
      }
    // unowned land dimmed
    ctx.fillStyle = 'rgba(2,6,23,0.38)';
    for (let y = range.y0; y <= range.y1; y++)
      for (let x = range.x0; x <= range.x1; x++) {
        if (m.owned[y * m.w + x]) continue;
        const [sx, sy] = toScreen(x, y);
        ctx.fillRect(sx, sy, z + 0.5, z + 0.5);
      }
    if (set.gridLines) {
      ctx.strokeStyle = 'rgba(15,23,42,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = range.x0; x <= range.x1 + 1; x++) {
        const [sx, sy0] = toScreen(x, range.y0);
        const [, sy1] = toScreen(x, range.y1 + 1);
        ctx.moveTo(Math.round(sx) + 0.5, sy0);
        ctx.lineTo(Math.round(sx) + 0.5, sy1);
      }
      for (let y = range.y0; y <= range.y1 + 1; y++) {
        const [sx0, sy] = toScreen(range.x0, y);
        const [sx1] = toScreen(range.x1 + 1, y);
        ctx.moveTo(sx0, Math.round(sy) + 0.5);
        ctx.lineTo(sx1, Math.round(sy) + 0.5);
      }
      ctx.stroke();
    }
    drawOwnership(ctx, m, toScreen, z, range);
    // land purchase mode: purchasable tiles get a dashed outline + plus sign
    if (inp.landMode && inp.purchasable) {
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      for (const i of inp.purchasable) {
        const x = i % m.w, y = Math.floor(i / m.w);
        if (x < range.x0 || x > range.x1 || y < range.y0 || y > range.y1) continue;
        const [sx, sy] = toScreen(x, y);
        ctx.strokeRect(sx + 3, sy + 3, z - 6, z - 6);
        ctx.fillStyle = 'rgba(253,224,71,0.85)';
        ctx.fillRect(sx + z / 2 - 1.5, sy + z / 2 - 6, 3, 12);
        ctx.fillRect(sx + z / 2 - 6, sy + z / 2 - 1.5, 12, 3);
      }
      ctx.setLineDash([]);
    }
    // build-mode eligibility: valid tiles tinted green, invalid hatched (not colour alone)
    if (inp.eligible) {
      const pat = hatchPattern(ctx, 'rgba(239,68,68,0.55)');
      for (let y = range.y0; y <= range.y1; y++)
        for (let x = range.x0; x <= range.x1; x++) {
          const i = y * m.w + x;
          const [sx, sy] = toScreen(x, y);
          if (inp.eligible(i)) {
            ctx.fillStyle = 'rgba(34,197,94,0.16)';
            ctx.fillRect(sx, sy, z, z);
          } else {
            ctx.fillStyle = pat;
            ctx.fillRect(sx, sy, z, z);
          }
        }
    }
    // buildings (culled by footprint)
    // own fuel production vs full-load plant burn, once per frame (producer labels)
    const fuelCover: Partial<Record<FuelId, number>> = {};
    for (const b of Object.values(m.buildings)) {
      const f = BUILDINGS[b.def]?.infra?.fuel;
      if (BUILDINGS[b.def]?.infra?.role === 'fuelProducer' && f && !(f in fuelCover)) {
        const fb = fuelBalance(s, m, f);
        if (fb.burnMax > 0) fuelCover[f] = fb.produced / fb.burnMax;
      }
    }
    const pulse = set.animations && !set.reducedMotion ? 0.5 + 0.5 * Math.sin(inp.now / 400) : 0.5;
    for (const b of Object.values(m.buildings)) {
      if (b.x > range.x1 + 1 || b.y > range.y1 + 1 || b.x + 3 < range.x0 || b.y + 3 < range.y0) continue;
      drawBuilding(ctx, b, toScreen, z, {
        names: set.buildingNames, values: set.productionValues, maintenance: set.maintenanceIndicators, electrical: set.electricalOverlay,
        threshold: repairThreshold(s, m, b), dpr: this.dpr, pulse, tick, state: s, map: m, fuelCover,
      });
    }
    if (set.terrainLabels && z >= 40) {
      ctx.font = `500 ${Math.min(11, z * 0.18)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      for (let y = range.y0; y <= range.y1; y++)
        for (let x = range.x0; x <= range.x1; x++) {
          const i = y * m.w + x;
          if (m.occ[i]) continue;
          const [sx, sy] = toScreen(x, y);
          ctx.fillStyle = 'rgba(248,250,252,0.85)';
          ctx.fillText(TERRAIN[m.flooded[i] ? 'reservoir' : m.terrain[i]].name, sx + 3, sy + 12);
        }
    }
    // day/night tint on terrestrial maps
    if (!space && set.animations) {
      const sun = Math.min(1, solarFactor(s.time));
      const night = 1 - sun;
      if (night > 0.02) {
        ctx.fillStyle = `rgba(15,23,60,${0.28 * night})`;
        ctx.fillRect(0, 0, camera.vw, camera.vh);
      }
    }
    if (inp.weather && inp.weather !== 'off') this.drawWeather(ctx, s, m, inp.weather, toScreen, z, range, set.animations && !set.reducedMotion ? inp.now : 0);
    // selection / hover
    const outline = (x: number, y: number, w: number, h: number, color: string, lw = 2) => {
      const [sx, sy] = toScreen(x, y);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.strokeRect(sx + 1, sy + 1, w * z - 2, h * z - 2);
    };
    if (inp.selectedBuilding && m.buildings[inp.selectedBuilding]) {
      const b = m.buildings[inp.selectedBuilding];
      const [fw, fh] = footprint(BUILDINGS[b.def], b.rot);
      outline(b.x, b.y, fw, fh, '#f8fafc', 3);
    } else if (inp.selectedTile >= 0) outline(inp.selectedTile % m.w, Math.floor(inp.selectedTile / m.w), 1, 1, '#f8fafc', 3);
    if (inp.hover >= 0 && !inp.ghost) outline(inp.hover % m.w, Math.floor(inp.hover / m.w), 1, 1, 'rgba(248,250,252,0.6)', 1.5);
    for (const g of [...(inp.ghosts ?? []), ...(inp.ghost ? [inp.ghost] : [])]) {
      if (g.flood) {
        ctx.fillStyle = 'rgba(37,99,235,0.45)';
        for (const i of g.flood) {
          const [sx, sy] = toScreen(i % m.w, Math.floor(i / m.w));
          ctx.fillRect(sx, sy, z, z);
        }
      }
      const [sx, sy] = toScreen(g.x, g.y);
      drawBuildingArt(ctx, g.def, sx, sy, g.w * z, g.h * z, this.dpr, 0.6);
      ctx.fillStyle = g.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.3)';
      ctx.fillRect(sx, sy, g.w * z, g.h * z);
      outline(g.x, g.y, g.w, g.h, g.ok ? '#22c55e' : '#ef4444', 3);
      if (!g.ok) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx + 6, sy + 6);
        ctx.lineTo(sx + g.w * z - 6, sy + g.h * z - 6);
        ctx.moveTo(sx + g.w * z - 6, sy + 6);
        ctx.lineTo(sx + 6, sy + g.h * z - 6);
        ctx.stroke();
      }
    }
    this.frameMs = performance.now() - t0;
  }
}
