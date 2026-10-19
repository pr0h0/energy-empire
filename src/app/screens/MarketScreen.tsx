import { STAGE_LIST, STAGES } from '../../engine/data/stages';
import { BALANCE } from '../../engine/data/balance';
import { spotFactor } from '../../engine/core/GameClock';
import { gridLimits, tradingCapacity, traderBonus } from '../../engine/core/Helpers';
import { hasFeature } from '../../engine/core/Modifiers';
import { pricesAt } from '../../engine/systems/GridSystem';
import { activePPAs, ppaOffer } from '../../engine/systems/TradingSystem';
import { cmd } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { Card, Empty, Row, Stat } from '../components/ui';
import { LineChart } from '../components/LineChart';

export function MarketScreen() {
  const f = useFmt();
  const s = useGame((s) => s);
  const ui = useUI();
  const spot = hasFeature(s, 'market.spot');
  const ppas = activePPAs(s);
  return (
    <div className="p-3 flex flex-col gap-3" data-testid="market-screen">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Spot markets" value={spot ? 'Unlocked' : 'Locked'} sub={spot ? 'choose per map' : 'research Spot Markets'} />
        <Stat label="Trading capacity" value={tradingCapacity(s).toFixed(1)} />
        <Stat label="Trader price uplift" value={f.pct(traderBonus(s), 1)} />
        <Stat label="Active PPAs" value={`${ppas.length} / ${Math.floor(tradingCapacity(s))}`} />
      </div>
      <p className="muted">Backyard sells at a fixed feed-in tariff. Larger maps can switch to smooth, forecastable spot prices (evening peak, midday solar dip). Basic exporting never needs an employee.</p>
      <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
        {STAGE_LIST.filter((st) => s.maps[st.id]).map((st) => {
          const m = s.maps[st.id]!;
          const p = pricesAt(s, m, s.time);
          const fc = Array.from({ length: 49 }, (_, k) => [s.time + k, st.export * spotFactor(s.time + k, m.seed, BALANCE.spotAmplitude)] as [number, number]);
          const offer = hasFeature(s, 'market.contracts') ? ppaOffer(s, st.id) : null;
          return (
            <Card key={st.id} title={st.name} actions={
              st.id !== 'backyard' && (
                <div className="flex gap-1">
                  <button className={`btn btn-sm ${m.policies.tariff === 'fixed' ? 'active' : ''}`} onClick={() => cmd({ type: 'mapPolicy', map: st.id, patch: { tariff: 'fixed' } })}>Fixed</button>
                  <button className={`btn btn-sm ${m.policies.tariff === 'spot' ? 'active' : ''}`} disabled={!spot} onClick={() => cmd({ type: 'mapPolicy', map: st.id, patch: { tariff: 'spot' } })} data-testid={`spot-${st.id}`}>Spot</button>
                </div>
              )
            }>
              <Row k="Customer retail price" v={f.price(st.retail)} />
              <Row k="Export price now" v={f.price(p.export)} />
              <Row k="Import price now" v={f.price(p.import)} />
              <Row k="Export capacity" v={f.kw(gridLimits(s, m).exportKW)} />
              {spot && st.id !== 'backyard' && (
                <div className="mt-1">
                  <div className="muted text-[0.85em]">Spot export price forecast (48 h)</div>
                  <LineChart series={[{ name: 'Spot export', color: '#38bdf8', points: fc }]} height={100} format={f.price} />
                </div>
              )}
              {offer && offer.kw > 0 && (
                <div className="panel2 p-2 mt-2">
                  <div className="font-medium">PPA offer: {f.kw(offer.kw)} firm for {f.dur(offer.durationH)} @ {f.price(offer.price)}</div>
                  <div className="muted text-[0.82em]">Shortfall is penalised at 50% of the contract price.</div>
                  <button className="btn btn-sm btn-primary mt-1" disabled={ppas.length >= Math.floor(tradingCapacity(s))} onClick={() => cmd({ type: 'signPPA', map: st.id }, 'PPA signed.')} data-testid={`ppa-${st.id}`}>Sign PPA</button>
                </div>
              )}
            </Card>
          );
        })}
        <Card title="Active power purchase agreements">
          {ppas.length === 0 ? <Empty>{hasFeature(s, 'market.contracts') ? 'No active PPAs.' : 'Research Power Purchase Agreements to sell firm power at premium prices.'}</Empty> : ppas.map((c) => (
            <div key={c.id} className="py-1 border-b border-[var(--border)] last:border-0">
              <div className="flex justify-between gap-2">
                <span>{STAGES[c.map].name}: {f.kw(c.amount)} @ {f.price(c.price)}</span>
                <button className="btn btn-sm" onClick={() => cmd({ type: 'cancelSupplyContract', id: c.id })}>Cancel</button>
              </div>
              <div className="muted text-[0.82em]">Delivered {f.kwh(c.delivered)} · shortfall {f.kwh(c.shortfall)} · ends in {f.dur(c.endsAt - s.time)}</div>
            </div>
          ))}
        </Card>
      </div>
      <button className="btn self-start" onClick={() => ui.setScreen('workforce')}>Hire energy traders →</button>
    </div>
  );
}
