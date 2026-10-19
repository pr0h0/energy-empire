import { useState } from 'react';
import { STAGE_LIST } from '../../engine/data/stages';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { Card, Row, Stat, Tabs } from '../components/ui';
import { LineChart } from '../components/LineChart';
import type { MixGroup } from '../../engine/core/State';

const MIX_SERIES: { id: MixGroup; name: string; color: string }[] = [
  { id: 'solar', name: 'Solar', color: '#facc15' }, { id: 'wind', name: 'Wind', color: '#38bdf8' }, { id: 'hydro', name: 'Hydro', color: '#3b82f6' },
  { id: 'thermal', name: 'Thermal', color: '#f97316' }, { id: 'nuclear', name: 'Nuclear', color: '#a3e635' }, { id: 'fusion', name: 'Fusion', color: '#e879f9' },
  { id: 'space', name: 'Space & exotic', color: '#c084fc' }, { id: 'storage', name: 'Storage discharge', color: '#94a3b8' },
];

export function StatsScreen() {
  const f = useFmt();
  const s = useGame((s) => s);
  const [range, setRange] = useState<'recent' | 'long'>('recent');
  const h = range === 'recent' ? s.history : s.historyLong;
  return (
    <div className="p-3 flex flex-col gap-3" data-testid="stats-screen">
      <div className="flex justify-between items-center">
        <Tabs value={range} onChange={setRange} tabs={[{ id: 'recent', label: 'Last 12 days (hourly)' }, { id: 'long', label: 'Long term (daily)' }]} />
      </div>
      <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
        <Card title="Cash"><LineChart series={[{ name: 'Money', color: '#f5b301', points: h.map((p) => [p.t, p.money]) }]} format={f.money} /></Card>
        <Card title="Net income"><LineChart series={[{ name: 'Net/h', color: '#22c55e', points: h.map((p) => [p.t, p.net]) }]} format={f.money} /></Card>
        <Card title="Generation vs demand"><LineChart series={[{ name: 'Generation', color: '#facc15', points: h.map((p) => [p.t, p.generation]) }, { name: 'Demand', color: '#38bdf8', points: h.map((p) => [p.t, p.demand]) }]} format={f.kw} /></Card>
        <Card title="Grid exchange"><LineChart series={[{ name: 'Export', color: '#f97316', points: h.map((p) => [p.t, p.exported]) }, { name: 'Import', color: '#818cf8', points: h.map((p) => [p.t, p.imported]) }]} format={f.kw} /></Card>
        <Card title="Sales revenue"><LineChart series={[{ name: 'Sales/h', color: '#f5b301', points: h.filter((p) => p.sales !== undefined).map((p) => [p.t, p.sales!]) }]} format={f.money} /></Card>
        <Card title="Reliability"><LineChart series={[{ name: 'Demand served', color: '#22c55e', points: h.filter((p) => p.reliability !== undefined).map((p) => [p.t, p.reliability!]) }]} format={(v) => f.pct(v, 1)} /></Card>
        <Card title="Generation mix">
          <LineChart series={MIX_SERIES.filter((g) => h.some((p) => (p.mix?.[g.id] ?? 0) > 0)).map((g) => ({ name: g.name, color: g.color, points: h.filter((p) => p.mix).map((p) => [p.t, p.mix![g.id] ?? 0] as [number, number]) }))} format={f.kw} />
        </Card>
        <Card title="Research throughput"><LineChart series={[{ name: 'RP/h', color: '#c084fc', points: h.map((p) => [p.t, p.rp]) }]} format={f.num} /></Card>
        <Card title="Lifetime statistics">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Stat label="Lifetime sales revenue" value={f.money(s.prestige.lifetimeRevenue)} />
            <Stat label="Energy produced" value={f.kwh(s.lifetime.produced)} />
            <Stat label="Energy sold" value={f.kwh(s.lifetime.sold)} />
            <Stat label="Peak generation" value={f.kw(s.lifetime.peakKW)} />
          </div>
          <Row k="Installations built" v={s.lifetime.buildings} />
          <Row k="Demolished" v={s.lifetime.demolished} />
          <Row k="Repairs completed" v={s.lifetime.repairs} />
          <Row k="Play time (game)" v={f.dur(s.lifetime.playH)} />
          <Row k="Play time (real)" v={f.dur(s.lifetime.realH)} />
          {/* runs start at 06:00 on day 1 */}
          <Row k="This run: game / real time" v={`${f.dur(s.time - 6)} / ${f.dur(s.run.realH)}`} />
          <Row k="This run: produced / sold" v={`${f.kwh(s.run.produced)} / ${f.kwh(s.run.sold)}`} />
          <Row k="This run: emissions" v={`${f.num(s.run.emissions / 1000)} t CO₂`} />
          <Row k="Prestige resets" v={s.prestige.resets} />
          <h4 className="font-semibold mt-2">Per map (now)</h4>
          {STAGE_LIST.filter((st) => s.maps[st.id]).map((st) => <Row key={st.id} k={st.name} v={`${f.kw(s.maps[st.id]!.flow.generation)} · total ${f.kwh(s.maps[st.id]!.totals.produced)}`} />)}
          {s.runHistory.length > 0 && (
            <>
              <h4 className="font-semibold mt-2">Previous runs</h4>
              {s.runHistory.map((r) => <Row key={r.index} k={`Run #${r.index} (${r.highestStage})`} v={`${f.money(r.revenue)} · +${r.pointsEarned} pts`} />)}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
