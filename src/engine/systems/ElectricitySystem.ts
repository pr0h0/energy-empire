import { BALANCE } from '../data/balance';
import { FUELS } from '../data/fuels';
import { STAGES } from '../data/stages';
import { type Def, defOf, gridLimits, mapAgg, ratedKW, storageCapacityKWh, storagePowerKW } from '../core/Helpers';
import { getMods, hasFeature, localMods } from '../core/Modifiers';
import type { BuildingInstance, GameState, MapState, StorageMode } from '../core/State';
import { emptyFlow } from '../world/MapManager';
import { customerDemand } from './DemandSystem';
import { earn, spend } from './FinanceSystem';
import { pricesAt } from './GridSystem';
import { burnFuel, fuelPrice, thermalLimits, type ThermalLimits } from './ThermalSystem';
import { avgTerrain, envAt, pulsarFactor, siteSolar, siteWind, tilesOf, windPower } from './WeatherSystem';
import { notify } from '../core/GameEvents';
import { incidentMult } from './IncidentSystem';

/**
 * Per-map electricity dispatch for one fixed time step.
 *
 * Merit order (no energy is ever double counted — see the balance check at the end):
 *  deficit: must-run → hydro/CSP flex → storage (policy) → load-following thermal → emergency
 *           storage → grid import → unserved (loads shed before customers)
 *  surplus: back thermal down to min stable load → charge storage → endgame sink → export →
 *           "sell surplus" storage → curtail
 *  then: economic thermal export, price-driven storage arbitrage.
 */

const G = 9.81; // kW per (m³/s · m) for water: P = ρ g Q H η with ρ = 1000 kg/m³ → 9.81 kW

interface Must { b: BuildingInstance; d: Def; avail: number; out: number }
interface Thermal { b: BuildingInstance; d: Def; L: ThermalLimits; out: number; p: number }
interface Flex { b: BuildingInstance; d: Def; must: number; flex: number; out: number; kind: 'dam' | 'csp'; H?: number; eta?: number; qin?: number }
interface Store { b: BuildingInstance; d: Def; mode: StorageMode; cap: number; power: number; etaIn: number; etaOut: number; reserveKWh: number; charge: number; discharge: number; fromGrid: number }
interface Load { b: BuildingInstance; d: Def; kw: number; kind: 'producer' | 'ignition' }

export function conditionFactor(d: Def, c: number): number {
  switch (d.family) {
    case 'wind': return 0.6 + 0.4 * c;
    case 'solar': case 'orbital': case 'stellar': return 0.5 + 0.5 * c;
    default: return 0.8 + 0.2 * c;
  }
}

/** Seasonal river flows with dam releases propagated downstream (one-step lag for cascades). */
export function updateRivers(m: MapState, seasonal: number, hasHydro = true) {
  if (!m.riverOrder.length) return;
  if (!hasHydro) {
    // no water users: plain seasonal flows (cheap)
    for (const i of m.riverOrder) m.riverFlow[i] = m.riverBase[i] * seasonal;
    return;
  }
  const delta = new Map<number, number>();
  const damAt = new Map<number, BuildingInstance>();
  for (const b of Object.values(m.buildings)) if (defOf(b).gen?.kind === 'dam') damAt.set(b.y * m.w + b.x, b);
  for (const i of m.riverOrder) {
    const base = m.riverBase[i] * seasonal;
    const din = delta.get(i) ?? 0;
    let flow = Math.max(0, base + din);
    let dout = din;
    const dam = damAt.get(i);
    if (dam && dam.release !== undefined) {
      dam.reservoirTarget ??= 0.75;
      dam.inflow = flow;
      flow = dam.release;
      dout = flow - base;
    }
    m.riverFlow[i] = flow;
    const n = m.riverNext[i];
    if (n >= 0) delta.set(n, (delta.get(n) ?? 0) + dout);
  }
}

const avgDropCache = new WeakMap<number[], number>();
/**
 * Run-of-river head factor from terrain: how steeply the river falls from this tile to the next.
 * Normalised per map so an average river tile is ×1 (flat stretches ×0.75, steep ones up to ×1.5).
 */
