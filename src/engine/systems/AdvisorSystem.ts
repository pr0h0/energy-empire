import { RESEARCH_LIST } from '../data/research';
import { STAGES } from '../data/stages';
import { FUELS } from '../data/fuels';
import type { FuelId } from '../data/types';
import { defOf, maintenanceCapacity, storageCapacityKWh } from '../core/Helpers';
import type { GameState, LedgerKey, MapState } from '../core/State';
import { solarFactor } from '../core/GameClock';
import { mapMaintenanceLoad } from './MaintenanceSystem';
import { nextStage, stageUnlockStatus } from './ProgressionSystem';
import { researchStatus } from './ResearchSystem';
import { fuelBalance } from './ThermalSystem';
import { nextWeather, WEATHER, weatherAt } from './WeatherSystem';

export interface Hint {
  id: string;
  level: 'bad' | 'warn' | 'tip';
  text: string;
  /** Screen that helps act on it (UI navigation id). */
  screen?: 'research' | 'workforce' | 'operations' | 'fuel' | 'finance' | 'progress';
}

const COST_NAME: Partial<Record<LedgerKey, string>> = {
  importCost: 'grid imports', fuel: 'fuel', wages: 'wages', maintenance: 'servicing', repairs: 'repairs', opex: 'grid fees & upkeep', penalties: 'contract penalties', carbon: 'carbon price',
};

/** Plain-language suggestions for a map, most urgent first. Pure: reads state, changes nothing. */
export function advise(s: GameState, m: MapState): Hint[] {
  const out: Hint[] = [];
  const fl = m.flow;
  const kw = (v: number) => (v >= 1e6 ? `${(v / 1e6).toPrecision(3)} GW` : v >= 1e3 ? `${(v / 1e3).toPrecision(3)} MW` : `${v.toPrecision(3)} kW`);
  const all = Object.values(m.buildings);

  if (fl.unserved > Math.max(1e-9, fl.demand * 0.02))
    out.push({ id: 'unserved', level: 'bad', text: `${kw(fl.unserved)} of demand isn't being served. Add generation or storage, or upgrade the grid import limit.` });

  const dry = all.filter((b) => defOf(b).thermal && b.enabled && (b.tank ?? 0) <= 0);
  if (dry.length) {
    const fuels = [...new Set(dry.map((b) => FUELS[defOf(b).thermal!.fuel].name))].join(' / ');
    out.push({ id: 'nofuel', level: 'bad', text: `${dry.length} fuel plant${dry.length > 1 ? 's have' : ' has'} no ${fuels}. Buy fuel, refuel from the depot, or turn on auto-purchase.`, screen: 'fuel' });
  }

  if (s.rates.net < 0) {
    const worst = (Object.entries(s.rates.cats) as [LedgerKey, number][]).filter(([k]) => COST_NAME[k]).sort((a, b) => b[1] - a[1])[0];
    out.push({ id: 'losing', level: 'warn', text: `The company is losing money right now${worst ? `; the biggest cost is ${COST_NAME[worst[0]]}` : ''}.`, screen: 'finance' });
  }

  const load = mapMaintenanceLoad(s, m), cap = maintenanceCapacity(s, m);
  if (load > cap * 1.02) out.push({ id: 'crew', level: 'warn', text: `Maintenance crews are overloaded (${load.toFixed(1)} / ${cap.toFixed(1)} WU), so buildings will keep wearing down. Hire technicians or build a maintenance depot.`, screen: 'workforce' });

  const broken = all.filter((b) => !defOf(b).fixed && b.condition < 0.4).length;
  if (broken) out.push({ id: 'broken', level: 'warn', text: `${broken} installation${broken > 1 ? 's are' : ' is'} below 40% condition and losing output. "Repair all" fixes them now.` });

  const stores = all.filter((b) => defOf(b).storage);
  const storeCap = stores.reduce((a, b) => a + storageCapacityKWh(s, b), 0);
  const storeFull = stores.length > 0 && stores.every((b) => (b.stored ?? 0) >= storageCapacityKWh(s, b) * 0.98);
  if (m.lastExportCapped) out.push({ id: 'capped', level: 'warn', text: `Export is at the grid limit and ${kw(fl.curtailed)} is being thrown away. Upgrade the grid connection, add storage, or sign customers.` });
  else if (fl.curtailed > 0 && !storeCap) out.push({ id: 'curtail', level: 'tip', text: `${kw(fl.curtailed)} of surplus is being wasted. Storage would keep it for the evening.` });
  else if (fl.curtailed > 0 && storeFull) out.push({ id: 'storefull', level: 'tip', text: 'Storage is full and surplus is still wasted. More storage or export capacity would turn it into money.' });

  if (fl.imported > fl.demand * 0.1 && fl.importCost > 0 && solarFactor(s.time) < 0.05)
    out.push({ id: 'night', level: 'tip', text: `Importing ${kw(fl.imported)} at night. Wind, hydro, dams or storage can cover nights instead.` });

  for (const f of [...new Set(all.map((b) => defOf(b).infra?.role === 'fuelProducer' ? defOf(b).infra!.fuel : undefined).filter(Boolean))] as FuelId[]) {
    const fb = fuelBalance(s, m, f);
    if (fb.plants && fb.burnMax > 0 && fb.produced < fb.burnMax * 0.5)
      out.push({ id: `fuel:${f}`, level: 'tip', text: `Own ${FUELS[f].name} production covers only ${Math.round((fb.produced / fb.burnMax) * 100)}% of what your plants burn at full load.`, screen: 'fuel' });
    else if (!fb.plants) out.push({ id: `fuel:${f}`, level: 'tip', text: `You produce ${FUELS[f].name} but have no plant burning it here.` });
  }

  if (!Object.keys(s.research.active).length) {
    const can = RESEARCH_LIST.some((r) => researchStatus(s, r.id) === 'available' && r.cost <= s.money);
    if (can) out.push({ id: 'research', level: 'tip', text: 'No research is running. Start a project to unlock better buildings.', screen: 'research' });
  }

  const wx = weatherAt(m, s.time) ?? nextWeather(m, s.time, 24);
  if (wx) {
    const soon = wx.start > s.time ? `in ${Math.max(1, Math.round(wx.start - s.time))} h` : `for ${Math.max(1, Math.round(wx.end - s.time))} more h`;
    const tip = wx.kind === 'storm' ? 'Charge storage now; wind and solar will drop.' : wx.kind === 'heatwave' ? 'Demand will rise: fill storage and keep fuel plants stocked.' : 'Hydro will fall: keep fuel or storage ready.';
    out.push({ id: 'weather', level: 'warn', text: `${WEATHER[wx.kind].name} ${soon}. ${tip}` });
  }

  const ns = nextStage(s);
  if (ns && stageUnlockStatus(s, ns).canUnlock) out.push({ id: 'expand', level: 'tip', text: `You can expand to ${STAGES[ns].name} now.`, screen: 'progress' });

  const rank = { bad: 0, warn: 1, tip: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
