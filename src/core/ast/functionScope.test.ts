import { describe, expect, it } from 'vitest';

import { createStatement, literal, variable } from './factory';
import { renameVariable } from './operations';
import { bodiesOf } from './types';
import type { Statement } from './types';

const ask = (target: string): Statement =>
  ({ ...createStatement('ask'), target, prompt: literal('?', 'text') }) as Statement;

const fnWith = (name: string, params: string[], body: Statement[]): Statement =>
  ({
    ...createStatement('function'),
    name,
    params: params.map((param) => ({ name: param, type: 'number' as const })),
    body,
  }) as Statement;

const declare = (name: string): Statement =>
  ({ ...createStatement('declare'), name, value: literal(1, 'number') }) as Statement;

/**
 * `renameVariable` never walked into a function's body, so editing the name a
 * `preguntar` saves into — inside a function — renamed an unrelated variable
 * *outside* it and left the one being edited untouched. The field looked like
 * it refused to change.
 */
describe('renaming reaches inside a function', () => {
  it('renames what the function itself holds', () => {
    const program = [fnWith('leer', [], [ask('dato')])];
    const [renamed] = renameVariable(program, 'dato', 'respuesta');
    const inner = renamed.kind === 'function' ? renamed.body[0] : null;
    expect(inner?.kind === 'ask' && inner.target).toBe('respuesta');
  });

  it('renames a use inside the body too', () => {
    const say = { ...createStatement('say'), value: variable('dato') } as Statement;
    const program = [fnWith('leer', [], [ask('dato'), say])];
    const [renamed] = renameVariable(program, 'dato', 'respuesta');
    const inner = renamed.kind === 'function' ? renamed.body[1] : null;
    expect(inner?.kind === 'say' && inner.value.kind === 'variable' && inner.value.name).toBe(
      'respuesta',
    );
  });

  /*
    A parameter of the same name shadows the outer variable, so the rename
    stops at the door: inside, that name means the parameter, and renaming it
    would be renaming something else that merely shares a spelling.
  */
  it('stops at a parameter that shadows the name', () => {
    const say = { ...createStatement('say'), value: variable('n') } as Statement;
    const program = [declare('n'), fnWith('doble', ['n'], [say])];
    const [, fn] = renameVariable(program, 'n', 'total');
    const inner = fn.kind === 'function' ? fn.body[0] : null;
    expect(inner?.kind === 'say' && inner.value.kind === 'variable' && inner.value.name).toBe('n');
  });

  it('renames the declaration outside either way', () => {
    const program = [declare('n'), fnWith('doble', ['n'], [])];
    const [declaration] = renameVariable(program, 'n', 'total');
    expect(declaration.kind === 'declare' && declaration.name).toBe('total');
  });

  it('renames a variable passed as an argument', () => {
    const call = { ...createStatement('call'), name: 'doble', args: [variable('dato')] } as Statement;
    const [renamed] = renameVariable([call], 'dato', 'respuesta');
    const arg = renamed.kind === 'call' ? renamed.args[0] : null;
    expect(arg?.kind === 'variable' && arg.name).toBe('respuesta');
  });

  it('renames inside a returned expression', () => {
    const ret = { ...createStatement('return'), value: variable('dato') } as Statement;
    const [renamed] = renameVariable([ret], 'dato', 'respuesta');
    expect(renamed.kind === 'return' && renamed.value?.kind === 'variable' && renamed.value.name).toBe(
      'respuesta',
    );
  });
});

/**
 * The enumerator the compiler checks. Six walks have been found missing a
 * statement kind, every one of them a `switch` whose `default` returned
 * something plausible — which the type checker cannot see through.
 */
describe('bodiesOf', () => {
  it('finds a function body', () => {
    expect(bodiesOf(fnWith('x', [], [ask('a')]))).toHaveLength(1);
  });

  it('finds every arm of a decision', () => {
    const branch = {
      ...createStatement('if'),
      then: [ask('a')],
      elseIfs: [{ id: 'e1', condition: literal(true, 'boolean'), body: [ask('b')] }],
      otherwise: [ask('c')],
    } as Statement;
    expect(bodiesOf(branch)).toHaveLength(3);
  });

  it('finds nothing on a statement that owns no body', () => {
    expect(bodiesOf(ask('a'))).toHaveLength(0);
    expect(bodiesOf(createStatement('call'))).toHaveLength(0);
    expect(bodiesOf(createStatement('return'))).toHaveLength(0);
  });
});
