import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { STAGE_LIST } from '../../engine/data/stages';
import { BALANCE } from '../../engine/data/balance';
import { stageUnlockStatus } from '../../engine/systems/ProgressionSystem';
import { cmd } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { STAGE_ICON } from '../components/icons';
import { Card, Chip, Progress } from '../components/ui';

export function ProgressScreen() {
  const f = useFmt();
  const s = useGame((s) => s);
  const ui = useUI();
  return (
    <div className="p-3 flex flex-col gap-3" data-testid="progress-screen">
      <p className="muted">Each scale is a separate map that keeps running when you leave it. Expanding needs milestones <b>and</b> an expansion purchase; nothing is ever reset by expanding. Prestige is optional.</p>
      <Card title="Endgame: the Convergence Engine">
        <Progress value={s.convergence / BALANCE.winEnergyKWh} color="#a78bfa" label="Convergence progress" />
        <div className="flex justify-between text-[0.88em] num mt-1">
          <span>{f.kwh(s.convergence)} / {f.kwh(BALANCE.winEnergyKWh)} channelled</span>
          {s.won ? <Chip tone="good">Completed — sandbox mode</Chip> : <span className="muted">Research Convergence Theory on the Universe map, build the engine and feed it surplus power.</span>}
        </div>
      </Card>
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
        {STAGE_LIST.map((st) => {
          const u = stageUnlockStatus(s, st.id);
          const Icon = STAGE_ICON[st.id];
          return (
            <Card key={st.id} title={<span className="flex items-center gap-2"><Icon size={16} />{st.name}{u.unlocked ? <Chip tone="good">unlocked</Chip> : !u.prevUnlocked ? <Chip><Lock size={10} />locked</Chip> : null}</span>}>
              <p className="muted text-[0.88em]">{st.tagline} Cells: {st.cellLabel}, {st.w}×{st.h} map.</p>
              {!u.unlocked && st.unlock && (
                <>
                  <ul className="my-2">
                    {u.milestones.map((x) => (
                      <li key={x.label} className="flex items-start gap-1.5 py-0.5">
                        {x.done ? <CheckCircle2 size={14} className="text-green-400 mt-0.5 shrink-0" /> : <Circle size={14} className="muted mt-0.5 shrink-0" />}
                        <span className="flex-1">{x.label}<span className="muted num"> — {x.current}</span><Progress value={x.progress} label={x.label} /></span>
                      </li>
                    ))}
                  </ul>
                  <button className="btn btn-primary w-full" disabled={!u.canUnlock} onClick={() => { if (cmd({ type: 'unlockStage', stage: st.id }, `Expanded to ${st.name}!`).ok) { ui.setMap(st.id); ui.setScreen('map'); } }} data-testid={`unlock-${st.id}`}>
                    Expand to {st.name} · {f.money(u.cost)}
                  </button>
                </>
              )}
              {u.unlocked && <button className="btn btn-sm mt-1" onClick={() => { ui.setMap(st.id); ui.setScreen('map'); }}>Open map</button>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
