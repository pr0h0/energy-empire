import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../../src/engine/data/buildings';
import { STAGES, STAGE_LIST } from '../../src/engine/data/stages';
import { representedUnits } from '../../src/engine/world/BuildingAggregation';
import { footprint } from '../../src/engine/world/BuildingFootprints';
import { floodArea, previewPlacement, salvageValue } from '../../src/engine/systems/ConstructionSystem';
import { landBlockReason, landPrice } from '../../src/engine/systems/LandSystem';
import { createMap } from '../../src/engine/world/MapManager';
import { neighbors4 } from '../../src/engine/world/TileGrid';
import { engine, findSpot, ownAll, place, research, unlock } from '../helpers';

describe('maps', () => {
  it('every stage generates a playable, independent map', () => {
    for (const st of STAGE_LIST) {
      const m = createMap(st.id, 123, 0);
      expect(m.terrain.length).toBe(st.w * st.h);
      expect(m.owned.reduce((a, b) => a + b, 0)).toBe(st.startOwned[2] * st.startOwned[3]);
      expect(Object.values(m.buildings).every((b) => b.def === 'house')).toBe(true);
    }
  });
  it('terrestrial maps with hydro content have rivers with downstream flow', () => {
    for (const id of ['backyard', 'neighborhood', 'city', 'country', 'continent'] as const) {
      const m = createMap(id, 99, 0);
      expect(m.riverOrder.length).toBeGreaterThan(2);
      for (const i of m.riverOrder) if (m.riverNext[i] >= 0) expect(m.riverBase[m.riverNext[i]]).toBeGreaterThanOrEqual(m.riverBase[i] - 1e-9);
    }
  });
});

describe('land', () => {
  it('only adjacent land can be bought, ownership survives demolition', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    const m = s.maps.backyard!;
    const far = m.owned.findIndex((o, i) => !o && !neighbors4(i, m.w, m.h).some((j) => m.owned[j]));
    expect(landBlockReason(s, m, far)).toMatch(/adjacent/);
    const near = m.owned.findIndex((o, i) => !o && neighbors4(i, m.w, m.h).some((j) => m.owned[j]) && !landBlockReason(s, m, i));
    expect(e.dispatch({ type: 'buyLand', map: 'backyard', x: near % m.w, y: Math.floor(near / m.w) }).ok).toBe(true);
    expect(m.owned[near]).toBe(1);
    const id = place(e, 'backyard', 'pv_rooftop');
    e.dispatch({ type: 'demolish', map: 'backyard', id });
    expect(m.owned.reduce((a, b) => a + b, 0)).toBe(17);
  });
  it('ocean/mountain tiles need research before purchase', () => {
    const e = engine(5);
    const s = e.state;
    const m = unlock(s, 'country');
    const ocean = m.terrain.findIndex((t, i) => t === 'ocean' && neighbors4(i, m.w, m.h).some((j) => m.owned[j]));
    if (ocean >= 0) expect(landBlockReason(s, m, ocean)).toMatch(/Offshore/);
    m.owned = m.owned.map((_o, i) => (m.terrain[i] === 'mountain' ? 0 : 1));
    const mt = m.terrain.findIndex((t) => t === 'mountain');
    if (mt >= 0) {
      expect(landBlockReason(s, m, mt)).toMatch(/Mountain Engineering/);
      research(s, 'materials_2');
      expect(landBlockReason(s, m, mt)).toBeNull();
    }
  });
});

