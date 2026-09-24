/**
 * Recognising a database that has not been migrated yet.
 *
 * Its own file with its own tests because the first attempt was a regex
 * written from memory of what the error probably said, and it was wrong in the
 * one direction that matters: it never matched, so the fallback it guarded
 * never ran and every save failed instead. The real message puts the column
 * name *before* the word `column`, and PostgREST answers about its schema
 * cache rather than with Postgres's own code.
 *
 * A rule this easy to get wrong by eye belongs where it can be asserted.
 */
export function isMissingColumn(code: string | undefined, message: string): boolean {
  // PostgREST cannot find the column in its cached schema; Postgres itself
  // would say 42703. Either means the same thing to this app.
  if (code === 'PGRST204' || code === '42703') return true;

  return (
    /could not find the '(kind|source)' column/i.test(message) ||
    /column\s+"?(kind|source)"?\s+(of|does not exist)/i.test(message) ||
    /'(kind|source)' column .* schema cache/i.test(message)
  );
}
