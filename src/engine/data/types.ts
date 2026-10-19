/** Static (definition) data types. Definitions are frozen; runtime state never references them mutably. */

export const STAGE_IDS = ['backyard', 'neighborhood', 'city', 'country', 'continent', 'planet', 'solar', 'galaxy', 'universe'] as const;
export type StageId = (typeof STAGE_IDS)[number];

export type TerrainId =
  | 'grass' | 'forest' | 'hill' | 'mountain' | 'river' | 'lake' | 'coast' | 'ocean' | 'desert' | 'urban' | 'industrial' | 'geothermal' | 'reservoir'
  | 'void' | 'inner' | 'corona' | 'orbit' | 'lunar' | 'martian' | 'asteroid' | 'gasgiant'
  | 'nebula' | 'star_red' | 'star_yellow' | 'star_blue' | 'neutron' | 'galactic_core'
  | 'galaxy_spiral' | 'galaxy_elliptical' | 'quasar' | 'filament' | 'supervoid' | 'smbh';

export interface TerrainDef {
  id: TerrainId;
  name: string;
  color: string;
  /** Land price multiplier; 0 = never purchasable. */
  priceMult: number;
  /** Research needed before tiles of this type can be bought. */
  requires?: string;
  solar: number;
  wind: number;
  /** Cooling bonus for thermal plants placed adjacent to this terrain. */
  cooling?: number;
  water?: boolean;
  desc: string;
}

export type FuelId = 'diesel' | 'gas' | 'coal' | 'biomass' | 'uranium' | 'fusion' | 'he3' | 'stellar' | 'exotic';

export interface FuelDef {
  id: FuelId;
  name: string;
  unit: string;
  /** Thermal energy content per unit (kWh_th). */
  energyPerUnit: number;
  /** Base purchase price per unit ($). */
  price: number;
  /** Max relative price swing (smooth). */
  volatility: number;
  /** Base delivery time (h). */
  deliveryH: number;
  /** Emissions per kWh_th (kg CO2). */
  emissions: number;
  /** Earliest scale whose market supplies this fuel. */
  availableFrom: StageId;
  research?: string;
}

export type BuildingCategory = 'generation' | 'storage' | 'grid' | 'infrastructure' | 'automation' | 'research' | 'special';
export type Family =
  | 'solar' | 'wind' | 'hydro' | 'fossil' | 'biomass' | 'geothermal' | 'nuclear' | 'fusion' | 'orbital' | 'stellar' | 'exotic'
  | 'storage' | 'grid' | 'infra' | 'fuel' | 'house';

export type GenKind = 'solar' | 'wind' | 'hydro' | 'dam' | 'tidal' | 'thermal' | 'csp' | 'geothermal' | 'orbital' | 'stellar' | 'dyson' | 'pulsar' | 'penrose' | 'constant';

export interface ThermalParams {
  fuel: FuelId;
  /** Max conversion efficiency heat → electricity. */
  eta: number;
  minLoad: number;
  /** Max change of output per hour as a fraction of capacity. */
  ramp: number;
  /** Cooling capacity relative to rated waste heat. */
  cooling: number;
  /** Part-load efficiency penalty. */
  partLoad: number;
  /** Local tank / core size in hours of full-load operation. */
  tankH: number;
  /** Nuclear-style refuel outage (h) — refuelling happens in batches with downtime. */
  refuelOutageH?: number;
  /** Fusion: parasitic fraction of gross output used by magnets/heating. */
  parasitic?: number;
  /** Fusion: energy needed to ignite plasma (h of rated output). */
  ignitionH?: number;
}

export interface GenParams {
  kind: GenKind;
  /** Hydro: design head (m). */
  head?: number;
  /** Hydro turbine efficiency. */
  eta?: number;
  /** Dam: crest height above river bed (m) and reservoir depth multiplier. */
  crest?: number;
  /** CSP: thermal storage hours. */
  storageH?: number;
  /** Geothermal: pressure decline per full-load hour. */
  decline?: number;
  /** Penrose/finite pool: extractable energy in hours of rated output. */
  poolH?: number;
  /** Pulsar period (h). */
  period?: number;
}

