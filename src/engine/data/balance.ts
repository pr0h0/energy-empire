/**
 * Central balance configuration. Every tunable coefficient that is not a property of a
 * specific definition lives here. See docs/BALANCE.md for rationale.
 */
export const TIME = {
  /** 1 real second = 10 game minutes → a game day lasts 2.4 real minutes. */
  gameHoursPerRealSecond: 10 / 60,
  /** Fixed logical step: 2.5 game minutes (4 ticks per real second at 1×). */
  tickH: 1 / 24,
  /** Coarser step used for offline reconciliation. */
  offlineStepH: 0.5,
  offlineCapRealH: 12,
  offlineExtendedCapRealH: 48,
  maxSpeed: 3,
  hoursPerDay: 24,
  daysPerYear: 120,
};

export const PRESTIGE_FORMULA = { divisor: 1e5, exponent: 0.25 };

export const BALANCE = {
  startMoney: 60,
  /** Fraction of a tile's area usable after access roads, setbacks and infrastructure. */
  usableArea: 0.85,
  /** Fleet cost = unitCost × units^bulkExponent (economies of scale). */
  bulkExponent: 0.97,
  /** Reference capacity factors used to derive costs from payback targets. */
  cfRef: { solar: 0.3, wind: 0.32, hydro: 0.6, dam: 0.5, tidal: 0.4, thermal: 0.75, csp: 0.45, geothermal: 0.9, orbital: 0.9, stellar: 0.9, dyson: 0.85, pulsar: 0.5, penrose: 0.9, constant: 0.9 } as Record<string, number>,
  /**
   * Payback multiplier by native stage applied to every derived cost: early stages pay back in a
   * few real minutes; later stages are slower so each scale offers substantial progression.
   */
  paybackScale: { backyard: 0.38, neighborhood: 0.45, city: 0.5, country: 0.5, continent: 0.5, planet: 0.5, solar: 0.5, galaxy: 0.5, universe: 0.5 } as Record<string, number>,
  defaultRepairThreshold: 0.7,
  /** Full repair from 0% costs this fraction of invested cost (materials). */
  repairCostFrac: 0.2,
  manualRepairPremium: 1.6,
  /** Repair work (WU·h) per unit of condition restored, per maintenance-load unit. */
  repairWorkPerLoad: 60,
  /** Fixed O&M cost per hour as a fraction of invested capital. */
  omRate: 0.0004,
  /** Fuel depot capacity (kWh_th) in units of the stage KW_TILE. */
  depotBase: 2000,
  depotPerBuilding: 8000,
  /** Swarm saturation scale (kW) for Dyson diminishing returns per map. */
  dysonSaturationKW: 2e18,
  componentReplaceFrac: 0.35,
  rebuildFrac: 0.65,
  /** Max salvage as fraction of invested — guarantees buy/demolish loops lose money. */
  salvageCap: 0.8,
  landGrowth: 1.03,
  bulkLandDiscount: 0.9,
  importForShortageDefault: true,
  founderRP: 1,
  /** Founder (player) maintenance capacity on Backyard, so early repairs need no hire. */
  founderWU: 0,
  baseLogisticsSlots: 1,
  logisticsTrainingStep: 0.15,
  maintenanceTrainingStep: 0.15,
  /** Researcher / trader output per company-wide training level. */
  staffTrainingStep: 0.1,
  trainingCost: [20, 120, 700, 4000],
  /** Carbon price per kg CO2 as a fraction of the map's retail price per kWh (optional setting). */
  carbonPriceFactor: 0.6,
  historyEveryH: 1,
  historyLongEveryH: 24,
  historyMax: 288,
  reliabilityWindowH: 48,
  winEnergyKWh: 2e38,
  fuelBaseStorageH: 24,
  economicDispatchMargin: 1.05,
  spotAmplitude: 0.28,
  ppaDurationH: 24 * 20,
};
