import { describe, expect, it } from 'vitest';

import { createStatement, literal, variable } from './factory';
import type { Expression, Statement } from './types';
import { validate } from './validate';

const keys = (program: Statement[]): string[] =>
  validate(program).map((problem) => problem.messageKey);

const fn = (name: string, params: string[], body: Statement[] = []): Statement =>
  ({
    ...createStatement('function'),
    name,
    params: params.map((param) => ({ name: param, type: 'number' as const })),
    body,
  }) as Statement;

const callStatement = (name: string, args: Expression[] = []): Statement =>
  ({ ...createStatement('call'), name, args }) as Statement;

const say = (value: Expression): Statement => ({ ...createStatement('say'), value }) as Statement;

const call = (name: string, args: Expression[] = []): Expression => ({ kind: 'call', name, args });

/**
 * Calling a function wrong is a mistake the interpreter only meets at run
 * time, which is exactly the kind these checks exist to catch first.
 */
describe('calls', () => {
  it('flags a call to a function that does not exist', () => {
    expect(keys([callStatement('fantasma')])).toContain('unknownFunction');
  });

  it('accepts a call to a function written further down', () => {
    /* The interpreter collects functions before the first step, so reading
       order is not a constraint — the main steps go first and the detail
       below, which is how a program is meant to read. */
    expect(keys([callStatement('saludar'), fn('saludar', [])])).not.toContain('unknownFunction');
  });

  it('flags too few arguments', () => {
    expect(keys([fn('doble', ['n']), callStatement('doble')])).toContain('wrongArgumentCount');
  });

  it('flags too many arguments', () => {
    expect(
      keys([fn('saludar', []), callStatement('saludar', [literal(1, 'number')])]),
    ).toContain('wrongArgumentCount');
  });

  it('accepts the right number', () => {
    expect(
      keys([fn('doble', ['n']), callStatement('doble', [literal(2, 'number')])]),
    ).not.toContain('wrongArgumentCount');
  });

  it('flags a call with nothing chosen', () => {
    expect(keys([callStatement('')])).toContain('noFunctionChosen');
  });

  /* A call inside an expression is checked like any other, which needs the
     walk to reach into it — it did not, and a name used only there was
     invisible to every check. */
  it('checks a call used as a value', () => {
    expect(keys([say(call('fantasma'))])).toContain('unknownFunction');
  });

  it('sees a variable used only inside a call argument', () => {
    expect(keys([fn('doble', ['n']), say(call('doble', [variable('fantasma')]))])).toContain(
      'undefinedVariable',
    );
  });
});

describe('function declarations', () => {
  it('warns about a function that does nothing', () => {
    expect(keys([fn('vacia', [])])).toContain('emptyFunction');
  });

  it('flags a parameter with no name', () => {
    expect(keys([fn('doble', [''], [say(literal('x', 'text'))])])).toContain('emptyParam');
  });

  it('sees the parameters inside the body', () => {
    expect(keys([fn('doble', ['n'], [say(variable('n'))])])).not.toContain('undefinedVariable');
  });

  /*
    The point of a scope, checked statically: a name that exists outside is
    not in scope inside, and saying otherwise would hide the mistake the scope
    exists to prevent.
  */
  it('does not see the caller’s variables inside the body', () => {
    const program: Statement[] = [
      { ...createStatement('declare'), name: 'fuera', value: literal(1, 'number') } as Statement,
      fn('trabajar', [], [say(variable('fuera'))]),
    ];
    expect(keys(program)).toContain('undefinedVariable');
  });

  it('restores the outer scope after the body', () => {
    const program: Statement[] = [
      { ...createStatement('declare'), name: 'fuera', value: literal(1, 'number') } as Statement,
      fn('trabajar', ['n'], [say(variable('n'))]),
      say(variable('fuera')),
    ];
    expect(keys(program)).not.toContain('undefinedVariable');
  });
});

describe('return', () => {
  it('flags a `devolver` outside any function', () => {
    expect(keys([createStatement('return')])).toContain('returnOutsideFunction');
  });

  it('accepts one inside a function', () => {
    expect(keys([fn('doble', ['n'], [createStatement('return')])])).not.toContain(
      'returnOutsideFunction',
    );
  });

  it('accepts one nested in a loop inside a function', () => {
    const loop = {
      ...createStatement('repeat'),
      body: [createStatement('return')],
    } as Statement;
    expect(keys([fn('parar', [], [loop])])).not.toContain('returnOutsideFunction');
  });
});
