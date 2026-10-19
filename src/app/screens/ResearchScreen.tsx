import { Infinity as Inf, Pause, Play, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BUILDINGS } from '../../engine/data/buildings';
import { BRANCHES, RESEARCH, RESEARCH_LIST, REPEATABLE_LIST } from '../../engine/data/research';
import { STAGE_LIST, STAGES } from '../../engine/data/stages';
import { UPGRADES } from '../../engine/data/upgrades';
import type { Effect, ModKey, ResearchBranch, ResearchDef } from '../../engine/data/types';
import { etaHours, lockReasons, researchShares, researchStatus, researchThroughput, rpNeeded, type ResearchStatus } from '../../engine/systems/ResearchSystem';
import { cmd } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import type { GameState } from '../../engine/core/State';
import { Card, Chip, Progress, Stat } from '../components/ui';
import { GoLink, revealFocus } from '../components/GoLink';
import { useUI } from '../stores/uiStore';

const FEATURE_TEXT: Record<string, string> = {
  'battery.advanced': 'Advanced battery modes (reserve %, peak shaving, smart dispatch)', 'battery.arbitrage': 'Battery market arbitrage', 'market.spot': 'Dynamic spot prices & energy traders',
  'market.contracts': 'Power purchase agreements', 'fuel.contracts': 'Long-term fuel contracts', 'fuel.bulk': 'Bulk fuel discounts', 'fuel.autoBuy': 'Automated fuel purchasing',
  'land.bulk': 'Bulk land purchase', 'thermal.advanced': 'Advanced thermal management', 'repair.preventive': 'Preventive maintenance by idle crews', 'automation.priority': 'Repair priority overrides',
  'fleet.upgrade': 'Bulk fleet upgrades', 'terrain.ocean': 'Buy ocean tiles', 'terrain.mountain': 'Buy mountain tiles', 'trading.auto': 'Automatic PPA renewal', 'offline.extended': 'Extended offline progress',
};

const MOD_TEXT: Record<ModKey, string> = {
  'solar.output': 'solar output', 'wind.output': 'wind output', 'hydro.output': 'hydro output', 'thermal.eta': 'thermal plant efficiency', 'thermal.cooling': 'thermal cooling capacity',
  'geothermal.output': 'geothermal output', 'nuclear.fuel': 'nuclear fuel use', 'fusion.output': 'fusion output', 'orbital.output': 'orbital output', 'stellar.output': 'stellar output', 'exotic.output': 'exotic output',
  'storage.eta': 'storage efficiency', 'storage.capacity': 'storage capacity', 'storage.aging': 'storage aging', 'storage.power': 'storage power',
  'grid.capacity': 'grid connection capacity', 'grid.losses': 'grid losses', wear: 'building wear', 'maintenance.capacity': 'maintenance crew capacity', 'repair.cost': 'repair cost',
  'logistics.speed': 'fuel delivery speed', 'logistics.capacity': 'fuel delivery capacity', 'research.speed': 'research speed', 'market.price': 'sale price', 'fuel.cost': 'fuel cost',
  'land.cost': 'land price', density: 'building density', wages: 'wages', 'build.cost': 'construction cost', salvage: 'salvage value', 'demand.price': 'retail price', revenue: 'revenue',
  'workforce.capacity': 'staff capacity',
};

export function effectText(e: Effect): string {
  switch (e.type) {
    case 'mod': return `${e.add > 0 ? '+' : ''}${Math.round(e.add * 100)}% ${MOD_TEXT[e.key] ?? e.key}`;
    case 'unlock': return `Unlocks ${BUILDINGS[e.building]?.name ?? e.building}`;
    case 'upgrade': return `Retrofit: ${UPGRADES[e.upgrade]?.name ?? e.upgrade}`;
    case 'feature': return FEATURE_TEXT[e.feature] ?? e.feature;
  }
}

const TONE: Record<ResearchStatus, 'good' | 'info' | 'warn' | undefined> = { done: 'good', active: 'info', paused: 'warn', available: undefined, locked: undefined };
const EDGE: Record<ResearchStatus, string> = { done: 'var(--good)', active: 'var(--accent2)', paused: 'var(--accent)', available: 'var(--accent)', locked: 'var(--border)' };

function repeatText(e: Effect, level: number): string {
  if (e.type !== 'mod') return effectText(e);
  const name = MOD_TEXT[e.key] ?? e.key;
  const per = `${e.add > 0 ? '+' : ''}${Math.round(e.add * 1000) / 10}% ${name} per level`;
  // matches Modifiers.ts: reductions approach −25% asymptotically
  const total = e.add < 0 ? -0.25 * (1 - Math.pow(1 + e.add / 0.25, level)) : e.add * level;
  return `${per} (now ${total > 0 ? '+' : ''}${Math.round(total * 1000) / 10}%${e.add < 0 ? ', max −25%' : ''})`;
}

