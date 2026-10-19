import { Power, Trash2, Wrench } from 'lucide-react';
import { useState } from 'react';
import { FUELS } from '../../engine/data/fuels';
import { UPGRADES, UPGRADE_RESEARCH } from '../../engine/data/upgrades';
import { defOf, isGenerator, nameplateKW, ratedKW, repairThreshold, storageCapacityKWh, storagePowerKW } from '../../engine/core/Helpers';
import { hasFeature, isUpgradeUnlocked } from '../../engine/core/Modifiers';
import type { StorageMode, ThermalMode } from '../../engine/core/State';
import type { BuildingPatch } from '../../engine/core/Commands';
import { availableUpgrades, componentReplacementCost, rebuildCost, repowerCost, repowerOptions, upgradeCost } from '../../engine/systems/BuildingSystem';
import { salvageValue } from '../../engine/systems/ConstructionSystem';
import { manualRepairCost, maintLoad, expectedLoad } from '../../engine/systems/MaintenanceSystem';
import { tankCapacity, thermalLimits } from '../../engine/systems/ThermalSystem';
import { buildingIconURL } from '../../rendering/SVGAssets';
import { cmd } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame, useMapState } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { Chip, Modal, Progress, Row, Select, Slider } from '../components/ui';
import { GoLink } from '../components/GoLink';
import { BuildingFuelInfo } from '../components/FuelInfo';

