import type { Statement } from '../ast/types';

/** Anything with a `kind` is a node of the tree, statement or expression. */
interface Node {
  kind: string;
  name?: unknown;
  isAsync?: unknown;
  body?: unknown;
}

/**
 * Every node beneath a value, statements and expressions alike.
 *
 * Structural rather than a `switch` per kind. Elsewhere in the AST the switches
 * are deliberate — `bodiesOf` explains why, with six bugs of a missed field —
 * but those are walks that must treat each kind differently. This one asks
 * only "is there a question or a call anywhere under here", and a structural
 * walk is the one that cannot forget where a kind keeps its expressions.
 */
function visit(value: unknown, onNode: (node: Node) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, onNode);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const node = value as Record<string, unknown>;
  if (typeof node.kind === 'string') onNode(node as unknown as Node);
  for (const key of Object.keys(node)) visit(node[key], onNode);
}

/**
 * The functions that wait for an answer, and so must be written `async`.
 *
 * An `ask` is emitted as `await prompt(...)`, because asking waits. That is
 * fine at the top of a program, which the runner wraps in an async function —
 * and a SyntaxError inside a plain `function`. So any function that asks has
 * to be `async`, and then so does any function that calls *it*, because the
 * caller has to wait too. This finds that set, by fixed point.
 *
 * A function the student marked async themselves is not in it. Theirs runs
 * "on its own while the program carries on", so its calls must *not* be
 * awaited — awaiting it would quietly change what the program does.
 */
export function functionsThatWait(program: Statement[]): Set<string> {
  const plain = new Map<string, { asks: boolean; calls: Set<string> }>();

  visit(program, (node) => {
    if (node.kind !== 'function' || typeof node.name !== 'string' || node.isAsync) return;

    let asks = false;
    const calls = new Set<string>();
    visit(node.body, (inner) => {
      if (inner.kind === 'ask') asks = true;
      if (inner.kind === 'call' && typeof inner.name === 'string') calls.add(inner.name);
    });
    plain.set(node.name, { asks, calls });
  });

  const waits = new Set<string>();
  for (const [name, facts] of plain) if (facts.asks) waits.add(name);

  // Whoever calls a function that waits, waits too — until nothing changes.
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, facts] of plain) {
      if (waits.has(name)) continue;
      if ([...facts.calls].some((called) => waits.has(called))) {
        waits.add(name);
        grew = true;
      }
    }
  }

  return waits;
}
