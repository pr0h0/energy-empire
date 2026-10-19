import { useState } from 'react';
import { STAGE_LIST, STAGES } from '../../engine/data/stages';
import type { Ledger, LedgerKey } from '../../engine/core/State';
import { defOf, isGenerator, ratedKW } from '../../engine/core/Helpers';
import { cmd } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { Card, Stat, Toggle } from '../components/ui';

const INCOME: [LedgerKey, string][] = [['sales', 'Electricity sales'], ['income', 'Household income'], ['salvage', 'Salvage (net)']];
const EXPENSE: [LedgerKey, string][] = [
  ['importCost', 'Electricity purchases'], ['fuel', 'Fuel'], ['wages', 'Wages'], ['hiring', 'Hiring & training'], ['maintenance', 'Preventive maintenance'], ['repairs', 'Repairs'],
  ['land', 'Land'], ['research', 'Research'], ['construction', 'Construction'], ['infrastructure', 'Infrastructure & expansion'], ['upgrades', 'Upgrades'], ['opex', 'Operating costs (O&M, grid)'],
  ['penalties', 'Contract penalties'], ['carbon', 'Carbon pricing'],
];

function LedgerTable({ l, compact }: { l: Ledger; compact: boolean }) {
  const f = useFmt();
  const inc = INCOME.reduce((a, [k]) => a + l[k], 0);
  const exp = EXPENSE.reduce((a, [k]) => a + l[k], 0);
  return (
    <table className="tbl">
      <tbody>
        {INCOME.filter(([k]) => !compact || l[k]).map(([k, n]) => <tr key={k}><td>{n}</td><td className="num text-right text-green-400">{f.money(l[k])}</td></tr>)}
        <tr><td className="muted">Bill savings (avoided cost — not revenue)</td><td className="num text-right muted">{f.money(l.savings)}</td></tr>
        {EXPENSE.filter(([k]) => !compact || l[k]).map(([k, n]) => <tr key={k}><td>{n}</td><td className="num text-right text-red-300">−{f.money(l[k])}</td></tr>)}
        <tr><td className="font-semibold">Net</td><td className={`num text-right font-semibold ${inc - exp >= 0 ? 'text-green-400' : 'text-red-400'}`}>{f.money(inc - exp)}</td></tr>
      </tbody>
    </table>
  );
}

export function FinanceScreen() {
  const f = useFmt();
  const s = useGame((s) => s);
  const ui = useUI();
  const [sort, setSort] = useState<'net' | 'payback' | 'util'>('net');
  const compact = s.settings.compactFinance;
  const assets = STAGE_LIST.flatMap((st) => Object.values(s.maps[st.id]?.buildings ?? {}).filter((b) => !defOf(b).fixed).map((b) => {
    const d = defOf(b);
    const net = b.rRevenue - b.rCost;
    return { st, b, d, net, payback: net > 0 ? b.invested / net : Infinity, util: isGenerator(d) && ratedKW(b, d) > 0 ? Math.max(0, b.output) / ratedKW(b, d) : 0 };
  }));
  assets.sort((a, b) => (sort === 'net' ? b.net - a.net : sort === 'payback' ? a.payback - b.payback : b.util - a.util));
  return (
    <div className="p-3 flex flex-col gap-3" data-testid="finance-screen">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Cash" value={f.money(s.money)} tone={s.money < 0 ? 'bad' : undefined} />
        <Stat label="Operating revenue" value={f.rate(s.rates.revenue)} />
        <Stat label="Operating expenses" value={f.rate(s.rates.expenses)} />
        <Stat label="Net income" value={f.rate(s.rates.net)} tone={s.rates.net >= 0 ? 'good' : 'bad'} />
      </div>
      <Toggle label="Compact financial dashboard" checked={compact} onChange={(v) => cmd({ type: 'settings', patch: { compactFinance: v } })} />
      <div className="grid gap-3 grid-cols-1 xl:grid-cols-3">
        <Card title="Company (this run)"><LedgerTable l={s.ledger} compact={compact} /></Card>
        {STAGE_LIST.filter((st) => s.maps[st.id]).map((st) => {
          const m = s.maps[st.id]!;
          return (
            <Card key={st.id} title={`${st.name}`}>
              <div className="grid grid-cols-2 gap-1 mb-2 text-[0.88em] num">
                <span>Sales {f.rate(m.flow.sales)}</span><span>Imports −{f.rate(m.flow.importCost)}</span>
                <span>Wages −{f.rate(m.flow.wages)}</span><span>O&M −{f.rate(m.flow.opex)}</span>
                <span>Fuel use −{f.rate(m.flow.fuelCost)}</span>{m.flow.carbon > 0 && <span>Carbon −{f.rate(m.flow.carbon)}</span>}
              </div>
              {!compact && <LedgerTable l={m.ledger} compact />}
            </Card>
          );
        })}
      </div>
      <Card title="Installation profitability" actions={
        <div className="flex gap-1">{(['net', 'payback', 'util'] as const).map((k) => <button key={k} className={`btn btn-sm ${sort === k ? 'active' : ''}`} onClick={() => setSort(k)}>{k === 'net' ? 'Net/h' : k === 'payback' ? 'Payback' : 'Utilisation'}</button>)}</div>
      }>
        <div className="scroll max-h-[420px]">
          <table className="tbl text-[0.9em]">
            <thead><tr><th>Installation</th><th>Map</th><th>Revenue/h</th><th>Cost/h</th><th>Net/h</th><th>Payback</th><th>Utilisation</th><th>Condition</th></tr></thead>
            <tbody>
              {assets.slice(0, 200).map(({ st, b, d, net, payback, util }) => (
                <tr key={b.id}>
                  <td><button className="underline decoration-dotted text-left" onClick={() => { ui.setMap(st.id); ui.setScreen('map'); ui.select({ kind: 'building', id: b.id }); }}>{d.name}</button></td>
                  <td>{STAGES[st.id].name}</td>
                  <td className="num">{f.rate(b.rRevenue)}</td>
                  <td className="num">{f.rate(b.rCost)}</td>
                  <td className={`num ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>{f.rate(net)}</td>
                  <td className="num">{Number.isFinite(payback) ? f.dur(payback) : '—'}</td>
                  <td className="num">{isGenerator(d) ? f.pct(util) : '—'}</td>
                  <td className="num">{f.pct(b.condition)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
