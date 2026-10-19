import { formatNumber, type NumberFormat } from './LargeNumber';

/**
 * Internal units: power in kW, energy in kWh, time in game hours, money in $.
 * energy_kWh = power_kW × duration_h.
 */
const POWER_UNITS = ['W', 'kW', 'MW', 'GW', 'TW', 'PW', 'EW', 'ZW', 'YW', 'RW', 'QW'];

function scaled(kw: number, suffix: string, fmt: NumberFormat): string {
  const w = Math.abs(kw) * 1000;
  if (w === 0) return `0 ${POWER_UNITS[1]}${suffix}`;
  // scientific: 1.23e7 W · engineering: exponent a multiple of 3, 12.3e6 W · short: SI prefixes, 12.3 MW
  if ((fmt === 'scientific' || fmt === 'engineering') && w >= 1e6) return `${kw < 0 ? '-' : ''}${formatNumber(w, fmt)} W${suffix}`;
  let tier = Math.floor(Math.log10(w) / 3 + 1e-12);
  if (w / 10 ** (tier * 3) >= 999.995) tier++;
  tier = Math.max(0, Math.min(POWER_UNITS.length - 1, tier));
  const v = w / 10 ** (tier * 3);
  const str = tier === POWER_UNITS.length - 1 && v >= 1000 ? formatNumber(v, 'scientific') : v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return `${kw < 0 ? '-' : ''}${str} ${POWER_UNITS[tier]}${suffix}`;
}

export const formatPower = (kw: number, fmt: NumberFormat = 'short') => scaled(kw, '', fmt);
export const formatEnergy = (kwh: number, fmt: NumberFormat = 'short') => scaled(kwh, 'h', fmt);

export function kwhFromPower(kw: number, hours: number): number {
  return kw * hours;
}

/** Price per kWh rendered in the most readable energy unit, e.g. "$0.42/kWh" or "$12/TWh". */
export function formatPrice(perKWh: number): string {
  const units: [string, number][] = [['kWh', 1], ['MWh', 1e3], ['GWh', 1e6], ['TWh', 1e9], ['PWh', 1e12], ['EWh', 1e15], ['ZWh', 1e18], ['YWh', 1e21], ['RWh', 1e24], ['QWh', 1e27]];
  for (const [u, f] of units) {
    const v = perKWh * f;
    if (v >= 0.01 || u === 'QWh') return `$${formatNumber(v)}/${u}`;
  }
  return `$${perKWh}/kWh`;
}
