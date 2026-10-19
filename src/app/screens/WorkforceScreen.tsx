import { Minus, Plus } from 'lucide-react';
import { EMPLOYEE_LIST } from '../../engine/data/employees';
import { STAGE_LIST, STAGES } from '../../engine/data/stages';
import type { EmployeeGroup, StageId } from '../../engine/data/types';
import { logisticsSlots, maintenanceCapacity, tradingCapacity, traderBonus, workerCount } from '../../engine/core/Helpers';
import { mod } from '../../engine/core/Modifiers';
import { hireCost, tierAvailable, trainingCost } from '../../engine/systems/EmployeeSystem';
import { globalWages, mapWages } from '../../engine/systems/FinanceSystem';
import { mapMaintenanceLoad } from '../../engine/systems/MaintenanceSystem';
import { researchThroughput } from '../../engine/systems/ResearchSystem';
import { cmd } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { Card, Progress, Row, Stat } from '../components/ui';
import { GoLink } from '../components/GoLink';

function TierRow({ tier, map }: { tier: string; map?: StageId }) {
  const f = useFmt();
  const s = useGame((s) => s);
  const t = EMPLOYEE_LIST.find((x) => x.id === tier)!;
  const pool = map ? s.maps[map]!.workforce : s.workforce;
  const n = pool[tier] ?? 0;
  const why = tierAvailable(s, tier);
  const cost = hireCost(tier, map);
  const scale = map ? STAGES[map].scale : 1;
  const unit = t.group === 'maintenance' ? 'WU' : t.group === 'logistics' ? 'slots' : t.group === 'research' ? 'RP/h' : 'trade';
  return (
    <div className={`flex items-center gap-2 py-1 border-b border-[var(--border)] last:border-0 ${why ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{t.name} <span className="muted num">×{n}</span></div>
        <div className="muted text-[0.82em] num">{t.capacity} {unit} each · wage {f.rate(t.wage * scale * mod(s, 'wages'))} · hire {f.money(cost)}</div>
        {why && t.research && <div className="text-amber-300 text-[0.8em]">Requires <GoLink kind="research" id={t.research} /></div>}
      </div>
      <button className="btn btn-sm" disabled={n <= 0} onClick={() => cmd({ type: 'fire', tier, count: 1, map })} aria-label={`Dismiss ${t.name}`}><Minus size={13} /></button>
      <button className="btn btn-sm btn-primary" disabled={!!why || s.money < cost} onClick={() => cmd({ type: 'hire', tier, count: 1, map }, `Hired ${t.name}.`)} aria-label={`Hire ${t.name}`} data-testid={`hire-${tier}${map ? `-${map}` : ''}`}><Plus size={13} /></button>
    </div>
  );
}

/** Company-wide training: +10% researcher/trader output per level. */
function TrainButton({ group, label }: { group: 'research' | 'trading'; label: string }) {
  const f = useFmt();
  const s = useGame((s) => s);
  const c = trainingCost(s, 'backyard', group);
  return (
    <button className="btn btn-sm mt-1" disabled={c === null || s.money < (c ?? 0)} onClick={() => cmd({ type: 'train', map: 'backyard', group }, 'Training complete.')} data-tip="+10% output for this whole staff group per level" data-testid={`train-${group}`}>
      {label} (lvl {s.staffTraining[group]}) {c !== null ? f.money(c) : 'max'}
    </button>
  );
}

const tiers = (g: EmployeeGroup) => EMPLOYEE_LIST.filter((t) => t.group === g).map((t) => t.id);

export function WorkforceScreen() {
  const f = useFmt();
  const s = useGame((s) => s);
  const maps = STAGE_LIST.filter((st) => s.maps[st.id]);
  const totalWages = globalWages(s) + maps.reduce((a, st) => a + mapWages(s, s.maps[st.id]!), 0);
  return (
    <div className="p-3 flex flex-col gap-3" data-testid="workforce-screen">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Employees" value={workerCount(s)} />
        <Stat label="Wage bill" value={f.rate(totalWages)} />
        <Stat label="Research pool" value={`${f.num(researchThroughput(s))} RP/h`} />
        <Stat label="Trading capacity" value={`${tradingCapacity(s).toFixed(1)} (+${f.pct(traderBonus(s), 1)} prices)`} />
      </div>
      <p className="muted">Crews work as capacity pools — never tied to a single building. Maintenance and logistics crews serve one map each; researchers and traders work company-wide. Your first technician needs no office.</p>
      <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
        <Card title="Researchers (company-wide)">
          {tiers('research').map((t) => <TierRow key={t} tier={t} />)}
          <TrainButton group="research" label="Train researchers" />
        </Card>
        <Card title="Energy traders (company-wide)">
          {tiers('trading').map((t) => <TierRow key={t} tier={t} />)}
          <TrainButton group="trading" label="Train traders" />
          <p className="muted text-[0.82em] mt-1">Basic selling never needs traders. Traders raise export/PPA prices (1% per capacity, max 12%) and each manages one power purchase agreement.</p>
        </Card>
        {maps.map((st) => {
          const m = s.maps[st.id]!;
          const load = mapMaintenanceLoad(s, m);
          const cap = maintenanceCapacity(s, m);
          const tm = trainingCost(s, st.id, 'maintenance');
          const tl = trainingCost(s, st.id, 'logistics');
          return (
            <Card key={st.id} title={`${st.name} crews`}>
              <Row k="Maintenance load / capacity" v={`${load.toFixed(2)} / ${cap.toFixed(2)} WU`} />
              <Progress value={cap > 0 ? load / cap : 1} color={load > cap ? '#ef4444' : '#22c55e'} label="Maintenance utilisation" />
              <Row k="Logistics slots (in use)" v={`${logisticsSlots(s, m)} (${Math.min(m.logisticsJobs.length, logisticsSlots(s, m))})`} />
              <h4 className="font-semibold mt-2">Maintenance</h4>
              {tiers('maintenance').map((t) => <TierRow key={t} tier={t} map={st.id} />)}
              <h4 className="font-semibold mt-2">Logistics</h4>
              {tiers('logistics').map((t) => <TierRow key={t} tier={t} map={st.id} />)}
              <div className="flex gap-1 mt-2 flex-wrap">
                <button className="btn btn-sm" disabled={tm === null || s.money < (tm ?? 0)} onClick={() => cmd({ type: 'train', map: st.id, group: 'maintenance' }, 'Training complete.')}>Train maintenance (lvl {m.training.maintenance}) {tm !== null ? f.money(tm) : 'max'}</button>
                <button className="btn btn-sm" disabled={tl === null || s.money < (tl ?? 0)} onClick={() => cmd({ type: 'train', map: st.id, group: 'logistics' }, 'Training complete.')}>Train logistics (lvl {m.training.logistics}) {tl !== null ? f.money(tl) : 'max'}</button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
