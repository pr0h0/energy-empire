import { BALANCE } from '../data/balance';
import { emptyLedger, createMap } from '../world/MapManager';
import type { GameState, Settings } from './State';

export const SAVE_VERSION = 3;

export const defaultSettings = (): Settings => ({
  gridLines: true, terrainLabels: false, buildingNames: false, productionValues: true, maintenanceIndicators: true, electricalOverlay: false,
  animations: true, compactInspector: false, compactFinance: false, notifications: 'important', numberFormat: 'short', theme: 'dark',
  reducedMotion: false, carbonPricing: false, confirmExpensive: true, mutedCategories: [],
});

/** A fresh company at the Backyard. */
export function newGame(seed = (Math.random() * 2 ** 31) >>> 0, now = Date.now()): GameState {
  return {
    version: SAVE_VERSION, seed, time: 6, savedAt: now, speed: 1, paused: false, money: BALANCE.startMoney,
    maps: { backyard: createMap('backyard', seed, 6) },
    research: { done: {}, progress: {}, active: {}, paid: {}, startedAt: {}, levels: {} },
    workforce: {},
    prestige: { lifetimeRevenue: 0, awarded: 0, available: 0, spent: 0, resets: 0, upgrades: {} },
    contracts: [], achievements: {}, blueprints: [], notifications: [], nextId: 1, ledger: emptyLedger(),
    rates: { revenue: 0, expenses: 0, net: 0, rp: 0, cats: {} },
    run: { index: 1, startedAt: now, realH: 0, revenue: 0, sold: 0, produced: 0, repairs: 0, fuelUsed: 0, emissions: 0, highestStage: 'backyard' },
    lifetime: { revenue: 0, sold: 0, produced: 0, buildings: 0, repairs: 0, playH: 0, realH: 0, demolished: 0, peakKW: 0 },
    history: [], historyLong: [], runHistory: [], settings: defaultSettings(), staffTraining: { research: 0, trading: 0 }, incidents: { pending: null, active: [], lastBlock: 0 }, automationPaused: false, defaultRepairThreshold: BALANCE.defaultRepairThreshold,
    convergence: 0, won: 0, offlineSummary: null, lastEvents: {}, goals: {}, challenge: null,
  };
}
