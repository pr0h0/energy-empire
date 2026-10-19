import type { ChallengeId } from '../data/goals';
import type { FuelId, StageId } from '../data/types';
import type { TrainGroup } from '../systems/EmployeeSystem';
import type { CoolingMode, FuelAutomation, MapPolicies, Priority, Settings, StorageMode, ThermalMode } from './State';

/** Every player intent is a serialisable command; React never mutates game state directly. */
export type Command =
  | { type: 'place'; map: StageId; def: string; x: number; y: number; rot: 0 | 1; acceptFlood?: boolean; buyLand?: boolean }
  | { type: 'demolish'; map: StageId; id: string }
  | { type: 'buyLand'; map: StageId; x: number; y: number }
  | { type: 'buyLandBulk'; map: StageId }
  | { type: 'upgradeGrid'; map: StageId }
  | { type: 'downgradeGrid'; map: StageId }
  | { type: 'signContract'; map: StageId; contract: string }
  | { type: 'cancelContract'; map: StageId; contract: string }
  | { type: 'hire'; tier: string; count: number; map?: StageId }
  | { type: 'fire'; tier: string; count: number; map?: StageId }
  | { type: 'train'; map: StageId; group: TrainGroup }
  | { type: 'repair'; map: StageId; id: string }
  | { type: 'repairAll'; map: StageId }
  | { type: 'replaceComponents'; map: StageId; id: string }
  | { type: 'rebuild'; map: StageId; id: string }
  | { type: 'retrofit'; map: StageId; id: string; upgrade: string }
  | { type: 'fleetUpgrade'; map: StageId; upgrade: string; def?: string }
  | { type: 'repower'; map: StageId; id: string; to: string }
  | { type: 'configure'; map: StageId; id: string; patch: BuildingPatch }
  | { type: 'mapPolicy'; map: StageId; patch: Partial<Pick<MapPolicies, 'repairThreshold' | 'importForShortage' | 'autoExport' | 'tariff' | 'defaultStorageMode'>> }
  | { type: 'typeThreshold'; map: StageId; def: string; value: number | null }
  | { type: 'globalThreshold'; value: number }
  | { type: 'jobPriority'; map: StageId; job: string; priority: Priority }
  | { type: 'fuelPolicy'; map: StageId; fuel: FuelId; patch: Partial<{ mode: FuelAutomation; refillAt: number; minInventory: number; budgetPerDay: number; maxPriceFactor: number }> }
  | { type: 'buyFuel'; map: StageId; fuel: FuelId; qty: number }
  | { type: 'refuel'; map: StageId; id: string }
  | { type: 'refuelAll'; map: StageId }
  | { type: 'fuelContract'; map: StageId; fuel: FuelId; perDay: number }
  | { type: 'signPPA'; map: StageId; fraction?: number }
  | { type: 'cancelSupplyContract'; id: string }
  | { type: 'startResearch'; id: string }
  | { type: 'pauseResearch'; id: string }
  | { type: 'allocate'; id: string; pct: number }
  | { type: 'unlockStage'; stage: StageId }
  | { type: 'prestige'; confirm: string; challenge?: ChallengeId | null }
  | { type: 'buyPrestige'; id: string }
  | { type: 'saveBlueprint'; map: StageId; name: string }
  | { type: 'deleteBlueprint'; id: string }
  | { type: 'renameBlueprint'; id: string; name: string }
  | { type: 'applyBlueprint'; id: string; map: StageId; x: number; y: number; mode: 'all' | 'subset' }
  | { type: 'setSpeed'; speed: number }
  | { type: 'pause'; paused: boolean }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'automationPaused'; paused: boolean }
  | { type: 'dismissOffline' }
  | { type: 'clearNotifications' }
  | { type: 'resolveIncident'; accept: boolean };

export interface BuildingPatch {
  enabled?: boolean;
  mode?: ThermalMode;
  target?: number;
  coolingMode?: CoolingMode;
  storageMode?: StorageMode;
  reserve?: number;
  lowPrice?: number;
  highPrice?: number;
  peakKW?: number;
  repairThreshold?: number | null;
  priority?: Priority;
  reservoirTarget?: number;
}

export interface CommandResult {
  ok: boolean;
  error?: string;
  data?: unknown;
}
