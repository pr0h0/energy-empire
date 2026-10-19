import { describe, expect, it } from 'vitest';
import { ART_IDS, batterySVG, buildingSVG, FRAMES, hasLevelArt, isAnimatedArt, isAnimatedTerrain, terrainSVG } from '../../src/rendering/SVGAssets';
import { BUILDINGS } from '../../src/engine/data/buildings';

describe('animated art', () => {
  it('every building art resolves to an svg and animated art has distinct frames', () => {
    for (const d of Object.values(BUILDINGS)) expect(ART_IDS).toContain(d.art);
    const animated = ART_IDS.filter(isAnimatedArt);
    expect(animated).toEqual(expect.arrayContaining(['wind', 'wind_farm', 'diesel', 'coal', 'waterwheel', 'dam']));
    for (const a of animated) {
      const frames = Array.from({ length: FRAMES }, (_, f) => buildingSVG(a, f));
      expect(new Set(frames).size, a).toBe(FRAMES);
      for (const svg of frames) expect(svg).toMatch(/^<svg[^]*<\/svg>$/);
      expect(frames.join('')).not.toMatch(/NaN|undefined/);
    }
  });
  it('water terrain animates, land does not', () => {
    expect(isAnimatedTerrain('river')).toBe(true);
    expect(isAnimatedTerrain('grass')).toBe(false);
    expect(terrainSVG('river', '#00f', 1)).not.toBe(terrainSVG('river', '#00f', 0));
    expect(terrainSVG('grass', '#0f0', 1)).toBe(terrainSVG('grass', '#0f0', 0));
  });
});

describe('battery level art', () => {
  it('fill height tracks the level and colour is part of the art', () => {
    const empty = batterySVG('battery', 0, '#22c55e'), full = batterySVG('battery', 1, '#22c55e');
    expect(empty).not.toContain('#22c55e');
    expect(full).toContain('#22c55e');
    expect(batterySVG('battery', 0.5, '#ef4444')).toContain('#ef4444');
    expect(hasLevelArt('battery_big')).toBe(true);
    expect(hasLevelArt('pumped')).toBe(false);
  });
});
