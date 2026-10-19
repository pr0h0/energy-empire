import type { GameState } from '../core/State';
import { checksum, validateSave } from './SaveSchema';
import { migrate } from './SaveMigration';
import { type KV, rotate, SLOTS, type StoredSave } from './BackupManager';

const DB = 'energy-empire';
const STORE = 'saves';

function idbKV(): KV {
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => {
        db.close();
        resolve(r.result);
      };
      t.onerror = () => {
        db.close();
        reject(t.error);
      };
    });
  };
  return {
    get: (k) => tx('readonly', (s) => s.get(k)) as Promise<StoredSave | undefined>,
    set: async (k, v) => {
      await tx('readwrite', (s) => s.put(v, k));
    },
    del: async (k) => {
      await tx('readwrite', (s) => s.delete(k));
    },
  };
}

export function serialize(s: GameState): StoredSave {
  const data = JSON.stringify(s);
  return { data, checksum: checksum(data), savedAt: s.savedAt, version: s.version };
}

/** Parse + verify + migrate + validate. Throws a readable error on any problem. */
export function deserialize(stored: StoredSave): GameState {
  if (checksum(stored.data) !== stored.checksum) throw new Error('Checksum mismatch — save is corrupted.');
  const raw = JSON.parse(stored.data);
  const s = migrate(raw);
  const errors = validateSave(s);
  if (errors.length) throw new Error(`Invalid save: ${errors.slice(0, 3).join('; ')}`);
  return s;
}

export class SaveManager {
  constructor(private kv: KV = idbKV()) {}

  async save(s: GameState): Promise<void> {
    s.savedAt = Date.now();
    await rotate(this.kv);
    await this.kv.set('primary', serialize(s));
  }

  /** Load the newest valid slot; falls back through backups if the primary is corrupted. */
  async load(): Promise<{ state: GameState; slot: string; errors: string[] } | null> {
    const errors: string[] = [];
    for (const slot of SLOTS) {
      const st = await this.kv.get(slot);
      if (!st) continue;
      try {
        return { state: deserialize(st), slot, errors };
      } catch (e) {
        errors.push(`${slot}: ${(e as Error).message}`);
      }
    }
    if (errors.length) throw new Error(`No valid save could be loaded. ${errors.join(' | ')}`);
    return null;
  }

  async listSlots(): Promise<{ slot: string; savedAt: number; ok: boolean }[]> {
    const out = [];
    for (const slot of SLOTS) {
      const st = await this.kv.get(slot);
      if (!st) continue;
      let ok = true;
      try {
        deserialize(st);
      } catch {
        ok = false;
      }
      out.push({ slot, savedAt: st.savedAt, ok });
    }
    return out;
  }

  async restore(slot: string): Promise<GameState> {
    const st = await this.kv.get(slot);
    if (!st) throw new Error('Slot is empty.');
    return deserialize(st);
  }

  async reset(): Promise<void> {
    for (const slot of SLOTS) await this.kv.del(slot);
  }
}

/** Export format: a small JSON envelope (human-inspectable) with checksum. */
export function exportSave(s: GameState): string {
  const st = serialize(s);
  return JSON.stringify({ format: 'energy-empire-save', ...st });
}

export function importSave(text: string): GameState {
  let env: StoredSave & { format?: string };
  try {
    env = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (env.format !== 'energy-empire-save' || typeof env.data !== 'string') throw new Error('Not an Energy Empire save file.');
  return deserialize(env);
}