/** Selected-building inspector: output, condition, fuel, finances, upgrades, actions, policies. */
export function Inspector({ id }: { id: string }) {
  const f = useFmt();
  const m = useMapState();
  const s = useGame((s) => s);
  const [confirmDemolish, setConfirmDemolish] = useState(false);
  const b = m.buildings[id];
  if (!b) return <p className="muted">Installation no longer exists.</p>;
  const d = defOf(b);
  const compact = s.settings.compactInspector;
  const gen = isGenerator(d);
  const rated = ratedKW(b, d);
  const util = rated > 0 ? Math.max(0, b.output) / rated : 0;
  const net = b.rRevenue - b.rCost;
  const payback = net > 0 ? b.invested / net : Infinity;
  const salvage = salvageValue(s, b);
  const th = repairThreshold(s, m, b);
  const repairCost = manualRepairCost(s, b);
  const adv = hasFeature(s, 'thermal.advanced');
  const L = d.thermal ? thermalLimits(s, m, b, d, 1 / 24) : null;
  const conf = (patch: BuildingPatch) => cmd({ type: 'configure', map: m.id, id, patch });
  return (
    <div className="flex flex-col gap-2" data-testid="inspector">
      <div className="flex gap-2 items-start">
        <img src={buildingIconURL(d.art)} alt="" className="w-14 h-14 rounded bg-[var(--panel3)]" />
        <div className="min-w-0">
          <h3 className="font-bold text-[1.1em] leading-tight" data-testid="inspector-name">{d.name}</h3>
          <div className="muted text-[0.85em]">{d.category} · {d.family}{d.aggregate && b.units > 1 ? ` · ${b.units.toLocaleString()} × ${d.unit.label}` : ''}</div>
          <div className="text-[0.85em] mt-0.5" data-testid="inspector-status">{b.status}</div>
        </div>
      </div>
      {!compact && <p className="muted text-[0.85em]">{d.desc}</p>}
      {d.speculative && <Chip tone="info">Speculative technology</Chip>}
      <div className="panel2 p-2">
        {gen && (
          <>
            <Row k="Output now" v={f.kw(b.output)} />
            <Row k="Available now" v={f.kw(b.available)} />
            <Row k="Nameplate" v={f.kw(nameplateKW(b, d))} />
            <Row k="Utilisation" v={f.pct(util)} />
          </>
        )}
        {d.storage && (
          <>
            <Row k="Stored" v={`${f.kwh(b.stored ?? 0)} / ${f.kwh(storageCapacityKWh(s, b, d))}`} />
            <Progress value={(b.stored ?? 0) / Math.max(1e-9, storageCapacityKWh(s, b, d))} color="#22c55e" label="State of charge" />
            <Row k="Max charge/discharge" v={f.kw(storagePowerKW(s, b, d))} />
            <Row k="Round-trip efficiency" v={f.pct(d.storage.etaIn * d.storage.etaOut, 1)} />
            <Row k="Cycles" v={(b.cycles ?? 0).toFixed(1)} />
            <Row k="Flow now" v={b.output > 0 ? `discharging ${f.kw(b.output)}` : b.output < 0 ? `charging ${f.kw(-b.output)}` : 'idle'} />
          </>
        )}
        {d.infra && d.infra.role !== 'house' && !d.storage && (
          <Row k="Function" v={d.infra.role === 'fuelProducer' ? `${d.infra.rate! * b.units} ${FUELS[d.infra.fuel!].unit}/h ${FUELS[d.infra.fuel!].name}` : d.infra.role === 'grid' ? `+${f.kw(d.infra.kw ?? 0)} grid` : d.infra.role === 'sink' ? `Convergence ${f.kwh(s.convergence)}` : d.infra.role} />
        )}
        {(d.thermal || d.infra?.role === 'fuelStorage' || d.infra?.role === 'fuelProducer') && <div className="panel2 p-2 my-1"><BuildingFuelInfo s={s} m={m} b={b} /></div>}
        <div className="mt-1">
          <div className="flex justify-between"><span className="muted">Condition</span><span className="num">{f.pct(b.condition)} (repair at {f.pct(th)})</span></div>
          <Progress value={b.condition} color={b.condition > 0.7 ? '#22c55e' : b.condition > 0.4 ? '#eab308' : '#ef4444'} label="Condition" />
        </div>
        {b.wearOut > 0.001 && <Row k={d.storage ? 'Cell aging (capacity lost)' : 'Irreversible aging'} v={f.pct(b.wearOut, 1)} />}
        {d.gen?.kind === 'geothermal' && <Row k="Reservoir pressure" v={f.pct(b.pressure ?? 1)} />}
        {d.gen?.kind === 'penrose' && <Row k="Spin reservoir" v={f.kwh(b.pool ?? 0)} />}
        {d.gen?.kind === 'csp' && <Row k="Stored heat" v={f.kwh(b.heatStore ?? 0)} />}
        {d.gen?.kind === 'dam' && (
          <>
            <Row k="Reservoir" v={`${f.pct((b.reservoir ?? 0) / Math.max(1, b.reservoirMax ?? 1))} of ${(b.reservoirMax ?? 0).toExponential(2)} m³`} />
            <Row k="Inflow / release" v={`${(b.inflow ?? 0).toPrecision(3)} / ${(b.release ?? 0).toPrecision(3)} m³/s`} />
          </>
        )}
        {!compact && <Row k="Maintenance load" v={`${maintLoad(b, d).toFixed(2)} WU (${expectedLoad(s, b, d).toFixed(3)} WU/h wear)`} />}
      </div>
      {d.thermal && L && (
        <div className="panel2 p-2">
          <h4 className="font-semibold">Thermal</h4>
          <Row k="Fuel" v={`${FUELS[d.thermal.fuel].name}: ${(b.tank ?? 0).toPrecision(3)} / ${tankCapacity(b, d).toPrecision(3)} ${FUELS[d.thermal.fuel].unit}`} />
          <Progress value={(b.tank ?? 0) / Math.max(1e-12, tankCapacity(b, d))} color="#f97316" label="Fuel tank" />
          <Row k="Heat input" v={f.kw(b.heat ?? 0)} />
          <Row k="Efficiency" v={f.pct(b.eta ?? L.eta, 1)} />
          <Row k="Waste heat / cooling" v={`${f.kw(b.waste ?? 0)} / ${f.kw(L.coolingCap)}`} />
          <Row k="Limited by" v={d.thermal?.parasitic && !b.ignited ? 'plasma not ignited yet' : b.output <= 0 && (b.tank ?? 0) > 0 && b.mode !== 'off' ? 'demand (not needed right now)' : L.limitedBy} />
          <Row k="Marginal cost" v={f.price(L.mc)} />
          {d.thermal.parasitic && <Row k="Plasma" v={b.ignited ? 'burning' : 'cold'} />}
          <div className="flex gap-1 mt-1 flex-wrap">
            <button className="btn btn-sm" onClick={() => cmd({ type: 'refuel', map: m.id, id }, 'Refuelling started.')} data-testid="refuel">Refuel from depot</button>
            <button className="btn btn-sm" onClick={() => { useUI.getState().setScreen('fuel'); }}>Buy fuel…</button>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span>Dispatch mode</span>
            <Select<ThermalMode> value={b.mode ?? 'follow'} label="Dispatch mode" onChange={(v) => conf({ mode: v })} options={[{ value: 'baseload', label: 'Baseload' }, { value: 'follow', label: 'Load-follow' }, { value: 'economic', label: 'Economic (export when profitable)' }, { value: 'off', label: 'Off' }]} />
          </div>
          <Slider label={adv ? 'Operating target' : 'Operating target (max 100% — Advanced Thermal Management raises to 110%)'} value={b.target ?? 1} min={0.2} max={adv ? 1.1 : 1} step={0.05} format={(v) => f.pct(v)} onChange={(v) => conf({ target: v })} />
          <div className="flex items-center justify-between gap-2">
            <span>Cooling margin</span>
            <Select value={b.coolingMode ?? 'safe'} label="Cooling mode" onChange={(v) => conf({ coolingMode: v as 'safe' | 'optimized' })} options={[{ value: 'safe', label: 'Safe (automatic)' }, { value: 'optimized', label: 'Optimised', disabled: !adv }]} />
          </div>
        </div>
      )}
      {d.storage && (
        <div className="panel2 p-2">
          <h4 className="font-semibold">Storage policy</h4>
          <div className="flex items-center justify-between gap-2">
            <span>Mode</span>
            <Select<StorageMode>
              value={b.storageMode ?? 'self'}
              label="Storage mode"
              onChange={(v) => conf({ storageMode: v })}
              options={[
                { value: 'self', label: 'Self-consumption' }, { value: 'sell', label: 'Sell surplus first' }, { value: 'reserve', label: 'Emergency reserve' },
                { value: 'peak', label: 'Peak shaving', disabled: !hasFeature(s, 'battery.advanced') }, { value: 'smart', label: 'Smart dispatch', disabled: !hasFeature(s, 'battery.advanced') },
                { value: 'arbitrage', label: 'Market arbitrage', disabled: !hasFeature(s, 'battery.arbitrage') },
              ]}
            />
          </div>
          {hasFeature(s, 'battery.advanced') && <Slider label="Minimum reserve" value={b.reserve ?? 0.2} min={0} max={0.9} step={0.05} format={(v) => f.pct(v)} onChange={(v) => conf({ reserve: v })} />}
          {b.storageMode === 'peak' && <Slider label="Shave demand above" value={b.peakKW ?? 0} min={0} max={Math.max(1, m.flow.demand * 2)} step={Math.max(0.01, m.flow.demand / 100)} format={f.kw} onChange={(v) => conf({ peakKW: v })} />}
          {(b.storageMode === 'arbitrage' || b.storageMode === 'smart') && (
            <>
              <Slider label="Charge below price factor" value={b.lowPrice ?? 0.85} min={0.4} max={1.2} step={0.01} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => conf({ lowPrice: v })} />
              <Slider label="Discharge above price factor" value={b.highPrice ?? 1.15} min={0.8} max={1.8} step={0.01} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => conf({ highPrice: v })} />
            </>
          )}
        </div>
      )}
      {d.gen?.kind === 'dam' && (
        <div className="panel2 p-2">
          <Slider label="Reservoir target level" value={b.reservoirTarget ?? 0.75} min={0.1} max={1} step={0.05} format={(v) => f.pct(v)} onChange={(v) => conf({ reservoirTarget: v })} />
          <p className="muted text-[0.82em]">Water above the target is released over ~8 h; spillways open automatically when full.</p>
        </div>
      )}
      {!d.fixed && (
        <div className="panel2 p-2">
          <h4 className="font-semibold">Finances</h4>
          <Row k="Revenue" v={f.rate(b.rRevenue)} />
          <Row k="Operating cost" v={f.rate(b.rCost)} />
          <Row k="Net" v={<span className={net >= 0 ? 'text-green-400' : 'text-red-400'}>{f.rate(net)}</span>} />
          <Row k="Invested" v={f.money(b.invested)} />
          <Row k="Est. payback" v={Number.isFinite(payback) ? f.dur(payback) : '—'} />
          {!compact && <Row k="Lifetime energy / revenue" v={`${f.kwh(b.energy)} / ${f.money(b.revenue)}`} />}
        </div>
      )}
      {!d.fixed && (
        <div className="panel2 p-2 flex flex-col gap-1">
          <h4 className="font-semibold">Actions</h4>
          <div className="flex gap-1 flex-wrap">
            <button className="btn btn-sm btn-primary" disabled={b.condition >= 0.999 || s.money < repairCost} onClick={() => cmd({ type: 'repair', map: m.id, id }, 'Repaired.')} data-testid="repair"><Wrench size={13} />Repair {f.money(repairCost)}</button>
            <button className="btn btn-sm" onClick={() => conf({ enabled: !b.enabled })} data-testid="toggle-enabled"><Power size={13} />{b.enabled ? 'Switch off' : 'Switch on'}</button>
            {(b.wearOut > 0.01 || (d.gen?.kind === 'geothermal' && (b.pressure ?? 1) < 0.95)) && (
              <button className="btn btn-sm" onClick={() => cmd({ type: 'replaceComponents', map: m.id, id }, 'Components replaced.')}>{d.storage ? 'Replace cells' : 'Replace components'} {f.money(componentReplacementCost(s, m, b))}</button>
            )}
            <button className="btn btn-sm" onClick={() => cmd({ type: 'rebuild', map: m.id, id }, 'Rebuild started.')}>Rebuild {f.money(rebuildCost(s, m, b))}</button>
            <button className="btn btn-sm btn-danger" onClick={() => setConfirmDemolish(true)} data-testid="demolish"><Trash2 size={13} />Demolish</button>
          </div>
          {repowerOptions(s, m, b).map((n) => (
            <button key={n.id} className="btn btn-sm justify-start" onClick={() => cmd({ type: 'repower', map: m.id, id, to: n.id }, `Repowering to ${n.name}.`)}>
              Repower → {n.name} · {f.money(repowerCost(s, m, b, n.id))}
            </button>
          ))}
          <div className="flex items-center justify-between gap-2 mt-1">
            <span>Repair threshold</span>
            <Select
              value={b.repairThreshold === undefined ? 'default' : String(b.repairThreshold)}
              label="Repair threshold override"
              onChange={(v) => conf({ repairThreshold: v === 'default' ? null : Number(v) })}
              options={[{ value: 'default', label: `Default (${f.pct(th)})` }, ...[0.5, 0.6, 0.7, 0.8, 0.9].map((x) => ({ value: String(x), label: f.pct(x) }))]}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Repair priority</span>
            <Select value={String(b.priority ?? 0)} label="Repair priority" onChange={(v) => conf({ priority: Number(v) as -1 | 0 | 1 })} options={[{ value: '1', label: 'High', disabled: !hasFeature(s, 'automation.priority') }, { value: '0', label: 'Normal' }, { value: '-1', label: 'Low', disabled: !hasFeature(s, 'automation.priority') }]} />
          </div>
        </div>
      )}
      {!d.fixed && availableUpgrades(b).length + b.upgrades.length > 0 && (
        <div className="panel2 p-2" data-testid="upgrades">
          <h4 className="font-semibold mb-1">Upgrades & retrofits</h4>
          {b.upgrades.map((u) => <div key={u} className="text-green-300 text-[0.9em]">✓ {UPGRADES[u].name}</div>)}
          {availableUpgrades(b).map((u) => {
            const up = UPGRADES[u];
            const unlocked = isUpgradeUnlocked(s, u);
            const cost = upgradeCost(s, m, b, u);
            return (
              <div key={u} className="py-1 border-t border-[var(--border)]">
                <div className="flex justify-between gap-2 items-center">
                  <span className="font-medium">{up.name}</span>
                  <button className="btn btn-sm" disabled={!unlocked || s.money < cost} onClick={() => cmd({ type: 'retrofit', map: m.id, id, upgrade: u }, `${up.name} installed.`)} data-testid={`retrofit-${u}`}>
                    {f.money(cost)}
                  </button>
                </div>
                <div className="muted text-[0.82em]">{up.desc} Downtime {up.downtimeH} h.</div>
                {!unlocked && <div className="text-amber-300 text-[0.8em]">Requires {UPGRADE_RESEARCH[u] ? <GoLink kind="research" id={UPGRADE_RESEARCH[u]} /> : 'research'}</div>}
              </div>
            );
          })}
        </div>
      )}
      {confirmDemolish && (
        <Modal
          title={`Demolish ${d.name}?`}
          onClose={() => setConfirmDemolish(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmDemolish(false)}>Cancel</button>
              <button className="btn btn-danger" data-testid="confirm-demolish" onClick={() => { cmd({ type: 'demolish', map: m.id, id }, salvage >= 0 ? `Demolished — salvage ${f.money(salvage)}` : `Decommissioned for ${f.money(-salvage)}`); setConfirmDemolish(false); useUI.getState().select(null); }}>
                Demolish
              </button>
            </>
          }
        >
          <p>The land stays yours. {salvage >= 0 ? <>Salvage recovered: <b>{f.money(salvage)}</b></> : <>Decommissioning will cost <b>{f.money(-salvage)}</b>.</>}</p>
          <p className="muted mt-1">Linked repair and refuelling jobs are cancelled; unburnt fuel returns to the depot.</p>
        </Modal>
      )}
    </div>
  );
}
