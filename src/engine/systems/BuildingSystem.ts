import { BALANCE } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { UNIVERSAL_UPGRADES, UPGRADES } from '../data/upgrades';
import { defOf, isGenerator, type Def } from '../core/Helpers';
import { hasFeature, isBuildingUnlocked, isUpgradeUnlocked } from '../core/Modifiers';
import type { BuildingInstance, GameState, MapState } from '../core/State';
import { representedUnits } from '../world/BuildingAggregation';
import { footprint } from '../world/BuildingFootprints';
import { rectTiles } from '../world/TileGrid';
import { constructionCost, salvageValue } from './ConstructionSystem';
import { canAfford, spend } from './FinanceSystem';
import { manualRepairCost } from './MaintenanceSystem';
import { requestRefuel } from './LogisticsSystem';
import { transferToTank } from './FuelSystem';

/**
 * Operations on existing installations, kept distinct as in real asset management:
 * repair (condition) · component replacement (irreversible aging) · retrofit (upgrade, downtime)
 * · repowering (newer technology on the same site) · full rebuild.
 */

export function replacementValue(s: GameState, m: MapState, b: BuildingInstance): number {
  const d = defOf(b);
  const [w, h] = footprint(d, b.rot);
  return constructionCost(s, m, d, b.units, rectTiles(b.x, b.y, w, h, m.w));
}

export function availableUpgrades(b: BuildingInstance): string[] {
  const d = defOf(b);
  const list = [...(d.upgrades ?? []), ...(isGenerator(d) ? UNIVERSAL_UPGRADES : [])];
  return list.filter((u) => !b.upgrades.includes(u) && UPGRADES[u]);
}

export function upgradeCost(s: GameState, m: MapState, b: BuildingInstance, u: string): number {
  return replacementValue(s, m, b) * UPGRADES[u].costFrac;
}

export function manualRepair(s: GameState, m: MapState, b: BuildingInstance): string | null {
  if (b.condition >= 0.999) return 'Already in perfect condition.';
  const cost = manualRepairCost(s, b);
  if (!canAfford(s, cost)) return 'Not enough money.';
  spend(s, m, 'repairs', cost);
  b.opCost += cost;
  b.condition = 1;
  m.repairJobs = m.repairJobs.filter((j) => j.building !== b.id);
  s.run.repairs++;
  s.lifetime.repairs++;
  return null;
}

export function componentReplacementCost(s: GameState, m: MapState, b: BuildingInstance): number {
  return replacementValue(s, m, b) * BALANCE.componentReplaceFrac * (0.15 + b.wearOut / 0.6);
}

export function replaceComponents(s: GameState, m: MapState, b: BuildingInstance): string | null {
  const d = defOf(b);
  const geo = d.gen?.kind === 'geothermal';
  if (b.wearOut < 0.01 && !(geo && (b.pressure ?? 1) < 0.95)) return 'No irreversible wear to replace.';
  const cost = componentReplacementCost(s, m, b);
  if (!canAfford(s, cost)) return 'Not enough money.';
  spend(s, m, 'repairs', cost);
  b.wearOut = 0;
  if (geo) b.pressure = 1;
  setDowntime(s, b, d.storage ? 1 : 3, d.storage ? 'Cell replacement' : geo ? 'Well rework' : 'Component replacement');
  return null;
}

export function rebuildCost(s: GameState, m: MapState, b: BuildingInstance) {
  return replacementValue(s, m, b) * BALANCE.rebuildFrac;
}

export function rebuild(s: GameState, m: MapState, b: BuildingInstance): string | null {
  const cost = rebuildCost(s, m, b);
  if (!canAfford(s, cost)) return 'Not enough money.';
  spend(s, m, 'construction', cost);
  b.invested += cost * 0.5;
  b.condition = 1;
  b.wearOut = 0;
  b.ageH = 0;
  b.pressure = 1;
  setDowntime(s, b, 8, 'Full rebuild');
  m.repairJobs = m.repairJobs.filter((j) => j.building !== b.id);
  return null;
}

function setDowntime(s: GameState, b: BuildingInstance, h: number, reason: string) {
  if (h <= 0) return;
  b.downtimeUntil = Math.max(b.downtimeUntil, s.time) + h;
  b.downtimeReason = reason;
}

export function retrofit(s: GameState, m: MapState, b: BuildingInstance, u: string): string | null {
  const up = UPGRADES[u];
  if (!up) return 'Unknown upgrade.';
  if (!availableUpgrades(b).includes(u)) return b.upgrades.includes(u) ? 'Already installed.' : 'Not applicable to this installation.';
  if (!isUpgradeUnlocked(s, u)) return 'Upgrade not yet researched.';
  const cost = upgradeCost(s, m, b, u);
  if (!canAfford(s, cost)) return 'Not enough money.';
  spend(s, m, 'upgrades', cost);
  b.invested += cost;
  b.upgrades.push(u);
  setDowntime(s, b, up.downtimeH, `Retrofit: ${up.name}`);
  return null;
}

