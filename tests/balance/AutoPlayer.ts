import { BALANCE } from '../../src/engine/data/balance';
import { buildingsForStage } from '../../src/engine/data/buildings';
import { CONTRACT_LIST } from '../../src/engine/data/contracts';
import { EMPLOYEE_LIST } from '../../src/engine/data/employees';
import { FUELS } from '../../src/engine/data/fuels';
import { PRESTIGE_LIST, prestigeCost } from '../../src/engine/data/prestige';
import { RESEARCH_LIST } from '../../src/engine/data/research';
import { STAGE_LIST, STAGES } from '../../src/engine/data/stages';
import { TERRAIN } from '../../src/engine/data/terrain';
import type { StageId } from '../../src/engine/data/types';
import { GameEngine } from '../../src/engine/core/GameEngine';
import { defOf, depotCapacityKWh, isGenerator, maintenanceCapacity, type Def } from '../../src/engine/core/Helpers';
import { hasFeature, isBuildingUnlocked } from '../../src/engine/core/Modifiers';
import type { MapState } from '../../src/engine/core/State';
import { availableUpgrades, upgradeCost } from '../../src/engine/systems/BuildingSystem';
import { previewPlacement } from '../../src/engine/systems/ConstructionSystem';
import { evalMilestone } from '../../src/engine/systems/ProgressionSystem';
import { hireCost, tierAvailable } from '../../src/engine/systems/EmployeeSystem';
import { averageDemandKW } from '../../src/engine/systems/DemandSystem';
import { landBlockReason, landPrice } from '../../src/engine/systems/LandSystem';
import { mapMaintenanceLoad } from '../../src/engine/systems/MaintenanceSystem';
import { lockReasons, researchStatus } from '../../src/engine/systems/ResearchSystem';
import { nextStage, stageUnlockStatus } from '../../src/engine/systems/ProgressionSystem';
import { thermalLimits, fuelPrice } from '../../src/engine/systems/ThermalSystem';
import { canAfford } from '../../src/engine/systems/FinanceSystem';

/**
 * A greedy, rules-abiding player used to validate reachability and pacing. It only issues normal
 * commands — no cheats — so if it can reach the Universe, so can a player.
 */
const CF: Record<string, number> = { solar: 0.3, wind: 0.3, hydro: 0.5, dam: 0.5, tidal: 0.38, csp: 0.42, geothermal: 0.9, orbital: 0.92, stellar: 0.95, dyson: 0.85, pulsar: 0.5, penrose: 0.9, constant: 0.95 };

export class AutoPlayer {
  log: string[] = [];
  stageTimes: Partial<Record<StageId, number>> = {};
  constructor(public e: GameEngine, public verbose = false) {}

  /** Money the bot is saving for its current goal (grid upgrade / expansion). */
  reserve = 0;

  get s() {
    return this.e.state;
  }

  get free() {
    return Math.max(0, this.s.money - this.reserve);
  }

  private say(msg: string) {
    const line = `[t=${this.s.time.toFixed(0)}h real=${(this.s.time / 10).toFixed(1)}min $${this.s.money.toExponential(2)}] ${msg}`;
    this.log.push(line);
    if (this.verbose) console.log(line);
  }

  /** Value of one kWh produced on map m (local retail if demand unmet, else export). */
  private kwhValue(m: MapState): number {
    const st = STAGES[m.id];
    const demand = averageDemandKW(m);
    const gen = Object.values(m.buildings).reduce((a, b) => a + (isGenerator(defOf(b)) ? Math.max(0, b.available) : 0), 0);
    if (gen < demand * 0.9) return st.retail;
    const lim = st.grid[m.gridLevel].exportKW;
    return lim > 0 && gen < lim * 1.5 + demand ? st.export : st.export * 0.15;
  }

