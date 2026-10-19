import type { ChallengeId } from '../data/goals';
import type { Incident, IncidentEffect } from '../systems/IncidentSystem';
import type { DemandCategory, FuelId, StageId, TerrainId } from '../data/types';

/** Runtime game state. Fully JSON-serialisable; never holds references to definition objects. */

export type ThermalMode = 'baseload' | 'follow' | 'economic' | 'off';
export type CoolingMode = 'safe' | 'optimized';
export type StorageMode = 'self' | 'sell' | 'reserve' | 'arbitrage' | 'peak' | 'smart';
export type Priority = -1 | 0 | 1;
export type FuelAutomation = 'manual' | 'refuel' | 'full';

export interface BuildingInstance {
  id: string;
  def: string;
  x: number;
  y: number;
  /** 1 = rotated 90° (footprint w/h swapped). */
  rot: 0 | 1;
  units: number;
  condition: number;
  /** Irreversible capacity loss 0..1 (aging, cycle aging). */
  wearOut: number;
  ageH: number;
  upgrades: string[];
  enabled: boolean;
  downtimeUntil: number;
  downtimeReason?: string;
  invested: number;
  /** Electrical output last tick (kW, net). */
  output: number;
  /** Max available output last tick (kW). */
  available: number;
  /** Status explanation for UI. */
  status: string;
  // thermal
  mode?: ThermalMode;
  target?: number;
  coolingMode?: CoolingMode;
  tank?: number;
  heat?: number;
  waste?: number;
  coolingCap?: number;
  eta?: number;
  ignited?: boolean;
  ignition?: number;
  refuelPending?: boolean;
  // storage
  stored?: number;
  storageMode?: StorageMode;
  reserve?: number;
  lowPrice?: number;
  highPrice?: number;
  peakKW?: number;
  cycles?: number;
  // hydro/geo/penrose/csp state
  reservoir?: number;
  reservoirMax?: number;
  reservoirTarget?: number;
  release?: number;
  pressure?: number;
  pool?: number;
  heatStore?: number;
  inflow?: number;
  /** Fraction of an electric load that was supplied last tick. */
  supplied?: number;
  /** Storage activity (throughput / power) last tick. */
  act?: number;
  // policies
  repairThreshold?: number;
  priority?: Priority;
  // statistics
  energy: number;
  revenue: number;
  opCost: number;
  /** Rolling hourly rates (exponential average). */
  rRevenue: number;
  rCost: number;
}

export interface RepairJob {
  id: string;
  building: string;
  kind: 'repair' | 'preventive';
  work: number;
  done: number;
  waitedH: number;
  paid: boolean;
  /** Manual override from operations screen. */
  priority: Priority;
}

export interface LogisticsJob {
  id: string;
  kind: 'delivery' | 'refuel';
  fuel: FuelId;
  qty: number;
  remainingH: number;
  totalH: number;
  /** refuel target building */
  building?: string;
  auto: boolean;
}

export interface FuelPolicy {
  mode: FuelAutomation;
  /** Refill tanks below this fraction. */
  refillAt: number;
  /** Minimum depot inventory (fraction of capacity) kept by auto-purchase. */
  minInventory: number;
  /** Max spend per game day on auto purchases (≤ 0 = unlimited, still capped at 50% of cash per order). */
  budgetPerDay: number;
  spentToday: number;
  /** Only buy when price ≤ base × this. */
  maxPriceFactor: number;
  day?: number;
}

export interface MapPolicies {
  repairThreshold: number | null;
  typeThresholds: Record<string, number>;
  importForShortage: boolean;
  autoExport: boolean;
  tariff: 'fixed' | 'spot';
  fuel: Partial<Record<FuelId, FuelPolicy>>;
  defaultStorageMode: StorageMode;
}

export interface FlowStats {
  generation: number;
  demand: number;
  served: number;
  selfServed: number;
  imported: number;
  exported: number;
  curtailed: number;
  charged: number;
  discharged: number;
  unserved: number;
  sink: number;
  /** Money rates ($/h) */
  sales: number;
  /** sales split: end customers / spot export / power contracts ($/h) */
  retailRev: number;
  exportRev: number;
  contractRev: number;
  savings: number;
  importCost: number;
  fuelCost: number;
  wages: number;
  maintenance: number;
  opex: number;
  income: number;
  penalty: number;
  carbon: number;
  emissions: number;
}

export type Ledger = Record<LedgerKey, number>;
export type LedgerKey =
  | 'sales' | 'savings' | 'income' | 'importCost' | 'fuel' | 'wages' | 'maintenance' | 'repairs' | 'land' | 'research' | 'construction'
  | 'infrastructure' | 'salvage' | 'opex' | 'hiring' | 'penalties' | 'carbon' | 'upgrades' | 'other';

export interface MapState {
  id: StageId;
  w: number;
  h: number;
  seed: number;
  terrain: TerrainId[];
  /** 0..1 */
  elev: number[];
  owned: number[];
  occ: (string | null)[];
  /** Dam id that floods the tile, or null. */
  flooded: (string | null)[];
  /** Base river flow m³/s at tile (0 = no river). */
  riverBase: number[];
  /** Index of the downstream river tile or -1. */
  riverNext: number[];
  /** Upstream→downstream processing order of river tiles. */
  riverOrder: number[];
  /** Current river flow m³/s (after dams). */
  riverFlow: number[];
  /** Special tile resource (geothermal heat, star class...) 0..1 */
  resource: number[];
  buildings: Record<string, BuildingInstance>;
  gridLevel: number;
  fuel: Partial<Record<FuelId, number>>;
  contracts: string[];
  workforce: Record<string, number>;
  training: { maintenance: number; logistics: number };
  repairJobs: RepairJob[];
  logisticsJobs: LogisticsJob[];
  policies: MapPolicies;
  flow: FlowStats;
  reliability: number;
  totals: { produced: number; sold: number; revenue: number; expenses: number };
  ledger: Ledger;
  lastExportCapped: boolean;
  unlockedAt: number;
  /** Streaks for per-map goals (hours). */
  goalTrack: { noImportH: number; cleanH: number };
}