export interface FleetQuote {
  upgrade: string;
  targets: string[];
  cost: number;
  downtimeH: number;
  skippedInstalled: number;
}

export function fleetUpgradeQuote(s: GameState, m: MapState, u: string, defFilter?: string): FleetQuote {
  const targets: string[] = [];
  let cost = 0;
  let skipped = 0;
  for (const b of Object.values(m.buildings)) {
    if (defFilter && b.def !== defFilter) continue;
    if (b.upgrades.includes(u)) {
      skipped++;
      continue;
    }
    if (!availableUpgrades(b).includes(u)) continue;
    targets.push(b.id);
    cost += upgradeCost(s, m, b, u);
  }
  return { upgrade: u, targets, cost, downtimeH: UPGRADES[u]?.downtimeH ?? 0, skippedInstalled: skipped };
}

export function fleetUpgrade(s: GameState, m: MapState, u: string, defFilter?: string): string | null {
  if (!hasFeature(s, 'fleet.upgrade')) return 'Requires Fleet Management research.';
  if (!isUpgradeUnlocked(s, u)) return 'Upgrade not yet researched.';
  const q = fleetUpgradeQuote(s, m, u, defFilter);
  if (!q.targets.length) return 'No eligible installations.';
  if (!canAfford(s, q.cost)) return 'Not enough money for the whole fleet.';
  for (const id of q.targets) retrofit(s, m, m.buildings[id], u);
  return null;
}

/** Candidate technologies that can replace an installation on the same footprint. */
export function repowerOptions(s: GameState, m: MapState, b: BuildingInstance): Def[] {
  const d = defOf(b);
  const [w, h] = footprint(d, b.rot);
  return Object.values(BUILDINGS).filter((n) => {
    if (n.id === d.id || n.family !== d.family || n.fixed || !n.stages.includes(m.id) || !isBuildingUnlocked(s, n.id)) return false;
    const [nw, nh] = n.size;
    if (!((nw === w && nh === h) || (nh === w && nw === h))) return false;
    const tiles = rectTiles(b.x, b.y, w, h, m.w);
    return tiles.every((i) => n.terrain.includes(m.flooded[i] && m.flooded[i] !== b.id ? 'reservoir' : m.terrain[i])) && (n.gen?.kind === 'dam') === (d.gen?.kind === 'dam');
  });
}

export function repowerCost(s: GameState, m: MapState, b: BuildingInstance, to: string): number {
  const n = BUILDINGS[to];
  const [w, h] = footprint(defOf(b), b.rot);
  const tiles = rectTiles(b.x, b.y, w, h, m.w);
  const units = representedUnits(n, m.id, tiles.length);
  const fresh = constructionCost(s, m, n, units, tiles);
  return Math.max(fresh * 0.25, fresh - Math.max(0, salvageValue(s, b)));
}

export function repower(s: GameState, m: MapState, b: BuildingInstance, to: string): string | null {
  if (!repowerOptions(s, m, b).some((d) => d.id === to)) return 'Not a valid repowering option.';
  const n = BUILDINGS[to];
  const cost = repowerCost(s, m, b, to);
  if (!canAfford(s, cost)) return 'Not enough money.';
  const carried = Math.max(0, salvageValue(s, b));
  spend(s, m, 'construction', cost);
  const [w, h] = footprint(defOf(b), b.rot);
  const rot: 0 | 1 = n.size[0] === w && n.size[1] === h ? 0 : 1;
  b.def = to;
  b.rot = rot;
  b.units = representedUnits(n, m.id, w * h);
  b.invested = cost + carried;
  b.condition = 1;
  b.wearOut = 0;
  b.ageH = 0;
  b.upgrades = b.upgrades.filter((u) => n.upgrades?.includes(u));
  setDowntime(s, b, 4, `Repowering to ${n.name}`);
  return null;
}

export function manualRefuel(s: GameState, m: MapState, b: BuildingInstance): string | null {
  const d = defOf(b);
  if (!d.thermal) return 'This installation does not use fuel.';
  if ((m.fuel[d.thermal.fuel] ?? 0) <= 0) return 'Depot is empty — buy fuel first.';
  if (d.thermal.refuelOutageH) return requestRefuel(s, m, b.id, false) ? null : 'Refuelling already scheduled.';
  return transferToTank(m, b.id) > 0 ? null : 'Tank already full.';
}
