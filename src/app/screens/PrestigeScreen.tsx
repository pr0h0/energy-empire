import { useState } from 'react';
import { PRESTIGE_LIST, prestigeCost } from '../../engine/data/prestige';
import { entitledPoints, revenueForPoints } from '../../engine/math/PrestigeFormulas';
import { PRESTIGE_CONFIRM, prestigePreview } from '../../engine/systems/PrestigeSystem';
import { cmd } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { Card, Chip, Modal, Row, Stat } from '../components/ui';
import { CHALLENGE_IDS, CHALLENGES, type ChallengeId } from '../../engine/data/goals';

export function PrestigeScreen() {
  const f = useFmt();
  const s = useGame((s) => s);
  const ui = useUI();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [next, setNext] = useState<ChallengeId | null>(null);
  const p = prestigePreview(s);
  const nextAt = revenueForPoints(entitledPoints(s.prestige.lifetimeRevenue) + 1);
  return (
    <div className="p-3 flex flex-col gap-3" data-testid="prestige-screen">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="Lifetime electricity sales" value={f.money(p.lifetimeRevenue)} />
        <Stat label="Entitled points" value={p.entitled} />
        <Stat label="Previously awarded" value={p.awarded} />
        <Stat label="Claimable now" value={p.claimable} tone={p.claimable > 0 ? 'good' : undefined} />
        <Stat label="Available to spend" value={s.prestige.available} sub={`spent ${s.prestige.spent} · resets ${s.prestige.resets}`} />
      </div>
      <p className="muted">Points = ⌊(lifetime sales revenue ÷ 100 000)^0.25⌋. Only electricity <b>sales</b> count (not bill savings, not cash on hand). Points already awarded are never paid again; spending them does not lower the high-water mark. Next point at {f.money(nextAt)} lifetime sales.</p>
      <button className="btn btn-primary self-start" disabled={p.claimable <= 0} onClick={() => setOpen(true)} data-testid="prestige-open">Prestige: claim {p.claimable + p.bonus} points…</button>
      <Card title="Challenge runs">
        <p className="muted mb-2">Pick an optional challenge for your next run. Finishing a challenge run pays extra prestige points on top of the normal amount.</p>
        <p className="mb-2">This run: {s.challenge ? <b data-testid="active-challenge">{CHALLENGES[s.challenge].name}</b> : 'no challenge'}{p.bonus > 0 && <span className="text-green-400"> (+{p.bonus} bonus points if you prestige now)</span>}</p>
        <div className="grid gap-2 grid-cols-1 md:grid-cols-2 2xl:grid-cols-4" role="radiogroup" aria-label="Challenge for the next run">
          {[null, ...CHALLENGE_IDS].map((id) => (
            <button key={id ?? 'none'} role="radio" aria-checked={next === id} className={`panel2 p-2 text-left ${next === id ? 'border-[var(--accent)]' : ''}`} onClick={() => setNext(id)} data-testid={`challenge-${id ?? 'none'}`}>
              <div className="flex justify-between gap-2 font-semibold"><span>{id ? CHALLENGES[id].name : 'No challenge'}</span>{id && <Chip>+{Math.round(CHALLENGES[id].bonus * 100)}% points</Chip>}</div>
              <div className="muted text-[0.88em]">{id ? CHALLENGES[id].desc : 'A normal run.'}</div>
            </button>
          ))}
        </div>
      </Card>
      <Card title="Prestige shop">
        <div className="grid gap-2 grid-cols-1 md:grid-cols-2 2xl:grid-cols-3">
          {PRESTIGE_LIST.map((u) => {
            const lvl = s.prestige.upgrades[u.id] ?? 0;
            const max = lvl >= u.maxLevel;
            const cost = prestigeCost(u.id, lvl);
            return (
              <div key={u.id} className="panel2 p-2 flex flex-col gap-1" data-testid={`pshop-${u.id}`}>
                <div className="flex justify-between gap-2"><span className="font-semibold">{u.name}</span><Chip>{u.category}</Chip></div>
                <div className="muted text-[0.88em]">{u.desc}</div>
                <div className="flex justify-between items-center">
                  <span className="num muted">Level {lvl}/{u.maxLevel}</span>
                  <button className="btn btn-sm btn-primary" disabled={max || s.prestige.available < cost} onClick={() => cmd({ type: 'buyPrestige', id: u.id }, `${u.name} purchased.`)} data-testid={`pbuy-${u.id}`}>{max ? 'Max' : `${cost} pts`}</button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      {open && (
        <Modal title="Confirm prestige reset" onClose={() => setOpen(false)} wide footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-danger" disabled={typed !== PRESTIGE_CONFIRM} data-testid="prestige-confirm" onClick={() => { const r = cmd({ type: 'prestige', confirm: typed, challenge: next }); if (r.ok) { setOpen(false); setTyped(''); ui.setMap('backyard'); ui.setScreen('map'); ui.toast(`Prestige complete: +${r.data} points.`, 'success'); } }}>Reset and claim {p.claimable} points</button>
          </>
        }>
          <div className="grid grid-cols-2 gap-x-6">
            <Row k="Lifetime electricity sales" v={f.money(p.lifetimeRevenue)} />
            <Row k="Entitled points" v={p.entitled} />
            <Row k="Previously awarded" v={p.awarded} />
            <Row k="New points" v={<b className="text-green-400">+{p.claimable}{p.bonus > 0 && ` + ${p.bonus} challenge bonus`}</b>} />
            <Row k="Next run's challenge" v={next ? CHALLENGES[next].name : 'none'} />
            <Row k="Available afterwards" v={p.availableAfter} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div><h4 className="font-semibold text-red-300">Lost</h4><ul className="list-disc pl-5">{p.lost.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div><h4 className="font-semibold text-green-300">Kept</h4><ul className="list-disc pl-5">{p.kept.map((x) => <li key={x}>{x}</li>)}</ul></div>
          </div>
          <label className="block mt-3">Type <span className="kbd">{PRESTIGE_CONFIRM}</span> to confirm:
            <input className="input w-full mt-1" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Confirmation phrase" data-testid="prestige-typed" />
          </label>
        </Modal>
      )}
    </div>
  );
}
