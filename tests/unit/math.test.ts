import { describe, expect, it } from 'vitest';
import { formatMoney, formatNumber, safe } from '../../src/engine/math/LargeNumber';
import { formatEnergy, formatPower, formatPrice, kwhFromPower } from '../../src/engine/math/EnergyUnits';
import { claimablePoints, entitledPoints, revenueForPoints } from '../../src/engine/math/PrestigeFormulas';
import { demandProfile, solarFactor, tidalFactor, windPower } from '../../src/engine/core/GameClock';

describe('units and formatting', () => {
  it('integrates energy as power × time', () => {
    expect(kwhFromPower(3, 2)).toBe(6);
  });
  it('formats power and energy with SI prefixes', () => {
    expect(formatPower(1.5)).toBe('1.50 kW');
    expect(formatPower(2500)).toBe('2.50 MW');
    expect(formatEnergy(3e6)).toBe('3.00 GWh');
    expect(formatPower(4e30)).toMatch(/QW|e/);
    expect(formatPrice(0.25)).toBe('$0.250/kWh');
    expect(formatPrice(2e-17)).toMatch(/\/(ZWh|YWh|EWh|PWh)/);
  });
  it('formats money compactly and safely', () => {
    expect(formatMoney(1234)).toBe('$1.23K');
    expect(formatMoney(-5)).toBe('-$5.00');
    expect(formatMoney(1e9)).toBe('$1.00B');
    expect(formatMoney(999_999)).toBe('$1.00M');
    expect(formatPower(1e6)).toBe('1.00 GW');
    expect(formatNumber(1e40, 'scientific')).toMatch(/e40/);
    // the three formats are visibly different
    expect([formatNumber(12.3e6, 'short'), formatNumber(12.3e6, 'scientific'), formatNumber(12.3e6, 'engineering')]).toEqual(['12.3M', '1.23e7', '12.3e6']);
    expect([formatPower(12.3e3, 'short'), formatPower(12.3e3, 'scientific'), formatPower(12.3e3, 'engineering')]).toEqual(['12.3 MW', '1.23e7 W', '12.3e6 W']);
    expect(safe(NaN, 7)).toBe(7);
  });
});

describe('prestige formula', () => {
  it('uses the fourth root of lifetime revenue / 100k', () => {
    expect(entitledPoints(0)).toBe(0);
    expect(entitledPoints(1e5)).toBe(1);
    expect(entitledPoints(1.6e6)).toBe(2);
    expect(entitledPoints(1e9)).toBe(10);
  });
  it('is stable at astronomical values (log space)', () => {
    expect(entitledPoints(1e300) / 10 ** 73.75).toBeCloseTo(1, 6);
    expect(Number.isFinite(entitledPoints(1e300))).toBe(true);
  });
  it('high-water mark: claimable = entitled − awarded, never negative', () => {
    expect(claimablePoints(1e9, 4)).toBe(6);
    expect(claimablePoints(1e9, 50)).toBe(0);
  });
  it('inverse gives the revenue needed for a point', () => {
    expect(entitledPoints(revenueForPoints(7))).toBe(7);
  });
});

describe('environment curves', () => {
  it('solar is zero at night and positive at noon', () => {
    expect(solarFactor(0)).toBe(0);
    expect(solarFactor(12)).toBeGreaterThan(0.8);
  });
  it('wind power curve has cut-in, rated region and cut-out', () => {
    expect(windPower(0.2)).toBe(0);
    expect(windPower(0.75)).toBeGreaterThan(0);
    expect(windPower(1.5)).toBe(1);
    expect(windPower(3)).toBe(0);
  });
  it('demand profiles have a daily mean of 1', () => {
    for (const c of ['household', 'residential', 'commercial', 'industrial', 'infrastructure', 'advanced']) {
      let s = 0;
      for (let i = 0; i < 480; i++) s += demandProfile(c, i / 20);
      expect(s / 480).toBeCloseTo(1, 2);
    }
  });
  it('tides are periodic (12.42 h)', () => {
    expect(tidalFactor(3)).toBeCloseTo(tidalFactor(3 + 12.42), 1);
  });
});
