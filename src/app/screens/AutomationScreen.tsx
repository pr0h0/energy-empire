import { BUILDINGS } from '../../engine/data/buildings';
import { FUELS } from '../../engine/data/fuels';
import { STAGE_LIST } from '../../engine/data/stages';
import type { StorageMode } from '../../engine/core/State';
import { hasFeature } from '../../engine/core/Modifiers';
import { fuelPolicy, fuelsUsed } from '../../engine/systems/FuelSystem';
import { cmd, engine } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { Card, Select, Slider, Toggle } from '../components/ui';

export function AutomationScreen() {
  const f = useFmt();
  const s = useGame((s) => s);
  const maps = STAGE_LIST.filter((st) => s.maps[st.id]);
  return (
    <div className="p-3 flex flex-col gap-3" data-testid="automation-screen">
      <Card title="Company automation">
        <Toggle label="Pause all automation (repairs, refuelling, purchasing, PPA renewal)" checked={s.automationPaused} onChange={(v) => cmd({ type: 'automationPaused', paused: v })} />
        <Slider label="Global default repair threshold" value={s.defaultRepairThreshold} min={0.2} max={0.95} step={0.05} format={(v) => f.pct(v)} onChange={(v) => cmd({ type: 'globalThreshold', value: v })} />
        <p className="muted text-[0.85em]">Thresholds resolve installation override → building-type override → map default → global default.</p>
        <ul className="muted text-[0.85em] mt-1 list-disc pl-5">
          <li>Preventive servicing by idle crews: {hasFeature(s, 'repair.preventive') ? 'enabled' : 'requires Predictive Maintenance'}</li>
          <li>Repair priority overrides: {hasFeature(s, 'automation.priority') ? 'enabled' : 'requires Condition Monitoring'}</li>
          <li>Fully automatic fuel purchasing: {hasFeature(s, 'fuel.autoBuy') ? 'available' : 'requires Delivery Routing'}</li>
          <li>Automatic PPA renewal: {hasFeature(s, 'trading.auto') ? 'enabled' : 'requires Algorithmic Trading'}</li>
        </ul>
      </Card>
      <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
        {maps.map((st) => {
          const m = s.maps[st.id]!;
          const types = [...new Set(Object.values(m.buildings).map((b) => b.def))].filter((d) => !BUILDINGS[d].fixed);
          return (
            <Card key={st.id} title={`${st.name} policies`}>
              <Slider label="Map repair threshold" value={m.policies.repairThreshold ?? s.defaultRepairThreshold} min={0.2} max={0.95} step={0.05} format={(v) => (m.policies.repairThreshold === null ? `${f.pct(v)} (global)` : f.pct(v))} onChange={(v) => cmd({ type: 'mapPolicy', map: st.id, patch: { repairThreshold: v } })} />
              {m.policies.repairThreshold !== null && <button className="btn btn-sm mb-1" onClick={() => cmd({ type: 'mapPolicy', map: st.id, patch: { repairThreshold: null } })}>Use global default</button>}
              <Toggle label="Import from grid to cover shortages" checked={m.policies.importForShortage || st.id === 'backyard'} disabled={st.id === 'backyard'} onChange={(v) => cmd({ type: 'mapPolicy', map: st.id, patch: { importForShortage: v } })} />
              <Toggle label="Automatically export surplus" checked={m.policies.autoExport} onChange={(v) => cmd({ type: 'mapPolicy', map: st.id, patch: { autoExport: v } })} />
              <div className="flex items-center justify-between gap-2 py-1">
                <span>Default battery mode (new storage)</span>
                <Select<StorageMode> value={m.policies.defaultStorageMode} label="Default storage mode" onChange={(v) => cmd({ type: 'mapPolicy', map: st.id, patch: { defaultStorageMode: v } })}
                  options={[{ value: 'self', label: 'Self-consumption' }, { value: 'sell', label: 'Sell surplus first' }, { value: 'reserve', label: 'Emergency reserve' }, { value: 'smart', label: 'Smart', disabled: !hasFeature(s, 'battery.advanced') }]} />
              </div>
              {types.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer">Building-type repair thresholds</summary>
                  {types.map((d) => (
                    <div key={d} className="flex items-center justify-between gap-2 py-0.5">
                      <span>{BUILDINGS[d].name}</span>
                      <Select value={m.policies.typeThresholds[d] === undefined ? 'default' : String(m.policies.typeThresholds[d])} label={`${BUILDINGS[d].name} threshold`} onChange={(v) => cmd({ type: 'typeThreshold', map: st.id, def: d, value: v === 'default' ? null : Number(v) })}
                        options={[{ value: 'default', label: 'Map default' }, ...[0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((x) => ({ value: String(x), label: f.pct(x) }))]} />
                    </div>
                  ))}
                </details>
              )}
              {fuelsUsed(m).length > 0 && <h4 className="font-semibold mt-2">Fuel automation</h4>}
              {fuelsUsed(m).map((fu) => {
                const p = m.policies.fuel[fu] ?? fuelPolicy(structuredClone(m), fu);
                return (
                  <div key={fu} className="panel2 p-2 mt-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{FUELS[fu].name}</span>
                      <Select value={p.mode} label={`${FUELS[fu].name} automation`} onChange={(v) => cmd({ type: 'fuelPolicy', map: st.id, fuel: fu, patch: { mode: v as 'manual' | 'refuel' | 'full' } })}
                        options={[{ value: 'manual', label: 'Manual' }, { value: 'refuel', label: 'Auto-refuel from depot' }, { value: 'full', label: 'Auto-purchase + refuel', disabled: !hasFeature(engine.state, 'fuel.autoBuy') }]} />
                    </div>
                    <Slider label="Refill tanks below" value={p.refillAt} min={0.05} max={0.9} step={0.05} format={(v) => f.pct(v)} onChange={(v) => cmd({ type: 'fuelPolicy', map: st.id, fuel: fu, patch: { refillAt: v } })} />
                    {p.mode === 'full' && (
                      <>
                        <Slider label="Keep depot share at least" value={p.minInventory} min={0.1} max={1} step={0.05} format={(v) => f.pct(v)} onChange={(v) => cmd({ type: 'fuelPolicy', map: st.id, fuel: fu, patch: { minInventory: v } })} />
                        <Slider label="Only buy below base price ×" value={p.maxPriceFactor} min={0.8} max={2} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => cmd({ type: 'fuelPolicy', map: st.id, fuel: fu, patch: { maxPriceFactor: v } })} />
                        <label className="flex items-center justify-between gap-2 py-1">
                          <span>Daily budget (0 = unlimited)</span>
                          <input className="input w-36 num" type="number" min={0} value={p.budgetPerDay} onChange={(e) => cmd({ type: 'fuelPolicy', map: st.id, fuel: fu, patch: { budgetPerDay: Number(e.target.value) } })} aria-label="Daily fuel budget" />
                        </label>
                        <div className="muted text-[0.82em]">Spent today: {f.money(p.spentToday)}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
