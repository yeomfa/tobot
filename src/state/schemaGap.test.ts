import { describe, expect, it } from 'vitest';

import { isMissingColumn } from './schemaGap';

/**
 * These strings are copied from a real failure rather than imagined.
 *
 * The first version of this rule was written from a guess at the wording and
 * matched none of them, so the fallback it existed to trigger never fired and
 * saving broke for every algorithm, not only the new kind.
 */
describe('recognising a table that has not been migrated', () => {
  it('reads what PostgREST actually says', () => {
    expect(
      isMissingColumn(
        undefined,
        "Could not find the 'kind' column of 'algorithms' in the schema cache",
      ),
    ).toBe(true);
    expect(
      isMissingColumn(
        undefined,
        "Could not find the 'source' column of 'algorithms' in the schema cache",
      ),
    ).toBe(true);
  });

  it('trusts the code when there is one', () => {
    expect(isMissingColumn('PGRST204', 'anything at all')).toBe(true);
    expect(isMissingColumn('42703', 'anything at all')).toBe(true);
  });

  it('reads what Postgres says when the request reaches it', () => {
    expect(isMissingColumn(undefined, 'column "kind" of relation "algorithms" does not exist')).toBe(
      true,
    );
  });

  // Saving has to keep failing loudly for everything else: a row rejected by
  // row-level security is not a missing column, and retrying without two
  // fields would turn a real refusal into silence.
  it('does not mistake any other failure for a missing column', () => {
    expect(isMissingColumn('42501', 'new row violates row-level security policy')).toBe(false);
    expect(isMissingColumn(undefined, 'JWT expired')).toBe(false);
    expect(isMissingColumn(undefined, 'duplicate key value violates unique constraint')).toBe(false);
    expect(isMissingColumn(undefined, "Could not find the 'name' column of 'algorithms'")).toBe(
      false,
    );
  });
});
