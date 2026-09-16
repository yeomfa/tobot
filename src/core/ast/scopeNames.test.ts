import { describe, expect, it } from 'vitest';

import { createStatement } from './factory';
import { collectVariables } from './operations';
import type { Statement } from './types';

/**
 * Every name a student can bind has to reach the variable picker.
 *
 * `para cada elemento` was missing, so the element being walked could not be
 * referenced inside its own loop: the picker did not list it, and there was no
 * other way to name it. The same pair of list statements had already been
 * missing from `renameVariable`, `countReferences` and the shape validator —
 * this walk was the fourth.
 */
describe('names in scope', () => {
  const named = (kind: 'declare' | 'ask' | 'forEach' | 'forEachItem', name: string): Statement => {
    const base = createStatement(kind);
    if (kind === 'declare') return { ...base, name } as Statement;
    if (kind === 'ask') return { ...base, target: name } as Statement;
    return { ...base, variable: name } as Statement;
  };

  it('collects the name a `para cada elemento` binds', () => {
    expect(collectVariables([named('forEachItem', 'nota')])).toContain('nota');
  });

  it('collects every kind that binds a name', () => {
    const body = [
      named('declare', 'a'),
      named('ask', 'b'),
      named('forEach', 'c'),
      named('forEachItem', 'd'),
    ];
    expect(collectVariables(body)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('sees a name bound inside a loop body', () => {
    const inner = named('forEachItem', 'letra');
    const outer = { ...createStatement('repeat'), body: [inner] } as Statement;
    expect(collectVariables([outer])).toContain('letra');
  });

  it('leaves `cambiar lista` out: its name refers to a list already declared', () => {
    const listOp = { ...createStatement('listOp'), name: 'notas' } as Statement;
    expect(collectVariables([listOp])).not.toContain('notas');
  });
});
