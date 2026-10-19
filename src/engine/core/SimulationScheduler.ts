import { TIME } from '../data/balance';
import type { GameEngine } from './GameEngine';

/**
 * Fixed-timestep driver for the browser. Real time accumulates and is consumed in fixed ticks,
 * independent of frame rate. Large gaps (tab hidden, laptop asleep) are reconciled with the
 * offline simulator instead of thousands of catch-up ticks. A hidden tab doesn't simulate at all:
 * browsers throttle its timers to ~1/min, which used to turn one long absence into many 1-minute
 * offline chunks (each overwriting the summary). Wall-clock time (Date.now) is used because the
 * monotonic clock may stop while the machine sleeps.
 */
export class SimulationScheduler {
  private acc = 0;
  private last = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private catchingUp = false;
  /** Real ms per tick at 1× speed. */
  readonly tickMs = (TIME.tickH / TIME.gameHoursPerRealSecond) * 1000;
  lastFrameMs = 0;

  constructor(private engine: GameEngine) {}

  start() {
    if (this.timer) return;
    this.last = Date.now();
    this.timer = setInterval(() => this.loop(), 50);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private loop() {
    if (this.catchingUp) return;
    // hidden: keep `last` so the whole absence is reconciled once, when the tab is visible again
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const now = Date.now();
    const gap = now - this.last;
    this.last = now;
    const s = this.engine.state;
    if (gap > 15_000) {
      // came back from a hidden tab / sleep: reconcile as offline time (capped, with summary)
      this.acc = 0;
      if (s.paused) return;
      this.catchingUp = true;
      void this.engine.simulateOfflineAsync(gap / 1000).finally(() => {
        this.catchingUp = false;
        this.last = Date.now();
      });
      return;
    }
    // real play time: only while the tab is visible (a hidden tab still ticks, throttled)
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      s.lifetime.realH += gap / 3.6e6;
      s.run.realH += gap / 3.6e6;
    }
    if (s.paused) {
      this.acc = 0;
      s.savedAt = Date.now();
      return;
    }
    this.acc += gap * s.speed;
    let steps = 0;
    const t0 = performance.now();
    while (this.acc >= this.tickMs && steps < 40) {
      this.engine.tick();
      this.acc -= this.tickMs;
      steps++;
    }
    if (this.acc > this.tickMs * 40) this.acc = 0; // never spiral
    if (steps) {
      s.savedAt = Date.now();
      this.lastFrameMs = performance.now() - t0;
      this.engine.emit(true);
    }
  }
}