export interface ResearchState {
  done: Record<string, number>;
  progress: Record<string, number>;
  /** Allocation weights (percent) for active projects. */
  active: Record<string, number>;
  paid: Record<string, boolean>;
  startedAt: Record<string, number>;
  /** Completed levels of repeatable research. */
  levels: Record<string, number>;
}

export interface PrestigeState {
  /** Lifetime electricity sales revenue across every run (prestige basis). */
  lifetimeRevenue: number;
  awarded: number;
  available: number;
  spent: number;
  resets: number;
  upgrades: Record<string, number>;
}

export interface SupplyContract {
  id: string;
  kind: 'fuel' | 'power';
  map: StageId;
  fuel?: FuelId;
  /** fuel: fixed price per unit. power: price per kWh. */
  price: number;
  /** power: committed kW. fuel: units per day delivered */
  amount: number;
  endsAt: number;
  delivered: number;
  shortfall: number;
}

export interface NotificationEntry {
  id: number;
  t: number;
  level: 'info' | 'success' | 'warning' | 'critical';
  category: string;
  text: string;
  map?: StageId;
}

export interface Blueprint {
  id: string;
  name: string;
  stage: StageId;
  createdAt: number;
  version: number;
  w: number;
  h: number;
  items: BlueprintItem[];
}

export interface BlueprintItem {
  def: string;
  dx: number;
  dy: number;
  rot: 0 | 1;
  upgrades: string[];
  mode?: ThermalMode;
  storageMode?: StorageMode;
  repairThreshold?: number;
  priority?: Priority;
}

export interface HistorySample {
  t: number;
  money: number;
  net: number;
  generation: number;
  demand: number;
  exported: number;
  imported: number;
  rp: number;
  /** Sales revenue rate ($/h) across maps (absent in old saves). */
  sales?: number;
  /** Demand-weighted reliability across maps. */
  reliability?: number;
  /** Generation (kW) by technology group. */
  mix?: Partial<Record<MixGroup, number>>;
}

export type MixGroup = 'solar' | 'wind' | 'hydro' | 'thermal' | 'nuclear' | 'fusion' | 'space' | 'storage';

export interface RunRecord {
  index: number;
  startedAt: number;
  endedAt: number;
  revenue: number;
  highestStage: StageId;
  pointsEarned: number;
}

export interface Settings {
  gridLines: boolean;
  terrainLabels: boolean;
  buildingNames: boolean;
  productionValues: boolean;
  maintenanceIndicators: boolean;
  electricalOverlay: boolean;
  animations: boolean;
  compactInspector: boolean;
  compactFinance: boolean;
  notifications: 'all' | 'important' | 'critical';
  numberFormat: 'short' | 'scientific' | 'engineering';
  theme: 'dark' | 'light';
  reducedMotion: boolean;
  carbonPricing: boolean;
  confirmExpensive: boolean;
  /** Notification categories hidden from the event list and alert badge. */
  mutedCategories: string[];
}

export interface OfflineSummary {
  hours: number;
  realSeconds: number;
  produced: number;
  sold: number;
  revenue: number;
  expenses: number;
  net: number;
  repairs: number;
  fuelUsed: number;
  researchRP: number;
  researchCompleted: string[];
  issues: string[];
  capped: boolean;
}

export interface GameState {
  version: number;
  seed: number;
  /** Game time in hours since the run started. */
  time: number;
  /** Real wall-clock ms of the last simulated moment (for offline progress). */
  savedAt: number;
  speed: number;
  paused: boolean;
  money: number;
  maps: Partial<Record<StageId, MapState>>;
  research: ResearchState;
  /** Global workforce (researchers, traders). */
  workforce: Record<string, number>;
  prestige: PrestigeState;
  contracts: SupplyContract[];
  achievements: Record<string, number>;
  blueprints: Blueprint[];
  notifications: NotificationEntry[];
  nextId: number;
  ledger: Ledger;
  /** Rolling company rates ($/h) */
  /** cats: the same smoothing per operating ledger key (they sum to net). */
  rates: { revenue: number; expenses: number; net: number; rp: number; cats: Partial<Record<LedgerKey, number>> };
  /** realH: real hours with the game open in a visible tab (paused included). */
  run: { index: number; startedAt: number; realH: number; revenue: number; sold: number; produced: number; repairs: number; fuelUsed: number; emissions: number; highestStage: StageId };
  lifetime: { revenue: number; sold: number; produced: number; buildings: number; repairs: number; playH: number; realH: number; demolished: number; peakKW: number };
  history: HistorySample[];
  historyLong: HistorySample[];
  runHistory: RunRecord[];
  settings: Settings;
  /** Company-wide training levels for researchers and traders. */
  staffTraining: { research: number; trading: number };
  /** Business events waiting for a decision, and their running effects. */
  incidents: { pending: Incident | null; active: IncidentEffect[]; lastBlock: number };
  automationPaused: boolean;
  defaultRepairThreshold: number;
  convergence: number;
  won: number;
  offlineSummary: OfflineSummary | null;
  /** Completed per-map goals: `${map}:${kind}` → game time reached (this run). */
  goals: Record<string, number>;
  /** Optional run modifier chosen at prestige (data/goals.ts CHALLENGES). */
  challenge: ChallengeId | null;
  lastEvents: Record<string, number>;
}

export type { DemandCategory };
