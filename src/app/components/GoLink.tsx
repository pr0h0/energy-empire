import type { ReactNode } from 'react';
import { BUILDINGS } from '../../engine/data/buildings';
import { RESEARCH } from '../../engine/data/research';
import { STAGES } from '../../engine/data/stages';
import { isBuildingUnlocked } from '../../engine/core/Modifiers';
import { engine } from '../game';
import { useUI, type Focus } from '../stores/uiStore';

/** Open a research project (Research screen) or a building (map catalog, armed for placement when unlocked). */
export function goto(kind: Focus['kind'], id: string) {
  const ui = useUI.getState();
  const focus = { kind, id, n: Date.now() };
  if (kind === 'research') return useUI.setState({ screen: 'research', focus });
  const d = BUILDINGS[id];
  const s = engine.state;
  const map = d.stages.includes(ui.map) ? ui.map : [...d.stages].reverse().find((st) => s.maps[st]);
  if (!map) return ui.toast(`${d.name} is built on the ${d.stages.map((st) => STAGES[st].name).join(' / ')} map, which is not unlocked yet.`);
  if (map !== ui.map) ui.setMap(map);
  ui.set({ sidebar: true });
  useUI.setState({ screen: 'map', selected: null, mode: isBuildingUnlocked(s, id) ? { kind: 'build', def: id, rot: 0 } : { kind: 'select' }, focus });
}

export function GoLink({ kind, id, children }: { kind: Focus['kind']; id: string; children?: ReactNode }) {
  const name = kind === 'research' ? RESEARCH[id]?.name : BUILDINGS[id]?.name;
  return (
    <button type="button" className="link" onClick={(e) => { e.stopPropagation(); goto(kind, id); }} data-tip={`Open ${name ?? id}`} data-testid={`goto-${kind}-${id}`}>
      {children ?? name ?? id}
    </button>
  );
}

/** Scroll a freshly focused item into view and flash it. */
export function revealFocus(selector: string) {
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1600);
  }, 30);
}