describe('placement', () => {
  it('checks bounds, ownership, occupancy, terrain and money — and fails without charging', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    const m = s.maps.backyard!;
    const money = s.money;
    expect(previewPlacement(s, m, 'pv_rooftop', m.w, 0, 0).reasons.join()).toMatch(/beyond the map/);
    const far = m.owned.findIndex((o, i) => !o && !neighbors4(i, m.w, m.h).some((j) => m.owned[j]));
    expect(previewPlacement(s, m, 'pv_rooftop', far % m.w, Math.floor(far / m.w), 0).reasons.join()).toMatch(/not owned/);
    const house = Object.values(m.buildings)[0];
    expect(previewPlacement(s, m, 'pv_rooftop', house.x, house.y, 0).reasons.join()).toMatch(/occupied/);
    const r = e.dispatch({ type: 'place', map: 'backyard', def: 'waterwheel', x: house.x + 2, y: house.y, rot: 0 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/terrain/i);
    expect(s.money).toBe(money);
    s.money = 1;
    expect(e.dispatch({ type: 'place', map: 'backyard', def: 'pv_rooftop', x: house.x + 2, y: house.y, rot: 0 }).ok).toBe(false);
    expect(s.money).toBe(1);
  });
  it('locked technology cannot be built', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    const m = s.maps.backyard!;
    const [x, y] = findSpot(m, 'pv_improved')!;
    expect(previewPlacement(s, m, 'pv_improved', x, y, 0).reasons.join()).toMatch(/researched/);
    research(s, 'solar_1');
    expect(previewPlacement(s, m, 'pv_improved', x, y, 0).ok).toBe(true);
  });
  it('rotation swaps the footprint', () => {
    expect(footprint(BUILDINGS.ccgt, 0)).toEqual([2, 1]);
    expect(footprint(BUILDINGS.ccgt, 1)).toEqual([1, 2]);
  });
  it('double occupancy is impossible', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    const id = place(e, 'backyard', 'pv_rooftop');
    const b = s.maps.backyard!.buildings[id];
    expect(e.dispatch({ type: 'place', map: 'backyard', def: 'wind_micro', x: b.x, y: b.y, rot: 0 }).ok).toBe(false);
  });
});

describe('aggregation', () => {
  it('fleet size follows usable area and operating spacing, not visual footprint', () => {
    const wind = BUILDINGS.wind_utility;
    const units = representedUnits(wind, 'city', 4);
    const cell = STAGES.city.cellM ** 2;
    expect(units).toBe(Math.floor((4 * cell * 0.85) / wind.unit.areaM2));
    // a PV module needs far less spacing than a 3 MW turbine
    expect(representedUnits(BUILDINGS.pv_utility, 'city', 4)).toBeGreaterThan(units * 1000);
    // small generators become fleets on larger maps
    expect(representedUnits(BUILDINGS.pv_rooftop, 'backyard', 1)).toBe(9);
    expect(representedUnits(BUILDINGS.pv_rooftop, 'neighborhood', 1)).toBeGreaterThan(800);
    expect(representedUnits(BUILDINGS.wind_commercial, 'neighborhood', 1)).toBe(0); // too small
  });
});

describe('build on unowned land', () => {
  it('quotes adjacent land with the building, needs confirmation, then buys both', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e6;
    const m = s.maps.backyard!;
    const i = m.owned.findIndex((o, k) => !o && !m.occ[k] && BUILDINGS.pv_rooftop.terrain.includes(m.terrain[k]) && neighbors4(k, m.w, m.h).some((j) => m.owned[j]));
    const [x, y] = [i % m.w, Math.floor(i / m.w)];
    const p = previewPlacement(s, m, 'pv_rooftop', x, y, 0);
    expect(p.ok).toBe(true);
    expect(p.land!.tiles).toEqual([i]);
    expect(p.land!.cost).toBeCloseTo(landPrice(s, m, i));
    const money = s.money;
    expect(e.dispatch({ type: 'place', map: 'backyard', def: 'pv_rooftop', x, y, rot: 0 }).ok).toBe(false);
    expect(s.money).toBe(money);
    const r = e.dispatch({ type: 'place', map: 'backyard', def: 'pv_rooftop', x, y, rot: 0, buyLand: true });
    expect(r.ok).toBe(true);
    expect(m.owned[i]).toBe(1);
    expect(s.money).toBeCloseTo(money - p.cost);
    expect(m.ledger.land).toBeCloseTo(p.land!.cost);
    expect(m.buildings[r.data as string].invested).toBeCloseTo(p.cost - p.land!.cost); // salvage never refunds land
  });
});

