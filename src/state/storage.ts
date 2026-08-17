import type { Algorithm } from '../core/ast/types';

/**
 * Persistence seam.
 *
 * The app talks only to this interface, never to `localStorage` directly, so
 * swapping in Supabase later means writing a second implementation of
 * `AlgorithmStore` and changing one line in `createStore`. Every method is
 * async for that reason, even though the local implementation resolves
 * immediately.
 */
export interface AlgorithmStore {
  list(): Promise<Algorithm[]>;
  get(id: string): Promise<Algorithm | null>;
  save(algorithm: Algorithm): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface Preferences {
  language: string;
  theme: 'light' | 'dark' | 'system';
  /** Last opened algorithm, restored on the next visit. */
  activeAlgorithmId: string | null;
}

export interface PreferenceStore {
  read(): Preferences | null;
  write(preferences: Preferences): void;
}

const ALGORITHMS_KEY = 'tobot.algorithms.v1';
const PREFERENCES_KEY = 'tobot.preferences.v1';

/** Storage can throw in private mode or when the quota is exhausted. */
function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Rejects anything that is not a plausible algorithm record. */
function isAlgorithm(value: unknown): value is Algorithm {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    Array.isArray(record.body)
  );
}

export class LocalAlgorithmStore implements AlgorithmStore {
  private readAll(): Algorithm[] {
    const raw = safeRead(ALGORITHMS_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      // Corrupt or hand-edited storage must not crash the app on boot.
      return Array.isArray(parsed) ? parsed.filter(isAlgorithm) : [];
    } catch {
      return [];
    }
  }

  private writeAll(algorithms: Algorithm[]): void {
    safeWrite(ALGORITHMS_KEY, JSON.stringify(algorithms));
  }

  async list(): Promise<Algorithm[]> {
    return this.readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<Algorithm | null> {
    return this.readAll().find((algorithm) => algorithm.id === id) ?? null;
  }

  async save(algorithm: Algorithm): Promise<void> {
    const all = this.readAll();
    const index = all.findIndex((candidate) => candidate.id === algorithm.id);
    if (index >= 0) all[index] = algorithm;
    else all.push(algorithm);
    this.writeAll(all);
  }

  async remove(id: string): Promise<void> {
    this.writeAll(this.readAll().filter((algorithm) => algorithm.id !== id));
  }
}

export class LocalPreferenceStore implements PreferenceStore {
  read(): Preferences | null {
    const raw = safeRead(PREFERENCES_KEY);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as Preferences;
    } catch {
      return null;
    }
  }

  write(preferences: Preferences): void {
    safeWrite(PREFERENCES_KEY, JSON.stringify(preferences));
  }
}

/**
 * Single construction point for persistence. A Supabase-backed store would be
 * selected here, e.g. by checking for configured credentials.
 */
export function createAlgorithmStore(): AlgorithmStore {
  return new LocalAlgorithmStore();
}

export function createPreferenceStore(): PreferenceStore {
  return new LocalPreferenceStore();
}
