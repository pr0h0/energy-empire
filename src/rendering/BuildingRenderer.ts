import { BUILDINGS } from '../engine/data/buildings';
import type { BuildingInstance, GameState, MapState } from '../engine/core/State';
import type { FuelId } from '../engine/data/types';
import { depotCapacityKWh, depotUsedKWh, storageCapacityKWh } from '../engine/core/Helpers';
import { batterySVG, buildingSVG, FRAMES, hasLevelArt, isAnimatedArt, raster, svgImage, UI_ICONS } from './SVGAssets';
import { footprint } from '../engine/world/BuildingFootprints';
import { formatPower } from '../engine/math/EnergyUnits';

export interface BuildingDrawOpts {
  names: boolean;
  values: boolean;
  maintenance: boolean;
  electrical: boolean;
  threshold: number;
  dpr: number;
  pulse: number;
  /** Global animation tick, or -1 when animations are off. */
  tick: number;
  state: GameState;
  map: MapState;
  /** Own fuel production ÷ full-load plant burn, per fuel (for producer labels). */
  fuelCover: Partial<Record<FuelId, number>>;
}

/** Storage state colours: charging / discharging / idle. */
export const STORE_COLOR = { charging: '#22c55e', discharging: '#ef4444', idle: '#64748b' };
const storeColor = (b: BuildingInstance) => (b.output < 0 ? STORE_COLOR.charging : b.output > 0 ? STORE_COLOR.discharging : STORE_COLOR.idle);

export function drawBuildingArt(ctx: CanvasRenderingContext2D, defId: string, sx: number, sy: number, w: number, h: number, dpr: number, alpha = 1, frame = 0) {
  const d = BUILDINGS[defId];
  if (!d) return;
  const pad = Math.min(w, h) * 0.06;
  const img = raster(`b:${d.art}#${frame}`, buildingSVG(d.art, frame), (w - pad * 2) * dpr, (h - pad * 2) * dpr);
  ctx.globalAlpha = alpha;
  if ((img as HTMLImageElement).complete !== false) ctx.drawImage(img, sx + pad, sy + pad, w - pad * 2, h - pad * 2);
  ctx.globalAlpha = 1;
}