export function hydroHead(m: MapState, i: number): number {
  const drop = (j: number) => (m.riverNext[j] >= 0 ? Math.max(0, m.elev[j] - m.elev[m.riverNext[j]]) : 0);
  let avg = avgDropCache.get(m.elev);
  if (avg === undefined) {
    avg = m.riverOrder.length ? m.riverOrder.reduce((a, j) => a + drop(j), 0) / m.riverOrder.length : 0;
    avgDropCache.set(m.elev, avg);
  }
  if (avg <= 1e-9) return 1;
  return Math.max(0.75, Math.min(1.5, 0.75 + 0.25 * (drop(i) / avg)));
}

export interface ElectricityTick {
  produced: number;
  sold: number;
  revenue: number;
  imbalance: number;
  fuelUnits: number;
}

export function simulateElectricity(s: GameState, m: MapState, t: number, dt: number): ElectricityTick {
  const st = STAGES[m.id];
  const M = getMods(s).m;
  const env = envAt(m, t);
  updateRivers(m, env.river, mapAgg(m).hydro > 0);
  const dem = customerDemand(s, m, t);
  const pr = pricesAt(s, m, t);
  const lim = gridLimits(s, m);
  const now = s.time;
  const household = m.id === 'backyard';

  const must: Must[] = [];
  const thermals: Thermal[] = [];
  const flexes: Flex[] = [];
  const stores: Store[] = [];
  const loads: Load[] = [];
  const sinks: { b: BuildingInstance; cap: number; out: number }[] = [];
  const dysons: Must[] = [];
  let dysonRaw = 0;

  for (const b of Object.values(m.buildings)) {
    const d = defOf(b);
    if (d.fixed) continue;
    b.ageH += dt;
    const down = b.downtimeUntil > now;
    const shut = b.condition < (d.shutdownBelow ?? 0.1);
    b.available = 0;
    if (!b.enabled || down || shut) {
      b.output = 0;
      b.status = !b.enabled ? 'Switched off' : down ? `${b.downtimeReason ?? 'Downtime'} (${(b.downtimeUntil - now).toFixed(1)} h left)` : 'Shut down: condition critical — repair required';
      if (d.thermal?.parasitic) b.ignited = false;
      if (d.gen?.kind === 'dam') {
        // gates open: inflow passes straight through
        b.release = b.inflow ?? 0;
      }
      continue;
    }
    b.status = 'Operating';
    const cf = conditionFactor(d, b.condition);
    const lm = localMods(b);
    const rated = ratedKW(b, d);
    const terrBonus = d.terrainBonus ? avgTerrain(m, tilesOf(m, b, d), (tt) => d.terrainBonus![tt] ?? 1) : 1;

    if (d.storage) {
      const cap = storageCapacityKWh(s, b, d);
      b.stored = Math.min(b.stored ?? 0, cap);
      const mode = b.storageMode ?? m.policies.defaultStorageMode;
      const etaBoost = lm.storageEta + (M['storage.eta'] - 1);
      const advanced = hasFeature(s, 'battery.advanced');
      stores.push({
        b, d, mode, cap, power: storagePowerKW(s, b, d) * (0.7 + 0.3 * b.condition), etaIn: Math.min(0.995, d.storage.etaIn + etaBoost / 2), etaOut: Math.min(0.995, d.storage.etaOut + etaBoost / 2),
        reserveKWh: advanced ? cap * (b.reserve ?? 0) : 0, charge: 0, discharge: 0, fromGrid: 0,
      });
      b.available = storagePowerKW(s, b, d);
      continue;
    }
    if (d.infra) {
      if (d.infra.role === 'fuelProducer') loads.push({ b, d, kw: (d.infra.loadKW ?? 0) * b.units, kind: 'producer' });
      else if (d.infra.role === 'sink') sinks.push({ b, cap: d.infra.kw ?? 0, out: 0 });
      continue;
    }
    if (d.thermal) {
      b.mode ??= d.family === 'nuclear' || d.family === 'fusion' || d.family === 'stellar' || d.family === 'exotic' ? 'baseload' : 'follow';
      const p = d.thermal.parasitic ?? 0;
      if (p > 0 && !b.ignited) {
        if (b.mode !== 'off' && (b.tank ?? 0) > 0) {
          loads.push({ b, d, kw: rated * 0.3, kind: 'ignition' });
          b.status = `Igniting plasma (${Math.round(((b.ignition ?? 0) / (rated * (d.thermal.ignitionH ?? 0.5))) * 100)}%)`;
        } else b.status = (b.tank ?? 0) <= 0 ? 'Cold — no fuel' : 'Cold standby';
        b.output = 0;
        continue;
      }
      const L = thermalLimits(s, m, b, d, dt);
      const k = 1 - p;
      L.lo *= k; L.hi *= k; L.max *= k; L.minStable *= k;
      b.coolingCap = L.coolingCap;
      b.available = L.max;
      const out = b.mode === 'baseload' ? L.hi : L.lo;
      thermals.push({ b, d, L, out, p });
      if ((b.tank ?? 0) <= 0) b.status = 'Out of fuel';
      else if (L.limitedBy === 'cooling capacity' && L.hi < L.max * 0.999) b.status = 'Throttled by cooling capacity (safe mode)';
      continue;
    }
    const g = d.gen!;
    let avail = 0;
    switch (g.kind) {
      case 'solar': {
        const f = m.id === 'planet' ? env.solarSmooth : env.solar;
        avail = rated * f * siteSolar(m, b, d) * M['solar.output'] * (1 + lm.output) * cf;
        break;
      }
      case 'wind': {
        const kite = d.id === 'kite' ? 1.45 : 1;
        avail = rated * windPower(env.wind * siteWind(m, b, d) * kite * 0.92) * env.windOut * M['wind.output'] * (1 + lm.output) * cf;
        break;
      }
      case 'hydro': {
        const q = m.riverFlow[b.y * m.w + b.x] ?? 0;
        avail = Math.min(rated * (1 + lm.output), G * q * (g.head ?? 1) * hydroHead(m, b.y * m.w + b.x) * (g.eta ?? 0.7) * M['hydro.output'] * (1 + lm.output)) * cf;
        break;
      }
      case 'tidal':
        avail = rated * env.tide * M['hydro.output'] * (1 + lm.output) * cf;
        break;
      case 'geothermal': {
        b.pressure ??= 1;
        avail = rated * b.pressure * terrBonus * M['geothermal.output'] * cf;
        break;
      }
      case 'orbital': {
        const flux = st.space ? siteSolar(m, b, d) : 1;
        avail = rated * env.orbital * flux * M['orbital.output'] * (1 + lm.output) * cf;
        break;
      }
      case 'stellar': {
        const flux = siteSolar(m, b, d);
        avail = rated * flux * M['stellar.output'] * (1 + lm.output) * cf;
        break;
      }
      case 'dyson': {
        const raw = rated * siteSolar(m, b, d) * M['stellar.output'] * (1 + lm.output) * cf;
        dysonRaw += raw;
        const u = { b, d, avail: raw, out: 0 };
        dysons.push(u);
        must.push(u);
        continue;
      }
      case 'pulsar':
        avail = rated * pulsarFactor(t, g.period ?? 2) * M['stellar.output'] * (1 + lm.output) * cf;
        break;
      case 'constant':
        avail = rated * 0.95 * (d.family === 'exotic' ? M['exotic.output'] : M['orbital.output']) * (1 + lm.output) * cf;
        break;
      case 'penrose': {
        b.pool ??= rated * (g.poolH ?? 1000);
        avail = rated * Math.min(1, b.pool / (rated * 20)) * M['exotic.output'] * (1 + lm.output) * cf;
        break;
      }
      case 'dam': {
        const res = damPlan(s, m, b, d, dt, cf);
        flexes.push(res);
        b.available = res.must + res.flex;
        continue;
      }
      case 'csp': {
        const cap = rated * (g.storageH ?? 10);
        b.heatStore = Math.min(cap, (b.heatStore ?? 0) + rated * 1.8 * env.solar * siteSolar(m, b, d) * M['solar.output'] * cf * dt);
        const flex = Math.min(rated, b.heatStore / dt);
        const overflow = Math.max(0, b.heatStore - cap * 0.97) / dt;
        const mustP = Math.min(flex, overflow);
        flexes.push({ b, d, must: mustP, flex: flex - mustP, out: mustP, kind: 'csp' });
        b.available = flex;
        continue;
      }
    }
    b.available = avail;
    must.push({ b, d, avail, out: avail });
  }

  // Dyson swarm diminishing returns: mutual shading as swarm coverage grows
  if (dysonRaw > 0) {
    const c = dysonRaw / BALANCE.dysonSaturationKW;
    const f = c < 1e-6 ? 1 : (1 - Math.exp(-c)) / c;
    for (const u of dysons) {
      u.avail *= f;
      u.out = u.avail;
      u.b.available = u.avail;
    }
  }

  const mustKW = must.reduce((a, u) => a + u.avail, 0);
  let G0 = mustKW;
  for (const u of thermals) G0 += u.out;
  for (const u of flexes) G0 += u.must;
  const Dc = dem.kw * env.demand * incidentMult(s, 'demand', m.id, t);
  const Dl = loads.reduce((a, l) => a + l.kw, 0);
  const net = G0 - Dc - Dl;
  let imported = 0, exported = 0, unserved = 0, curtailed = 0, sinkUsed = 0;
  const canImport = household || m.policies.importForShortage;

  const dischargeRoom = (u: Store, keepReserve: boolean) => {
    const floor = keepReserve ? u.reserveKWh : 0;
    return Math.max(0, Math.min(u.power - u.discharge, ((u.b.stored ?? 0) - floor) * u.etaOut / dt - u.discharge));
  };
  const chargeRoom = (u: Store) => Math.max(0, Math.min(u.power - u.charge - u.fromGrid, (u.cap - (u.b.stored ?? 0)) / (u.etaIn * dt) - u.charge - u.fromGrid));
  const lowPrice = (u: Store) => pr.spot && pr.factor <= (u.b.lowPrice ?? 0.85);
  const highPrice = (u: Store) => pr.spot && pr.factor >= (u.b.highPrice ?? 1.15);

  if (net < 0) {
    let deficit = -net;
    for (const u of flexes) {
      const a = Math.min(deficit, u.flex);
      u.out += a;
      deficit -= a;
    }
    for (const u of stores) {
      if (deficit <= 0) break;
      let allow = Infinity;
      if (u.mode === 'reserve') continue;
      if (u.mode === 'peak') allow = Math.max(0, Dc - (u.b.peakKW ?? Dc * 0.8));
      if (u.mode === 'arbitrage' && !highPrice(u)) continue;
      const a = Math.min(deficit, allow, dischargeRoom(u, true));
      u.discharge += a;
      deficit -= a;
    }
    for (const u of [...thermals].sort((a, b) => a.L.mc - b.L.mc)) {
      if (deficit <= 0) break;
      if (u.b.mode === 'baseload' || u.b.mode === 'off') continue;
      const a = Math.min(deficit, u.L.hi - u.out);
      u.out += a;
      deficit -= a;
    }
    for (const u of stores) {
      if (deficit <= 0) break;
      const a = Math.min(deficit, dischargeRoom(u, false));
      u.discharge += a;
      deficit -= a;
    }
    if (canImport && deficit > 0) {
      imported = Math.min(deficit, lim.importKW);
      deficit -= imported;
    }
    unserved = deficit;
  } else {
    let surplus = net;
    for (const u of [...thermals].sort((a, b) => b.L.mc - a.L.mc)) {
      if (surplus <= 0) break;
      if (u.b.mode === 'baseload') continue; // baseload holds output; the surplus goes to storage/export/curtailment
      const a = Math.min(surplus, u.out - u.L.lo);
      u.out -= a;
      surplus -= a;
    }
    for (const u of stores) {
      if (surplus <= 0) break;
      if (u.mode === 'sell') continue;
      const a = Math.min(surplus, chargeRoom(u));
      u.charge += a;
      surplus -= a;
    }
    for (const k of sinks) {
      const a = Math.min(surplus, k.cap);
      k.out += a;
      sinkUsed += a;
      surplus -= a;
    }
    if (m.policies.autoExport && lim.exportKW > 0) {
      exported = Math.min(surplus, lim.exportKW);
      surplus -= exported;
    }
    for (const u of stores) {
      if (surplus <= 0) break;
      if (u.mode !== 'sell') continue;
      const a = Math.min(surplus, chargeRoom(u));
      u.charge += a;
      surplus -= a;
    }
    curtailed = surplus;
  }

  // economic dispatch for export: run thermal when the export price beats marginal cost
  let exportRoom = m.policies.autoExport ? Math.max(0, lim.exportKW - exported) : 0;
  if (exportRoom > 0 && curtailed <= 1e-9) {
    for (const u of [...thermals].sort((a, b) => a.L.mc - b.L.mc)) {
      if (u.b.mode !== 'economic' || pr.export * (1 - lim.losses) < u.L.mc * BALANCE.economicDispatchMargin) continue;
      const a = Math.min(exportRoom, u.L.hi - u.out);
      u.out += a;
      exported += a;
      exportRoom -= a;
    }
  }
  // price-driven storage arbitrage (spot markets only)
  let arbExported = 0;
  if (hasFeature(s, 'battery.arbitrage') && pr.spot) {
    let importRoom = Math.max(0, lim.importKW - imported);
    for (const u of stores) {
      if (u.mode !== 'arbitrage' && u.mode !== 'smart') continue;
      if (lowPrice(u) && importRoom > 0) {
        const a = Math.min(importRoom, chargeRoom(u));
        u.fromGrid += a;
        importRoom -= a;
      } else if (highPrice(u) && exportRoom > 0) {
        const a = Math.min(exportRoom, dischargeRoom(u, true));
        u.discharge += a;
        exported += a;
        arbExported += a;
        exportRoom -= a;
      }
    }
  }

  // curtailment: variable renewables first, then flexible hydro/CSP (water is spilled)
  let toCurtail = curtailed;
  if (toCurtail > 0 && mustKW > 0) {
    const k = Math.max(0, 1 - toCurtail / mustKW);
    for (const u of must) u.out = u.avail * k;
    toCurtail = Math.max(0, toCurtail - mustKW);
  }
  for (const u of flexes) {
    if (toCurtail <= 0) break;
    const a = Math.min(toCurtail, u.out);
    u.out -= a;
    toCurtail -= a;
  }
  // whatever could not be curtailed (thermal held at minimum stable load) is dumped
  const dumped = Math.max(0, toCurtail);

  // shed loads before customers when supply is short
  const loadUnserved = Math.min(Dl, unserved);
  const custUnserved = unserved - loadUnserved;
  const loadFrac = Dl > 0 ? (Dl - loadUnserved) / Dl : 1;

  // ───── apply results ─────
  let gen = 0;
  let fuelUnits = 0;
  let emissions = 0;
  for (const u of must) {
    u.b.output = u.out;
    gen += u.out;
    const g = u.d.gen!;
    if (g.kind === 'penrose') {
      const rated = ratedKW(u.b, u.d);
      u.b.pool = Math.max(0, (u.b.pool ?? 0) - u.out * dt) + rated * 0.05 * dt;
      if ((u.b.pool ?? 0) < rated * 40) u.b.status = 'Spin reservoir depleting — output falling';
    }
    if (g.kind === 'geothermal') {
      const rated = Math.max(1e-9, ratedKW(u.b, u.d));
      const load = u.out / rated;
      const decline = (g.decline ?? 0.0003) * Math.max(0.1, 1 + localMods(u.b).aging);
      u.b.pressure = Math.min(1, Math.max(0.3, (u.b.pressure ?? 1) - decline * load * dt + 0.00025 * (1 - load) * dt));
    }
    if (u.out < u.avail * 0.999) u.b.status = 'Curtailed (no demand, storage or export room)';
  }
  for (const u of thermals) {
    u.b.output = u.out;
    gen += u.out;
    if (u.out <= 1e-9 && u.b.status === 'Operating') u.b.status = u.b.mode === 'off' ? 'Switched off' : 'Standby: demand already covered by cheaper sources';
    const r = burnFuel(s, u.b, u.d, u.out / (1 - u.p), dt);
    fuelUnits += r.units;
    emissions += r.emissions;
    const th = u.d.thermal!;
    if (th.parasitic && (u.out < u.L.minStable * 0.98 || (u.b.tank ?? 0) <= 0)) {
      u.b.ignited = false;
      u.b.ignition = 0;
      u.b.status = 'Plasma quenched — re-ignition required';
    }
  }
  for (const u of flexes) {
    u.b.output = u.out;
    gen += u.out;
    if (u.kind === 'csp') u.b.heatStore = Math.max(0, (u.b.heatStore ?? 0) - u.out * dt);
    else finishDam(u, dt);
  }
  for (const l of loads) {
    if (l.kind === 'ignition') {
      const th = l.d.thermal!;
      l.b.ignition = (l.b.ignition ?? 0) + l.kw * loadFrac * dt;
      if (l.b.ignition >= ratedKW(l.b, l.d) * (th.ignitionH ?? 0.5)) {
        l.b.ignited = true;
        l.b.ignition = 0;
        l.b.output = 0;
      }
    } else l.b.supplied = loadFrac;
  }
  for (const k of sinks) {
    k.b.output = -k.out;
    s.convergence += k.out * dt;
  }
  let charged = 0, discharged = 0, gridCharge = 0;
  for (const u of stores) {
    const inKW = u.charge + u.fromGrid;
    const stored0 = u.b.stored ?? 0;
    const add = inKW * u.etaIn * dt;
    const take = (u.discharge / u.etaOut) * dt;
    u.b.stored = Math.max(0, Math.min(u.cap, stored0 + add - take));
    u.b.output = u.discharge - inKW;
    charged += u.charge;
    gridCharge += u.fromGrid;
    discharged += u.discharge;
    const cycles = u.cap > 0 ? (add + take) / (2 * u.cap) : 0;
    u.b.cycles = (u.b.cycles ?? 0) + cycles;
    const aging = u.d.storage!.cycleAging * M['storage.aging'] * Math.max(0.1, 1 + localMods(u.b).aging);
    u.b.wearOut = Math.min(0.6, u.b.wearOut + cycles * aging);
    // capacity fade applies immediately (lost energy is part of degradation, not a balance error)
    u.b.stored = Math.min(u.b.stored, storageCapacityKWh(s, u.b, u.d));
    u.b.act = u.power > 0 ? (inKW + u.discharge) / u.power : 0;
    u.b.status = u.b.output > 0 ? 'Discharging' : u.b.output < 0 ? 'Charging' : (u.b.stored ?? 0) >= u.cap * 0.999 ? 'Full' : 'Idle';
  }
  const totalImport = imported + gridCharge;

  // energy balance: delivered sources = uses (kW); `gen` is already net of curtailment
  const sources = gen + discharged + totalImport;
  const uses = (Dc - custUnserved) + (Dl - loadUnserved) + charged + gridCharge + exported + dumped + sinkUsed;
  const imbalance = sources - uses;

  // ───── money ─────
  const losses = lim.losses;
  const revMod = M['revenue'];
  const servedCust = Dc - custUnserved;
  const selfServed = Math.max(0, servedCust - imported);
  const ppa = s.contracts.filter((c) => c.kind === 'power' && c.map === m.id && c.endsAt > now);
  let ppaRev = 0;
  let penalty = 0;
  let exportLeft = exported * (1 - losses);
  for (const c of ppa) {
    const del = Math.min(exportLeft, c.amount);
    exportLeft -= del;
    ppaRev += del * c.price * dt;
    c.delivered += del * dt;
    const short = c.amount - del;
    if (short > 0) {
      c.shortfall += short * dt;
      penalty += short * c.price * 0.5 * dt;
    }
  }
  const exportRev = exportLeft * pr.export * dt;
  const custRev = household ? 0 : servedCust * dem.price * dt;
  // resold arbitrage energy earns the market price but not the brand (revenue) bonus — otherwise
  // high prestige turns grid buy-low/sell-high into a generation-free money printer
  const arbRev = Math.min(arbExported * (1 - losses), exportLeft) * pr.export * dt;
  const sales = (custRev + exportRev - arbRev + ppaRev) * revMod + arbRev;
  const savings = household ? selfServed * dem.price * dt : 0;
  const importCost = totalImport * pr.import * (1 + losses) * dt;
  earn(s, m, 'sales', sales);
  // avoided-cost savings are informational only (the bill is simply smaller) — never money
  s.ledger.savings += savings;
  m.ledger.savings += savings;
  if (household) earn(s, m, 'income', dem.income * dt);
  spend(s, m, 'importCost', importCost);
  spend(s, m, 'penalties', penalty);
  let carbonCost = 0;
  if (s.settings.carbonPricing && emissions > 0) {
    carbonCost = emissions * st.retail * BALANCE.carbonPriceFactor;
    spend(s, m, 'carbon', carbonCost);
  }
  s.run.emissions += emissions;

  // attribute revenue to generators by output share
  const value = gen > 0 ? (sales + savings) / (gen * dt) : 0;
  const a = Math.min(1, dt / 6);
  let fuelCostRate = 0;
  for (const u of thermals) fuelCostRate += ((u.b.heat ?? 0) / FUELS[u.d.thermal!.fuel].energyPerUnit) * fuelPrice(s, u.d.thermal!.fuel);
  for (const b of Object.values(m.buildings)) {
    const d = defOf(b);
    if (d.fixed) continue;
    const e = Math.max(0, b.output) * dt;
    b.energy += e;
    const rev = e * value;
    b.revenue += rev;
    b.rRevenue += (rev / dt - b.rRevenue) * a;
    const fuelRate = d.thermal ? ((b.heat ?? 0) / FUELS[d.thermal.fuel].energyPerUnit) * fuelPrice(s, d.thermal.fuel) : 0;
    const om = b.invested * BALANCE.omRate;
    b.rCost += (fuelRate + om - b.rCost) * a;
    b.opCost += (fuelRate + om) * dt;
  }

  // reliability (rolling) and flow stats
  if (Dc > 0) m.reliability += ((servedCust / Dc) - m.reliability) * Math.min(1, dt / BALANCE.reliabilityWindowH);
  const f = emptyFlow();
  f.generation = gen;
  f.demand = Dc + Dl;
  f.served = servedCust;
  f.selfServed = household ? selfServed : servedCust - Math.min(servedCust, imported);
  f.imported = totalImport;
  f.exported = exported;
  f.curtailed = curtailed;
  f.charged = charged + gridCharge;
  f.discharged = discharged;
  f.unserved = unserved;
  f.sink = sinkUsed;
  f.sales = sales / dt;
  f.retailRev = (custRev * revMod) / dt;
  f.exportRev = ((exportRev - arbRev) * revMod + arbRev) / dt;
  f.contractRev = (ppaRev * revMod) / dt;
  f.savings = savings / dt;
  f.income = household ? dem.income : 0;
  f.importCost = importCost / dt;
  f.penalty = penalty / dt;
  f.carbon = carbonCost / dt;
  f.emissions = emissions / dt;
  f.fuelCost = fuelCostRate;
  m.flow = f;
  m.lastExportCapped = lim.exportKW > 0 && exported >= lim.exportKW * 0.999 && curtailed > 0;

  const soldKWh = (exported * (1 - losses) + (household ? 0 : servedCust)) * dt;
  m.totals.produced += gen * dt;
  m.totals.sold += soldKWh;

  if (m.lastExportCapped) notify(s, `export:${m.id}`, 'warning', 'grid', `Grid export limit reached on ${st.name} — surplus is being curtailed. Upgrade the connection or add storage.`, m.id, 48);
  if (custUnserved > Dc * 0.02) notify(s, `short:${m.id}`, 'warning', 'grid', `Supply shortage on ${st.name}: ${Math.round((custUnserved / Dc) * 100)}% of demand unserved.`, m.id, 24);
  if (stores.length && stores.every((u) => (u.b.stored ?? 0) >= u.cap * 0.999) && curtailed > 0) notify(s, `full:${m.id}`, 'info', 'storage', `Storage full on ${st.name}.`, m.id, 72);

  return { produced: gen * dt, sold: soldKWh, revenue: sales, imbalance, fuelUnits };
}

