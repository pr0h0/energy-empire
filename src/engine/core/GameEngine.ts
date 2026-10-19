import { BALANCE, TIME } from '../data/balance';
import { CONTRACTS } from '../data/contracts';
import { FUELS } from '../data/fuels';
import { STAGES } from '../data/stages';
import type { StageId } from '../data/types';
import { evalMilestone } from '../systems/ProgressionSystem';
import { applyBlueprint, saveBlueprint } from '../systems/BlueprintSystem';
import { checkAchievements } from '../systems/AchievementSystem';
import { fleetUpgrade, manualRefuel, manualRepair, rebuild, replaceComponents, repower, retrofit } from '../systems/BuildingSystem';
import { demolish, placeBuilding } from '../systems/ConstructionSystem';
import { simulateElectricity } from '../systems/ElectricitySystem';
import { fire, hire, payrollProtection, train } from '../systems/EmployeeSystem';
import { canAfford, globalWages, mapOpex, mapWages, spend } from '../systems/FinanceSystem';
import { fuelPolicy, orderFuel, produceFuel } from '../systems/FuelSystem';
import { tankCapacity } from '../systems/ThermalSystem';
import { simulateGoals } from '../systems/GoalSystem';
import { nextWeather, WEATHER } from '../systems/WeatherSystem';
import { resolveIncident, simulateIncidents } from '../systems/IncidentSystem';
import { nextGridLevel } from '../systems/GridSystem';
import { buyLand, buyLandBulk } from '../systems/LandSystem';
import { simulateFuelAutomation, simulateLogistics } from '../systems/LogisticsSystem';
import { simulateMaintenance } from '../systems/MaintenanceSystem';
import { buyPrestigeUpgrade, performPrestige } from '../systems/PrestigeSystem';
import { checkProgression, unlockStage } from '../systems/ProgressionSystem';
import { setAllocation, simulateResearch, startResearch } from '../systems/ResearchSystem';
import { cancelContract, signFuelContract, signPPA, simulateTrading } from '../systems/TradingSystem';
import type { Command, CommandResult } from './Commands';
import { claimablePoints } from '../math/PrestigeFormulas';
import { notify } from './GameEvents';
import { defOf, speedCap } from './Helpers';
import { freezeMods, hasFeature, unfreezeMods } from './Modifiers';
import { newGame } from './NewGame';
import type { GameState, LedgerKey, MapState, MixGroup, OfflineSummary } from './State';

const OP_REVENUE: LedgerKey[] = ['sales', 'income'];
const OP_EXPENSE: LedgerKey[] = ['importCost', 'fuel', 'wages', 'maintenance', 'repairs', 'opex', 'penalties', 'carbon'];
const OP_KEYS = [...OP_REVENUE, ...OP_EXPENSE];
/** Building family → generation-mix group for history charts. */
const MIX: Record<string, MixGroup> = {
  solar: 'solar', wind: 'wind', hydro: 'hydro', fossil: 'thermal', biomass: 'thermal', geothermal: 'thermal', nuclear: 'nuclear', fusion: 'fusion',
  orbital: 'space', stellar: 'space', exotic: 'space', storage: 'storage',
};

/**
 * Authoritative simulation. Owns the state; the UI only reads snapshots and sends commands.
 * `tick(dt)` advances one fixed logical step independent of frame rate.
 */
export class GameEngine {
  state: GameState;
  version = 0;
  private listeners = new Set<(fromTick: boolean) => void>();
  private stateListeners = new Set<() => void>();

  constructor(state?: GameState) {
    this.state = state ?? newGame();
  }

