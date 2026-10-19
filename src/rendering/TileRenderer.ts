import { TERRAIN } from '../engine/data/terrain';
import type { MapState } from '../engine/core/State';
import { FRAMES, isAnimatedTerrain, terrainRaster, terrainSVG } from './SVGAssets';

export function drawTile(ctx: CanvasRenderingContext2D, m: MapState, i: number, sx: number, sy: number, size: number, dpr: number, tick = -1) {
  const t = m.flooded[i] ? 'reservoir' : m.terrain[i];
  const def = TERRAIN[t];
  const f = tick >= 0 && isAnimatedTerrain(t) ? tick % FRAMES : 0;
  const img = terrainRaster(`t:${t}#${f}`, terrainSVG(t, def.color, f), size * dpr);
  if ((img as HTMLImageElement).complete === false) {
    ctx.fillStyle = def.color;
    ctx.fillRect(sx, sy, size, size);
  } else ctx.drawImage(img, sx, sy, size, size);
  // gentle elevation shading (higher = lighter)
  const e = m.elev[i];
  if (e > 0 && !m.flooded[i]) {
    ctx.fillStyle = e > 0.5 ? `rgba(255,255,255,${(e - 0.5) * 0.12})` : `rgba(0,0,0,${(0.5 - e) * 0.12})`;
    ctx.fillRect(sx, sy, size, size);
  }
}

let hatch: CanvasPattern | null = null;
export function hatchPattern(ctx: CanvasRenderingContext2D, color: string): CanvasPattern | string {
  if (hatch) return hatch;
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d')!;
  g.strokeStyle = color;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, 8);
  g.lineTo(8, 0);
  g.stroke();
  hatch = ctx.createPattern(c, 'repeat');
  return hatch ?? color;
}

/** Amber border along every edge between owned and unowned land. */
export function drawOwnership(ctx: CanvasRenderingContext2D, m: MapState, toScreen: (x: number, y: number) => [number, number], z: number, range: { x0: number; y0: number; x1: number; y1: number }) {
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = Math.max(1.5, z * 0.05);
  ctx.beginPath();
  for (let y = range.y0; y <= range.y1; y++)
    for (let x = range.x0; x <= range.x1; x++) {
      const i = y * m.w + x;
      if (!m.owned[i]) continue;
      const [sx, sy] = toScreen(x, y);
      if (y === 0 || !m.owned[i - m.w]) {
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + z, sy);
      }
      if (y === m.h - 1 || !m.owned[i + m.w]) {
        ctx.moveTo(sx, sy + z);
        ctx.lineTo(sx + z, sy + z);
      }
      if (x === 0 || !m.owned[i - 1]) {
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + z);
      }
      if (x === m.w - 1 || !m.owned[i + 1]) {
        ctx.moveTo(sx + z, sy);
        ctx.lineTo(sx + z, sy + z);
      }
    }
  ctx.stroke();
}
