import type { NotificationEntry } from '../../engine/core/State';
import { CheckCircle2, Circle, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { STAGES } from '../../engine/data/stages';
import { RESEARCH } from '../../engine/data/research';
import { installedStorage, workerCount } from '../../engine/core/Helpers';
import { formatClock } from '../../engine/core/GameClock';
import { cmd } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { INCIDENTS, incidentText } from '../../engine/systems/IncidentSystem';
import { Modal, Row } from './ui';

export function Toasts() {
  const ui = useUI();
  return (
    <div className="fixed bottom-3 right-3 z-[60] flex flex-col gap-1.5 max-w-[min(420px,calc(100vw-1.5rem))]" aria-live="polite">
      {ui.toasts.map((t) => (
        <div key={t.id} className={`panel px-3 py-2 shadow-xl flex gap-2 items-start ${t.kind === 'error' ? 'border-red-700' : t.kind === 'success' ? 'border-green-700' : ''}`} role={t.kind === 'error' ? 'alert' : 'status'} data-testid="toast">
          <span className="flex-1">{t.text}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => ui.dismiss(t.id)} aria-label="Dismiss"><X size={12} /></button>
        </div>
      ))}
    </div>
  );
}

const LEVEL_RANK = { info: 0, success: 1, warning: 2, critical: 3 } as const;

/** Same category, map and text once numbers are ignored: shown as one entry with a count. */
const groupKey = (n: NotificationEntry) => `${n.category}|${n.map ?? ''}|${n.text.replace(/[\d.,]+/g, '#')}`;