function ResearchCard({ r, s }: { r: ResearchDef; s: GameState }) {
  const f = useFmt();
  const st = researchStatus(s, r.id);
  const why = st === 'locked' ? lockReasons(s, r.id) : [];
  const need = rpNeeded(s, r.id);
  const prog = (s.research.progress[r.id] ?? 0) / need;
  const level = s.research.levels[r.id] ?? 0;
  const rp = researchThroughput(s);
  const shares = researchShares(s);
  const missing = r.prereq.filter((p) => s.research.done[p] === undefined);
  return (
    <Card title={<span className="flex items-center gap-2 flex-wrap">{r.name} <Chip tone={TONE[st]}>{st}</Chip>{r.repeat && <Chip tone="info">Level {level}</Chip>}</span>} className={st === 'locked' ? 'opacity-75' : ''}>
      <div data-testid={`research-${r.id}`}>
        <p className="muted text-[0.88em] mb-1">{r.desc}{r.repeat && ' Repeatable: runs level after level until you pause it.'}</p>
        <ul className="text-[0.88em] mb-1">{r.effects.map((e, i) => <li key={i}>• {r.repeat ? repeatText(e, level) : e.type === 'unlock' && BUILDINGS[e.building] ? <>Unlocks <GoLink kind="building" id={e.building} /></> : effectText(e)}</li>)}</ul>
        <div className="flex flex-wrap gap-x-3 text-[0.85em] num muted">
          <span>{f.num(need)} RP{r.repeat && ` for level ${level + 1} (×${r.repeat.growth} each level)`}</span>
          {r.cost > 0 && <span>{f.money(r.cost)}</span>}
          <span>{r.beyond ? 'Beyond' : STAGES[r.stage].name}</span>
          {r.minH && <span>min {r.minH} h</span>}
          {st !== 'done' && st !== 'active' && <span data-tip="Time to finish if it got all of your current research throughput">≈ {rp > 0 ? f.dur(Math.max(r.minH ?? 0, (need - (s.research.progress[r.id] ?? 0)) / rp)) : '∞'} at full RP</span>}
          {r.prereq.length > 0 && <span>after: {r.prereq.map((p, i) => <span key={p}>{i > 0 && ', '}<GoLink kind="research" id={p} /></span>)}</span>}
        </div>
        {why.length > 0 && (
          <div className="text-amber-300 text-[0.85em] mt-1">
            {/* lockReasons lists missing prerequisites first, so those become links */}
            {[...missing.map((p) => <>Requires <GoLink kind="research" id={p} /></>), ...why.slice(missing.length)].map((x, i) => <span key={i}>{i > 0 && ' · '}{x}</span>)}
          </div>
        )}
        {(st === 'active' || st === 'paused') && (
          <div className="mt-1">
            <Progress value={prog} label={`${r.name} progress`} />
            <div className="flex justify-between text-[0.85em] num muted mt-0.5">
              <span>{f.pct(prog)}</span>
              {st === 'active' && <span>ETA {f.dur(etaHours(s, r.id))} · {f.num(rp * (shares[r.id] ?? 0))} RP/h</span>}
            </div>
          </div>
        )}
        {st === 'active' && (
          <label className="flex items-center gap-2 mt-1 text-[0.88em]">
            <span className="muted">Allocation</span>
            <input type="range" min={0} max={100} step={5} value={s.research.active[r.id]} onChange={(e) => cmd({ type: 'allocate', id: r.id, pct: Number(e.target.value) })} className="flex-1" aria-label={`Allocation for ${r.name}`} />
            <span className="num w-14 text-right">{f.pct(shares[r.id] ?? 0)}</span>
          </label>
        )}
        <div className="flex gap-1 mt-1.5">
          {(st === 'available' || st === 'paused') && (
            <button className="btn btn-sm btn-primary" disabled={st === 'available' && s.money < r.cost} onClick={() => cmd({ type: 'startResearch', id: r.id }, st === 'available' ? `Research started: ${r.name}` : undefined)} data-testid={`start-${r.id}`}>
              <Play size={12} />{st === 'paused' ? 'Resume' : r.cost > 0 ? `Start · ${f.money(r.cost)}` : 'Start'}
            </button>
          )}
          {st === 'active' && <button className="btn btn-sm" onClick={() => cmd({ type: 'pauseResearch', id: r.id })}><Pause size={12} />Pause</button>}
        </div>
      </div>
    </Card>
  );
}

