import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { cmd, engine, saveNow, saves, scheduler } from './app/game';
import { useUI } from './app/stores/uiStore';
import { newGame } from './engine/core/NewGame';
import { notify } from './engine/core/GameEvents';
import { exportSave, importSave } from './engine/persistence/SaveManager';
import { createMap } from './engine/world/MapManager';
import type { StageId } from './engine/data/types';

async function boot() {
  let loadedSlot: string | null = null;
  try {
    const r = await saves.load();
    if (r) {
      engine.replaceState(r.state);
      loadedSlot = r.slot;
      if (r.slot !== 'primary') notify(engine.state, 'recovered', 'warning', 'save', `Primary save was unreadable — recovered from ${r.slot}.`);
    } else engine.replaceState(newGame());
  } catch (e) {
    engine.replaceState(newGame());
    notify(engine.state, 'loadfail', 'critical', 'save', `Could not load any save (${(e as Error).message}). A new game was started; use Settings → Import to restore an exported save.`);
  }
  if (loadedSlot) {
    const away = (Date.now() - engine.state.savedAt) / 1000;
    if (away > 5) {
      const el = document.getElementById('boot');
      await engine.simulateOfflineAsync(away, (f) => {
        if (el) el.textContent = `Catching up on offline progress… ${Math.round(f * 100)}%`;
      });
      el?.remove();
    }
  }
  engine.subscribe((fromTick) => useUI.getState().bump(fromTick));
  scheduler.start();
  setInterval(() => saveNow(), 20_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && saveNow());
  window.addEventListener('pagehide', () => saveNow());
  // test / debug hooks (only with ?debug in the URL)
  if (new URLSearchParams(location.search).has('debug')) {
    const dev = {
      unlock: (stage: StageId) => {
        engine.state.maps[stage] ??= createMap(stage, engine.state.seed, engine.state.time);
        engine.emit();
      },
      money: (n: number) => {
        engine.state.money = n;
        engine.emit();
      },
      research: (...ids: string[]) => {
        for (const id of ids) engine.state.research.done[id] = engine.state.time;
        engine.emit();
      },
      ownAll: (stage: StageId) => {
        const m = engine.state.maps[stage];
        if (m) m.owned = m.owned.map(() => 1);
        engine.emit();
      },
    };
    Object.assign(window, { __ee: { engine, cmd, saveNow, saves, exportSave, importSave, newGame, scheduler, ui: useUI, dev } });
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot();
