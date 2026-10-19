import { useState } from 'react';
import { STAGE_LIST, STAGES } from '../../engine/data/stages';
import { UPGRADES } from '../../engine/data/upgrades';
import { BUILDINGS } from '../../engine/data/buildings';
import type { StageId } from '../../engine/data/types';
import { defOf, maintenanceCapacity, repairThreshold } from '../../engine/core/Helpers';
import { getMods, hasFeature } from '../../engine/core/Modifiers';
import { fleetUpgradeQuote } from '../../engine/systems/BuildingSystem';
import { jobPriority, mapMaintenanceLoad, workPerCondition } from '../../engine/systems/MaintenanceSystem';
import { cmd } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { Card, Empty, Progress, Select, Stat } from '../components/ui';

export function OperationsScreen() {
  const f = useFmt();
  const s = useGame((s) => s);
  const ui = useUI();
  const [map, setMap] = useState<StageId>(ui.map);
  const m = s.maps[map] ?? s.maps.backyard!;
  const load = mapMaintenanceLoad(s, m);
  const cap = maintenanceCapacity(s, m);
  const maxRev = Object.values(m.buildings).reduce((a, b) => Math.max(a, b.rRevenue), 0);
  const jobs = [...m.repairJobs].sort((a, b) => jobPriority(s, m, b, maxRev) - jobPriority(s, m, a, maxRev));
  const attention = Object.values(m.buildings).filter((b) => !defOf(b).fixed && (b.condition < repairThreshold(s, m, b) || !b.enabled || b.status.startsWith('Shut') || b.status.startsWith('Out of fuel')));
  const fleet = hasFeature(s, 'fleet.upgrade');
  const ups = [...getMods(s).unlockedUpgrades].filter((u) => UPGRADES[u]);
  return (
    <div className="p-3 flex flex-col gap-3" data-testid="operations-screen">
      <div className="flex gap-2 items-center">
        <span>Map</span>
        <Select<StageId> value={m.id} label="Map" onChange={setMap} options={STAGE_LIST.filter((st) => s.maps[st.id]).map((st) => ({ value: st.id, label: st.name }))} />
        <button className="btn btn-sm" onClick={() => cmd({ type: 'repairAll', map: m.id }, 'Repaired everything affordable.')}>Repair all manually</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Maintenance load" value={`${load.toFixed(2)} WU`} />
        <Stat label="Capacity" value={`${cap.toFixed(2)} WU`} tone={cap < load ? 'bad' : 'good'} />
        <Stat label="Queued jobs" value={m.repairJobs.length} />
        <Stat label="Needs attention" value={attention.length} tone={attention.length ? 'warn' : undefined} />
      </div>
      <Card title="Repair queue (priority order)">
        {jobs.length === 0 ? <Empty>No repairs queued.</Empty> : (
          <div className="scroll max-h-80">
            <table className="tbl">
              <thead><tr><th>Installation</th><th>Condition</th><th>Work left</th><th>Waited</th><th>Score</th><th>Priority</th></tr></thead>
              <tbody>
                {jobs.map((j) => {
                  const b = m.buildings[j.building];
                  if (!b) return null;
                  const d = defOf(b);
                  return (
                    <tr key={j.id}>
                      <td><button className="underline decoration-dotted" onClick={() => { ui.setMap(m.id); ui.setScreen('map'); ui.select({ kind: 'building', id: b.id }); }}>{d.name}</button></td>
                      <td className="num w-32"><Progress value={b.condition} color={b.condition > 0.5 ? '#eab308' : '#ef4444'} label="condition" /> {f.pct(b.condition)}</td>
                      <td className="num">{((1 - b.condition) * workPerCondition(b, d)).toFixed(1)} WU·h</td>
                      <td className="num">{f.dur(j.waitedH)}</td>
                      <td className="num">{jobPriority(s, m, j, maxRev).toFixed(1)}</td>
                      <td>
                        <Select value={String(j.priority)} label="Job priority" disabled={!hasFeature(s, 'automation.priority')} onChange={(v) => cmd({ type: 'jobPriority', map: m.id, job: j.id, priority: Number(v) as -1 | 0 | 1 })} options={[{ value: '1', label: 'High' }, { value: '0', label: 'Normal' }, { value: '-1', label: 'Low' }]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {cap <= 0 && jobs.length > 0 && <p className="text-amber-300 mt-1">No maintenance crews on {STAGES[m.id].name} — hire technicians or repair manually.</p>}
      </Card>
      <Card title="Installations needing attention">
        {attention.length === 0 ? <Empty>Everything is operating normally.</Empty> : attention.map((b) => (
          <div key={b.id} className="flex justify-between gap-2 py-1 border-b border-[var(--border)] last:border-0">
            <span>{defOf(b).name} — <span className="muted">{b.status}</span></span>
            <button className="btn btn-sm" onClick={() => cmd({ type: 'repair', map: m.id, id: b.id })}>Repair</button>
          </div>
        ))}
      </Card>
      <Card title="Fleet upgrades">
        {!fleet && <p className="muted">Research Fleet Management to retrofit whole fleets in one action.</p>}
        {fleet && ups.length === 0 && <Empty>No retrofits researched yet.</Empty>}
        {fleet && ups.map((u) => <FleetRow key={u} u={u} map={m.id} />)}
      </Card>
    </div>
  );
}

/** One retrofit across a fleet: optional building-type filter and a two-click confirmation. */
function FleetRow({ u, map }: { u: string; map: StageId }) {
  const f = useFmt();
  const s = useGame((s) => s);
  const m = s.maps[map]!;
  const [def, setDef] = useState('');
  const [sure, setSure] = useState(false);
  const all = fleetUpgradeQuote(s, m, u);
  if (!all.targets.length && !all.skippedInstalled) return null;
  const types = [...new Set(all.targets.map((id) => m.buildings[id].def))];
  const q = fleetUpgradeQuote(s, m, u, def || undefined);
  return (
    <div className="flex justify-between items-center gap-2 py-1 border-b border-[var(--border)] last:border-0 flex-wrap" onMouseLeave={() => setSure(false)}>
      <div>
        <div className="font-medium">{UPGRADES[u].name}</div>
        <div className="muted text-[0.82em]">{q.targets.length} eligible · {q.skippedInstalled} already installed · downtime {q.downtimeH} h each</div>
      </div>
      <div className="flex gap-1 items-center">
        {types.length > 1 && (
          <select className="input text-[0.85em]" value={def} onChange={(e) => { setDef(e.target.value); setSure(false); }} aria-label={`Building type for ${UPGRADES[u].name}`} data-testid={`fleet-filter-${u}`}>
            <option value="">All types ({all.targets.length})</option>
            {types.map((d) => <option key={d} value={d}>{BUILDINGS[d]?.name ?? d} ({all.targets.filter((id) => m.buildings[id].def === d).length})</option>)}
          </select>
        )}
        <button className={`btn btn-sm ${sure ? 'btn-danger' : 'btn-primary'}`} disabled={!q.targets.length || s.money < q.cost}
          onClick={() => {
            if (!sure) return setSure(true);
            setSure(false);
            cmd({ type: 'fleetUpgrade', map: m.id, upgrade: u, def: def || undefined }, `${UPGRADES[u].name} applied to ${q.targets.length} installations.`);
          }} data-testid={`fleet-${u}`}>
          {sure ? `Confirm: ${q.targets.length} × · ${f.money(q.cost)} · ${q.downtimeH} h offline each` : `Upgrade ${def ? 'these' : 'all'} · ${f.money(q.cost)}`}
        </button>
      </div>
    </div>
  );
}