  private estimate(m: MapState, d: Def, units: number, tiles: number[]): number {
    const value = this.kwhValue(m);
    if (d.thermal) {
      const fuelPerKWh = FUELS[d.thermal.fuel].price / FUELS[d.thermal.fuel].energyPerUnit / d.thermal.eta;
      return Math.max(0, value - fuelPerKWh) * d.unit.kw * units * 0.7;
    }
    const kind = d.gen?.kind ?? 'solar';
    let site = 1;
    if (kind === 'solar' || kind === 'stellar' || kind === 'dyson' || (kind === 'orbital' && STAGES[m.id].space)) site = tiles.reduce((a, i) => a + TERRAIN[m.terrain[i]].solar, 0) / tiles.length;
    if (kind === 'wind') site = Math.pow(tiles.reduce((a, i) => a + TERRAIN[m.terrain[i]].wind, 0) / tiles.length, 2);
    if (kind === 'hydro') site = Math.min(1, (m.riverFlow[tiles[0]] * 9.81 * (d.gen?.head ?? 1) * (d.gen?.eta ?? 0.7)) / Math.max(1e-9, d.unit.kw));
    if (kind === 'dyson') site *= 0.6;
    return value * d.unit.kw * units * (CF[kind] ?? 0.5) * site;
  }

  /** Best placement of any generator on owned free land: (score, def, x, y, rot). */
  private bestBuild(m: MapState, budget: number) {
    let best: { score: number; def: string; x: number; y: number; rot: 0 | 1; cost: number } | null = null;
    const defs = buildingsForStage(m.id).filter((d) => isGenerator(d) && isBuildingUnlocked(this.s, d.id));
    for (const d of defs) {
      let found = 0;
      for (const rot of d.size[0] !== d.size[1] ? ([0, 1] as const) : ([0] as const)) {
        for (let y = 0; y < m.h && found < 10; y++)
          for (let x = 0; x < m.w && found < 10; x++) {
            const i = y * m.w + x;
            if (!m.owned[i] || m.occ[i]) continue;
            if (!d.terrain.includes(m.flooded[i] ? 'reservoir' : m.terrain[i])) continue;
            const p = previewPlacement(this.s, m, d.id, x, y, rot);
            const okButMoney = p.ok || (p.reasons.length === 1 && p.reasons[0] === 'Not enough money.');
            if (!okButMoney || p.cost > budget) continue;
            if ((p.flood && p.flood.buildings.length) || p.land) continue;
            found++;
            const score = this.estimate(m, d, p.units, p.tiles) / p.cost;
            if (!best || score > best.score) best = { score, def: d.id, x, y, rot, cost: p.cost };
          }
      }
    }
    return best;
  }

  private buyLand(m: MapState, budget: number): boolean {
    let best = -1, bestP = Infinity;
    for (let i = 0; i < m.w * m.h; i++) {
      if (landBlockReason(this.s, m, i)) continue;
      // prefer tiles that suit generation (not water unless offshore)
      const t = m.terrain[i];
      const pen = ['river', 'lake'].includes(t) ? 0.6 : t === 'forest' ? 1.4 : t === 'ocean' ? 1.8 : t === 'desert' ? 0.8 : 1;
      const p = landPrice(this.s, m, i) * pen;
      if (p < bestP) {
        bestP = p;
        best = i;
      }
    }
    if (best < 0 || landPrice(this.s, m, best) > budget) return false;
    return this.e.dispatch({ type: 'buyLand', map: m.id, x: best % m.w, y: Math.floor(best / m.w) }).ok;
  }

  /** Like a sensible player: pay small protective costs, decline demand booms it may not cover. */
  private incident() {
    const i = this.e.state.incidents.pending;
    if (!i) return;
    const pay = i.kind !== 'demandBoom' && i.cost <= this.e.state.money * 0.2;
    this.e.dispatch({ type: 'resolveIncident', accept: pay });
  }

