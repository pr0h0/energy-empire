import type { BuildingDef } from '../data/types';

/** Footprint dimensions honouring rotation (rot = 1 swaps width and height). */
export function footprint(def: BuildingDef, rot: 0 | 1): [number, number] {
  const [w, h] = def.size;
  return rot ? [h, w] : [w, h];
}

export const canRotate = (def: BuildingDef) => def.size[0] !== def.size[1];
