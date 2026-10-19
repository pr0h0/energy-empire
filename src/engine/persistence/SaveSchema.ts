import { STAGE_IDS } from '../data/types';
import type { GameState } from '../core/State';

/** Structural validation before loading. Rejects anything that could corrupt the simulation. */
export function validateSave(x: unknown): string[] {
  const e: string[] = [];
  const o = x as Record<string, unknown>;
  if (!o || typeof o !== 'object') return ['Save is not an object.'];
  const num = (v: unknown, path: string) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) e.push(`${path} must be a finite number`);
  };
  num(o.version, 'version');
  num(o.seed, 'seed');
  num(o.time, 'time');
  num(o.money, 'money');
  num(o.nextId, 'nextId');
  if (!o.maps || typeof o.maps !== 'object') e.push('maps missing');
  else {
    const maps = o.maps as Record<string, Record<string, unknown>>;
    if (!maps.backyard) e.push('backyard map missing');
    for (const [k, m] of Object.entries(maps)) {
      if (!(STAGE_IDS as readonly string[]).includes(k)) e.push(`unknown map ${k}`);
      if (!m || typeof m !== 'object') continue;
      const n = (m.w as number) * (m.h as number);
      for (const arr of ['terrain', 'elev', 'owned', 'occ', 'flooded', 'riverBase', 'riverNext']) {
        if (!Array.isArray(m[arr]) || (m[arr] as unknown[]).length !== n) e.push(`maps.${k}.${arr} malformed`);
      }
      if (!m.buildings || typeof m.buildings !== 'object') e.push(`maps.${k}.buildings missing`);
      else
        for (const [id, b] of Object.entries(m.buildings as Record<string, Record<string, unknown>>)) {
          if (typeof b.def !== 'string') e.push(`building ${id} has no type`);
          for (const f of ['x', 'y', 'units', 'condition', 'invested']) num(b[f], `building ${id}.${f}`);
        }
    }
  }
  const p = o.prestige as Record<string, unknown> | undefined;
  if (!p) e.push('prestige missing');
  else for (const f of ['lifetimeRevenue', 'awarded', 'available', 'spent', 'resets']) num(p[f], `prestige.${f}`);
  if (p && typeof p.awarded === 'number' && typeof p.available === 'number' && typeof p.spent === 'number' && p.available > (p.awarded as number) - (p.spent as number) + 1e-6)
    e.push('prestige accounting inconsistent (available exceeds awarded − spent)');
  const r = o.research as Record<string, unknown> | undefined;
  if (!r || typeof r.done !== 'object' || typeof r.active !== 'object') e.push('research missing');
  return e;
}

/** FNV-1a checksum used to detect truncated/corrupted save payloads. */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function isGameState(x: unknown): x is GameState {
  return validateSave(x).length === 0;
}