  private research() {
    const s = this.s;
    const active = Object.keys(s.research.active).length;
    // research required by the next expansion (and its prerequisites) gets priority over saving
    const needed = new Set<string>();
    const ns = nextStage(s);
    const want = (id: string) => {
      if (needed.has(id) || s.research.done[id] !== undefined) return;
      needed.add(id);
      for (const p of RESEARCH_LIST.find((r) => r.id === id)?.prereq ?? []) want(p);
    };
    if (ns)
      for (const x of stageUnlockStatus(s, ns).milestones) {
        if (x.m.kind === 'researchDone') want(x.m.id);
        if (x.m.kind === 'storage' && !x.done) {
          const newest = STAGE_LIST.filter((st) => s.maps[st.id]).pop()!;
          for (const d of buildingsForStage(newest.id)) if (d.storage && d.research) want(d.research);
        }
      }
    // native generation tech of the newest map
    const newestStage = STAGE_LIST.filter((st) => s.maps[st.id]).pop()!;
    for (const d of buildingsForStage(newestStage.id)) if (isGenerator(d) && d.research && d.stages[0] === newestStage.id) want(d.research);
    if (s.maps.universe) want('universal_5');
    const avail = RESEARCH_LIST.filter((r) => researchStatus(s, r.id) === 'available' || researchStatus(s, r.id) === 'paused').sort((a, b) => Number(needed.has(b.id)) - Number(needed.has(a.id)) || a.rp - b.rp);
    const pick = [...avail.filter((r) => needed.has(r.id)), ...avail.filter((r) => !needed.has(r.id)).slice(0, Math.max(0, 3 - active))];
    for (const r of pick) {
      const budget = needed.has(r.id) ? s.money * 0.5 : Math.max(this.free * 0.6, s.money * 0.15);
      if (r.cost > budget || (s.time < 100 && r.cost > this.free * 0.25)) continue;
      const res = this.e.dispatch({ type: 'startResearch', id: r.id });
      if (res.ok) { this.say(`research ${r.id}`); if (process.env.DBG) console.log("RES", s.time, r.id, r.cost, this.free, this.reserve, s.money); }
    }
    void lockReasons;
  }

  private staff(m: MapState) {
    const s = this.s;
    const load = mapMaintenanceLoad(s, m);
    const cap = maintenanceCapacity(s, m);
    if (load > cap * 0.75 || (cap === 0 && Object.keys(m.buildings).length > 2)) {
      const tiers = EMPLOYEE_LIST.filter((t) => t.group === 'maintenance' && !tierAvailable(s, t.id)).sort((a, b) => b.capacity - a.capacity);
      for (const t of tiers) {
        const c = hireCost(t.id, m.id);
        if (c < this.free * 0.25 && (t.capacity < load * 3 || t === tiers[tiers.length - 1])) {
          if (this.e.dispatch({ type: 'hire', tier: t.id, count: 1, map: m.id }).ok) return this.say(`hire ${t.id} @${m.id} load=${load.toFixed(2)} cap=${cap.toFixed(2)}`);
        }
      }
    }
    // logistics for thermal maps
    const thermal = Object.values(m.buildings).filter((b) => defOf(b).thermal).length;
    const slots = 1 + Object.entries(m.workforce).reduce((a, [k, n]) => a + (k === 'driver' ? n : k === 'fleet_manager' ? 3 * n : k === 'autofreight' ? 8 * n : 0), 0);
    if (thermal > slots) {
      const t = EMPLOYEE_LIST.filter((x) => x.group === 'logistics' && !tierAvailable(s, x.id)).sort((a, b) => b.capacity - a.capacity)[0];
      if (t && hireCost(t.id, m.id) < s.money * 0.2) this.e.dispatch({ type: 'hire', tier: t.id, count: 1, map: m.id });
    }
  }

