import type { Statement } from './types';
import { copyStatement } from './operations';
import { sanitizeStatements } from './validateShape';

/**
 * Carrying statements through the system clipboard.
 *
 * Text rather than an in-memory variable, so a block copied in one algorithm
 * can be pasted into another — or into a second tab, which is how a student
 * moves work between the exercise they are doing and the one they did last
 * week. The cost is that anything at all can arrive on the clipboard, so
 * nothing read here is trusted: it goes through the same shape check that
 * guards a file loaded from storage.
 */

/** Marks our own payload, so arbitrary copied text is not mistaken for one. */
const MARKER = 'tobot/statements@1';

interface Payload {
  kind: typeof MARKER;
  statements: Statement[];
}

/** Renders statements as clipboard text. */
export function encodeStatements(statements: Statement[]): string {
  const payload: Payload = { kind: MARKER, statements };
  /* Indented: a student who pastes this into a document or a message sees
     something legible rather than one unbroken line. */
  return JSON.stringify(payload, null, 2);
}

/**
 * Reads statements back, or returns null when the text is not ours.
 *
 * Every statement gets fresh ids. Two copies of one block would otherwise
 * share an id, and the editor addresses everything by id — selecting one would
 * select both, and deleting one would delete both.
 */
export function decodeStatements(text: string): Statement[] | null {
  if (!text.trim().startsWith('{')) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const payload = parsed as Partial<Payload>;
  if (payload.kind !== MARKER) return null;

  const statements = sanitizeStatements(payload.statements);
  return statements.length > 0 ? statements.map(copyStatement) : null;
}
