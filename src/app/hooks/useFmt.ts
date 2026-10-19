import { useGame } from './useGame';
import { formatMoney, formatNumber, formatPercent, formatDuration } from '../../engine/math/LargeNumber';
import { formatEnergy, formatPower, formatPrice } from '../../engine/math/EnergyUnits';

/** Number formatters honouring the player's notation preference. */
export function useFmt() {
  const f = useGame((s) => s.settings.numberFormat);
  return {
    money: (n: number) => formatMoney(n, f),
    num: (n: number) => formatNumber(n, f),
    kw: (n: number) => formatPower(n, f),
    kwh: (n: number) => formatEnergy(n, f),
    pct: (n: number, d = 0) => formatPercent(n, d),
    dur: formatDuration,
    price: formatPrice,
    rate: (n: number) => `${formatMoney(n, f)}/h`,
  };
}