  private researchers() {
    const s = this.s;
    if (!Object.keys(s.research.active).length) return;
    const wageBill = EMPLOYEE_LIST.filter((t) => t.group === 'research').reduce((a, t) => a + t.wage * (s.workforce[t.id] ?? 0), 0);
    if (wageBill > s.rates.revenue * 0.08) return;
    const tiers = EMPLOYEE_LIST.filter((t) => t.group === 'research' && !tierAvailable(s, t.id)).sort((a, b) => b.capacity - a.capacity);
    for (const t of tiers) {
      if (t.hire < this.free * 0.08 && t.wage * 20 < Math.max(1, s.rates.net)) {
        if (this.e.dispatch({ type: 'hire', tier: t.id, count: 1 }).ok) return;
      }
    }
  }





  private fuel(m: MapState) {
    const s = this.s;
    const used = new Set(Object.values(m.buildings).map((b) => defOf(b).thermal?.fuel).filter(Boolean));
    for (const f of used) {
      if (!f) continue;
      if (hasFeature(s, 'fuel.autoBuy')) {
        if (m.policies.fuel[f]?.mode !== 'full') this.e.dispatch({ type: 'fuelPolicy', map: m.id, fuel: f, patch: { mode: 'full', minInventory: 0.6, maxPriceFactor: 1.3 } });
      } else {
        const have = (m.fuel[f] ?? 0) * FUELS[f].energyPerUnit;
        const inTransit = m.logisticsJobs.some((j) => j.kind === 'delivery' && j.fuel === f);
        if (!inTransit && have < depotCapacityKWh(m) * 0.3) {
          const qty = (depotCapacityKWh(m) * 0.6) / FUELS[f].energyPerUnit;
          const cost = qty * fuelPrice(s, f);
          if (cost < s.money * 0.4) this.e.dispatch({ type: 'buyFuel', map: m.id, fuel: f, qty });
        }
      }
    }
    // economic mode for thermal plants with expensive fuel vs export
    for (const b of Object.values(m.buildings)) {
      const d = defOf(b);
      if (!d.thermal || d.thermal.parasitic) continue;
      const L = thermalLimits(s, m, b, d, 1 / 24);
      const want = L.mc < STAGES[m.id].export * 0.9 ? 'baseload' : 'follow';
      if (b.mode !== want) this.e.dispatch({ type: 'configure', map: m.id, id: b.id, patch: { mode: want } });
    }
  }

  private storage(m: MapState, force = false) {
    const s = this.s;
    const curt = m.flow.curtailed;
    if (!force && curt <= 0 && !(m.id === 'backyard' && m.flow.imported > 0.5)) return;
    const defs = buildingsForStage(m.id).filter((d) => d.storage && isBuildingUnlocked(s, d.id));
    for (const d of defs.reverse()) {
      for (let i = 0; i < m.w * m.h; i++) {
        if (!m.owned[i] || m.occ[i]) continue;
        const p = previewPlacement(s, m, d.id, i % m.w, Math.floor(i / m.w), 0);
        if (p.ok && !p.land && p.cost < this.free * 0.3) {
          this.e.dispatch({ type: 'place', map: m.id, def: d.id, x: i % m.w, y: Math.floor(i / m.w), rot: 0 });
          this.say(`storage ${d.id}@${m.id}`);
          return;
        }
      }
    }
    if (force) this.buyLand(m, this.free * 0.3);
  }

  private infra(m: MapState) {
    const s = this.s;
    const want: string[] = [];
    if (m.id === 'backyard') want.push('garage_lab');
    else want.push('research_lab');
    const thermal = Object.values(m.buildings).some((b) => defOf(b).thermal);
    if (thermal) want.push('fuel_depot');
    if (Object.keys(m.buildings).length > 10) want.push('maint_depot');
    if (STAGES[m.id].index >= 2 && hasFeature(s, 'market.spot')) want.push('trading_desk');
    for (const id of want) {
      const have = Object.values(m.buildings).filter((b) => b.def === id).length;
      if (have >= (id === 'research_lab' ? 2 : 1)) continue;
      for (let i = 0; i < m.w * m.h; i++) {
        if (!m.owned[i] || m.occ[i]) continue;
        const p = previewPlacement(s, m, id, i % m.w, Math.floor(i / m.w), 0);
        if (p.ok && !p.land && p.cost < this.free * 0.2) {
          this.e.dispatch({ type: 'place', map: m.id, def: id, x: i % m.w, y: Math.floor(i / m.w), rot: 0 });
          this.say(`infra ${id}@${m.id}`);
          return;
        }
      }
    }
  }

