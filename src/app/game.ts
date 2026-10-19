import { GameEngine } from '../engine/core/GameEngine';
import type { Command, CommandResult } from '../engine/core/Commands';
import { SimulationScheduler } from '../engine/core/SimulationScheduler';
import { SaveManager } from '../engine/persistence/SaveManager';
import { useUI } from './stores/uiStore';

/** Singletons shared by the UI. The engine is authoritative; UI only reads and sends commands. */
export const engine = new GameEngine();
export const scheduler = new SimulationScheduler(engine);
export const saves = new SaveManager();

export function cmd(c: Command, okMessage?: string): CommandResult {
  const r = engine.dispatch(c);
  // re-render immediately so controlled inputs reflect the new state without waiting a frame
  useUI.setState((u) => ({ version: u.version + 1 }));
  if (!r.ok && r.error) useUI.getState().toast(r.error, 'error');
  else if (r.ok && okMessage) useUI.getState().toast(okMessage, 'success');
  return r;
}

export async function saveNow(manual = false) {
  try {
    await saves.save(engine.state);
    if (manual) useUI.getState().toast('Game saved.', 'success');
  } catch (e) {
    useUI.getState().toast(`Save failed: ${(e as Error).message}`, 'error');
  }
}
