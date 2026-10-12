/**
 * Formatting a student's program: spacing, line breaks, quotes and semicolons,
 * not only indentation.
 *
 * Prettier, because it is what the student will meet in every real editor, so
 * the shape it gives their code is the shape code has outside Tobot too. It is
 * the heaviest thing the code editor can use, so it is fetched the first time
 * someone asks for it and never before: a student who never formats never
 * downloads it.
 */

export type FormatOutcome =
  | { ok: true; source: string; cursor: number }
  | { ok: false; line: number | null; message: string };

export async function formatSource(source: string, cursor: number): Promise<FormatOutcome> {
  const [prettier, babel, estree] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ]);
  try {
    const result = await prettier.formatWithCursor(source, {
      cursorOffset: Math.min(Math.max(cursor, 0), source.length),
      parser: 'babel',
      plugins: [babel, estree],
      /* Prettier's defaults, said out loud: these are the choices a student
         will see everywhere else, which is the point of using it. */
      semi: true,
      singleQuote: false,
      tabWidth: 2,
      printWidth: 80,
    });
    return { ok: true, source: result.formatted, cursor: result.cursorOffset };
  } catch (thrown) {
    /* A program that does not parse cannot be laid out. Said with the line,
       because "it did nothing" is the one answer a student cannot act on. */
    const located = thrown as { loc?: { start?: { line?: number } }; message?: string };
    const message = (located.message ?? String(thrown)).split('\n')[0].replace(/\s*\(\d+:\d+\)\s*$/, '');
    return { ok: false, line: located.loc?.start?.line ?? null, message };
  }
}