  private upgrades(m: MapState) {
    const s = this.s;
    for (const b of Object.values(m.buildings)) {
      for (const u of availableUpgrades(b)) {
        if (!s.research.done || !this.e) continue;
        const c = upgradeCost(s, m, b, u);
        if (c < this.free * 0.05 && b.downtimeUntil <= s.time) {
          const r = this.e.dispatch({ type: 'retrofit', map: m.id, id: b.id, upgrade: u });
          if (r.ok) return;
        }
      }
    }
  }

  private prestigeShop() {
    const s = this.s;
    const order = ['p_revenue', 'p_research', 'p_starter', 'p_capital', 'p_generation', 'p_autofuel', 'p_bulkland', 'p_wear', 'p_maint', 'p_land', 'p_workforce', 'p_fuel', 'p_storage', 'p_keepland', 'p_memory', 'p_offline'];
    let bought = true;
    while (bought) {
      bought = false;
      for (const id of order) {
        const d = PRESTIGE_LIST.find((p) => p.id === id)!;
        const lvl = s.prestige.upgrades[id] ?? 0;
        if (lvl < d.maxLevel && prestigeCost(id, lvl) <= s.prestige.available) {
          if (this.e.dispatch({ type: 'buyPrestige', id }).ok) bought = true;
        }
      }
    }
  }

  /** Candidate investments ranked by estimated return per dollar. */
  candidates(maps: MapState[]) {
    const s = this.s;
    const out: { roi: number; cost: number; label: string; run: () => boolean }[] = [];
    for (const m of maps) {
      const st = STAGES[m.id];
      const ring = this.samples.get(m.id) ?? [];
      const frac = ring.reduce((a, r) => a + r[0], 0) / Math.max(1e-9, ring.reduce((a, r) => a + r[1], 0));
      this.curt.set(m.id, frac);
      const saturated = frac > 0.06;
      const b = saturated ? null : this.bestBuild(m, Infinity);
      if (b && b.score > 1 / 400) out.push({ roi: b.score, cost: b.cost, label: `build ${b.def}@${m.id}`, run: () => this.e.dispatch({ type: 'place', map: m.id, def: b.def, x: b.x, y: b.y, rot: b.rot, acceptFlood: true }).ok });
      if (!b && !saturated) {
        // need land: estimate using the best 1-tile generator on the cheapest purchasable tile
        let tile = -1, price = Infinity;
        for (let i = 0; i < m.w * m.h; i++) {
          if (landBlockReason(s, m, i)) continue;
          const pen = ['river', 'lake', 'ocean'].includes(m.terrain[i]) ? 1.6 : m.terrain[i] === 'forest' ? 1.3 : 1;
          const p = landPrice(s, m, i) * pen;
          if (p < price) { price = p; tile = i; }
        }
        if (tile >= 0) {
          const lp = landPrice(s, m, tile);
          const ref = this.refPerTile(m);
          if (ref) out.push({ roi: ref.value / (ref.cost + lp * 1.2), cost: lp, label: `land@${m.id}`, run: () => this.e.dispatch({ type: 'buyLand', map: m.id, x: tile % m.w, y: Math.floor(tile / m.w) }).ok });
        }
      }
      const next = st.grid[m.gridLevel + 1];
      if (next && (!next.research || s.research.done[next.research] !== undefined)) {
        const cur = st.grid[m.gridLevel].exportKW;
        const curtAvg = (this.curt.get(m.id) ?? 0) * (m.flow.generation + m.flow.curtailed + 1e-9);
        const extra = Math.min(next.exportKW - cur, Math.max(m.flow.curtailed, curtAvg * 2) + (m.lastExportCapped ? cur * 0.3 : 0));
        const gens = Object.values(m.buildings).filter((x) => isGenerator(defOf(x))).length;
        const value = cur === 0 && gens >= 2 ? next.cost : extra * 0.45 * st.export;
        if (value > 0) out.push({ roi: value / next.cost, cost: next.cost, label: `grid@${m.id}`, run: () => this.e.dispatch({ type: 'upgradeGrid', map: m.id }).ok });
      }
      // customer contracts: sell surplus locally at retail instead of exporting
      const cap = Object.values(m.buildings).reduce((a, x) => a + (isGenerator(defOf(x)) ? Math.max(0, x.available) : 0), 0);
      for (const c of CONTRACT_LIST.filter((c) => c.stage === m.id && !m.contracts.includes(c.id) && !(m.id === 'universe' && s.research.done.universal_5 !== undefined))) {
        if (c.requires && !evalMilestone(s, c.requires).done) continue;
        const surplus = Math.max(0, m.flow.exported + m.flow.curtailed);
        const value = m.id === 'backyard' ? (c.income ?? 0) - c.kw * st.import * 0.6 : Math.min(c.kw, surplus) * (c.price - st.export * (m.flow.curtailed > 0 ? 0 : 1)) - Math.max(0, c.kw - surplus) * 0.05 * c.price;
        void cap;
        if (value > 0) out.push({ roi: value / Math.max(1e-9, c.fee), cost: c.fee, label: `contract ${c.id}`, run: () => this.e.dispatch({ type: 'signContract', map: m.id, contract: c.id }).ok });
      }
    }
    return out.sort((a, b) => b.roi - a.roi);
  }

