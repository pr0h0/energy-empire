import { ChevronRight, Hammer, Info, LayoutDashboard, PanelRightClose, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { buildingsForStage } from '../../engine/data/buildings';
import { CONTRACT_LIST } from '../../engine/data/contracts';
import { RESEARCH } from '../../engine/data/research';
import { STAGES } from '../../engine/data/stages';
import { TERRAIN } from '../../engine/data/terrain';
import type { BuildingCategory, BuildingDef, GenKind } from '../../engine/data/types';
import { FUELS } from '../../engine/data/fuels';
import { defOf, effectiveTerrain, gridLimits, maintenanceCapacity } from '../../engine/core/Helpers';
import { isBuildingUnlocked, mod } from '../../engine/core/Modifiers';
import { representedUnits } from '../../engine/world/BuildingAggregation';
import { constructionCost } from '../../engine/systems/ConstructionSystem';
import { averageDemandKW } from '../../engine/systems/DemandSystem';
import { nextGridLevel } from '../../engine/systems/GridSystem';
import { landBlockReason, landPrice } from '../../engine/systems/LandSystem';
import { manualRepairCost, mapMaintenanceLoad } from '../../engine/systems/MaintenanceSystem';
import { tankCapacity } from '../../engine/systems/ThermalSystem';
import { advise } from '../../engine/systems/AdvisorSystem';
import { forecast, hydroHead } from '../../engine/systems/ElectricitySystem';
import { WEATHER } from '../../engine/systems/WeatherSystem';
import { LineChart } from '../components/LineChart';
import { goalProgress } from '../../engine/systems/GoalSystem';
import { GOALS, goalReward, type GoalKind } from '../../engine/data/goals';
import { evalMilestone, milestoneLabel } from '../../engine/systems/ProgressionSystem';
import { buildingIconURL } from '../../rendering/SVGAssets';
import { cmd, engine } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame, useMapState } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { Chip, Progress, Row } from '../components/ui';
import { Inspector } from './Inspector';
import { GoLink, goto, revealFocus } from '../components/GoLink';

type Tab = 'build' | 'inspect' | 'overview';

export function SidePanel() {
  const ui = useUI();
  const [tab, setTab] = useState<Tab>('build');
  // a fresh selection on the map always brings up the inspector (the Map tab would otherwise keep it hidden)
  useEffect(() => { if (ui.selected) setTab((t) => (t === 'overview' ? 'inspect' : t)); }, [ui.selected]);
  useEffect(() => { if (ui.focus?.kind === 'building') setTab('build'); }, [ui.focus]);
  const active: Tab = ui.selected ? (tab === 'build' && ui.mode.kind === 'build' ? 'build' : tab === 'overview' ? 'overview' : 'inspect') : tab === 'inspect' ? 'build' : tab;
  // Q cycles Build → Inspect → Map (Inspect only when something is selected)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'q' && e.key !== 'Q') return;
      if ((e.target as HTMLElement)?.closest('input,textarea,select,[role=dialog]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const order: Tab[] = useUI.getState().selected ? ['build', 'inspect', 'overview'] : ['build', 'overview'];
      const next = order[(order.indexOf(active) + 1) % order.length];
      if (next === 'build') useUI.getState().select(null);
      setTab(next);
      e.preventDefault();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [active]);
  return (
    <aside className="flex flex-col min-h-0 bg-[var(--panel)] border-l border-[var(--border)] w-full lg:w-[340px] 2xl:w-[400px] shrink-0" data-testid="side-panel" aria-label="Map side panel">
      <div className="flex gap-1 p-1.5 border-b border-[var(--border)]" role="tablist">
        <button role="tab" aria-selected={active === 'build'} className={`btn btn-sm flex-1 ${active === 'build' ? 'active' : 'btn-ghost'}`} onClick={() => { setTab('build'); ui.select(null); }} data-testid="tab-build"><Hammer size={14} />Build</button>
        <button role="tab" aria-selected={active === 'inspect'} className={`btn btn-sm flex-1 ${active === 'inspect' ? 'active' : 'btn-ghost'}`} onClick={() => setTab('inspect')} disabled={!ui.selected} data-testid="tab-inspect"><Info size={14} />Inspect</button>
        <button role="tab" aria-selected={active === 'overview'} className={`btn btn-sm flex-1 ${active === 'overview' ? 'active' : 'btn-ghost'}`} onClick={() => setTab('overview')} data-testid="tab-overview"><LayoutDashboard size={14} />Map</button>
        <button className="btn btn-ghost btn-sm" onClick={() => ui.set({ sidebar: false })} aria-label="Collapse side panel" data-tip="Collapse panel" data-testid="collapse-sidebar"><PanelRightClose size={14} /></button>
      </div>
      <div className="flex-1 min-h-0 scroll p-2">
        {active === 'build' && <Catalog />}
        {active === 'inspect' && ui.selected?.kind === 'building' && <Inspector id={ui.selected.id} />}
        {active === 'inspect' && ui.selected?.kind === 'tile' && <TileInspector i={ui.selected.i} />}
        {active === 'overview' && <MapOverview />}
      </div>
    </aside>
  );
}

const CATS: { id: BuildingCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'generation', label: 'Generation' }, { id: 'storage', label: 'Storage' }, { id: 'grid', label: 'Grid' },
  { id: 'infrastructure', label: 'Infrastructure' }, { id: 'automation', label: 'Automation' }, { id: 'research', label: 'Research' }, { id: 'special', label: 'Special' },
];

