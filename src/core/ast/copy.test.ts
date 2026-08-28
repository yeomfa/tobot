import { describe, expect, it } from 'vitest';

import { createId, literal, variable } from './factory';
import { copyStatement } from './operations';
import type { Statement } from './types';

/** Every id inside a statement, so a copy can be checked for collisions. */
function idsIn(statement: Statement): string[] {
  const ids = [statement.id];
  if (statement.kind === 'if') {
    ids.push(...statement.then.flatMap(idsIn));
    for (const arm of statement.elseIfs ?? []) {
      ids.push(arm.id, ...arm.body.flatMap(idsIn));
    }
    ids.push(...(statement.otherwise ?? []).flatMap(idsIn));
  } else if ('body' in statement) {
    ids.push(...(statement.body as Statement[]).flatMap(idsIn));
  }
  return ids;
}

describe('copyStatement', () => {
  it('gives the copy a different id', () => {
    const say: Statement = { id: createId(), kind: 'say', value: literal('hola', 'text') };
    expect(copyStatement(say).id).not.toBe(say.id);
  });

  it('keeps everything else', () => {
    const say: Statement = { id: createId(), kind: 'say', value: literal('hola', 'text') };
    const copy = copyStatement(say);
    expect({ ...copy, id: say.id }).toEqual(say);
  });

  it('renames every node in a nested block, not just the root', () => {
    /*
      Ids address blocks — a drop target, a flowchart node, the statement the
      interpreter is on. A copy that shared any of them would be a second block
      claiming to be the first, and edits would land on whichever came first.
    */
    const original: Statement = {
      id: createId(),
      kind: 'if',
      condition: variable('n'),
      then: [{ id: createId(), kind: 'say', value: literal('sí', 'text') }],
      elseIfs: [
        {
          id: createId(),
          condition: variable('m'),
          body: [{ id: createId(), kind: 'say', value: literal('quizá', 'text') }],
        },
      ],
      otherwise: [{ id: createId(), kind: 'say', value: literal('no', 'text') }],
    };

    const copy = copyStatement(original);
    const before = idsIn(original);
    const after = idsIn(copy);

    expect(after).toHaveLength(before.length);
    expect(after.filter((id) => before.includes(id))).toEqual([]);
    expect(new Set(after).size).toBe(after.length);
  });

  it('leaves the original untouched', () => {
    const loop: Statement = {
      id: createId(),
      kind: 'while',
      condition: literal(true, 'boolean'),
      body: [{ id: createId(), kind: 'say', value: literal('x', 'text') }],
    };
    const snapshot = JSON.stringify(loop);
    copyStatement(loop);
    expect(JSON.stringify(loop)).toBe(snapshot);
  });
});
