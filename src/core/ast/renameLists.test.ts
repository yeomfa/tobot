import { describe, expect, it } from 'vitest';

import { createStatement, literal, variable } from './factory';
import type { Statement } from './types';
import { countReferences, renameVariable } from './operations';

const forEachItem = (varName: string, listName: string, body: Statement[] = []): Statement =>
  ({
    ...createStatement('forEachItem'),
    variable: varName,
    list: variable(listName),
    body,
  }) as Statement;

const listOp = (name: string): Statement =>
  ({ ...createStatement('listOp'), operation: 'append', name, value: literal(1, 'number') }) as Statement;

const say = (name: string): Statement =>
  ({ ...createStatement('say'), value: variable(name) }) as Statement;

/**
 * Renaming has to reach every statement that holds a name.
 *
 * Both statements that came with lists were missing from the walk, which ended
 * in a silent `default`. For `para cada` that meant its element name could not
 * be typed at all — each keystroke went to the rename, found nothing to
 * rewrite, and was discarded. For `cambiar lista` it meant renaming a list
 * left the operation pointing at a name that no longer existed.
 */
describe('renaming reaches the list statements', () => {
  it('renames the element of a `para cada`', () => {
    const [renamed] = renameVariable([forEachItem('elemento', 'notas')], 'elemento', 'nota');
    expect(renamed.kind === 'forEachItem' && renamed.variable).toBe('nota');
  });

  it('renames the list a `para cada` walks', () => {
    const [renamed] = renameVariable([forEachItem('x', 'notas')], 'notas', 'puntajes');
    const list = renamed.kind === 'forEachItem' ? renamed.list : null;
    expect(list?.kind === 'variable' && list.name).toBe('puntajes');
  });

  it('reaches uses inside a `para cada` body', () => {
    const [renamed] = renameVariable([forEachItem('x', 'notas', [say('total')])], 'total', 'suma');
    const inner = renamed.kind === 'forEachItem' ? renamed.body[0] : null;
    const value = inner?.kind === 'say' ? inner.value : null;
    expect(value?.kind === 'variable' && value.name).toBe('suma');
  });

  it('renames the list a `cambiar lista` acts on', () => {
    const [renamed] = renameVariable([listOp('notas')], 'notas', 'puntajes');
    expect(renamed.kind === 'listOp' && renamed.name).toBe('puntajes');
  });

  it('leaves a different name alone', () => {
    const [renamed] = renameVariable([listOp('notas')], 'otra', 'puntajes');
    expect(renamed.kind === 'listOp' && renamed.name).toBe('notas');
  });
});

describe('counting uses includes the list statements', () => {
  it('counts the list a `para cada` walks', () => {
    expect(countReferences([forEachItem('x', 'notas')], 'notas')).toBe(1);
  });

  it('counts uses inside its body', () => {
    expect(countReferences([forEachItem('x', 'notas', [say('notas')])], 'notas')).toBe(2);
  });

  it('counts the list a `cambiar lista` names', () => {
    expect(countReferences([listOp('notas')], 'notas')).toBe(1);
  });
});
