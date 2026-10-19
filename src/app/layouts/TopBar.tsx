import { Bell, CloudLightning, Droplets, Maximize, Minimize, Pause, Play, Save, Settings, Star, ThermometerSun, Zap, FlaskConical } from 'lucide-react';
import { nextWeather, WEATHER, weatherAt, type WeatherKind } from '../../engine/systems/WeatherSystem';
import { useEffect, useState } from 'react';
import { STAGES } from '../../engine/data/stages';
import { formatClock, seasonName } from '../../engine/core/GameClock';
import { claimablePoints } from '../../engine/math/PrestigeFormulas';
import { researchThroughput } from '../../engine/systems/ResearchSystem';
import { globalWages } from '../../engine/systems/FinanceSystem';
import { defOf, SPEED_UNLOCK, speedCap } from '../../engine/core/Helpers';
import type { GameState } from '../../engine/core/State';
import { cmd, saveNow } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';

export async function toggleFullscreen() {
  const ui = useUI.getState();
  if (!document.fullscreenEnabled) {
    ui.toast('Fullscreen is not available in this browser — use your browser\'s full-screen key (F11).', 'error');
    return;
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (e) {
    ui.toast(`Fullscreen failed: ${(e as Error).message}`, 'error');
  }
}

export function useFullscreenSync() {
  useEffect(() => {
    const on = () => {
      useUI.getState().set({ fullscreen: !!document.fullscreenElement });
      window.dispatchEvent(new Event('resize'));
    };
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
}

export function TopBar() {
  const f = useFmt();
  const ui = useUI();
  const s = useGame((s) => s);
  let gen = 0, demand = 0, imp = 0, exp = 0;
  for (const m of Object.values(s.maps)) {
    if (!m) continue;
    gen += m.flow.generation;
    demand += m.flow.demand;
    imp += m.flow.imported;
    exp += m.flow.exported;
  }
  const claim = claimablePoints(s.prestige.lifetimeRevenue, s.prestige.awarded);
  const active = Object.keys(s.research.active).length;
  const alerts = s.notifications.filter((n) => (n.level === 'warning' || n.level === 'critical') && n.t > ui.seenAlerts && !s.settings.mutedCategories.includes(n.category)).length;
  const rp = researchThroughput(s);
  return (
    <header className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--border)] bg-[var(--panel)] min-h-[46px] overflow-x-auto scroll" data-testid="topbar">
      <div className="flex items-center gap-1.5 pr-2 shrink-0">
        <Zap className="text-amber-400" size={20} aria-hidden />
        <span className="font-bold hidden xl:inline">Energy Empire</span>
      </div>
      <Pill label="Money" testid="money" tip={<MoneyTip s={s} />}>
        <span className={`num font-bold ${s.money < 0 ? 'text-red-400' : ''}`}>{f.money(s.money)}</span>
        <span className={`num text-[0.85em] ${s.rates.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>{s.rates.net >= 0 ? '+' : ''}{f.rate(s.rates.net)}</span>
      </Pill>
      <Pill label="Production / demand" testid="power" tip={<PowerTip s={s} />}>
        <span className="num">{f.kw(gen)}</span>
        <span className="muted">/</span>
        <span className="num">{f.kw(demand)}</span>
      </Pill>
      <Pill label="Grid import / export" testid="grid" className="hidden md:flex" tip={<GridTip s={s} />}>
        <span className="num text-sky-300">↓{f.kw(imp)}</span>
        <span className="num text-amber-300">↑{f.kw(exp)}</span>
      </Pill>
      <button className="btn btn-ghost btn-sm shrink-0" onClick={() => ui.setScreen('research')} data-tip="Research status" aria-label="Research status">
        <FlaskConical size={15} /> <span className="num">{active} · {f.num(rp)} RP/h</span>
      </button>
      {claim > 0 && (
        <button className="btn btn-sm shrink-0" onClick={() => ui.setScreen('prestige')} data-tip="Prestige points available">
          <Star size={14} className="text-amber-400" /> +{claim}
        </button>
      )}
      <div className="flex-1" />
      <WeatherChip />
      <div className="hidden lg:flex flex-col items-end leading-tight shrink-0 pr-1">
        <span className="font-semibold">{STAGES[ui.map].name}</span>
        <span className="muted num text-[0.85em]">{formatClock(s.time)} · {seasonName(s.time)}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Time controls">
        <button className={`btn btn-sm ${s.paused ? 'active' : ''}`} onClick={() => cmd({ type: 'pause', paused: !s.paused })} aria-label={s.paused ? 'Resume' : 'Pause'} data-tip={s.paused ? 'Resume (Space)' : 'Pause (Space)'} data-testid="pause">
          {s.paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button className="btn btn-sm num w-11" onClick={() => cmd({ type: 'setSpeed', speed: (s.speed % speedCap(s)) + 1 })} aria-label={`Game speed ${s.speed}x, click to change`} data-tip={`Cycle game speed${speedCap(s) > 1 ? ` 1×–${speedCap(s)}×` : ''} (T). ${SPEED_UNLOCK[speedCap(s)] ?? 'All speeds unlocked.'}`} data-testid="speed">
          {s.speed}×
        </button>
      </div>
      <button className="btn btn-ghost btn-sm relative shrink-0" onClick={() => ui.set({ events: !ui.events, seenAlerts: s.time })} aria-label="Event history" data-tip="Notifications & event history" data-testid="alerts">
        <Bell size={16} />
        {alerts > 0 && <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white rounded-full text-[10px] px-1 num">{alerts > 99 ? '99+' : alerts}</span>}
      </button>
      <button className="btn btn-ghost btn-sm shrink-0" onClick={() => saveNow(true)} aria-label="Save game" data-tip="Save now">
        <Save size={16} />
      </button>
      <button className="btn btn-ghost btn-sm shrink-0" onClick={toggleFullscreen} aria-label={ui.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} data-tip="Fullscreen" data-testid="fullscreen">
        {ui.fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
      </button>
      <button className="btn btn-ghost btn-sm shrink-0" onClick={() => ui.setScreen('settings')} aria-label="Settings">
        <Settings size={16} />
      </button>
    </header>
  );
}

/** Stat pill with a hover/focus breakdown. Fixed-positioned so the scrolling header can't clip it. */
function Pill({ label, children, testid, className = '', tip }: { label: string; children: React.ReactNode; testid?: string; className?: string; tip: React.ReactNode }) {
  const [at, setAt] = useState<DOMRect | null>(null);
  const show = (e: React.SyntheticEvent<HTMLDivElement>) => setAt(e.currentTarget.getBoundingClientRect());
  return (
    <div
      className={`panel2 flex items-center gap-1.5 px-2 py-1 shrink-0 cursor-help ${className}`}
      aria-label={label}
      data-testid={testid}
      tabIndex={0}
      onMouseEnter={show}
      onFocus={show}
      onMouseLeave={() => setAt(null)}
      onBlur={() => setAt(null)}
    >
      {children}
      {at && (
        <div role="tooltip" data-testid={testid && `${testid}-tip`} className="fixed z-50 panel p-2.5 shadow-xl w-80 text-[0.9em] pointer-events-none" style={{ top: at.bottom + 6, left: Math.max(8, Math.min(at.left, window.innerWidth - 328)) }}>
          <div className="font-semibold mb-1">{label}</div>
          {tip}
        </div>
      )}
    </div>
  );
}

const WX_ICON: Record<WeatherKind, typeof Zap> = { storm: CloudLightning, heatwave: ThermometerSun, drought: Droplets };

/** Current or upcoming (24 h) weather event on the viewed map. */
function WeatherChip() {
  const ui = useUI();
  const s = useGame((s) => s);
  const m = s.maps[ui.map];
  if (!m) return null;
  const now = weatherAt(m, s.time);
  const ev = now ?? nextWeather(m, s.time, 24);
  if (!ev) return null;
  const w = WEATHER[ev.kind], Icon = WX_ICON[ev.kind];
  const h = Math.max(1, Math.round(now ? ev.end - s.time : ev.start - s.time));
  return (
    <div className={`chip ${now ? 'chip-warn' : 'chip-info'} shrink-0 cursor-help`} data-tip={`${w.name} ${now ? 'now' : `in ${h} h`} on ${STAGES[m.id].name} (lasts ~${Math.round(ev.end - ev.start)} h).\n${w.desc}`} data-testid="weather-chip" tabIndex={0}>
      <Icon size={13} aria-hidden /> {w.name} {now ? `· ${h} h left` : `in ${h} h`}
    </div>
  );
}

function TipRow({ k, v, tone }: { k: string; v: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="muted">{k}</span>
      <span className={`num ${tone === 'good' ? 'text-green-400' : tone === 'bad' ? 'text-red-400' : ''}`}>{v}</span>
    </div>
  );
}

const share = (total: number, part: number, whole: number) => (whole > 0 ? (total * part) / whole : 0);

/** Live money flow by source. Ledger rates are exact; the sub-splits (sales, wages, opex) use current per-map shares. */
function MoneyTip({ s }: { s: GameState }) {
  const f = useFmt();
  const c = s.rates.cats;
  let retail = 0, exp = 0, ppa = 0, site = 0, grid = 0, opex = 0;
  for (const m of Object.values(s.maps)) {
    if (!m) continue;
    retail += m.flow.retailRev;
    exp += m.flow.exportRev;
    ppa += m.flow.contractRev;
    site += m.flow.wages;
    opex += m.flow.opex;
    grid += STAGES[m.id].grid[m.gridLevel].opex;
  }
  const sales = c.sales ?? 0, wages = c.wages ?? 0, op = c.opex ?? 0, hq = globalWages(s);
  const salesSplit = retail + exp + ppa;
  const rows: [string, number][] = [
    ...(salesSplit > 0
      ? ([['Customer electricity sales', share(sales, retail, salesSplit)], ['Grid export sales', share(sales, exp, salesSplit)], ['Power contracts (PPAs)', share(sales, ppa, salesSplit)]] as [string, number][])
      : ([['Electricity sales', sales]] as [string, number][])),
    ['Household income', c.income ?? 0],
    ['Grid imports', -(c.importCost ?? 0)],
    ['Fuel purchases', -(c.fuel ?? 0)],
    ...(site + hq > 0 ? ([['Site staff wages', -share(wages, site, site + hq)], ['HQ staff wages', -share(wages, hq, site + hq)]] as [string, number][]) : ([['Staff wages', -wages]] as [string, number][])),
    ['Repairs', -(c.repairs ?? 0)],
    ['Preventive servicing', -(c.maintenance ?? 0)],
    ...(opex > 0 ? ([['Grid connection fees', -share(op, grid, opex)], ['Plant upkeep (O&M)', -share(op, opex - grid, opex)]] as [string, number][]) : ([['Operating costs', -op]] as [string, number][])),
    ['Contract penalties', -(c.penalties ?? 0)],
    ['Carbon price', -(c.carbon ?? 0)],
  ];
  const big = Math.max(1e-9, ...rows.map(([, v]) => Math.abs(v)));
  const shown = rows.filter(([, v]) => Math.abs(v) > big * 1e-3).sort((a, b) => b[1] - a[1]);
  const sign = (v: number) => `${v >= 0 ? '+' : '−'}${f.rate(Math.abs(v))}`;
  return (
    <>
      {shown.length ? shown.map(([k, v]) => <TipRow key={k} k={k} v={sign(v)} tone={v >= 0 ? 'good' : 'bad'} />) : <div className="muted">No money moving right now.</div>}
      <div className="border-t border-[var(--border)] mt-1 pt-1"><TipRow k="Net" v={sign(s.rates.net)} tone={s.rates.net >= 0 ? 'good' : 'bad'} /></div>
      <div className="muted text-[0.9em] mt-1 leading-snug">Running costs and income averaged over the last few game hours. One-off purchases (buildings, land, research, hiring) aren't included.</div>
    </>
  );
}

const SOURCE: Record<string, string> = {
  solar: 'Solar', wind: 'Wind', hydro: 'Hydro', fossil: 'Fossil fuel', biomass: 'Biomass', geothermal: 'Geothermal', nuclear: 'Nuclear', fusion: 'Fusion', orbital: 'Orbital', stellar: 'Stellar', exotic: 'Exotic', storage: 'Storage discharge',
};

function PowerTip({ s }: { s: GameState }) {
  const f = useFmt();
  const by: Record<string, number> = {};
  const maps: [string, number, number][] = [];
  let charging = 0;
  for (const m of Object.values(s.maps)) {
    if (!m) continue;
    for (const b of Object.values(m.buildings)) if (b.output > 0) {
      const k = SOURCE[defOf(b).family] ?? 'Other';
      by[k] = (by[k] ?? 0) + b.output;
    }
    charging += m.flow.charged;
    if (m.flow.generation > 0 || m.flow.demand > 0) maps.push([STAGES[m.id].name, m.flow.generation, m.flow.demand]);
  }
  const src = Object.entries(by).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className="text-[0.85em] uppercase muted mt-0.5">Producing now</div>
      {src.length ? src.map(([k, v]) => <TipRow key={k} k={k} v={f.kw(v)} />) : <div className="muted">Nothing is producing.</div>}
      {charging > 0 && <TipRow k="Charging storage" v={`−${f.kw(charging)}`} />}
      <div className="text-[0.85em] uppercase muted mt-1.5">By map · production / demand</div>
      {maps.map(([n, g, d]) => <TipRow key={n} k={n} v={`${f.kw(g)} / ${f.kw(d)}`} tone={g >= d ? 'good' : 'bad'} />)}
    </>
  );
}

function GridTip({ s }: { s: GameState }) {
  const f = useFmt();
  const rows = Object.values(s.maps).filter((m) => m && (m.flow.imported > 0 || m.flow.exported > 0));
  return (
    <>
      {rows.length ? rows.map((m) => (
        <div key={m!.id} className="py-0.5">
          <div>{STAGES[m!.id].name}</div>
          {m!.flow.imported > 0 && <TipRow k={`↓ Importing ${f.kw(m!.flow.imported)}`} v={`−${f.rate(m!.flow.importCost)}`} tone="bad" />}
          {m!.flow.exported > 0 && <TipRow k={`↑ Exporting ${f.kw(m!.flow.exported)}${m!.lastExportCapped ? ' (at limit)' : ''}`} v={`+${f.rate(m!.flow.exportRev + m!.flow.contractRev)}`} tone="good" />}
        </div>
      )) : <div className="muted">Not trading with the grid right now.</div>}
      <div className="muted text-[0.9em] mt-1 leading-snug">You import when your plants and storage can't cover demand, and export surplus up to the connection limit.</div>
    </>
  );
}