function Catalog() {
  const ui = useUI();
  const f = useFmt();
  const m = useMapState();
  const s = engine.state;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<BuildingCategory | 'all'>('all');
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [tip, setTip] = useState<{ d: BuildingDef; at: DOMRect; cost: number; units: number } | null>(null);
  useEffect(() => {
    if (ui.focus?.kind !== 'building') return;
    setQ('');
    setCat('all');
    setOnlyAvail(false);
    useUI.setState({ focus: null });
    revealFocus(`[data-testid="catalog-${ui.focus.id}"]`);
  }, [ui.focus]);
  const defs = useMemo(() => buildingsForStage(m.id), [m.id]);
  const list = defs.filter((d) => (cat === 'all' || d.category === cat) && (!q || `${d.name} ${d.family} ${d.desc}`.toLowerCase().includes(q.toLowerCase())) && (!onlyAvail || isBuildingUnlocked(s, d.id)));
  return (
    <div data-testid="catalog">
      <div className="flex items-center gap-1 mb-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2 top-1.5 muted" />
          <input className="input w-full pl-7" placeholder="Search buildings…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search buildings" />
        </div>
        <label className="flex items-center gap-1 text-[0.85em] muted"><input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} />Unlocked</label>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {CATS.filter((c) => c.id === 'all' || defs.some((d) => d.category === c.id)).map((c) => (
          <button key={c.id} className={`btn btn-sm ${cat === c.id ? 'active' : 'btn-ghost'}`} onClick={() => setCat(c.id)}>{c.label}</button>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {list.map((d) => {
          const unlocked = isBuildingUnlocked(s, d.id);
          const tiles = d.size[0] * d.size[1];
          const units = representedUnits(d, m.id, tiles, mod(s, 'density'));
          const cost = units >= 1 ? constructionCost(s, m, d, units, []) : NaN;
          const selected = ui.mode.kind === 'build' && ui.mode.def === d.id;
          return (
            <button
              key={d.id}
              className={`panel2 text-left p-2 flex gap-2 items-start hover:border-[var(--accent2)] ${selected ? 'border-[var(--accent)]' : ''} ${unlocked ? '' : 'opacity-60'}`}
              onClick={() => (unlocked ? ui.setMode({ kind: 'build', def: d.id, rot: 0 }) : d.research ? goto('research', d.research) : ui.setScreen('research'))}
              onMouseEnter={(e) => setTip({ d, at: e.currentTarget.getBoundingClientRect(), cost, units })}
              onMouseLeave={() => setTip(null)}
              data-testid={`catalog-${d.id}`}
              aria-pressed={selected}
            >
              <img src={buildingIconURL(d.art)} alt="" className="w-10 h-10 shrink-0 rounded bg-[var(--panel3)]" />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-1">
                  <span className="font-semibold truncate">{d.name}</span>
                  <span className="num text-[0.85em] shrink-0">{Number.isFinite(cost) ? f.money(cost) : '—'}</span>
                </div>
                <div className="muted text-[0.82em] flex flex-wrap gap-x-2">
                  <span>{d.size[0]}×{d.size[1]}</span>
                  {d.unit.kw > 0 && <span>{f.kw(d.unit.kw * Math.max(1, units))}</span>}
                  {d.storage && <span>{f.kwh(d.storage.kwh * Math.max(1, units))}</span>}
                  {d.aggregate && units > 1 && <span>{units.toLocaleString()} units</span>}
                  {units < 1 && <span className="text-red-300">too small at this scale</span>}
                  {d.speculative && <span className="text-fuchsia-300">speculative</span>}
                </div>
                {!unlocked && d.research && <div className="text-[0.8em] text-amber-300">Requires: <span className="link">{RESEARCH[d.research]?.name}</span></div>}
                <div className="muted text-[0.78em] truncate">Terrain: {d.terrain.slice(0, 5).map((t) => TERRAIN[t].name).join(', ')}{d.terrain.length > 5 ? '…' : ''}</div>
              </div>
            </button>
          );
        })}
      </div>
      {tip && <CatalogTip {...tip} />}
      <p className="muted text-[0.8em] mt-2">Select a building, then click a tile. <span className="kbd">R</span> rotates, <span className="kbd">Esc</span> cancels. Hover shows validity and cost.</p>
    </div>
  );
}

const HOW: Partial<Record<GenKind, string>> = {
  solar: 'Follows daylight: zero at night, lower in winter and on cloudy days.',
  wind: 'Follows the wind: varies hour to hour, often strongest at night. Hills and coasts help.',
  hydro: 'Steady output from river flow; changes with the seasons.',
  dam: 'Fills a reservoir and releases water on demand, so it can cover the evening and night.',
  tidal: 'Follows the tides: predictable but cycles twice a day.',
  thermal: 'Burns fuel on demand: runs whenever it is cheaper than other sources, as long as there is fuel.',
  csp: 'Solar heat stored in molten salt keeps it running after sunset.',
  geothermal: 'Steady around the clock; reservoir pressure slowly declines with heavy use.',
  orbital: 'Beams power down to a rectenna; almost constant.',
  constant: 'Constant output around the clock.',
};
const ROLE: Record<string, string> = {
  grid: 'Raises the grid import/export limit.', depot: 'Adds maintenance crew capacity.', logistics: 'Speeds up fuel deliveries.', fuelStorage: 'Stores delivered fuel for thermal plants.',
  lab: 'Generates research points.', ops: 'Operations centre: automation and monitoring.', trading: 'Enables market trading.', fuelProducer: 'Produces fuel from electricity.',
  sink: 'Consumes surplus energy.',
};

/** Rich hover card for a catalog entry, shown to the left of the side panel. */
function CatalogTip({ d, at, cost, units }: { d: BuildingDef; at: DOMRect; cost: number; units: number }) {
  const f = useFmt();
  const s = engine.state;
  const m = s.maps[useUI.getState().map]!;
  const n = Math.max(1, units);
  const mine = Object.values(m.buildings).filter((b) => b.def === d.id);
  const out = mine.reduce((a, b) => a + b.output, 0), net = mine.reduce((a, b) => a + b.rRevenue - b.rCost, 0);
  const t = d.thermal, st = d.storage;
  const top = Math.max(8, Math.min(at.top, window.innerHeight - 420));
  return (
    <div role="tooltip" data-testid="catalog-tip" className="fixed z-50 panel p-3 shadow-xl w-80 text-[0.9em] pointer-events-none" style={{ top, right: window.innerWidth - at.left + 8 }}>
      <div className="flex justify-between gap-2 font-semibold"><span>{d.name}</span><span className="num">{Number.isFinite(cost) ? f.money(cost) : '—'}</span></div>
      <p className="muted leading-snug my-1">{d.desc}</p>
      {d.gen && HOW[d.gen.kind] && <p className="leading-snug mb-1">{HOW[d.gen.kind]}</p>}
      {d.infra && ROLE[d.infra.role] && <p className="leading-snug mb-1">{ROLE[d.infra.role]}</p>}
      <div className="border-t border-[var(--border)] pt-1">
        {d.unit.kw > 0 && <Row k="Capacity" v={f.kw(d.unit.kw * n)} />}
        {d.aggregate && units > 1 && <Row k="Represents" v={`${units.toLocaleString()} × ${d.unit.label}`} />}
        {st && <Row k="Storage" v={`${f.kwh(st.kwh * n)} · ${f.kw(st.kwh * st.cRate * n)} max`} />}
        {st && <Row k="Round-trip efficiency" v={f.pct(st.etaIn * st.etaOut)} />}
        {t && <Row k="Fuel" v={`${FUELS[t.fuel].name} · ${f.pct(t.eta)} efficient`} />}
        {t && <Row k="Min load / ramp" v={`${f.pct(t.minLoad)} / ${f.pct(t.ramp)} per h`} />}
        {t && <Row k="Tank" v={`${t.tankH} h at full load`} />}
        {t && FUELS[t.fuel].emissions > 0 && <Row k="Emissions" v={`${(FUELS[t.fuel].emissions / t.eta).toFixed(2)} kg CO₂/kWh`} />}
        <Row k="Size" v={`${d.size[0]}×${d.size[1]} tiles`} />
        <Row k="Crew load / wear" v={`${d.maint} WU · ${f.pct(d.wear, 2)}/h at full use`} />
      </div>
      <div className="border-t border-[var(--border)] pt-1 mt-1 leading-snug">
        <div><span className="muted">Terrain: </span>{d.terrain.map((x) => TERRAIN[x].name).join(', ')}</div>
        {d.adjacent && <div><span className="muted">Must be next to: </span>{d.adjacent.map((x) => TERRAIN[x].name).join(', ')}</div>}
        {d.terrainBonus && <div><span className="muted">Bonus: </span>{Object.entries(d.terrainBonus).map(([x, k]) => `×${k} on ${TERRAIN[x as keyof typeof TERRAIN].name}`).join(', ')}</div>}
      </div>
      {mine.length > 0 && (
        <div className="border-t border-[var(--border)] pt-1 mt-1">
          <Row k={`You have ${mine.length} here`} v={`${f.kw(out)} now`} />
          <Row k="Their net" v={<span className={net >= 0 ? 'text-green-400' : 'text-red-400'}>{f.rate(net)}</span>} />
        </div>
      )}
      {!isBuildingUnlocked(s, d.id) && d.research && <div className="text-amber-300 mt-1">Requires research: {RESEARCH[d.research]?.name} (click to open)</div>}
      {units < 1 && <div className="text-red-300 mt-1">Too small to build at this map's scale.</div>}
    </div>
  );
}

function TileInspector({ i }: { i: number }) {
  const f = useFmt();
  const m = useMapState();
  const s = engine.state;
  const t = effectiveTerrain(m, i);
  const d = TERRAIN[t];
  const why = landBlockReason(s, m, i);
  const st = STAGES[m.id];
  const suits = buildingsForStage(m.id).filter((b) => b.terrain.includes(t) && isBuildingUnlocked(s, b.id)).slice(0, 8);
  return (
    <div className="flex flex-col gap-2" data-testid="tile-inspector">
      <h3 className="font-bold text-[1.1em]">{d.name} <span className="muted num text-[0.8em]">({i % m.w}, {Math.floor(i / m.w)})</span></h3>
      <p className="muted">{d.desc}</p>
      <div className="panel2 p-2">
        {!st.space && <Row k="Elevation" v={`${(m.elev[i] * st.elevRangeM).toFixed(1)} m`} />}
        <Row k="Solar / wind" v={`×${d.solar} / ×${d.wind}`} />
        {d.cooling && <Row k="Cooling" v={`×${d.cooling}`} />}
        {m.riverFlow[i] > 0 && <Row k="River flow" v={`${m.riverFlow[i].toPrecision(3)} m³/s`} />}
        {m.riverFlow[i] > 0 && <Row k="Hydro head (terrain drop)" v={`×${hydroHead(m, i).toFixed(2)}`} />}
        <Row k="Cell size" v={st.cellLabel} />
        <Row k="Ownership" v={m.owned[i] ? 'Owned' : 'Not owned'} />
      </div>
      {!m.owned[i] && (
        <button className="btn btn-primary" disabled={!!why || s.money < landPrice(s, m, i)} onClick={() => cmd({ type: 'buyLand', map: m.id, x: i % m.w, y: Math.floor(i / m.w) }, 'Land purchased.')} data-testid="buy-tile">
          Buy land · {f.money(landPrice(s, m, i))}
        </button>
      )}
      {why && !m.owned[i] && <p className="text-red-300 text-[0.9em]">{why}</p>}
      {suits.length > 0 && (
        <div>
          <h4 className="font-semibold mb-1">Suitable here</h4>
          {suits.map((b) => (
            <button key={b.id} className="btn btn-ghost btn-sm w-full justify-start" onClick={() => useUI.getState().setMode({ kind: 'build', def: b.id, rot: 0 })}>
              <img src={buildingIconURL(b.art)} alt="" className="w-5 h-5" /> {b.name} <ChevronRight size={12} className="ml-auto" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Per-map goals with progress and reward. */
function Goals() {
  const f = useFmt();
  const m = useMapState();
  const s = engine.state;
  const st = STAGES[m.id];
  const unit = (k: GoalKind, v: number) => (k === 'capacity' ? f.kw(v) : k === 'storage' ? f.kwh(v) : `${Math.floor(v)} h`);
  return (
    <div className="panel2 p-2" data-testid="goals">
      <div className="flex justify-between"><h4 className="font-semibold mb-1">Goals</h4><span className="muted text-[0.85em]">reward {f.money(goalReward(st))} each</span></div>
      {GOALS.map((g) => {
        const p = goalProgress(s, m, g.kind);
        return (
          <div key={g.kind} className="py-1" data-testid={`goal-${g.kind}`} data-tip={g.desc(st)}>
            <div className="flex justify-between gap-2">
              <span className={p.done ? 'text-green-400' : ''}>{p.done ? '✓ ' : ''}{g.name}</span>
              <span className="num muted text-[0.85em]">{p.done ? 'done' : `${unit(g.kind, p.value)} / ${unit(g.kind, p.target)}`}</span>
            </div>
            {!p.done && <Progress value={Math.min(1, p.value / p.target)} label={g.name} />}
          </div>
        );
      })}
    </div>
  );
}

const HINT_DOT = { bad: 'bg-red-500', warn: 'bg-amber-400', tip: 'bg-sky-400' };

/** Advisor: what to fix or try next on this map. */
function Forecast() {
  const f = useFmt();
  const m = useMapState();
  const s = useGame((s) => s);
  const hour = Math.floor(s.time);
  const n = Object.keys(m.buildings).length;
  // recomputed once per game hour (or when buildings change), not every frame
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pts = useMemo(() => forecast(s, m, 48), [hour, n, m.id]);
  if (!pts.some((p) => p.solar + p.wind > 0)) return null;
  const short = pts.filter((p) => p.solar + p.wind < p.demand).length;
  const ev = pts.find((p) => p.event);
  const sum = (k: 'solar' | 'wind' | 'demand') => pts.slice(0, 24).reduce((a, p) => a + p[k], 0);
  return (
    <div className="panel2 p-2" data-testid="forecast">
      <h4 className="font-semibold">Forecast · next 48 h</h4>
      <LineChart height={110} format={f.kw} series={[
        { name: 'Solar', color: '#facc15', points: pts.map((p) => [p.t, p.solar]) },
        { name: 'Wind', color: '#38bdf8', points: pts.map((p) => [p.t, p.wind]) },
        { name: 'Solar + wind', color: '#22c55e', points: pts.map((p) => [p.t, p.solar + p.wind]) },
        { name: 'Demand', color: '#f87171', points: pts.map((p) => [p.t, p.demand]) },
      ]} />
      <p className="muted text-[0.85em]">Next 24 h: {f.kwh(sum('solar'))} solar · {f.kwh(sum('wind'))} wind · {f.kwh(sum('demand'))} demand. Solar + wind fall short of demand in {short} of the next 48 h{short ? ' — plan storage, fuel or imports' : ''}.</p>
      {ev?.event && <p className="text-amber-300 text-[0.85em]">{WEATHER[ev.event as keyof typeof WEATHER].name} {ev.t <= s.time + 0.01 ? ' now' : ` in ${f.dur(ev.t - s.time)}`}.</p>}
    </div>
  );
}

function Advisor() {
  const m = useMapState();
  const ui = useUI();
  const hints = advise(engine.state, m);
  return (
    <div className="panel2 p-2" data-testid="advisor">
      <h4 className="font-semibold mb-1">Advisor</h4>
      {hints.length === 0 ? <p className="muted">All good here — nothing needs attention.</p> : hints.slice(0, 6).map((h) => (
        <div key={h.id} className="flex gap-2 items-start py-1 border-b border-[var(--border)] last:border-0" data-testid={`hint-${h.id}`}>
          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${HINT_DOT[h.level]}`} aria-label={h.level} />
          <span className="flex-1 leading-snug">{h.text}</span>
          {h.screen && <button className="btn btn-sm btn-ghost shrink-0" onClick={() => ui.setScreen(h.screen!)}>Open</button>}
        </div>
      ))}
    </div>
  );
}

/** Map-wide bulk actions with what they would cost / affect. */
function QuickActions() {
  const f = useFmt();
  const m = useMapState();
  const s = engine.state;
  const all = Object.values(m.buildings);
  const damaged = all.filter((b) => !defOf(b).fixed && b.condition < 0.999);
  const repairCost = damaged.reduce((a, b) => a + manualRepairCost(s, b), 0);
  const low = all.filter((b) => { const d = defOf(b); return d.thermal && (b.tank ?? 0) < tankCapacity(b, d) * 0.999; });
  return (
    <div className="flex gap-1 mt-2" data-testid="quick-actions">
      <button className="btn btn-sm flex-1 whitespace-normal leading-tight" disabled={!damaged.length} onClick={() => cmd({ type: 'repairAll', map: m.id }, 'Repaired everything affordable.')} data-tip="Repair every damaged installation now (manual repair, most damaged first)" data-testid="repair-all">
        Repair all{damaged.length ? ` (${damaged.length}) · ${f.money(repairCost)}` : ''}
      </button>
      {low.length > 0 && (
        <button className="btn btn-sm flex-1 whitespace-normal leading-tight" onClick={() => cmd({ type: 'refuelAll', map: m.id }, 'Refuelling from the depot.')} data-tip="Top up every fuel plant's tank from the fuel depot" data-testid="refuel-all">
          Refuel all ({low.length})
        </button>
      )}
    </div>
  );
}

function MapOverview() {
  const f = useFmt();
  const m = useMapState();
  const s = useGame((s) => s);
  const st = STAGES[m.id];
  const lim = gridLimits(s, m);
  const next = nextGridLevel(m);
  const prev = m.gridLevel > 0 ? st.grid[m.gridLevel - 1] : null;
  const [sureDown, setSureDown] = useState(false);
  const load = mapMaintenanceLoad(s, m);
  const cap = maintenanceCapacity(s, m);
  const contracts = CONTRACT_LIST.filter((c) => c.stage === m.id);
  return (
    <div className="flex flex-col gap-2" data-testid="map-overview">
      <h3 className="font-bold text-[1.1em]">{st.name}</h3>
      <p className="muted">{st.tagline}</p>
      <Advisor />
      <Goals />
      <Forecast />
      <div className="panel2 p-2">
        <Row k="Generation" v={f.kw(m.flow.generation)} />
        <Row k="Demand (avg contracted)" v={`${f.kw(m.flow.demand)} (${f.kw(averageDemandKW(m))})`} />
        <Row k="Served locally" v={f.kw(m.flow.selfServed)} />
        <Row k="Storage charge / discharge" v={`${f.kw(m.flow.charged)} / ${f.kw(m.flow.discharged)}`} />
        <Row k="Curtailed" v={f.kw(m.flow.curtailed)} />
        <Row k="Unserved" v={f.kw(m.flow.unserved)} />
        <Row k="Reliability (48 h)" v={f.pct(m.reliability, 1)} />
        <Row k={m.id === 'backyard' ? 'Bill savings' : 'Sales'} v={m.id === 'backyard' ? `${f.rate(m.flow.savings)} saved · ${f.rate(m.flow.sales)} sold` : f.rate(m.flow.sales)} />
        <Row k="Import cost" v={f.rate(m.flow.importCost)} />
        {m.id === 'backyard' && <Row k="Household income" v={f.rate(m.flow.income)} />}
      </div>
      <div className="panel2 p-2">
        <h4 className="font-semibold">Grid connection</h4>
        <Row k="Tier" v={`${m.gridLevel + 1}. ${st.grid[m.gridLevel].name}`} />
        <Row k="Import capacity" v={f.kw(lim.importKW)} />
        <Row k="Export capacity" v={lim.exportKW > 0 ? f.kw(lim.exportKW) : 'none (import only)'} />
        <Row k="Losses" v={f.pct(lim.losses, 1)} />
        <Row k="Running cost" v={f.rate(st.grid[m.gridLevel].opex)} />
        <div className="my-1"><Progress value={lim.exportKW > 0 ? m.flow.exported / lim.exportKW : 0} label="Export usage" color="#f59e0b" /></div>
        {next ? (
          <button className="btn btn-primary w-full mt-1 flex-col items-start text-left whitespace-normal leading-tight" disabled={s.money < next.cost || (!!next.research && s.research.done[next.research] === undefined)} onClick={() => cmd({ type: 'upgradeGrid', map: m.id }, 'Grid connection upgraded.')} data-testid="upgrade-grid">
            <span>Upgrade → {next.name} · {f.money(next.cost)}</span>
            <span className="text-[0.85em] opacity-80">{f.kw(next.exportKW)} export · running cost {f.rate(next.opex)}</span>
          </button>
        ) : <p className="muted">Highest tier reached. Build grid stations for more capacity.</p>}
        {next?.research && s.research.done[next.research] === undefined && <p className="text-amber-300 text-[0.85em]">Requires <GoLink kind="research" id={next.research} /></p>}
        {prev && (
          <button className={`btn ${sureDown ? 'btn-danger' : 'btn-ghost'} w-full mt-1 flex-col items-start text-left whitespace-normal leading-tight`} onClick={() => { if (!sureDown) return setSureDown(true); setSureDown(false); cmd({ type: 'downgradeGrid', map: m.id }, 'Grid connection downgraded.'); }} onMouseLeave={() => setSureDown(false)} data-testid="downgrade-grid" data-tip="No refund — re-upgrading costs the full price again.">
            <span>{sureDown ? 'Click again to confirm — no refund' : `Downgrade → ${prev.name}`}</span>
            <span className="text-[0.85em] opacity-80">{f.kw(prev.importKW)} import · {prev.exportKW > 0 ? `${f.kw(prev.exportKW)} export` : 'no export'} · running cost {f.rate(prev.opex)}</span>
          </button>
        )}
      </div>
      <div className="panel2 p-2">
        <h4 className="font-semibold">Maintenance</h4>
        <Row k="Load / capacity" v={`${load.toFixed(2)} / ${cap.toFixed(2)} WU`} />
        <Progress value={cap > 0 ? load / cap : 1} color={load > cap ? '#ef4444' : '#22c55e'} label="Maintenance utilisation" />
        <Row k="Queued repairs" v={m.repairJobs.length} />
        <QuickActions />
      </div>
      <div className="panel2 p-2" data-testid="contracts">
        <h4 className="font-semibold mb-1">{m.id === 'backyard' ? 'Home improvements' : 'Customer contracts'}</h4>
        {contracts.length === 0 && <p className="muted">No contracts at this scale.</p>}
        {contracts.map((c) => {
          const signed = m.contracts.includes(c.id);
          const req = c.requires ? evalMilestone(s, c.requires) : null;
          return (
            <div key={c.id} className="py-1 border-b border-[var(--border)] last:border-0">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{c.name}</span>
                {signed ? (
                  <button className="btn btn-sm" onClick={() => cmd({ type: 'cancelContract', map: m.id, contract: c.id })}>Cancel</button>
                ) : (
                  <button className="btn btn-sm btn-primary" disabled={s.money < c.fee || (req ? !req.done : false)} onClick={() => cmd({ type: 'signContract', map: m.id, contract: c.id }, 'Contract signed.')} data-testid={`sign-${c.id}`}>
                    {f.money(c.fee)}
                  </button>
                )}
              </div>
              <div className="muted text-[0.82em]">
                +{f.kw(c.kw)} {c.category} · {m.id === 'backyard' ? `+${f.rate(c.income ?? 0)} income` : `${f.price(c.price)}`} {signed && <Chip tone="good">signed</Chip>}
              </div>
              {c.requires && !signed && <div className={`text-[0.8em] ${req?.done ? 'text-green-300' : 'text-amber-300'}`}>Requires: {milestoneLabel(c.requires)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

