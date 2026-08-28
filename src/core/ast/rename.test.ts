import { describe, expect, it } from 'vitest';

import { createId, literal, variable } from './factory';
import { collectVariables, countReferences, renameVariable } from './operations';
import type { Statement } from './types';

const id = (): string => createId();

describe('renameVariable', () => {
  it('carries every use with the declaration', () => {
    /*
      The reported bug: renaming where a variable is created left every use
      pointing at a name that no longer existed, and nothing said so.
    */
    const body: Statement[] = [
      { id: id(), kind: 'declare', name: 'nota', valueKind: 'number', value: literal(0, 'number') },
      { id: id(), kind: 'say', value: variable('nota') },
      { id: id(), kind: 'assign', name: 'nota', value: literal(5, 'number') },
    ];

    const renamed = renameVariable(body, 'nota', 'calificacion');

    expect(collectVariables(renamed)).toEqual(['calificacion']);
    expect(countReferences(renamed, 'nota')).toBe(0);
    expect(countReferences(renamed, 'calificacion')).toBe(2);
  });

  it('reaches inside expressions and nested branches', () => {
    const body: Statement[] = [
      { id: id(), kind: 'declare', name: 'n', valueKind: 'number', value: literal(1, 'number') },
      {
        id: id(),
        kind: 'if',
        condition: { kind: 'binary', operator: '>', left: variable('n'), right: literal(3, 'number') },
        then: [{ id: id(), kind: 'say', value: variable('n') }],
        otherwise: [{ id: id(), kind: 'say', value: variable('n') }],
      },
    ];

    const renamed = renameVariable(body, 'n', 'total');
    expect(countReferences(renamed, 'n')).toBe(0);
    expect(countReferences(renamed, 'total')).toBe(3);
  });

  it('renames a loop counter and its uses', () => {
    const body: Statement[] = [
      {
        id: id(),
        kind: 'forEach',
        variable: 'i',
        from: literal(1, 'number'),
        to: literal(5, 'number'),
        step: literal(1, 'number'),
        body: [{ id: id(), kind: 'say', value: variable('i') }],
      },
    ];

    const renamed = renameVariable(body, 'i', 'contador');
    expect(collectVariables(renamed)).toEqual(['contador']);
    expect(countReferences(renamed, 'contador')).toBe(1);
  });

  it('leaves other names alone', () => {
    const body: Statement[] = [
      { id: id(), kind: 'declare', name: 'a', valueKind: 'number', value: literal(1, 'number') },
      { id: id(), kind: 'declare', name: 'ab', valueKind: 'number', value: literal(2, 'number') },
      { id: id(), kind: 'say', value: variable('ab') },
    ];

    const renamed = renameVariable(body, 'a', 'z');
    // A prefix match must not be swept up: `ab` is a different variable.
    expect(collectVariables(renamed)).toEqual(['z', 'ab']);
    expect(countReferences(renamed, 'ab')).toBe(1);
  });

  it('does nothing when the name is empty or unchanged', () => {
    const body: Statement[] = [
      { id: id(), kind: 'declare', name: 'x', valueKind: 'number', value: literal(0, 'number') },
    ];
    expect(renameVariable(body, '', 'y')).toBe(body);
    expect(renameVariable(body, 'x', 'x')).toBe(body);
  });
});