/** Dam: must-run environmental release + spill avoidance; flexible release limited by stored water. */
function damPlan(s: GameState, m: MapState, b: BuildingInstance, d: Def, dt: number, cf: number): Flex {
  const g = d.gen!;
  const M = getMods(s).m;
  const lm = localMods(b);
  const vmax = Math.max(1, b.reservoirMax ?? 1);
  b.reservoir ??= vmax * 0.5;
  b.reservoirTarget ??= 0.75;
  const qin = b.inflow ?? m.riverFlow[b.y * m.w + b.x] ?? 0;
  const fill = b.reservoir / vmax;
  const H = (g.head ?? 10) * (0.55 + 0.45 * fill);
  const eta = (g.eta ?? 0.88) * M['hydro.output'] * (1 + lm.output) * cf;
  const rated = ratedKW(b, d);
  const qt = rated / (G * H * eta);
  const sec = 3600 * dt;
  const above = Math.max(0, b.reservoir - b.reservoirTarget * vmax);
  const qMust = Math.min(qt, 0.25 * qin + above / (sec * 8));
  const usable = Math.max(0, b.reservoir - 0.05 * vmax) / sec + qin;
  const qFlex = Math.max(0, Math.min(qt, usable) - qMust);
  const P = (q: number) => G * q * H * eta;
  return { b, d, must: P(qMust), flex: P(qFlex), out: P(qMust), kind: 'dam', H, eta, qin };
}

