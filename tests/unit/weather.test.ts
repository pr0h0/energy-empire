import { describe, expect, it } from 'vitest';
import { envAt, nextWeather, weatherAt, WEATHER } from '../../src/engine/systems/WeatherSystem';
import { createMap } from '../../src/engine/world/MapManager';
import { solarFactor } from '../../src/engine/core/GameClock';
import { engine } from '../helpers';

describe('weather events', () => {
  const m = createMap('country', 7, 0);
  const scan = () => {
    const found: Record<string, number> = {};
    for (let t = 0; t < 24 * 400; t += 1) {
      const ev = weatherAt(m, t);
      if (ev && found[ev.kind] === undefined) found[ev.kind] = t;
    }
    return found;
  };
  it('all three kinds occur, deterministically, and never in the first days', () => {
    const f = scan();
    expect(Object.keys(f).sort()).toEqual(['drought', 'heatwave', 'storm']);
    expect(scan()).toEqual(f);
    for (let t = 0; t < 96; t++) expect(weatherAt(m, t)).toBeNull();
  });
  it('a storm cuts solar and wind and is announced ahead', () => {
    const t = scan().storm;
    const e = envAt(m, t + 0.5);
    expect(e.windOut).toBe(WEATHER.storm.wind);
    expect(e.solar).toBeCloseTo(solarFactor(t + 0.5) * WEATHER.storm.solar);
    const ev = weatherAt(m, t)!;
    expect(nextWeather(m, ev.start - 6, 12)?.start).toBe(ev.start);
  });
  it('space maps have no weather; warnings reach notifications', () => {
    expect(weatherAt(createMap('solar', 7, 0), 5000)).toBeNull();
    const e = engine(7);
    for (let k = 0; k < 24 * 40 * 4; k++) e.tick();
    const wx = e.state.notifications.filter((n) => n.category === 'weather').length;
    expect(wx).toBeGreaterThan(0);
    expect(wx).toBeLessThanOrEqual(10); // once per event: at most one event per 4-day block
  });
});

describe('production forecast', () => {
  it('matches what the simulation later makes available from solar and wind', async () => {
    const { forecast } = await import('../../src/engine/systems/ElectricitySystem');
    const { place, research } = await import('../helpers');
    const e = engine(3);
    const s = e.state;
    s.money = 1e6;
    research(s, 'wind_1');
    const ids = [place(e, 'backyard', 'pv_rooftop'), place(e, 'backyard', 'wind_residential')];
    const m = s.maps.backyard!;
    const t0 = s.time;
    for (const id of ids) m.buildings[id].condition = 1;
    const fc = forecast(s, m, 30, 1 / 48); // ticks simulate at their midpoint (t + dt/2)
    for (let k = 0; k < 30 * 24; k++) {
      const t = s.time;
      for (const id of ids) m.buildings[id].condition = 1; // wear is the one thing the forecast does not model
      e.tick(1 / 24);
      const p = fc.find((x) => Math.abs(x.t - (t + 1 / 48)) < 1e-6)!;
      const avail = ids.reduce((a, id) => a + m.buildings[id].available, 0);
      expect(Math.abs(p.solar + p.wind - avail)).toBeLessThanOrEqual(avail * 1e-3 + 1e-9); // float drift in accumulated time only
    }
    expect(s.time).toBeGreaterThan(t0);
  });
});