export function EventsDrawer() {
  const ui = useUI();
  const s = useGame((s) => s);
  const [cat, setCat] = useState('all');
  const [showMuted, setShowMuted] = useState(false);
  if (!ui.events) return null;
  const muted = s.settings.mutedCategories;
  const min = s.settings.notifications === 'all' ? 0 : s.settings.notifications === 'important' ? 1 : 3;
  const shown = [...s.notifications].reverse().filter((n) => LEVEL_RANK[n.level] >= min && (cat === 'all' || n.category === cat) && (showMuted || !muted.includes(n.category)));
  const list: { n: NotificationEntry; count: number; first: number }[] = [];
  for (const n of shown) {
    const last = list[list.length - 1];
    if (last && groupKey(last.n) === groupKey(n)) {
      last.count++;
      last.first = n.t;
    } else list.push({ n, count: 1, first: n.t });
  }
  const cats = [...new Set(s.notifications.map((n) => n.category))];
  const toggle = (c: string) => cmd({ type: 'settings', patch: { mutedCategories: muted.includes(c) ? muted.filter((x) => x !== c) : [...muted, c] } });
  return (
    <aside className="fixed top-12 right-2 bottom-2 z-40 panel w-[min(420px,calc(100vw-1rem))] flex flex-col shadow-2xl" aria-label="Event history" data-testid="events">
      <header className="flex items-center gap-2 p-2 border-b border-[var(--border)]">
        <h3 className="font-semibold flex-1">Event history</h3>
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">{['all', ...cats].map((c) => <option key={c}>{c}</option>)}</select>
        <button className="btn btn-sm" onClick={() => cmd({ type: 'clearNotifications' })} aria-label="Clear history"><Trash2 size={13} /></button>
        <button className="btn btn-ghost btn-sm" onClick={() => ui.set({ events: false })} aria-label="Close"><X size={14} /></button>
      </header>
      <div className="flex flex-wrap gap-1 items-center px-2 py-1.5 border-b border-[var(--border)] text-[0.85em]" data-testid="event-mutes">
        <span className="muted">Mute:</span>
        {cats.map((c) => (
          <button key={c} className={`btn btn-sm ${muted.includes(c) ? 'btn-ghost line-through opacity-60' : ''}`} onClick={() => toggle(c)} aria-pressed={muted.includes(c)} data-tip={muted.includes(c) ? `Unmute ${c}` : `Hide ${c} events from the list and the alert badge`} data-testid={`mute-${c}`}>{c}</button>
        ))}
        {muted.length > 0 && <label className="flex items-center gap-1 ml-auto muted"><input type="checkbox" checked={showMuted} onChange={(e) => setShowMuted(e.target.checked)} />show muted</label>}
      </div>
      <div className="scroll flex-1 p-2 flex flex-col gap-1">
        {list.length === 0 && <p className="muted text-center py-4">No events at this verbosity.</p>}
        {list.map(({ n, count, first }) => (
          <div key={n.id} className={`panel2 px-2 py-1.5 text-[0.9em] border-l-4 ${n.level === 'critical' ? 'border-l-red-500' : n.level === 'warning' ? 'border-l-yellow-500' : n.level === 'success' ? 'border-l-green-500' : 'border-l-sky-500'}`} data-testid="event">
            <div className="muted text-[0.8em] num">{count > 1 ? `${formatClock(first)} – ` : ''}{formatClock(n.t)} · {n.category}{n.map ? ` · ${STAGES[n.map].name}` : ''}{count > 1 && <span className="chip ml-1" data-testid="event-count">×{count}</span>}</div>
            <div>{n.text}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function OfflineModal() {
  const f = useFmt();
  const sum = useGame((s) => s.offlineSummary);
  if (!sum) return null;
  const real = sum.realSeconds;
  return (
    <Modal title="Welcome back" onClose={() => cmd({ type: 'dismissOffline' })} footer={<button className="btn btn-primary" onClick={() => cmd({ type: 'dismissOffline' })} data-testid="offline-dismiss">Continue</button>}>
      <p className="mb-2">You were away for <b>{real >= 3600 ? `${(real / 3600).toFixed(1)} h` : `${Math.round(real / 60)} min`}</b> ({f.dur(sum.hours)} of game time).{sum.capped && ' Offline progress was capped.'}</p>
      <div data-testid="offline-summary">
        <Row k="Electricity produced" v={f.kwh(sum.produced)} />
        <Row k="Electricity sold" v={f.kwh(sum.sold)} />
        <Row k="Revenue earned" v={f.money(sum.revenue)} />
        <Row k="Expenses" v={f.money(sum.expenses)} />
        <Row k="Net cash change" v={<span className={sum.net >= 0 ? 'text-green-400' : 'text-red-400'}>{f.money(sum.net)}</span>} />
        <Row k="Repairs completed" v={sum.repairs} />
        <Row k="Fuel consumed" v={`${f.num(sum.fuelUsed)} units`} />
        <Row k="Research progress" v={`${f.num(sum.researchRP)} RP`} />
      </div>
      {sum.researchCompleted.length > 0 && <p className="mt-2">Completed: {sum.researchCompleted.map((r) => RESEARCH[r]?.name ?? r).join(', ')}</p>}
      {sum.issues.length > 0 && (
        <div className="mt-2">
          <h4 className="font-semibold text-yellow-300">Operating issues</h4>
          <ul className="list-disc pl-5 text-[0.9em]">{sum.issues.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
      )}
    </Modal>
  );
}

export function WinModal() {
  const s = useGame((s) => s);
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem('ee-win-seen') === String(s.won);
    } catch {
      return false;
    }
  });
  if (!s.won || seen) return null;
  const close = () => {
    try {
      localStorage.setItem('ee-win-seen', String(s.won));
    } catch {
      /* ignore */
    }
    setSeen(true);
  };
  return (
    <Modal title="The Convergence Engine is complete" onClose={close} footer={<button className="btn btn-primary" onClick={close}>Continue in sandbox mode</button>}>
      <p>From one rooftop panel to the energy of a universe. You have won Energy Empire.</p>
      <p className="muted mt-2">Every map keeps running. Prestige for permanent bonuses and a faster run, chase the remaining achievements, or keep optimising.</p>
    </Modal>
  );
}

/** Lightweight onboarding for the first steps in the Backyard. */
export function Onboarding() {
  const s = useGame((s) => s);
  const ui = useUI();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('ee-onboarding') === 'off';
    } catch {
      return false;
    }
  });
  if (hidden || ui.screen !== 'map' || s.maps.neighborhood || s.prestige.resets > 0) return null;
  const by = s.maps.backyard!;
  const gens = Object.values(by.buildings).filter((b) => b.def !== 'house').length;
  const steps = [
    { done: gens > 0, text: 'Build a Rooftop PV Array on your land (Build tab → click a tile).' },
    { done: by.gridLevel > 0, text: 'Upgrade to a Net-metering connection (Map tab) to sell surplus.' },
    { done: by.owned.reduce((a, b) => a + b, 0) > 16, text: 'Buy adjacent land (Land mode) to expand.' },
    { done: workerCount(s) > 0, text: 'Hire a technician (Workforce) so repairs happen automatically.' },
    { done: Object.keys(s.research.done).length > 0, text: 'Start a research project (Research).' },
    { done: installedStorage(s) > 0, text: 'Research Home Batteries and store midday surplus for the evening.' },
    { done: !!s.maps.neighborhood, text: 'Meet the milestones and expand to the Neighborhood (Progression).' },
  ];
  return (
    <div className="absolute right-2 bottom-2 z-10 panel p-2.5 w-[300px] max-w-[calc(100%-1rem)] text-[0.88em] shadow-xl" data-testid="onboarding">
      <div className="flex justify-between items-center mb-1">
        <b>Getting started</b>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHidden(true); try { localStorage.setItem('ee-onboarding', 'off'); } catch { /* ignore */ } }} aria-label="Hide getting started"><X size={12} /></button>
      </div>
      {steps.map((x) => (
        <div key={x.text} className="flex gap-1.5 items-start py-0.5">
          {x.done ? <CheckCircle2 size={14} className="text-green-400 shrink-0 mt-0.5" /> : <Circle size={14} className="muted shrink-0 mt-0.5" />}
          <span className={x.done ? 'muted line-through' : ''}>{x.text}</span>
        </div>
      ))}
    </div>
  );
}

/** Non-blocking decision card for a pending business event; the "no" option applies when time runs out. */
export function IncidentPrompt() {
  const f = useFmt();
  const s = useGame((s) => s);
  const i = s.incidents.pending;
  if (!i) return null;
  const d = INCIDENTS[i.kind];
  return (
    <div className="fixed bottom-16 right-2 z-40 panel p-3 w-[min(380px,calc(100vw-1rem))] shadow-2xl border-l-4 border-l-yellow-500" role="dialog" aria-label={d.name} data-testid="incident">
      <div className="font-semibold">{d.name} · {STAGES[i.map].name}</div>
      <p className="text-[0.9em] my-1">{incidentText(i)}</p>
      <p className="muted text-[0.82em] num">Decide within {f.dur(Math.max(0, i.expiresAt - s.time))} — otherwise “{d.no}” applies.</p>
      <div className="flex gap-2 mt-2">
        <button className="btn btn-sm btn-primary" disabled={s.money < i.cost} onClick={() => cmd({ type: 'resolveIncident', accept: true })} data-testid="incident-yes">{d.yes}{i.cost > 0 ? ` · ${f.money(i.cost)}` : ''}</button>
        <button className="btn btn-sm" onClick={() => cmd({ type: 'resolveIncident', accept: false })} data-testid="incident-no">{d.no}</button>
      </div>
    </div>
  );
}
