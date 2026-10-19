import type { StageId } from '../data/types';
import type { GameState, NotificationEntry } from './State';

const MAX = 250;

/**
 * Push a notification. `key` + `cooldownH` throttle repeated events so the log stays useful.
 * Verbosity filtering happens in the UI (all/important/critical) — history keeps everything.
 */
export function notify(s: GameState, key: string, level: NotificationEntry['level'], category: string, text: string, map?: StageId, cooldownH = 0) {
  const last = s.lastEvents[key];
  if (cooldownH > 0 && last !== undefined && s.time - last < cooldownH) return;
  s.lastEvents[key] = s.time;
  s.notifications.push({ id: s.nextId++, t: s.time, level, category, text, map });
  if (s.notifications.length > MAX) s.notifications.splice(0, s.notifications.length - MAX);
}