describe('dams', () => {
  it('previews upstream flooding, floods on build, and affects eligibility', () => {
    const e = engine(11);
    const s = e.state;
    s.money = 1e12;
    const m = unlock(s, 'city');
    ownAll(m);
    research(s, 'hydro_1', 'hydro_3');
    const river = m.riverOrder.find((i) => m.riverNext[i] >= 0 && m.riverOrder.some((j) => m.riverNext[j] === i) && !m.occ[i])!;
    const fl = floodArea(s, m, BUILDINGS.small_dam, river % m.w, Math.floor(river / m.w));
    expect(fl.tiles.length).toBeGreaterThan(0);
    const r = e.dispatch({ type: 'place', map: 'city', def: 'small_dam', x: river % m.w, y: Math.floor(river / m.w), rot: 0, acceptFlood: true });
    expect(r.ok).toBe(true);
    for (const i of fl.tiles) expect(m.flooded[i]).toBe(r.data);
    const t = fl.tiles[0];
    expect(previewPlacement(s, m, 'pv_utility', t % m.w, Math.floor(t / m.w), 0).ok).toBe(false);
    // reservoir fills and the dam generates
    for (let k = 0; k < 24 * 24; k++) e.tick();
    const dam = m.buildings[r.data as string];
    expect(dam.reservoir!).toBeGreaterThan(0);
    expect(dam.energy).toBeGreaterThan(0);
    e.dispatch({ type: 'demolish', map: 'city', id: dam.id });
    expect(m.flooded.every((x) => x === null)).toBe(true);
  });
  it('flooded unowned tiles are priced into the dam and counted', () => {
    const e = engine(11);
    const s = e.state;
    s.money = 1e12;
    const m = unlock(s, 'city');
    ownAll(m);
    research(s, 'hydro_1', 'hydro_3');
    const river = m.riverOrder.find((i) => m.riverNext[i] >= 0 && m.riverOrder.some((j) => m.riverNext[j] === i) && !m.occ[i])!;
    const [x, y] = [river % m.w, Math.floor(river / m.w)];
    const owned = previewPlacement(s, m, 'small_dam', x, y, 0);
    expect(owned.flood!.unowned).toBe(0);
    for (const i of owned.flood!.tiles) m.owned[i] = 0;
    const p = previewPlacement(s, m, 'small_dam', x, y, 0);
    expect(p.flood!.unowned).toBe(owned.flood!.tiles.length);
    expect(p.flood!.landCost).toBeGreaterThan(0);
    expect(p.cost).toBeCloseTo(owned.cost + p.flood!.landCost);
  });
});

describe('salvage', () => {
  it('is always below acquisition cost, condition-dependent; nuclear decommissioning costs money', () => {
    const e = engine();
    const s = e.state;
    s.money = 1e12;
    const id = place(e, 'backyard', 'pv_rooftop');
    const b = s.maps.backyard!.buildings[id];
    expect(salvageValue(s, b)).toBeLessThan(b.invested);
    const full = salvageValue(s, b);
    b.condition = 0.2;
    expect(salvageValue(s, b)).toBeLessThan(full);
    const m = unlock(s, 'country');
    ownAll(m);
    research(s, 'nuclear_1');
    const n = place(e, 'country', 'smr');
    expect(salvageValue(s, m.buildings[n])).toBeLessThan(0);
  });
});

describe('hydro head from terrain', () => {
  it('averages ×1 over a map’s river tiles, stays in [0.75, 1.5], and steeper drops score higher', async () => {
    const { hydroHead } = await import('../../src/engine/systems/ElectricitySystem');
    const { createMap } = await import('../../src/engine/world/MapManager');
    const m = createMap('country', 11, 0);
    const hs = m.riverOrder.map((i) => hydroHead(m, i));
    expect(hs.length).toBeGreaterThan(3);
    for (const h of hs) {
      expect(h).toBeGreaterThanOrEqual(0.75);
      expect(h).toBeLessThanOrEqual(1.5);
    }
    const drop = (i: number) => (m.riverNext[i] >= 0 ? m.elev[i] - m.elev[m.riverNext[i]] : 0);
    const [a, b] = [...m.riverOrder].sort((x, y) => drop(x) - drop(y)).filter((_, k, arr) => k === 0 || k === arr.length - 1);
    expect(hydroHead(m, b)).toBeGreaterThanOrEqual(hydroHead(m, a));
    expect(new Set(hs.map((h) => h.toFixed(2))).size).toBeGreaterThan(1);
  });
});