export interface StorageParams {
  /** kWh per unit. */
  kwh: number;
  /** C-rate: max charge/discharge power = kwh × cRate. */
  cRate: number;
  etaIn: number;
  etaOut: number;
  /** Fraction of usable capacity lost per full cycle (irreversible). */
  cycleAging: number;
}

export type InfraRole = 'grid' | 'depot' | 'logistics' | 'fuelStorage' | 'lab' | 'ops' | 'trading' | 'fuelProducer' | 'sink' | 'house' | 'none';

export interface InfraParams {
  role: InfraRole;
  /** grid: kW import/export capacity added (scaled per unit). */
  kw?: number;
  /** depot/logistics/lab/ops/trading: amount (WU, LU, RP/h, %). */
  amount?: number;
  /** fuelStorage: kWh_th capacity. */
  kwhTh?: number;
  /** fuelProducer: fuel produced per hour (units) and electricity consumed (kW). */
  fuel?: FuelId;
  rate?: number;
  loadKW?: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  desc: string;
  category: BuildingCategory;
  family: Family;
  art: string;
  stages: StageId[];
  size: [number, number];
  /** Terrain allowed for every footprint tile. */
  terrain: TerrainId[];
  /** Some tile adjacent to the footprint must be one of these. */
  adjacent?: TerrainId[];
  terrainBonus?: Partial<Record<TerrainId, number>>;
  /** Represented unit (one machine) — aggregation divides usable area by `areaM2` operating spacing. */
  unit: { label: string; kw: number; areaM2: number };
  /** If false, building is a single installation (units = 1). */
  aggregate: boolean;
  /** Target payback in game hours at native stage price (used to derive cost). */
  paybackH: number;
  /** Explicit cost override per unit (else derived). */
  unitCost?: number;
  research?: string;
  gen?: GenParams;
  thermal?: ThermalParams;
  storage?: StorageParams;
  infra?: InfraParams;
  /** Condition loss per hour at full utilisation. */
  wear: number;
  /** Irreversible capacity loss per hour (aging). */
  aging: number;
  /** Maintenance load (work units) at native scale. */
  maint: number;
  /** Fraction of invested cost recoverable at full condition. */
  salvage: number;
  /** Decommissioning cost as fraction of invested cost. */
  decommission?: number;
  upgrades?: string[];
  successor?: string;
  unique?: boolean;
  fixed?: boolean;
  /** Cost and effect amounts scale with the map's stage (generic infrastructure). */
  scaled?: boolean;
  /** Shut down below this condition. */
  shutdownBelow?: number;
  emissions?: number;
  speculative?: boolean;
}

export type ModKey =
  | 'solar.output' | 'wind.output' | 'hydro.output' | 'thermal.eta' | 'thermal.cooling' | 'geothermal.output' | 'nuclear.fuel'
  | 'fusion.output' | 'orbital.output' | 'stellar.output' | 'exotic.output'
  | 'storage.eta' | 'storage.capacity' | 'storage.aging' | 'storage.power'
  | 'grid.capacity' | 'grid.losses' | 'wear' | 'maintenance.capacity' | 'repair.cost' | 'logistics.speed' | 'logistics.capacity'
  | 'research.speed' | 'market.price' | 'fuel.cost' | 'land.cost' | 'density' | 'wages' | 'build.cost' | 'salvage' | 'demand.price'
  | 'revenue' | 'workforce.capacity';

export type Feature =
  | 'battery.advanced' | 'battery.arbitrage' | 'market.spot' | 'market.contracts' | 'fuel.contracts' | 'fuel.bulk' | 'fuel.autoBuy'
  | 'land.bulk' | 'thermal.advanced' | 'repair.preventive' | 'automation.priority' | 'fleet.upgrade' | 'terrain.ocean' | 'terrain.mountain'
  | 'trading.auto' | 'offline.extended';

export type Effect =
  | { type: 'mod'; key: ModKey; add: number }
  | { type: 'unlock'; building: string }
  | { type: 'upgrade'; upgrade: string }
  | { type: 'feature'; feature: Feature };

