import { describe, expect, it } from 'vitest';

import { createStatement, literal } from './factory';
import { namesInScopeAt } from './operations';
import type { Statement, ValueKind } from './types';

const declare = (name: string, valueKind: ValueKind = 'number'): Statement =>
  ({ ...createStatement('declare'), name, valueKind, value: literal(0, 'number') }) as Statement;

const say = (): Statement => ({ ...createStatement('say'), value: literal('', 'text') }) as Statement;

const names = (program: Statement[], id: string): string[] =>
  namesInScopeAt(program, id).map((entry) => entry.name);

/**
 * The picker used to offer every name the algorithm declared anywhere, which
 * told the student that a variable created three blocks further down was
 * available now, and that a function could see the caller's variables.
 * Neither is true when the program runs.
 */
describe('what is in scope', () => {
  it('sees a variable declared before it', () => {
    const target = say();
    expect(names([declare('antes'), target], target.id)).toEqual(['antes']);
  });

  it('does not see one declared after it', () => {
    const target = say();
    expect(names([target, declare('después')], target.id)).toEqual([]);
  });

  it('sees names from the blocks it sits inside', () => {
    const target = say();
    const loop = { ...createStatement('repeat'), body: [target] } as Statement;
    expect(names([declare('fuera'), loop], target.id)).toEqual(['fuera']);
  });

  it('sees a loop counter inside the loop', () => {
    const target = say();
    const loop = { ...createStatement('forEach'), variable: 'i', body: [target] } as Statement;
    expect(names([loop], target.id)).toContain('i');
  });

  it('does not see the counter after the loop', () => {
    const target = say();
    const loop = { ...createStatement('forEach'), variable: 'i', body: [] } as Statement;
    expect(names([loop, target], target.id)).not.toContain('i');
  });

  it('sees a list element inside its own walk', () => {
    const target = say();
    const loop = { ...createStatement('forEachItem'), variable: 'nota', body: [target] } as Statement;
    expect(names([loop], target.id)).toContain('nota');
  });

  /*
    A function starts fresh. Seeing the caller's variables is exactly what a
    scope exists to prevent, and offering them in the picker promised
    something the interpreter refuses.
  */
  it('does not see the caller’s variables inside a function', () => {
    const target = say();
    const fn = {
      ...createStatement('function'),
      name: 'trabajar',
      params: [],
      body: [target],
    } as Statement;
    expect(names([declare('fuera'), fn], target.id)).toEqual([]);
  });

  it('sees its own parameters inside a function', () => {
    const target = say();
    const fn = {
      ...createStatement('function'),
      name: 'doble',
      params: [{ name: 'n', type: 'number' as const }],
      body: [target],
    } as Statement;
    expect(names([fn], target.id)).toEqual(['n']);
  });

  it('sees what the function declares before the statement', () => {
    const target = say();
    const fn = {
      ...createStatement('function'),
      name: 'trabajar',
      params: [],
      body: [declare('interno'), target],
    } as Statement;
    expect(names([fn], target.id)).toEqual(['interno']);
  });

  it('sees a name declared in a branch it is inside', () => {
    const target = say();
    const branch = {
      ...createStatement('if'),
      then: [declare('dentro'), target],
    } as Statement;
    expect(names([branch], target.id)).toContain('dentro');
  });

  it('carries the declared type with each name', () => {
    const target = say();
    const scope = namesInScopeAt([declare('notas', 'list'), target], target.id);
    expect(scope).toEqual([{ name: 'notas', kind: 'list' }]);
  });

  it('gives a list element no kind, since the list does not say', () => {
    const target = say();
    const loop = { ...createStatement('forEachItem'), variable: 'nota', body: [target] } as Statement;
    const scope = namesInScopeAt([loop], target.id);
    expect(scope.find((entry) => entry.name === 'nota')?.kind).toBe('unknown');
  });

  it('returns nothing for a statement that is not in the program', () => {
    expect(names([declare('x')], 'no_existe')).toEqual([]);
  });
});
