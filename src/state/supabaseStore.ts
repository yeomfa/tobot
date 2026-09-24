import type { Algorithm } from '../core/ast/types';
import { sanitizeStatements } from '../core/ast/validateShape';
import type { AlgorithmStore } from './storage';
import { isMissingColumn } from './schemaGap';
import { getSupabase } from './supabase';

/** One row of `public.algorithms`, as the database spells it. */
interface Row {
  id: string;
  name: string;
  body: unknown;
  created_at: string;
  updated_at: string;
  /* Both optional, because a row written before these columns existed comes
     back without them — and so does a project whose migration has not been
     run yet. Neither is a reason to fail to open someone's work. */
  kind?: unknown;
  source?: unknown;
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
  /* Read the same way the local store reads it: anything that is not the word
     `code` is a block algorithm. That is what every row written before the
     column existed comes back as, so old work keeps opening. */
  const kind = row.kind === 'code' ? 'code' : 'blocks';

  return {
    id: String(row.id),
    name: typeof row.name === 'string' ? row.name : '',
    kind,
    source: kind === 'code' && typeof row.source === 'string' ? row.source : undefined,
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
/**
 * Set once the database answers that it has never heard of `kind`.
 *
 * Module scope rather than instance state: the store is rebuilt on nearly
 * every call site, and asking the database the same question once per save
 * would turn a one-off discovery into a recurring failure.
 */
let missingColumns = false;

export class SupabaseAlgorithmStore implements AlgorithmStore {
  /* Every write crosses the network, so it can be slow and it can fail. */
  readonly isRemote = true;

  private async userId(): Promise<string | null> {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }

  /* `*` rather than a column list, which is the one place a wildcard earns
     its keep here: naming `kind` fails outright on a project whose migration
     has not been run, and the row is validated on the way in regardless. */
  async list(): Promise<Algorithm[]> {
    const supabase = await getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('algorithms')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[tobot] could not list algorithms:', error.message);
      return [];
    }
    return (data ?? []).map((row) => toAlgorithm(row as Row));
  }

  async get(id: string): Promise<Algorithm | null> {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('algorithms')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[tobot] could not read algorithm:', error.message);
      return null;
    }
    return data ? toAlgorithm(data as Row) : null;
  }

  async save(algorithm: Algorithm): Promise<void> {
    const supabase = await getSupabase();
    if (!supabase) return;
    const userId = await this.userId();
    // Without a session there is nobody to own the row; the caller keeps its
    // local copy rather than losing the edit.
    if (!userId) return;

    const core = {
      id: algorithm.id,
      user_id: userId,
      name: algorithm.name,
      body: algorithm.body,
      created_at: algorithm.createdAt,
    };

    const withKind = {
      ...core,
      kind: algorithm.kind ?? 'blocks',
      // Null rather than undefined: the column has to be cleared when a row is
      // not a code document, and `undefined` would leave the old text.
      source: algorithm.kind === 'code' ? (algorithm.source ?? '') : null,
    };

    const { error } = await supabase
      .from('algorithms')
      .upsert(missingColumns ? core : withKind, { onConflict: 'id' });

    /*
      A project whose migration has not been run yet has no `kind` column, and
      writing to one that does not exist fails the whole upsert — which meant
      adding code documents stopped *block* algorithms from saving on every
      such project, including this one's production. That is a regression to
      swallow rather than to pass on: the two new fields are dropped, the work
      is saved, and the student loses nothing they can see.

      Remembered, so the next save goes straight to the shorter row instead of
      failing once more on the way. A code document genuinely cannot be stored
      this way, and says so.
    */
    if (error && !missingColumns && isMissingColumn(error.code, error.message)) {
      missingColumns = true;
      console.warn(
        '[tobot] the algorithms table has no `kind` column yet — saving without it. ' +
          'Run the migration at the end of supabase/schema.sql to store code documents.',
      );
      if (algorithm.kind === 'code') {
        throw new Error('This project cannot store code documents until its migration is run.');
      }
      const retry = await supabase.from('algorithms').upsert(core, { onConflict: 'id' });
      if (retry.error) throw new Error(retry.error.message);
      return;
    }

    /*
      Thrown rather than logged. A failed save is the one storage error a
      student needs to know about — their work is not where they think it is —
      and swallowing it into the console meant the interface went on claiming
      everything was fine. The caller decides what to show.
    */
    if (error) throw new Error(error.message);
  }

  async remove(id: string): Promise<void> {
    const supabase = await getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from('algorithms').delete().eq('id', id);
    if (error) console.error('[tobot] could not delete algorithm:', error.message);
  }
}