// ---- tree layout: one area per map (plus Beyond), rows by prerequisite depth inside the area ----
const NW = 180, NH = 58, GX = 18, GY = 44, HEAD = 34, PAD = 14, AGAP = 18;
const treeW = (cols: number) => cols * (NW + GX) - GX + PAD * 2;
interface Area { id: string; name: string; y: number; h: number; stage: ResearchDef['stage'] }
interface Layout { pos: Record<string, { x: number; y: number }>; areas: Area[]; h: number; w: number }

const layouts = new Map<number, Layout>();
function layoutFor(COLS: number): Layout {
  const hit = layouts.get(COLS);
  if (hit) return hit;
  const pos: Layout['pos'] = {};
  const areas: Area[] = [];
  const branchIdx = (r: ResearchDef) => BRANCHES.findIndex((b) => b.id === r.branch);
  const groups = [
    ...STAGE_LIST.map((st) => ({ id: st.id, name: st.name, stage: st.id, nodes: RESEARCH_LIST.filter((r) => r.stage === st.id), reps: REPEATABLE_LIST.filter((r) => r.stage === st.id && !r.beyond) })),
    { id: 'beyond', name: 'Beyond — endless research', stage: 'universe' as const, nodes: [] as ResearchDef[], reps: REPEATABLE_LIST.filter((r) => r.beyond) },
  ];
  let y = 0;
  for (const g of groups) {
    const inArea = new Set(g.nodes.map((r) => r.id));
    const depth: Record<string, number> = {};
    const dep = (r: ResearchDef): number => (depth[r.id] ??= Math.max(-1, ...r.prereq.filter((p) => inArea.has(p)).map((p) => dep(RESEARCH[p]))) + 1);
    g.nodes.forEach(dep);
    const rows: ResearchDef[][] = [];
    for (const r of g.nodes) (rows[depth[r.id]] ??= []).push(r);
    const lines: ResearchDef[][] = [];
    for (const row of rows.filter(Boolean)) {
      // order by where the prerequisites sit (fewer crossing strings), then by branch
      const bary = (r: ResearchDef) => { const xs = r.prereq.filter((p) => pos[p]).map((p) => pos[p].x); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : branchIdx(r) * 60; };
      row.sort((a, b) => bary(a) - bary(b) || branchIdx(a) - branchIdx(b));
      for (let i = 0; i < row.length; i += COLS) lines.push(row.slice(i, i + COLS));
    }
    for (let i = 0; i < g.reps.length; i += COLS) lines.push(g.reps.slice(i, i + COLS));
    const top = y;
    let ly = y + HEAD;
    for (const line of lines) {
      const x0 = PAD + ((COLS - line.length) * (NW + GX)) / 2;
      line.forEach((r, i) => (pos[r.id] = { x: x0 + i * (NW + GX), y: ly }));
      ly += NH + GY;
    }
    const h = ly - GY + PAD - top;
    areas.push({ id: g.id, name: g.name, y: top, h, stage: g.stage });
    y = top + h + AGAP;
  }
  const out = { pos, areas, h: y - AGAP, w: treeW(COLS) };
  layouts.set(COLS, out);
  return out;
}

