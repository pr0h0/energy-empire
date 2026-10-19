import { useState } from 'react';
import { FUELS, FUEL_IDS } from '../../engine/data/fuels';
import { STAGE_LIST, STAGES } from '../../engine/data/stages';
import type { FuelId, StageId } from '../../engine/data/types';
import { defOf, depotCapacityKWh, depotUsedKWh, logisticsSlots } from '../../engine/core/Helpers';
import { hasFeature } from '../../engine/core/Modifiers';
import { deliveryHours, depotFreeKWh, fuelAvailable, fuelOrderCost, fuelsUsed } from '../../engine/systems/FuelSystem';
import { fuelPrice } from '../../engine/systems/ThermalSystem';
import { cmd } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { Card, Empty, Progress, Row, Select, Stat } from '../components/ui';
import { LineChart } from '../components/LineChart';
import { FuelCoverage } from '../components/FuelInfo';

export function FuelScreen() {
  const f = useFmt();
  const s = useGame((s) => s);
  const ui = useUI();
  const [map, setMap] = useState<StageId>(ui.map);
  const m = s.maps[map] ?? s.maps.backyard!;
  const used = fuelsUsed(m);
  const [fuel, setFuel] = useState<FuelId>(used[0] ?? 'diesel');
  const [frac, setFrac] = useState(0.5);
  const free = depotFreeKWh(m) / FUELS[fuel].energyPerUnit;
  const qty = Math.max(0, free * frac);
  const cost = fuelOrderCost(s, m, fuel, qty);
  const cap = depotCapacityKWh(m);
  const unlocked = FUEL_IDS.filter((x) => used.includes(x) || (m.fuel[x] ?? 0) > 0);
  const chart = Array.from({ length: 48 }, (_, k) => ({ t: s.time + k * 6, v: fuelPrice(s, fuel, s.time + k * 6) }));
  const producers = Object.values(m.buildings).filter((b) => defOf(b).infra?.role === 'fuelProducer');
  return (
    <div className="p-3 flex flex-col gap-3" data-testid="fuel-screen">
      <div className="flex gap-2 items-center flex-wrap">
        <span>Map</span>
        <Select<StageId> value={m.id} label="Map" onChange={setMap} options={STAGE_LIST.filter((st) => s.maps[st.id]).map((st) => ({ value: st.id, label: st.name }))} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Depot used" value={`${f.kwh(depotUsedKWh(m))} th`} sub={`of ${f.kwh(cap)} th`} />
        <Stat label="In transit" value={m.logisticsJobs.filter((j) => j.kind === 'delivery').length} />
        <Stat label="Logistics slots" value={`${Math.min(m.logisticsJobs.length, logisticsSlots(s, m))}/${logisticsSlots(s, m)}`} />
        <Stat label="Fuel consumption" value={f.rate(m.flow.fuelCost)} />
      </div>
      <Progress value={depotUsedKWh(m) / cap} color="#f97316" label="Depot fill" />
      <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
        <Card title="Inventory">
          {unlocked.length === 0 ? <Empty>No fuel-burning installations on {STAGES[m.id].name}.</Empty> : unlocked.map((x) => (
            <div key={x} className="py-1 border-b border-[var(--border)] last:border-0">
              <Row k={FUELS[x].name} v={`${(m.fuel[x] ?? 0).toPrecision(4)} ${FUELS[x].unit} · ${f.money(fuelPrice(s, x))}/${FUELS[x].unit}`} />
              <div className="text-[0.9em] pl-2"><FuelCoverage s={s} m={m} fuel={x} /></div>
            </div>
          ))}
          {producers.length > 0 && (
            <>
              <h4 className="font-semibold mt-2">Self-production</h4>
              {producers.map((b) => <Row key={b.id} k={defOf(b).name} v={b.status} />)}
            </>
          )}
        </Card>
        <Card title="Purchase fuel (timed delivery)">
          <div className="flex items-center gap-2 mb-1">
            <span>Fuel</span>
            <Select<FuelId> value={fuel} label="Fuel" onChange={setFuel} options={FUEL_IDS.map((x) => ({ value: x, label: fuelAvailable(m, x) ? FUELS[x].name : `${FUELS[x].name} (from ${STAGES[FUELS[x].availableFrom].name})`, disabled: !fuelAvailable(m, x) }))} />
          </div>
          <label className="block">
            <div className="flex justify-between"><span>Quantity ({f.pct(frac)} of free depot space)</span><span className="num">{qty.toPrecision(4)} {FUELS[fuel].unit}</span></div>
            <input type="range" min={0.05} max={1} step={0.05} value={frac} onChange={(e) => setFrac(Number(e.target.value))} className="w-full" aria-label="Fuel quantity" />
          </label>
          <Row k="Cost" v={f.money(cost)} />
          <Row k="Delivery time" v={f.dur(deliveryHours(s, m, fuel, qty))} />
          <Row k="Bulk discount" v={hasFeature(s, 'fuel.bulk') ? 'available for large orders' : 'requires Fuel Contracts'} />
          <div className="flex gap-1 mt-1 flex-wrap">
            <button className="btn btn-primary" disabled={qty <= 0 || s.money < cost || !fuelAvailable(m, fuel)} onClick={() => cmd({ type: 'buyFuel', map: m.id, fuel, qty }, `Ordered ${FUELS[fuel].name}.`)} data-testid="buy-fuel">Order delivery</button>
            <button className="btn" disabled={!hasFeature(s, 'fuel.contracts')} onClick={() => cmd({ type: 'fuelContract', map: m.id, fuel, perDay: Math.max(1e-9, qty / 4) }, 'Supply contract signed (10 days, −10%).')} data-tip="Daily deliveries at a locked price">Sign 10-day contract</button>
          </div>
          <div className="mt-2">
            <div className="muted text-[0.85em]">Price forecast (next 12 days)</div>
            <LineChart series={[{ name: FUELS[fuel].name, color: '#f97316', points: chart.map((p) => [p.t, p.v]) }]} height={110} format={f.money} />
          </div>
        </Card>
        <Card title="Deliveries & refuelling runs">
          {m.logisticsJobs.length === 0 ? <Empty>Nothing in transit.</Empty> : (
            <table className="tbl">
              <thead><tr><th>Job</th><th>Fuel</th><th>Qty</th><th>Remaining</th></tr></thead>
              <tbody>
                {m.logisticsJobs.map((j, k) => (
                  <tr key={j.id}>
                    <td>{j.kind === 'delivery' ? 'Delivery' : `Refuel ${j.building ? defOf(m.buildings[j.building]).name : ''}`}{k >= logisticsSlots(s, m) ? ' (waiting for slot)' : ''}</td>
                    <td>{FUELS[j.fuel].name}</td>
                    <td className="num">{j.kind === 'delivery' ? j.qty.toPrecision(3) : '—'}</td>
                    <td className="num">{f.dur(Math.max(0, j.remainingH))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Supply contracts">
          {s.contracts.filter((c) => c.kind === 'fuel' && c.map === m.id).length === 0 ? <Empty>No fuel contracts.</Empty> : s.contracts.filter((c) => c.kind === 'fuel' && c.map === m.id).map((c) => (
            <div key={c.id} className="flex justify-between py-1">
              <span>{FUELS[c.fuel!].name}: {c.amount.toPrecision(3)}/day @ {f.money(c.price)} · ends in {f.dur(c.endsAt - s.time)}</span>
              <button className="btn btn-sm" onClick={() => cmd({ type: 'cancelSupplyContract', id: c.id })}>Cancel</button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