function finishDam(u: Flex, dt: number) {
  const b = u.b;
  const vmax = Math.max(1, b.reservoirMax ?? 1);
  const q = u.out / (G * (u.H ?? 1) * (u.eta ?? 1));
  const sec = 3600 * dt;
  let v = (b.reservoir ?? 0) + ((u.qin ?? 0) - q) * sec;
  let spill = 0;
  if (v > vmax) {
    spill = (v - vmax) / sec;
    v = vmax;
  }
  b.reservoir = Math.max(0, v);
  b.release = q + spill;
  if (spill > 0) b.status = 'Spillway open — reservoir full';
}

export interface ForecastPoint { t: number; solar: number; wind: number; demand: number; event: string | null }

/**
 * Expected solar and wind output and customer demand for the coming hours. Weather, sun and wind are
 * deterministic in game time, so this matches the simulation (ignoring curtailment and future breakdowns).
 */
export function forecast(s: GameState, m: MapState, hours = 48, step = 1): ForecastPoint[] {
  const M = getMods(s).m;
  const units: { kind: 'solar' | 'wind'; k: number; site: number; kite: number }[] = [];
  for (const b of Object.values(m.buildings)) {
    const d = defOf(b);
    const g = d.gen;
    if (!g || (g.kind !== 'solar' && g.kind !== 'wind') || !b.enabled || b.condition < (d.shutdownBelow ?? 0.1)) continue;
    const k = ratedKW(b, d) * (1 + localMods(b).output) * conditionFactor(d, b.condition) * M[g.kind === 'solar' ? 'solar.output' : 'wind.output'];
    units.push({ kind: g.kind, k, site: g.kind === 'solar' ? siteSolar(m, b, d) : siteWind(m, b, d), kite: d.id === 'kite' ? 1.45 : 1 });
  }
  const out: ForecastPoint[] = [];
  for (let h = 0; h <= hours; h += step) {
    const t = s.time + h;
    const env = envAt(m, t);
    const sf = m.id === 'planet' ? env.solarSmooth : env.solar;
    let solar = 0, wind = 0;
    for (const u of units) {
      if (u.kind === 'solar') solar += u.k * sf * u.site;
      else wind += u.k * windPower(env.wind * u.site * u.kite * 0.92) * env.windOut;
    }
    out.push({ t, solar, wind, demand: customerDemand(s, m, t).kw * env.demand * incidentMult(s, 'demand', m.id, t), event: env.event?.kind ?? null });
  }
  return out;
}
