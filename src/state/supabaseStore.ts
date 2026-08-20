import type { Algorithm } from '../core/ast/types';
import { sanitizeStatements } from '../core/ast/validateShape';
import type { AlgorithmStore } from './storage';
import { supabase } from './supabase';

/** One row of `public.algorithms`, as the database spells it. */
interface Row {
  id: string;
  name: string;
  body: unknown;
  created_at: string;
  updated_at: string;
}

/**
 * Builds an algorithm from a database row, keeping nothing it cannot vouch
 * for.
 *
 * Row-level security decides *whose* rows arrive; it says nothing about their
 * shape. A row is a `jsonb` column that some other client wrote, so the body
 * is checked statement by statement rather than asserted with a cast — a
 * malformed one is dropped instead of reaching the interpreter or an emitter.
 * The local store has always validated what it reads; this is the same
 * standard applied to the remote one.
 */
function toAlgorithm(row: Row): Algorithm {
  return {
    id: String(row.id),
    name: typeof row.name === 'string' ? row.name : '',
    body: sanitizeStatements(row.body),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * The same `AlgorithmStore` interface, backed by Supabase.
 *
 * `user_id` is never sent by the app: it is filled from the signed-in session,
 * and the row-level security policies reject anything that does not match. So
 * a student cannot read or write another's work even by editing the request.
 *
 * Every method degrades to a local-feeling no-op when there is no session,
 * which is what lets the app keep running while the account layer is being set
 * up or when the network is down.
 */
export class SupabaseAlgorithmStore implements AlgorithmStore {
  private async userId(): Promise<string | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }

  async list(): Promise<Algorithm[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('algorithms')
      .select('id, name, body, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[tobot] could not list algorithms:', error.message);
      return [];
    }
    return (data ?? []).map((row) => toAlgorithm(row as Row));
  }

  async get(id: string): Promise<Algorithm | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('algorithms')
      .select('id, name, body, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[tobot] could not read algorithm:', error.message);
      return null;
    }
    return data ? toAlgorithm(data as Row) : null;
  }

  async save(algorithm: Algorithm): Promise<void> {
    if (!supabase) return;
    const userId = await this.userId();
    // Without a session there is nobody to own the row; the caller keeps its
    // local copy rather than losing the edit.
    if (!userId) return;

    const { error } = await supabase.from('algorithms').upsert(
      {
        id: algorithm.id,
        user_id: userId,
        name: algorithm.name,
        body: algorithm.body,
        created_at: algorithm.createdAt,
      },
      { onConflict: 'id' },
    );

    if (error) console.error('[tobot] could not save algorithm:', error.message);
  }

  async remove(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('algorithms').delete().eq('id', id);
    if (error) console.error('[tobot] could not delete algorithm:', error.message);
  }
}
