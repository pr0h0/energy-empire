import { BALANCE } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { defaultSettings, newGame, SAVE_VERSION } from '../core/NewGame';
import { speedCap } from '../core/Helpers';
import type { GameState } from '../core/State';
import { emptyFlow, emptyLedger, riverTopoOrder } from '../world/MapManager';
import { migrateBlueprint } from '../systems/BlueprintSystem';

type AnyObj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Versioned migrations. Each step upgrades one schema version; finally missing fields are filled
 * from a fresh state so older saves never lose progress. Definitions are never referenced —
 * everything is deep-copied plain data.
 */
const steps: Record<number, (s: AnyObj) => void> = {
  // v1 → v2: global repair threshold and convergence progress introduced
  1: (s) => {
    s.defaultRepairThreshold ??= BALANCE.defaultRepairThreshold;
    s.convergence ??= 0;
    s.won ??= 0;
  },
  // v2 → v3: per-map training levels and fuel policies; blueprint versions
  2: (s) => {
    for (const m of Object.values(s.maps ?? {}) as AnyObj[]) {
      m.training ??= { maintenance: 0, logistics: 0 };
      m.policies ??= {};
      m.policies.fuel ??= {};
      m.riverFlow ??= (m.riverBase ?? []).slice();
    }
    s.blueprints = (s.blueprints ?? []).map((b: AnyObj) => ({ version: 1, ...b }));
  },
};

export function migrate(input: unknown): GameState {
  const s = structuredClone(input) as AnyObj;
  let v = typeof s.version === 'number' ? s.version : 1;
  while (v < SAVE_VERSION) {
    steps[v]?.(s);
    v++;
  }
  s.version = SAVE_VERSION;
  const fresh = newGame(typeof s.seed === 'number' ? s.seed : 1) as unknown as AnyObj;
  for (const k of Object.keys(fresh)) if (s[k] === undefined) s[k] = fresh[k];
  s.settings = { ...defaultSettings(), ...(s.settings ?? {}) };
  s.ledger = { ...emptyLedger(), ...(s.ledger ?? {}) };
  for (const k of ['done', 'progress', 'active', 'paid', 'startedAt', 'levels']) s.research[k] ??= {};
  s.lifetime.realH ??= 0;
  s.run.realH ??= 0;
  s.rates.cats ??= {};
  s.goals ??= {};
  s.staffTraining ??= { research: 0, trading: 0 };
  s.incidents ??= { pending: null, active: [], lastBlock: Math.floor((s.time ?? 0) / 144) };
  s.speed = Math.min(s.speed ?? 1, speedCap(s as GameState));
  s.challenge ??= null;
  for (const m of Object.values(s.maps) as AnyObj[]) {
    m.flow = { ...emptyFlow(), ...(m.flow ?? {}) };
    m.ledger = { ...emptyLedger(), ...(m.ledger ?? {}) };
    m.repairJobs ??= [];
    m.goalTrack ??= { noImportH: 0, cleanH: 0 };
    m.logisticsJobs ??= [];
    m.contracts ??= [];
    m.workforce ??= {};
    m.fuel ??= {};
    m.policies = { repairThreshold: null, typeThresholds: {}, importForShortage: true, autoExport: true, tariff: 'fixed', defaultStorageMode: 'self', ...m.policies, fuel: m.policies?.fuel ?? {} };
    if (!Array.isArray(m.riverOrder) || !m.riverOrder.length) m.riverOrder = riverTopoOrder(m as never, (m.riverBase as number[]).map((q, i) => (q > 0 ? i : -1)).filter((i) => i >= 0));
    // drop installations whose definition no longer exists (blueprints keep a record)
    for (const [id, b] of Object.entries(m.buildings as Record<string, AnyObj>)) {
      if (!BUILDINGS[b.def]) {
        delete m.buildings[id];
        m.occ = (m.occ as (string | null)[]).map((o) => (o === id ? null : o));
      } else {
        b.upgrades ??= [];
        b.wearOut ??= 0;
        b.enabled ??= true;
        b.downtimeUntil ??= 0;
        for (const f of ['energy', 'revenue', 'opCost', 'rRevenue', 'rCost', 'output', 'available', 'ageH']) b[f] ??= 0;
        b.status ??= 'Operating';
      }
    }
  }
  s.blueprints = (s.blueprints ?? []).map(migrateBlueprint);
  s.offlineSummary = null;
  return s as GameState;
}