export interface ResearchDef {
  id: string;
  name: string;
  branch: ResearchBranch;
  desc: string;
  /** Research work (RP). */
  rp: number;
  /** Money paid when the project starts. */
  cost: number;
  prereq: string[];
  /** Milestone required for major breakthroughs. */
  milestone?: Milestone;
  /** Minimum duration (h) for breakthroughs. */
  minH?: number;
  stage: StageId;
  effects: Effect[];
  /** Repeatable project: effects stack per level, each level costs `growth`× the previous. */
  repeat?: { growth: number };
  /** Shown below the Universe area (post-Convergence research). */
  beyond?: boolean;
}

export type ResearchBranch =
  | 'solar' | 'wind' | 'hydro' | 'thermal' | 'geothermal' | 'nuclear' | 'fusion' | 'storage' | 'grid' | 'materials' | 'maintenance'
  | 'logistics' | 'workforce' | 'markets' | 'research' | 'orbital' | 'stellar' | 'universal';

export type Milestone =
  | { kind: 'energySold'; kwh: number }
  | { kind: 'revenue'; amount: number }
  | { kind: 'capacity'; kw: number; stage?: StageId }
  | { kind: 'reliability'; value: number; stage: StageId }
  | { kind: 'research'; count: number }
  | { kind: 'researchDone'; id: string }
  | { kind: 'workers'; count: number }
  | { kind: 'storage'; kwh: number }
  | { kind: 'buildings'; count: number; stage?: StageId }
  | { kind: 'contracts'; count: number; stage: StageId }
  | { kind: 'produced'; kwh: number }
  | { kind: 'gridLevel'; level: number; stage: StageId };

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  /** Cost as fraction of the building's invested cost. */
  costFrac: number;
  downtimeH: number;
  effects: { key: LocalKey; add: number }[];
}

export type LocalKey = 'output' | 'wear' | 'eta' | 'cooling' | 'maint' | 'fuel' | 'capacity' | 'aging' | 'storageEta' | 'ramp' | 'power';

export interface ContractDef {
  id: string;
  stage: StageId;
  name: string;
  category: DemandCategory;
  /** Average demand kW. */
  kw: number;
  /** Price paid by customer per kWh. */
  price: number;
  /** One-time connection fee. */
  fee: number;
  /** Backyard home improvements: extra household income $/h. */
  income?: number;
  requires?: Milestone;
}

export type DemandCategory = 'household' | 'residential' | 'commercial' | 'industrial' | 'infrastructure' | 'advanced' | 'planetary' | 'interstellar';

export interface GridLevel {
  name: string;
  importKW: number;
  exportKW: number;
  cost: number;
  /** Fraction lost on export/import. */
  losses: number;
  /** Fixed operating cost $/h. */
  opex: number;
  research?: string;
}

export interface StageDef {
  id: StageId;
  index: number;
  name: string;
  tagline: string;
  w: number;
  h: number;
  /** Cell edge length in metres (abstract sectors at space scales still carry a physical size). */
  cellM: number;
  cellLabel: string;
  elevRangeM: number;
  retail: number;
  export: number;
  import: number;
  /** Generic cost/capacity scale for infrastructure, land and workforce. */
  scale: number;
  landBase: number;
  startOwned: [number, number, number, number];
  baseDemandKW: number;
  householdIncome?: number;
  grid: GridLevel[];
  unlock: { cost: number; milestones: Milestone[] } | null;
  space: boolean;
  /** Base logistics delivery distance multiplier. */
  distance: number;
}

export interface EmployeeTier {
  id: string;
  group: EmployeeGroup;
  name: string;
  capacity: number;
  hire: number;
  wage: number;
  research?: string;
}
export type EmployeeGroup = 'maintenance' | 'logistics' | 'research' | 'trading';

export interface PrestigeUpgradeDef {
  id: string;
  name: string;
  desc: string;
  category: 'revenue' | 'maintenance' | 'research' | 'workforce' | 'fuel' | 'generation' | 'land' | 'storage' | 'automation' | 'qol';
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  effects: Effect[];
  /** Special one-time QoL behaviour flag. */
  special?: 'startMoney' | 'keepBackyardLand' | 'starterTech' | 'keepBasicResearch' | 'autoFuelEarly' | 'offlineCap';
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  check: Milestone | { kind: 'custom'; id: string };
}
