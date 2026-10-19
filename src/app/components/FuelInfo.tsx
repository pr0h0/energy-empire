import { FUELS, FUEL_IDS } from '../../engine/data/fuels';
import type { FuelId } from '../../engine/data/types';
import { defOf, depotCapacityKWh, depotUsedKWh } from '../../engine/core/Helpers';
import type { BuildingInstance, GameState, MapState } from '../../engine/core/State';
import { fuelBalance } from '../../engine/systems/ThermalSystem';
import { useFmt } from '../hooks/useFmt';

const qty = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toPrecision(2));

function Line({ k, v, tone }: { k: string; v: React.ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="muted">{k}</span>
      <span className={`num text-right ${tone === 'good' ? 'text-green-400' : tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-amber-300' : ''}`}>{v}</span>
    </div>
  );
}

/** Production vs plant demand for one fuel, with a plain-language verdict. */
export function FuelCoverage({ s, m, fuel }: { s: GameState; m: MapState; fuel: FuelId }) {
  const fb = fuelBalance(s, m, fuel);
  const u = FUELS[fuel].unit, name = FUELS[fuel].name;
  const cover = fb.burnMax > 0 ? fb.produced / fb.burnMax : Infinity;
  const verdict = !fb.plants
    ? `No ${name} plant here yet: production only fills the depot.`
    : !fb.producers
      ? `All ${name} comes from purchases.`
      : cover >= 1
        ? 'Covers every plant even at full load; extra goes to the depot. Room for another plant.'
        : fb.burnNow > 0 && fb.produced >= fb.burnNow
          ? `Covers today's use, but only ${Math.round(cover * 100)}% at full load.`
          : `Covers ${Math.round(cover * 100)}% at full load: add producers or buy fuel.`;
  return (
    <div data-testid={`fuel-cover-${fuel}`}>
      {fb.producers > 0 && <Line k={`${name} produced`} v={`${qty(fb.produced)} ${u}/h`} />}
      {fb.plants > 0 && <Line k="Plants burn now / full load" v={`${qty(fb.burnNow)} / ${qty(fb.burnMax)} ${u}/h`} />}
      {fb.plants > 0 && fb.producers > 0 && <Line k="Own supply covers" v={`${Math.round(Math.min(cover, 9.99) * 100)}% of full load`} tone={cover >= 1 ? 'good' : cover >= 0.5 ? 'warn' : 'bad'} />}
      {fb.burnNow > 0 && <Line k="Depot stock lasts" v={fb.produced >= fb.burnNow ? 'growing' : `${qty(fb.stock / (fb.burnNow - fb.produced))} h at current use`} />}
      <div className="muted leading-snug mt-0.5">{verdict}</div>
    </div>
  );
}

/** Depot fill and contents. */
export function DepotContents({ m }: { m: MapState }) {
  const f = useFmt();
  const cap = depotCapacityKWh(m), used = depotUsedKWh(m);
  const items = FUEL_IDS.filter((x) => (m.fuel[x] ?? 0) > 1e-9);
  return (
    <div data-testid="depot-contents">
      <Line k="Depot fill" v={`${f.pct(cap > 0 ? used / cap : 0)} of ${f.kwh(cap)} th`} />
      {items.length ? items.map((x) => <Line key={x} k={FUELS[x].name} v={`${qty(m.fuel[x]!)} ${FUELS[x].unit} · ${f.kwh(m.fuel[x]! * FUELS[x].energyPerUnit)} th`} />) : <div className="muted">Empty.</div>}
      {m.logisticsJobs.some((j) => j.kind === 'delivery') && <Line k="Deliveries on the way" v={m.logisticsJobs.filter((j) => j.kind === 'delivery').length} />}
    </div>
  );
}

/** Fuel facts for a building: depot contents, producer coverage, or a plant's own-supply coverage. */
export function BuildingFuelInfo({ s, m, b }: { s: GameState; m: MapState; b: BuildingInstance }) {
  const d = defOf(b);
  if (d.infra?.role === 'fuelStorage') return <DepotContents m={m} />;
  const fuel = d.infra?.role === 'fuelProducer' ? d.infra.fuel : d.thermal?.fuel;
  return fuel ? <FuelCoverage s={s} m={m} fuel={fuel} /> : null;
}
