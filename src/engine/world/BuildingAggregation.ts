import { BALANCE } from '../data/balance';
import { STAGES } from '../data/stages';
import type { BuildingDef, StageId } from '../data/types';

/**
 * Number of represented units in an installation. Units are limited by the usable area of the
 * footprint (after access/infrastructure allowance) divided by each unit's *operating spacing*
 * area (e.g. wind turbines need several rotor diameters of separation), scaled by technology
 * density. Large fleets are a single aggregated object — no per-unit simulation.
 */
export function representedUnits(def: BuildingDef, stage: StageId, tiles: number, density = 1): number {
  if (!def.aggregate || def.unit.areaM2 <= 0) return 1;
  const cell = STAGES[stage].cellM;
  const usable = tiles * cell * cell * BALANCE.usableArea * density;
  return Math.floor(usable / def.unit.areaM2);
}

/** Fleet economies of scale: cost grows slightly sub-linearly with unit count. */
export function fleetCostFactor(units: number): number {
  return units <= 1 ? units : Math.pow(units, BALANCE.bulkExponent);
}

/** Maintenance load grows sub-linearly with fleet size (shared crews, spares and access). */
export function fleetMaintFactor(def: BuildingDef, units: number): number {
  if (!def.aggregate) return 1;
  const native = representedUnits(def, def.stages[0], def.size[0] * def.size[1]);
  return Math.max(0.3, Math.pow(Math.max(1, units) / Math.max(1, native), 0.25));
}