  subscribe(fn: (fromTick: boolean) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Fires when the whole state object is replaced (load / import / prestige / reset). */
  onReplace(fn: () => void) {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  /** `fromTick` marks routine simulation updates, which the UI may coalesce; commands emit immediately. */
  emit(fromTick = false) {
    this.version++;
    for (const l of this.listeners) l(fromTick);
  }

  replaceState(s: GameState) {
    this.state = s;
    for (const l of this.stateListeners) l();
    this.emit();
  }

  /** One fixed step of `dt` game hours. */
  tick(dt: number = TIME.tickH) {
    freezeMods(this.state);
    try {
      this.step(dt);
    } finally {
      unfreezeMods();
    }
  }

  private step(dt: number) {
    const s = this.state;
    const tMid = s.time + dt / 2;
    const before = OP_KEYS.map((k) => s.ledger[k]);
    let produced = 0, sold = 0;
    for (const m of Object.values(s.maps) as MapState[]) {
      const r = simulateElectricity(s, m, tMid, dt);
      produced += r.produced;
      sold += r.sold;
      s.run.fuelUsed += r.fuelUnits;
      produceFuel(s, m, dt);
      simulateMaintenance(s, m, dt);
      simulateLogistics(s, m, dt);
      simulateFuelAutomation(s, m);
      simulateGoals(s, m, dt);
      const wx = nextWeather(m, s.time, 12);
      if (wx && s.lastEvents[`wx:${m.id}:${Math.round(wx.start)}`] === undefined) notify(s, `wx:${m.id}:${Math.round(wx.start)}`, 'warning', 'weather', `${WEATHER[wx.kind].name} expected on ${STAGES[m.id].name} in ${Math.max(1, Math.round(wx.start - s.time))} h (lasting ~${Math.round(wx.end - wx.start)} h). ${WEATHER[wx.kind].desc}`, m.id);
      const wages = mapWages(s, m);
      const opex = mapOpex(s, m);
      spend(s, m, 'wages', wages * dt);
      spend(s, m, 'opex', opex * dt);
      m.flow.wages = wages;
      m.flow.opex = opex;
    }
    spend(s, null, 'wages', globalWages(s) * dt);
    simulateIncidents(s);
    const res = simulateResearch(s, dt);
    simulateTrading(s);
    s.time += dt;
    s.run.produced += produced;
    s.run.sold += sold;
    s.lifetime.produced += produced;
    s.lifetime.sold += sold;
    s.lifetime.playH += dt;
    // rolling company rates (operating revenue/expenses, $/h)
    const a = Math.min(1, dt / 4);
    const cats = s.rates.cats;
    OP_KEYS.forEach((k, i) => (cats[k] = (cats[k] ?? 0) + ((s.ledger[k] - before[i]) / dt - (cats[k] ?? 0)) * a));
    s.rates.revenue = OP_REVENUE.reduce((x, k) => x + cats[k]!, 0);
    s.rates.expenses = OP_EXPENSE.reduce((x, k) => x + cats[k]!, 0);
    s.rates.net = s.rates.revenue - s.rates.expenses;
    s.rates.rp += (res.rp / dt - s.rates.rp) * a;
    const genKW = Object.values(s.maps).reduce((x, m) => x + (m?.flow.generation ?? 0), 0);
    s.lifetime.peakKW = Math.max(s.lifetime.peakKW, genKW);
    // hourly bookkeeping
    if (Math.floor(s.time / BALANCE.historyEveryH) !== Math.floor((s.time - dt) / BALANCE.historyEveryH)) this.hourly();
    if (s.convergence >= BALANCE.winEnergyKWh && !s.won) {
      s.won = s.time;
      notify(s, 'won', 'success', 'progression', 'The Convergence Engine is complete. You have united the energy of the universe — the game is won! Sandbox play continues.');
      checkAchievements(s);
    }
  }

  private hourly() {
    const s = this.state;
    const claim = claimablePoints(s.prestige.lifetimeRevenue, s.prestige.awarded);
    if (claim > (s.lastEvents.claimNotified ?? 0)) {
      s.lastEvents.claimNotified = claim;
      notify(s, `claim:${claim}`, 'success', 'prestige', `New prestige points available: ${claim} claimable (optional — open the Prestige screen).`);
    }
    checkProgression(s);
    checkAchievements(s);
    let gen = 0, demand = 0, exp = 0, imp = 0, sales = 0, rel = 0;
    const mix: Partial<Record<MixGroup, number>> = {};
    for (const m of Object.values(s.maps)) {
      if (!m) continue;
      gen += m.flow.generation;
      demand += m.flow.demand;
      exp += m.flow.exported;
      imp += m.flow.imported;
      sales += m.flow.sales;
      rel += m.reliability * m.flow.demand;
      for (const b of Object.values(m.buildings)) {
        const g = b.output > 0 ? MIX[defOf(b).family] : undefined;
        if (g) mix[g] = (mix[g] ?? 0) + b.output;
      }
    }
    const sample = { t: s.time, money: s.money, net: s.rates.net, generation: gen, demand, exported: exp, imported: imp, rp: s.rates.rp, sales, reliability: demand > 0 ? rel / demand : 1, mix };
    s.history.push(sample);
    if (s.history.length > BALANCE.historyMax) s.history.splice(0, s.history.length - BALANCE.historyMax);
    if (Math.floor(s.time / BALANCE.historyLongEveryH) !== Math.floor((s.time - BALANCE.historyEveryH) / BALANCE.historyLongEveryH)) {
      s.historyLong.push(sample);
      if (s.historyLong.length > BALANCE.historyMax) s.historyLong.splice(0, s.historyLong.length - BALANCE.historyMax);
    }
    if (s.money < 0) {
      notify(s, 'debt', 'critical', 'finance', 'Company is overdrawn. Purchases are blocked until cash is positive — cut wages or sell surplus.', undefined, 24);
      if ((s.lastEvents.overdrawnSince ??= s.time) < s.time - 12) {
        const who = payrollProtection(s);
        if (who) notify(s, `payroll:${s.time}`, 'critical', 'finance', `Insolvency safeguard: released ${who} to stop losses.`);
      }
    } else delete s.lastEvents.overdrawnSince;
  }

  /** Advance many hours in coarse chunks (offline reconciliation, tests). */
  advance(hours: number, step: number = TIME.offlineStepH) {
    let left = hours;
    while (left > 1e-9) {
      const dt = Math.min(step, left);
      this.tick(dt);
      left -= dt;
    }
  }

  offlineCapSeconds(): number {
    return (hasFeature(this.state, 'offline.extended') ? TIME.offlineExtendedCapRealH : TIME.offlineCapRealH) * 3600;
  }

  /** Offline step size: event-free chunked reconciliation, coarser for very long absences. */
  static offlineStep(hours: number): number {
    return hours <= 600 ? TIME.offlineStepH : hours <= 2400 ? 1 : 2;
  }

  /** Simulate real-world elapsed time while the game was closed and build a summary. */
  simulateOffline(realSeconds: number): OfflineSummary | null {
    const it = this.offlineRunner(realSeconds);
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
  }

  /** Same as simulateOffline but yields between chunks so the UI can show progress. */
  async simulateOfflineAsync(realSeconds: number, progress?: (f: number) => void): Promise<OfflineSummary | null> {
    const it = this.offlineRunner(realSeconds);
    let r = it.next();
    while (!r.done) {
      progress?.(r.value);
      await new Promise((res) => setTimeout(res, 0));
      r = it.next();
    }
    return r.value;
  }

  private *offlineRunner(realSeconds: number): Generator<number, OfflineSummary | null> {
    const s = this.state;
    if (!(realSeconds > 0)) return null;
    const cap = this.offlineCapSeconds();
    const secs = Math.min(realSeconds, cap);
    const hours = secs * TIME.gameHoursPerRealSecond;
    if (hours < TIME.tickH) return null;
    const l0 = { ...s.ledger };
    const run0 = { ...s.run };
    const done0 = new Set(Object.keys(s.research.done));
    const n0 = s.nextId;
    const rp0 = Object.values(s.research.progress).reduce((a, b) => a + b, 0);
    const money0 = s.money;
    const step = GameEngine.offlineStep(hours);
    let left = hours;
    let k = 0;
    while (left > 1e-9) {
      const dt = Math.min(step, left);
      this.tick(dt);
      left -= dt;
      if (++k % 60 === 0) yield 1 - left / hours;
    }
    const rev = OP_REVENUE.reduce((x, k) => x + s.ledger[k] - l0[k], 0);
    const expenses = (Object.keys(s.ledger) as LedgerKey[]).filter((k) => !['sales', 'income', 'savings', 'salvage'].includes(k)).reduce((x, k) => x + s.ledger[k] - l0[k], 0);
    const issues = [...new Set(s.notifications.filter((n) => n.id >= n0 && (n.level === 'warning' || n.level === 'critical')).map((n) => n.text))].slice(0, 8);
    const completed = Object.keys(s.research.done).filter((id) => !done0.has(id));
    const rp1 = Object.values(s.research.progress).reduce((a, b) => a + b, 0);
    const summary: OfflineSummary = {
      hours, realSeconds: secs, produced: s.run.produced - run0.produced, sold: s.run.sold - run0.sold, revenue: rev, expenses, net: s.money - money0,
      repairs: s.run.repairs - run0.repairs, fuelUsed: s.run.fuelUsed - run0.fuelUsed, researchRP: rp1 - rp0, researchCompleted: completed, issues, capped: realSeconds > cap,
    };
    if (realSeconds >= 60) s.offlineSummary = summary;
    this.emit();
    return summary;
  }

  map(id: StageId): MapState {
    const m = this.state.maps[id];
    if (!m) throw new Error(`map ${id} locked`);
    return m;
  }

  dispatch(c: Command): CommandResult {
    const r = this.exec(c);
    this.emit();
    return r;
  }

  private exec(c: Command): CommandResult {
    const s = this.state;
    const err = (e: string | null | undefined): CommandResult => (e ? { ok: false, error: e } : { ok: true });
    const blocked = (cost = 0) => (s.money < 0 && cost > 0 ? 'Company is overdrawn.' : null);
    const needMap = 'map' in c && c.map !== undefined && c.type !== 'hire' && c.type !== 'fire';
    if (needMap && !s.maps[(c as { map: StageId }).map]) return { ok: false, error: 'That map is locked.' };
    const m = needMap ? s.maps[(c as { map: StageId }).map]! : (undefined as unknown as MapState);
    const bld = (id: string) => m.buildings[id];
    switch (c.type) {
      case 'place': {
        const r = placeBuilding(s, m, c.def, Math.floor(c.x), Math.floor(c.y), c.rot === 1 ? 1 : 0, c.acceptFlood ?? false, c.buyLand ?? false);
        return r.ok ? { ok: true, data: r.id } : { ok: false, error: r.error };
      }
      case 'demolish': {
        const r = demolish(s, m, c.id);
        return r.ok ? { ok: true, data: r.value } : { ok: false, error: r.error };
      }
      case 'buyLand': return err(blocked(1) ?? buyLand(s, m, Math.floor(c.x), Math.floor(c.y)));
      case 'buyLandBulk': return err(blocked(1) ?? buyLandBulk(s, m));
      case 'upgradeGrid': {
        const n = nextGridLevel(m);
        if (!n) return err('Already at the highest connection tier.');
        if (n.research && s.research.done[n.research] === undefined) return err('Requires grid research.');
        if (!canAfford(s, n.cost)) return err('Not enough money.');
        spend(s, m, 'infrastructure', n.cost);
        m.gridLevel++;
        return { ok: true };
      }
      case 'downgradeGrid': {
        if (m.gridLevel <= 0) return err('Already at the lowest connection tier.');
        m.gridLevel--; // no refund: the upgrade cost is sunk
        return { ok: true };
      }
      case 'signContract': {
        const d = CONTRACTS[c.contract];
        if (!d || d.stage !== m.id) return err('Unknown contract.');
        if (m.contracts.includes(d.id)) return err('Already signed.');
        if (d.requires && !evalMilestone(s, d.requires).done) return err('Requirement not met.');
        if (!canAfford(s, d.fee)) return err('Not enough money.');
        spend(s, m, 'infrastructure', d.fee);
        m.contracts.push(d.id);
        return { ok: true };
      }
      case 'cancelContract':
        if (!m.contracts.includes(c.contract)) return err('Not signed.');
        m.contracts = m.contracts.filter((x) => x !== c.contract);
        return { ok: true };
      case 'hire': return err(blocked(1) ?? hire(s, c.tier, c.count, c.map));
      case 'fire': return err(fire(s, c.tier, c.count, c.map));
      case 'train': return err(train(s, c.map, c.group));
      case 'resolveIncident': return err(resolveIncident(s, c.accept));
      case 'repair': return bld(c.id) ? err(manualRepair(s, m, bld(c.id))) : err('No such installation.');
      case 'repairAll': {
        const list = Object.values(m.buildings).filter((b) => !defOf(b).fixed && b.condition < 0.999).sort((a, b) => a.condition - b.condition);
        let n = 0;
        for (const b of list) if (!manualRepair(s, m, b)) n++;
        return n ? { ok: true, data: n } : err('Nothing repaired (perfect condition or not enough money).');
      }
      case 'replaceComponents': return bld(c.id) ? err(replaceComponents(s, m, bld(c.id))) : err('No such installation.');
      case 'rebuild': return bld(c.id) ? err(rebuild(s, m, bld(c.id))) : err('No such installation.');
      case 'retrofit': return bld(c.id) ? err(retrofit(s, m, bld(c.id), c.upgrade)) : err('No such installation.');
      case 'fleetUpgrade': return err(fleetUpgrade(s, m, c.upgrade, c.def));
      case 'repower': return bld(c.id) ? err(repower(s, m, bld(c.id), c.to)) : err('No such installation.');
      case 'configure': {
        const b = bld(c.id);
        if (!b) return err('No such installation.');
        const d = defOf(b);
        const p = c.patch;
        const adv = hasFeature(s, 'thermal.advanced');
        if (p.enabled !== undefined) b.enabled = !!p.enabled;
        if (p.mode && d.thermal && ['baseload', 'follow', 'economic', 'off'].includes(p.mode)) b.mode = p.mode;
        if (p.target !== undefined && d.thermal) {
          if (!Number.isFinite(p.target)) return err('Invalid target.');
          b.target = Math.max(0.2, Math.min(adv ? 1.1 : 1, p.target));
        }
        if (p.coolingMode && d.thermal) {
          if (p.coolingMode === 'optimized' && !adv) return err('Requires Advanced Thermal Management.');
          b.coolingMode = p.coolingMode;
        }
        if (p.storageMode && d.storage) {
          const advModes = ['peak', 'smart'];
          if (advModes.includes(p.storageMode) && !hasFeature(s, 'battery.advanced')) return err('Requires Smart Dispatch research.');
          if (p.storageMode === 'arbitrage' && !hasFeature(s, 'battery.arbitrage')) return err('Requires Market Arbitrage research.');
          b.storageMode = p.storageMode;
        }
        if (p.reserve !== undefined && d.storage) b.reserve = clamp01(p.reserve);
        if (p.lowPrice !== undefined) b.lowPrice = Math.max(0.3, Math.min(2, p.lowPrice));
        if (p.highPrice !== undefined) b.highPrice = Math.max(0.3, Math.min(2.5, p.highPrice));
        if (p.peakKW !== undefined && Number.isFinite(p.peakKW)) b.peakKW = Math.max(0, p.peakKW);
        if (p.repairThreshold !== undefined) b.repairThreshold = p.repairThreshold === null ? undefined : Math.max(0.05, Math.min(0.99, p.repairThreshold));
        if (p.priority !== undefined) {
          if (p.priority !== 0 && !hasFeature(s, 'automation.priority')) return err('Requires Condition Monitoring research.');
          b.priority = p.priority;
        }
        if (p.reservoirTarget !== undefined && d.gen?.kind === 'dam') b.reservoirTarget = Math.max(0.1, Math.min(1, p.reservoirTarget));
        return { ok: true };
      }
      case 'mapPolicy': {
        const p = c.patch;
        if (p.tariff === 'spot' && !hasFeature(s, 'market.spot')) return err('Requires Spot Markets research.');
        if (p.repairThreshold !== undefined && p.repairThreshold !== null) p.repairThreshold = Math.max(0.05, Math.min(0.99, p.repairThreshold));
        if (p.defaultStorageMode && !['self', 'sell', 'reserve'].includes(p.defaultStorageMode) && !hasFeature(s, 'battery.advanced')) return err('Requires Smart Dispatch research.');
        Object.assign(m.policies, p);
        return { ok: true };
      }
      case 'typeThreshold':
        if (c.value === null) delete m.policies.typeThresholds[c.def];
        else m.policies.typeThresholds[c.def] = Math.max(0.05, Math.min(0.99, c.value));
        return { ok: true };
      case 'globalThreshold':
        if (!Number.isFinite(c.value)) return err('Invalid value.');
        s.defaultRepairThreshold = Math.max(0.05, Math.min(0.99, c.value));
        return { ok: true };
      case 'jobPriority': {
        if (!hasFeature(s, 'automation.priority')) return err('Requires Condition Monitoring research.');
        const j = m.repairJobs.find((x) => x.id === c.job);
        if (!j) return err('Job not found.');
        j.priority = c.priority;
        return { ok: true };
      }
      case 'fuelPolicy': {
        if (!FUELS[c.fuel]) return err('Unknown fuel.');
        const p = fuelPolicy(m, c.fuel);
        if (c.patch.mode === 'full' && !hasFeature(s, 'fuel.autoBuy')) return err('Requires Delivery Routing research.');
        if (c.patch.mode) p.mode = c.patch.mode;
        if (c.patch.refillAt !== undefined) p.refillAt = clamp01(c.patch.refillAt);
        if (c.patch.minInventory !== undefined) p.minInventory = clamp01(c.patch.minInventory);
        if (c.patch.budgetPerDay !== undefined && Number.isFinite(c.patch.budgetPerDay)) p.budgetPerDay = Math.max(0, c.patch.budgetPerDay);
        if (c.patch.maxPriceFactor !== undefined) p.maxPriceFactor = Math.max(0.5, Math.min(3, c.patch.maxPriceFactor));
        return { ok: true };
      }
      case 'buyFuel': {
        const b = blocked(1);
        if (b) return err(b);
        const r = orderFuel(s, m, c.fuel, c.qty, false);
        return r.ok ? { ok: true, data: r } : err(r.error);
      }
      case 'refuel': return bld(c.id) ? err(manualRefuel(s, m, bld(c.id))) : err('No such installation.');
      case 'refuelAll': {
        let n = 0;
        const empty = new Set<string>();
        for (const b of Object.values(m.buildings)) {
          const d = defOf(b);
          if (!d.thermal || (b.tank ?? 0) >= tankCapacity(b, d) * 0.999) continue;
          if ((m.fuel[d.thermal.fuel] ?? 0) <= 0) empty.add(FUELS[d.thermal.fuel].name);
          else if (!manualRefuel(s, m, b)) n++;
        }
        if (n) return { ok: true, data: n };
        return err(empty.size ? `Depot has no ${[...empty].join(' / ')} — buy fuel first.` : 'All tanks are already full.');
      }
      case 'fuelContract': return err(signFuelContract(s, m.id, c.fuel, c.perDay));
      case 'signPPA': return err(signPPA(s, m.id, c.fraction));
      case 'cancelSupplyContract': return err(cancelContract(s, c.id));
      case 'startResearch': return err(blocked(1) ?? startResearch(s, c.id));
      case 'pauseResearch':
        if (s.research.active[c.id] === undefined) return err('Not active.');
        delete s.research.active[c.id];
        return { ok: true };
      case 'allocate': return err(setAllocation(s, c.id, c.pct));
      case 'unlockStage': return err(unlockStage(s, c.stage));
      case 'prestige': {
        const r = performPrestige(s, c.confirm, c.challenge ?? null);
        if (!r.ok || !r.state) return err(r.error);
        this.replaceState(r.state);
        return { ok: true, data: r.points };
      }
      case 'buyPrestige': return err(buyPrestigeUpgrade(s, c.id));
      case 'saveBlueprint': return err(saveBlueprint(s, m.id, c.name));
      case 'deleteBlueprint':
        s.blueprints = s.blueprints.filter((b) => b.id !== c.id);
        return { ok: true };
      case 'renameBlueprint': {
        const bp = s.blueprints.find((b) => b.id === c.id);
        if (!bp) return err('Not found.');
        bp.name = c.name.trim().slice(0, 40) || bp.name;
        return { ok: true };
      }
      case 'applyBlueprint': {
        const r = applyBlueprint(s, c.id, m.id, Math.floor(c.x), Math.floor(c.y), c.mode);
        return r.ok ? { ok: true, data: r.built } : err(r.error);
      }
      case 'setSpeed':
        s.speed = Math.max(1, Math.min(speedCap(s), Math.round(c.speed)));
        s.paused = false;
        return { ok: true };
      case 'pause':
        s.paused = c.paused;
        return { ok: true };
      case 'settings':
        Object.assign(s.settings, c.patch);
        return { ok: true };
      case 'automationPaused':
        s.automationPaused = c.paused;
        return { ok: true };
      case 'dismissOffline':
        s.offlineSummary = null;
        return { ok: true };
      case 'clearNotifications':
        s.notifications = [];
        return { ok: true };
    }
  }
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