  private curt = new Map<string, number>();
  private samples = new Map<string, [number, number][]>();
  private refCache = new Map<string, { value: number; cost: number; t: number }>();
  /** Reference value/cost of filling one tile with the best unlocked 1×1-ish generator. */
  private refPerTile(m: MapState) {
    const c = this.refCache.get(m.id);
    if (c && this.s.time - c.t < 24) return c;
    let best: { value: number; cost: number; t: number } | null = null;
    for (const d of buildingsForStage(m.id).filter((d) => isGenerator(d) && isBuildingUnlocked(this.s, d.id) && !d.thermal && d.gen?.kind !== 'hydro' && d.gen?.kind !== 'dam')) {
      const tiles = d.size[0] * d.size[1];
      const units = Math.max(1, Math.floor(((STAGES[m.id].cellM ** 2) * 0.85 * tiles) / Math.max(1e-9, d.unit.areaM2)));
      const cost = (d.unitCost * Math.pow(units, 0.97)) / tiles;
      const value = this.estimate(m, d, units, Array(tiles).fill(m.terrain.indexOf('grass') >= 0 ? m.terrain.indexOf('grass') : 0)) / tiles;
      if (!d.aggregate && d.unit.areaM2 <= 0) continue;
      if (!best || value / cost > best.value / best.cost) best = { value, cost, t: this.s.time };
    }
    if (best) this.refCache.set(m.id, best);
    return best;
  }

