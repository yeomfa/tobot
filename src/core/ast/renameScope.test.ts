import { describe, expect, it } from 'vitest';

import { createStatement, literal } from './factory';
import { renameLoopVariable, renameVariable } from './operations';
import type { Statement } from './types';

/**
 * A loop's binding belongs to the loop.
 *
 * Renaming the element of `para cada nota en notas` went through the
 * program-wide rename, so it changed every other `nota` in the algorithm — and
 * when the list shared the name, it renamed the list out from under the loop
 * that was reading it. The field the student was editing said "call this
 * element something else"; what happened was a global search and replace.
 */
const listDeclaration = (name: string): Statement =>
  ({
    ...createStatement('declare'),
    name,
    valueKind: 'list',
    value: { kind: 'list', items: [literal(1, 'number')] },
  }) as Statement;

const walking = (variable: string, list: string, body: Statement[] = []): Statement =>
  ({
    ...createStatement('forEachItem'),
    variable,
    list: { kind: 'variable', name: list },
    body,
  }) as Statement;

describe('renaming what a loop binds', () => {
  it('leaves the list it walks alone, even when they share a name', () => {
    const loop = walking('elemento', 'elemento');
    const body = [listDeclaration('elemento'), loop];
    const [declaration, renamed] = renameLoopVariable(body, loop.id, 'nota');

    expect(declaration.kind === 'declare' && declaration.name).toBe('elemento');
    expect(renamed.kind === 'forEachItem' && renamed.variable).toBe('nota');
    expect(
      renamed.kind === 'forEachItem' && renamed.list.kind === 'variable' && renamed.list.name,
    ).toBe('elemento');
  });

  it('leaves an unrelated variable of the same name alone', () => {
    const loop = walking('nota', 'notas');
    const body = [{ ...createStatement('declare'), name: 'nota' } as Statement, loop];
    const [declaration] = renameLoopVariable(body, loop.id, 'x');

    expect(declaration.kind === 'declare' && declaration.name).toBe('nota');
  });

  it('carries the uses inside its own body', () => {
    const say = { ...createStatement('say'), value: { kind: 'variable', name: 'nota' } } as Statement;
    const loop = walking('nota', 'notas', [say]);
    const [renamed] = renameLoopVariable([loop], loop.id, 'elemento');

    expect(renamed.kind === 'forEachItem' && renamed.variable).toBe('elemento');
    const inner = renamed.kind === 'forEachItem' ? renamed.body[0] : null;
    expect(inner?.kind === 'say' && inner.value.kind === 'variable' && inner.value.name).toBe(
      'elemento',
    );
  });

  it('renames a counted loop the same way', () => {
    const loop = { ...createStatement('forEach'), variable: 'i' } as Statement;
    const body = [{ ...createStatement('declare'), name: 'i' } as Statement, loop];
    const [declaration, renamed] = renameLoopVariable(body, loop.id, 'contador');

    expect(declaration.kind === 'declare' && declaration.name).toBe('i');
    expect(renamed.kind === 'forEach' && renamed.variable).toBe('contador');
  });

  it('reaches a loop nested inside another statement', () => {
    const loop = walking('nota', 'notas');
    const outer = { ...createStatement('repeat'), body: [loop] } as Statement;
    const [renamed] = renameLoopVariable([outer], loop.id, 'x');
    const inner = renamed.kind === 'repeat' ? renamed.body[0] : null;

    expect(inner?.kind === 'forEachItem' && inner.variable).toBe('x');
  });

  it('accepts an empty name, since a half-typed field is a normal state', () => {
    const loop = walking('nota', 'notas');
    const [renamed] = renameLoopVariable([loop], loop.id, '');
    expect(renamed.kind === 'forEachItem' && renamed.variable).toBe('');
  });

  /* The global rename is still right where a name really is program-wide. */
  it('leaves the program-wide rename untouched', () => {
    const body = [
      { ...createStatement('declare'), name: 'total' } as Statement,
      { ...createStatement('say'), value: { kind: 'variable', name: 'total' } } as Statement,
    ];
    const [, said] = renameVariable(body, 'total', 'suma');
    expect(said.kind === 'say' && said.value.kind === 'variable' && said.value.name).toBe('suma');
  });
});
