import { Lock } from 'lucide-react';
import { STAGE_LIST } from '../../engine/data/stages';
import { stageUnlockStatus } from '../../engine/systems/ProgressionSystem';
import { STAGE_ICON } from '../components/icons';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';

/** All nine scales. Unlocked maps switch instantly; locked ones explain what is needed. */
export function StageNav() {
  const ui = useUI();
  const f = useFmt();
  const s = useGame((s) => s);
  return (
    <nav className="flex lg:flex-col gap-1 p-1.5 border-[var(--border)] bg-[var(--panel)] lg:border-r border-b lg:border-b-0 overflow-x-auto lg:overflow-y-auto scroll shrink-0 lg:w-[150px] 2xl:w-[180px]" aria-label="Map scales">
      {STAGE_LIST.map((st) => {
        const m = s.maps[st.id];
        const Icon = STAGE_ICON[st.id];
        const active = ui.map === st.id && ui.screen === 'map';
        if (!m) {
          const u = stageUnlockStatus(s, st.id);
          const done = u.milestones.filter((x) => x.done).length;
          const title = `${st.name} — locked\n${u.milestones.map((x) => `${x.done ? '✓' : '•'} ${x.label} (${x.current})`).join('\n')}\nExpansion cost: ${f.money(u.cost)}`;
          return (
            <button key={st.id} className="btn btn-ghost justify-start opacity-60 shrink-0" data-tip={title} data-tip-side="right" aria-label={`${st.name} locked`} onClick={() => ui.setScreen('progress')} data-testid={`stage-${st.id}`}>
              <Lock size={14} />
              <span className="hidden lg:inline truncate">{st.name}</span>
              {u.prevUnlocked && <span className="hidden lg:inline muted num text-[0.8em] ml-auto">{done}/{u.milestones.length}</span>}
            </button>
          );
        }
        return (
          <button key={st.id} className={`btn justify-start shrink-0 ${active ? 'active' : 'btn-ghost'}`} data-tip-side="right" onClick={() => { ui.setMap(st.id); ui.setScreen('map'); }} data-tip={`${st.name}: ${st.tagline}`} data-testid={`stage-${st.id}`} aria-current={active}>
            <Icon size={15} />
            <span className="flex flex-col items-start leading-tight min-w-0">
              <span className="truncate">{st.name}</span>
              <span className="hidden lg:inline muted num text-[0.78em] truncate">{f.kw(m.flow.generation)}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