function ResearchTree({ s, match, sel, setSel, cols }: { s: GameState; match: (r: ResearchDef) => boolean; sel: string | null; setSel: (id: string) => void; cols: number }) {
  const f = useFmt();
  const LAYOUT = layoutFor(cols);
  const TREE_W = LAYOUT.w;
  const [hover, setHover] = useState<string | null>(null);
  const focus = hover;
  const related = useMemo(() => {
    if (!focus) return null;
    const set = new Set([focus]);
    const up = (id: string) => RESEARCH[id]?.prereq.forEach((p) => { if (!set.has(p)) { set.add(p); up(p); } });
    up(focus);
    for (const r of Object.values(RESEARCH)) if (r.prereq.includes(focus)) set.add(r.id);
    return set;
  }, [focus]);
  const all = Object.values(RESEARCH).filter((r) => LAYOUT.pos[r.id]);
  const edges = all.flatMap((r) => r.prereq.filter((p) => LAYOUT.pos[p]).map((p) => ({ from: p, to: r.id })));
  return (
    <div className="relative" style={{ width: TREE_W, height: LAYOUT.h }} data-testid="research-tree">
      {LAYOUT.areas.map((a) => {
        const open = a.id === 'beyond' ? s.research.done.universal_5 !== undefined : !!s.maps[a.stage];
        const ids = all.filter((r) => (a.id === 'beyond' ? r.beyond : r.stage === a.stage && !r.beyond) && !r.repeat).map((r) => r.id);
        const dn = ids.filter((id) => s.research.done[id] !== undefined).length;
        return (
          <div key={a.id} className={`absolute rounded-lg border ${open ? '' : 'opacity-50'}`} style={{ left: 0, top: a.y, width: TREE_W, height: a.h, borderColor: 'var(--border)', background: 'var(--panel)' }} data-testid={`area-${a.id}`}>
            <div className="flex items-center gap-2 px-3 pt-2 text-[0.9em]">
              <b>{a.name}</b>
              {ids.length > 0 && <span className="muted num">{dn}/{ids.length}</span>}
              {!open && <span className="muted">· {a.id === 'beyond' ? 'complete Convergence Theory' : `unlock the ${a.name} map`}</span>}
            </div>
          </div>
        );
      })}
      <svg className="absolute inset-0 pointer-events-none" width={TREE_W} height={LAYOUT.h}>
        {edges.map(({ from, to }) => {
          const a = LAYOUT.pos[from], b = LAYOUT.pos[to];
          const x1 = a.x + NW / 2, y1 = a.y + NH, x2 = b.x + NW / 2, y2 = b.y;
          const dy = Math.max(24, Math.abs(y2 - y1) / 2);
          const lit = !related || (related.has(from) && related.has(to));
          const st = s.research.done[from] !== undefined ? researchStatus(s, to) : 'locked';
          return <path key={`${from}>${to}`} d={`M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`} fill="none" stroke={EDGE[st]} strokeWidth={lit && related ? 2.5 : 1.5} strokeDasharray={st === 'locked' ? '4 4' : undefined} opacity={lit ? 0.9 : 0.15} />;
        })}
      </svg>
      {all.map((r) => {
        const p = LAYOUT.pos[r.id];
        const st = researchStatus(s, r.id);
        const prog = (s.research.progress[r.id] ?? 0) / rpNeeded(s, r.id);
        const dim = !match(r) || (related && !related.has(r.id));
        return (
          <button key={r.id} className={`absolute text-left rounded-md border-2 px-2 py-1 transition-opacity ${sel === r.id ? 'ring-2 ring-sky-400' : ''}`}
            style={{ left: p.x, top: p.y, width: NW, height: NH, borderColor: EDGE[st], background: st === 'done' ? 'color-mix(in srgb, var(--good) 14%, var(--panel2))' : 'var(--panel2)', opacity: dim ? 0.35 : st === 'locked' ? 0.7 : 1, borderStyle: r.repeat ? 'dashed' : 'solid' }}
            onClick={() => setSel(r.id)} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} data-testid={`node-${r.id}`} aria-label={`${r.name}, ${st}`}>
            <div className="flex items-center gap-1 text-[0.85em] font-semibold leading-tight">
              {r.repeat && <Inf size={12} className="shrink-0" />}
              <span className="truncate">{r.name}</span>
            </div>
            <div className="flex justify-between text-[0.75em] muted num">
              <span>{r.repeat ? `Lv ${s.research.levels[r.id] ?? 0}` : BRANCHES.find((b) => b.id === r.branch)?.name}</span>
              <span>{st === 'done' ? '✓' : st === 'active' || st === 'paused' ? f.pct(prog) : `${f.num(rpNeeded(s, r.id))} RP`}</span>
            </div>
            {(st === 'active' || st === 'paused') && <div className="h-1 rounded mt-0.5" style={{ background: 'var(--border)' }}><div className="h-1 rounded" style={{ width: `${Math.min(1, prog) * 100}%`, background: EDGE[st] }} /></div>}
          </button>
        );
      })}
    </div>
  );
}

/** View and filters persist per viewer (browser storage is a convenience; defaults if unavailable). */
const PREFS = 'ee-research-prefs';
type Prefs = { view: 'tree' | 'list'; filter: ResearchStatus | 'all'; branch: ResearchBranch | 'all' };
function loadPrefs(): Prefs {
  const d: Prefs = { view: 'tree', filter: 'all', branch: 'all' };
  try { return { ...d, ...JSON.parse(localStorage.getItem(PREFS) ?? '{}') }; } catch { return d; }
}
function usePref<K extends keyof Prefs>(k: K): [Prefs[K], (v: Prefs[K]) => void] {
  const [v, setV] = useState<Prefs[K]>(() => loadPrefs()[k]);
  const set = (x: Prefs[K]) => {
    setV(x);
    try { localStorage.setItem(PREFS, JSON.stringify({ ...loadPrefs(), [k]: x })); } catch { /* not persisted */ }
  };
  return [v, set];
}

