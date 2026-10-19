import { create } from 'zustand';
import type { StageId } from '../../engine/data/types';

export type Screen =
  | 'map' | 'research' | 'workforce' | 'operations' | 'automation' | 'fuel' | 'market' | 'thermal' | 'finance' | 'stats' | 'progress' | 'blueprints' | 'prestige' | 'achievements' | 'settings' | 'help' | 'shortcuts';

export type Mode = { kind: 'select' } | { kind: 'build'; def: string; rot: 0 | 1 } | { kind: 'land' } | { kind: 'blueprint'; id: string };
export type Selection = { kind: 'building'; id: string } | { kind: 'tile'; i: number } | null;

/** A pending "open this item" request from a prerequisite link; `n` makes repeat clicks distinct. */
export type Focus = { kind: 'research' | 'building'; id: string; n: number };

export type WeatherLayer = 'off' | 'wind' | 'solar' | 'hydro';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'error';
}

interface UIState {
  /** Bumped (at most once per frame) when the simulation changes. */
  version: number;
  map: StageId;
  screen: Screen;
  mode: Mode;
  selected: Selection;
  sidebar: boolean;
  events: boolean;
  legend: boolean;
  toasts: Toast[];
  fullscreen: boolean;
  seenAlerts: number;
  focus: Focus | null;
  /** Map weather layer (view only). */
  weatherLayer: WeatherLayer;
  /** `soft` (simulation ticks) re-renders at most ~4×/s; other changes on the next frame. */
  bump: (soft?: boolean) => void;
  setMap: (m: StageId) => void;
  setScreen: (s: Screen) => void;
  setMode: (m: Mode) => void;
  select: (s: Selection) => void;
  set: (p: Partial<UIState>) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
}

let toastId = 1;
let raf = 0;
let softTimer = 0;
let lastBump = 0;
const SOFT_MS = 250;

const initial = (() => {
  try {
    const v = JSON.parse(localStorage.getItem('ee-ui') ?? '{}');
    return { map: (v.map as StageId) ?? 'backyard', sidebar: v.sidebar ?? (typeof window === 'undefined' || window.innerWidth >= 1024) };
  } catch {
    return { map: 'backyard' as StageId, sidebar: true };
  }
})();

export const useUI = create<UIState>((set, get) => ({
  version: 0,
  map: initial.map,
  screen: 'map',
  mode: { kind: 'select' },
  selected: null,
  weatherLayer: 'off',
  sidebar: initial.sidebar,
  events: false,
  legend: false,
  toasts: [],
  fullscreen: false,
  seenAlerts: -1,
  focus: null,
  bump: (soft) => {
    if (soft) {
      // ponytail: fixed 250 ms coalescing window; make it adaptive if long screens still lag
      const wait = SOFT_MS - (performance.now() - lastBump);
      if (wait > 0) {
        softTimer ||= setTimeout(() => { softTimer = 0; get().bump(); }, wait) as unknown as number;
        return;
      }
    }
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      lastBump = performance.now();
      set({ version: get().version + 1 });
    });
  },
  setMap: (map) => {
    set({ map, selected: null, mode: { kind: 'select' } });
    persist();
  },
  setScreen: (screen) => set({ screen }),
  setMode: (mode) => set({ mode }),
  select: (selected) => set({ selected }),
  set: (p) => {
    set(p);
    persist();
  },
  toast: (text, kind = 'info') => {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-3), { id, text, kind }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 5000 : 3000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

function persist() {
  try {
    const { map, sidebar } = useUI.getState();
    localStorage.setItem('ee-ui', JSON.stringify({ map, sidebar }));
  } catch {
    /* storage unavailable — non-critical */
  }
}
