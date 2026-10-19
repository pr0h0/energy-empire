/** Rolling backup slots: before each primary write the previous primary shifts down the chain. */
export const SLOTS = ['primary', 'backup1', 'backup2', 'backup3'] as const;
export type Slot = (typeof SLOTS)[number];

export interface StoredSave {
  data: string;
  checksum: string;
  savedAt: number;
  version: number;
}

export interface KV {
  get(key: string): Promise<StoredSave | undefined>;
  set(key: string, v: StoredSave): Promise<void>;
  del(key: string): Promise<void>;
}

/** Rotate primary → backup1 → backup2 → backup3 (only every few minutes to keep history useful). */
export async function rotate(kv: KV, minAgeMs = 5 * 60_000): Promise<void> {
  const primary = await kv.get('primary');
  if (!primary) return;
  const b1 = await kv.get('backup1');
  if (b1 && primary.savedAt - b1.savedAt < minAgeMs) return;
  for (let i = SLOTS.length - 1; i > 0; i--) {
    const prev = await kv.get(SLOTS[i - 1]);
    if (prev) await kv.set(SLOTS[i], prev);
  }
}