export function ResearchScreen() {
  const f = useFmt();
  const s = useGame((s) => s);
  const [view, pick] = usePref('view');
  const [branch, setBranch] = usePref('branch');
  const [filter, setFilter] = usePref('filter');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(() => Object.keys(s.research.active)[0] ?? RESEARCH_LIST.find((r) => researchStatus(s, r.id) === 'available')?.id ?? null);
  const focus = useUI((u) => u.focus);
  useEffect(() => {
    if (focus?.kind !== 'research') return;
    const r = RESEARCH[focus.id];
    // the list hides non-matching projects, so clear only the filters that would hide the target
    if (view === 'list' && r) {
      if (branch !== 'all' && r.branch !== branch) setBranch('all');
      if (filter !== 'all' && researchStatus(s, r.id) !== filter) setFilter('all');
      setQ('');
    }
    setSel(focus.id);
    useUI.setState({ focus: null });
    revealFocus(`[data-testid="${view === 'tree' ? 'node' : 'research'}-${focus.id}"]`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when a new focus request arrives
  }, [focus]);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [cols, setCols] = useState(4);
  useEffect(() => {
    if (!box) return;
    const fit = () => setCols(Math.max(2, Math.min(8, Math.floor((box.clientWidth - PAD * 2 + GX) / (NW + GX)))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [box]);
  const rp = researchThroughput(s);
  const shares = researchShares(s);
  const match = (r: ResearchDef) => (branch === 'all' || r.branch === branch) && (filter === 'all' || researchStatus(s, r.id) === filter) && (!q || `${r.name} ${r.desc}`.toLowerCase().includes(q.toLowerCase()));
  const list = [...RESEARCH_LIST, ...REPEATABLE_LIST].filter(match);
  const done = Object.keys(s.research.done).length;
  const levels = Object.values(s.research.levels).reduce((a, b) => a + b, 0);
  return (
    <div className="p-3 flex flex-col gap-3 min-h-0" data-testid="research-screen">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Research throughput" value={`${f.num(rp)} RP/h`} sub="Company-wide pool" />
        <Stat label="Active projects" value={Object.keys(s.research.active).length} sub="RP split by allocation weight" />
        <Stat label="Completed" value={`${done} / ${RESEARCH_LIST.length}`} sub={levels ? `+ ${levels} repeatable levels` : 'Repeatables open per map'} />
        <Stat label="Idle capacity" value={f.pct(Math.max(0, 1 - Object.values(shares).reduce((a, b) => a + b, 0)))} tone={Object.keys(shares).length ? undefined : 'warn'} />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1" role="tablist" aria-label="Research view">
          <button className={`btn btn-sm ${view === 'tree' ? 'active' : 'btn-ghost'}`} onClick={() => pick('tree')} data-testid="view-tree">Tree</button>
          <button className={`btn btn-sm ${view === 'list' ? 'active' : 'btn-ghost'}`} onClick={() => pick('list')} data-testid="view-list">List</button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1.5 muted" />
          <input className="input pl-7 w-56" placeholder="Search research…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search research" />
        </div>
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as ResearchStatus | 'all')} aria-label="Filter by status">
          {['all', 'available', 'active', 'paused', 'locked', 'done'].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="flex gap-1 flex-wrap" role="tablist" aria-label="Research branches">
        <button className={`btn btn-sm ${branch === 'all' ? 'active' : 'btn-ghost'}`} onClick={() => setBranch('all')}>All</button>
        {BRANCHES.map((b) => {
          const total = RESEARCH_LIST.filter((r) => r.branch === b.id).length;
          const dn = RESEARCH_LIST.filter((r) => r.branch === b.id && s.research.done[r.id] !== undefined).length;
          return <button key={b.id} className={`btn btn-sm ${branch === b.id ? 'active' : 'btn-ghost'}`} onClick={() => setBranch(b.id)}>{b.name} <span className="muted num">{dn}/{total}</span></button>;
        })}
      </div>
      {view === 'tree' ? (
        <div className="flex flex-col lg:flex-row gap-3 min-h-0">
          <div ref={setBox} className="overflow-auto flex-1 min-w-0 max-h-[75vh] rounded-lg">
            <ResearchTree s={s} match={match} sel={sel} setSel={setSel} cols={cols} />
          </div>
          <div className="lg:w-96 shrink-0">
            {sel && RESEARCH[sel] ? <ResearchCard r={RESEARCH[sel]} s={s} /> : <p className="muted">Select a project in the tree.</p>}
          </div>
        </div>
      ) : (
        <div className="grid gap-2 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
          {list.map((r) => <ResearchCard key={r.id} r={r} s={s} />)}
        </div>
      )}
    </div>
  );
}
