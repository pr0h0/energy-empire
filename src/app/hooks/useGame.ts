import { useUI } from '../stores/uiStore';
import { engine } from '../game';
import type { GameState } from '../../engine/core/State';

/** Read from the authoritative state; re-renders when the simulation publishes a new frame. */
export function useGame<T>(sel: (s: GameState) => T): T {
  useUI((u) => u.version);
  return sel(engine.state);
}

export function useMapState() {
  const id = useUI((u) => u.map);
  useUI((u) => u.version);
  return engine.state.maps[id] ?? engine.state.maps.backyard!;
}
