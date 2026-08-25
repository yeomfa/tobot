import type { Algorithm } from '../core/ast/types';
import { sanitizeStatements } from '../core/ast/validateShape';
import { isSupabaseConfigured } from './supabase';
import { SupabaseAlgorithmStore } from './supabaseStore';

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
  /**
   * Whether a save crosses the network.
   *
   * The interface is async either way — that is what lets the two
   * implementations be swapped — but only one of them can fail or take time
   * worth mentioning. Local writes are synchronous underneath, so the
   * interface reports which kind it is rather than making callers guess from
   * whether a session exists.
   */
  readonly isRemote: boolean;
}

export interface Preferences {
  language: string;
  theme: 'light' | 'dark' | 'system';
  /** Last opened algorithm, restored on the next visit. */
  activeAlgorithmId: string | null;
  /**
   * Set once the app has been opened. Without it there is no way to tell a
   * first visit from a returning student who deleted everything — and the
   * welcome example would keep coming back after being deleted.
   */
  visited?: boolean;
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
/**
 * `localStorage` is a file the student can edit, so what comes back is input
 * rather than state: the id and name are checked, and the body is walked
 * statement by statement. `Array.isArray` alone let anything inside the array
 * through to the interpreter and the emitters, which all assume a well-formed
 * tree.
 */
function reviveAlgorithm(value: unknown): Algorithm | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null;

  return {
    id: record.id,
    name: record.name,
    body: sanitizeStatements(record.body),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
  };
}

export class LocalAlgorithmStore implements AlgorithmStore {
  /* Writes land in `localStorage` synchronously; there is nothing to wait
     for and nothing that can fail on the way. */
  readonly isRemote = false;

  private readAll(): Algorithm[] {
    const raw = safeRead(ALGORITHMS_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      // Corrupt or hand-edited storage must not crash the app on boot.
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(reviveAlgorithm)
        .filter((algorithm): algorithm is Algorithm => algorithm !== null);
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
 * Single construction point for persistence.
 *
 * A signed-in student reads and writes their own rows in Supabase; everyone
 * else stays on localStorage. Because both satisfy the same interface, no
 * component knows or cares which one it is talking to.
 */
export function createAlgorithmStore(): AlgorithmStore {
  return hasSession() ? new SupabaseAlgorithmStore() : new LocalAlgorithmStore();
}

/**
 * Whether a Supabase session exists, read synchronously so the store can be
 * chosen without awaiting. Supabase keeps the session in localStorage under a
 * key derived from the project ref, and reading it directly avoids making
 * every caller of `createAlgorithmStore` async.
 */
function hasSession(): boolean {
  if (!isSupabaseConfigured) return false;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = window.localStorage.getItem(key);
        if (raw && raw.length > 2) return true;
      }
    }
  } catch {
    // Storage can be unavailable; fall back to local.
  }
  return false;
}

export function createPreferenceStore(): PreferenceStore {
  return new LocalPreferenceStore();
}