export function drawBuilding(ctx: CanvasRenderingContext2D, b: BuildingInstance, toScreen: (x: number, y: number) => [number, number], z: number, o: BuildingDrawOpts) {
  const d = BUILDINGS[b.def];
  if (!d) return;
  const [fw, fh] = footprint(d, b.rot);
  const [sx, sy] = toScreen(b.x, b.y);
  const w = fw * z, h = fh * z;
  // plinth
  ctx.fillStyle = 'rgba(15,23,42,0.35)';
  ctx.fillRect(sx + 2, sy + 2, w - 4, h - 4);
  if (o.electrical && b.available > 0) {
    const f = Math.max(0, Math.min(1, b.output / b.available));
    ctx.fillStyle = `rgba(250,204,21,${0.15 + 0.35 * f * (0.7 + 0.3 * o.pulse)})`;
    ctx.fillRect(sx + 2, sy + 2, w - 4, h - 4);
  }
  // only producing (or charging) buildings move; position offsets the phase so farms don't spin in lockstep
  const frame = o.tick >= 0 && b.output !== 0 && isAnimatedArt(d.art) ? (o.tick + b.x * 3 + b.y * 5) % FRAMES : 0;
  const cap = d.storage ? storageCapacityKWh(o.state, b, d) : 0;
  const level = cap > 0 ? Math.max(0, Math.min(1, (b.stored ?? 0) / cap)) : 0;
  if (hasLevelArt(d.art)) {
    // battery cells show the real charge level, coloured by charging / discharging / idle
    const pad = Math.min(w, h) * 0.06, q = Math.round(level * 20) / 20, c = storeColor(b);
    const img = raster(`bl:${d.art}:${q}:${c}`, batterySVG(d.art, q, c), (w - pad * 2) * o.dpr, (h - pad * 2) * o.dpr);
    if ((img as HTMLImageElement).complete !== false) ctx.drawImage(img, sx + pad, sy + pad, w - pad * 2, h - pad * 2);
  } else drawBuildingArt(ctx, b.def, sx, sy, w, h, o.dpr, 1, frame);
  const depot = d.infra?.role === 'fuelStorage';
  const depotLevel = depot ? Math.min(1, depotUsedKWh(o.map) / Math.max(1e-9, depotCapacityKWh(o.map))) : 0;
  if (((d.storage && !hasLevelArt(d.art)) || depot) && z >= 14) {
    // other storage and the fuel depot: a level gauge along the right edge
    const gh = h - 22, gx = sx + w - 9, gy = sy + 8, lv = depot ? depotLevel : level;
    ctx.fillStyle = 'rgba(15,23,42,0.8)';
    ctx.fillRect(gx, gy, 5, gh);
    ctx.fillStyle = depot ? '#f97316' : storeColor(b);
    ctx.fillRect(gx + 1, gy + 1 + (gh - 2) * (1 - lv), 3, (gh - 2) * lv);
  }
  const off = !b.enabled || b.condition < (d.shutdownBelow ?? 0.1);
  if (off) {
    ctx.fillStyle = 'rgba(30,41,59,0.55)';
    ctx.fillRect(sx + 2, sy + 2, w - 4, h - 4);
  }
  if (b.downtimeUntil > 0 && b.status.includes('h left')) {
    ctx.strokeStyle = '#38bdf8';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 3, sy + 3, w - 6, h - 6);
    ctx.setLineDash([]);
  }
  // condition bar
  if (!d.fixed && z >= 18) {
    const bw = w - 8;
    ctx.fillStyle = 'rgba(15,23,42,0.75)';
    ctx.fillRect(sx + 4, sy + h - 7, bw, 4);
    ctx.fillStyle = b.condition > 0.7 ? '#22c55e' : b.condition > 0.4 ? '#eab308' : '#ef4444';
    ctx.fillRect(sx + 4, sy + h - 7, bw * b.condition, 4);
  }
  const icon = Math.max(10, Math.min(22, z * 0.36));
  let ix = sx + w - icon - 2;
  const iy = sy + 2;
  const drawIcon = (markup: string, key: string) => {
    const img = svgImage(key, markup);
    if (img.complete) ctx.drawImage(img, ix, iy, icon, icon);
    ix -= icon + 2;
  };
  if (o.maintenance && !d.fixed && b.condition < o.threshold) drawIcon(UI_ICONS.wrench, 'i:wrench');
  if (d.thermal && (b.tank ?? 0) <= 0) drawIcon(UI_ICONS.fuel, 'i:fuel');
  if (off) drawIcon(UI_ICONS.off, 'i:off');
  const fontPx = Math.max(9, Math.min(13, z * 0.22));
  ctx.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  if (o.names && z >= 34) {
    ctx.fillStyle = 'rgba(15,23,42,0.8)';
    const label = d.name.length > 18 ? `${d.name.slice(0, 17)}…` : d.name;
    const tw = ctx.measureText(label).width + 6;
    ctx.fillRect(sx + w / 2 - tw / 2, sy + 2, tw, fontPx + 4);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, sx + w / 2, sy + fontPx + 3);
  }
  const cover = d.infra?.role === 'fuelProducer' && d.infra.fuel ? o.fuelCover[d.infra.fuel] : undefined;
  if (o.values && z >= 30 && (b.output !== 0 || b.available > 0 || d.storage || depot)) {
    const label = d.storage
      ? `${b.output !== 0 ? `${formatPower(b.output)} · ` : ''}${Math.round(level * 100)}%`
      : depot ? `${Math.round(depotLevel * 100)}% full`
      : cover !== undefined ? `${Math.round(Math.min(cover, 9.99) * 100)}% of plants` : formatPower(b.output);
    ctx.fillStyle = 'rgba(15,23,42,0.8)';
    const tw = ctx.measureText(label).width + 6;
    ctx.fillRect(sx + w / 2 - tw / 2, sy + h - 10 - fontPx - 4, tw, fontPx + 4);
    ctx.fillStyle = b.output >= 0 ? '#fde047' : '#7dd3fc';
    ctx.fillText(label, sx + w / 2, sy + h - 12);
  }
}