  /** One decision round. */
  act() {
    const s = this.s;
    this.reserve = 0;
    if (s.prestige.available > 0) this.prestigeShop();
    const next = nextStage(s);
    if (next) {
      const u = stageUnlockStatus(s, next);
      if (u.allDone && u.prevUnlocked && s.money > u.cost * 0.5) this.reserve = u.cost;
      if (u.canUnlock) {
        this.e.dispatch({ type: 'unlockStage', stage: next });
        this.stageTimes[next] = s.time;
        this.reserve = 0;
        this.say(`UNLOCKED ${next}`);
      }
    }
    const maps = STAGE_LIST.map((st) => s.maps[st.id]).filter(Boolean) as MapState[];
    this.endgame();
    for (const m of maps) {
      const ring = this.samples.get(m.id) ?? [];
      ring.push([m.flow.curtailed, m.flow.generation + m.flow.curtailed]);
      if (ring.length > 12) ring.shift();
      this.samples.set(m.id, ring);
    }
    // decide the savings goal first so side spending respects it
    const goal = this.candidates(maps)[0];
    const baseReserve = this.reserve;
    if (goal) this.reserve += goal.cost;
    this.incident();
    this.research();
    this.researchers();
    for (const m of maps) {
      this.staff(m);
      this.fuel(m);
      this.infra(m);
    }
    this.reserve = baseReserve;
    // ROI-ranked investing; save up for the best option if it is not yet affordable
    for (let k = 0; k < 12; k++) {
      const all = this.candidates(maps);
      const best = all[0];
      if (!best) break;
      const affordable = all.find((x) => x.cost <= this.free);
      let c = best;
      if (best.cost > this.free) {
        if (affordable && (affordable.roi * 2 >= best.roi || best.cost > this.free * 10)) c = affordable;
        else {
          this.reserve += best.cost;
          break;
        }
      }
      if (!c.run()) break;
      if (this.verbose) this.say(`${c.label} roi=${(c.roi * 100).toFixed(2)}%/h cost=${c.cost.toExponential(2)}`);
    }
    const ns = nextStage(s);
    const needStorage = ns && stageUnlockStatus(s, ns).milestones.some((x) => x.m.kind === 'storage' && !x.done);
    for (const m of maps) {
      for (let k = 0; k < (needStorage && m === maps[maps.length - 1] ? 3 : 1); k++) this.storage(m, !!needStorage && m === maps[maps.length - 1]);
      this.upgrades(m);
    }
    for (const m of maps) if (maintenanceCapacity(s, m) <= 0) this.e.dispatch({ type: 'repairAll', map: m.id });
    void canAfford;
    void BALANCE;
  }

  /** Universe: build the Convergence Engine once researched, keep feeding it surplus. */
  private endgame() {
    const s = this.s;
    const u = s.maps.universe;
    if (!u || s.research.done.universal_5 === undefined) return;
    if (Object.values(u.buildings).some((b) => b.def === 'convergence_engine')) {
      // feed the engine: customer contracts would consume the surplus it needs
      for (const c of [...u.contracts]) this.e.dispatch({ type: 'cancelContract', map: 'universe', contract: c });
      return;
    }
    this.reserve = Math.max(this.reserve, 3e14);
    for (let y = 0; y + 3 <= u.h; y++)
      for (let x = 0; x + 3 <= u.w; x++) {
        const p = previewPlacement(s, u, 'convergence_engine', x, y, 0);
        if (p.ok && !p.land) {
          this.e.dispatch({ type: 'place', map: 'universe', def: 'convergence_engine', x, y, rot: 0 });
          this.say('BUILT convergence engine');
          return;
        }
        if (!p.land && p.reasons.length === 1 && p.reasons[0] === 'Not enough money.') return; // spot exists: keep saving
      }
    this.buyLand(u, s.money * 0.3);
  }

  /** Run for `hours` game hours, acting every `every` hours. Returns false if stuck. */
  run(hours: number, every = 2, until?: () => boolean) {
    const end = this.s.time + hours;
    while (this.s.time < end) {
      this.act();
      // late game: coarser steps keep the long validation run fast (offline-equivalent accuracy)
      const late = !!this.s.maps.solar;
      const dt = late ? 0.5 : 0.25;
      const span = late ? every * 2 : every;
      for (let i = 0; i < span / dt; i++) this.e.tick(dt);
      if (until?.()) return true;
    }
    return false;
  }
}
