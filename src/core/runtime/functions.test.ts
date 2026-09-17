import { describe, expect, it } from 'vitest';

import { createStatement, literal, variable } from '../ast/factory';
import type { Expression, Statement } from '../ast/types';
import { Interpreter } from './interpreter';

/** Runs to completion and returns the final state. */
function execute(body: Statement[]) {
  const machine = new Interpreter(body);
  let state = machine.getState();
  let guard = 0;
  while (state.status !== 'finished' && state.status !== 'error') {
    if (guard++ > 5000) throw new Error('program did not terminate');
    state = machine.step();
  }
  return state;
}

/** What the robot said. */
const spoken = (body: Statement[]): string[] =>
  execute(body)
    .output.filter((entry) => entry.kind === 'say')
    .map((entry) => entry.text);

const fn = (
  name: string,
  params: string[],
  body: Statement[],
): Statement =>
  ({
    ...createStatement('function'),
    name,
    /* The tests care about binding, not about types, so every parameter takes
       the one kind that holds anything the tests pass. */
    params: params.map((param) => ({ name: param, type: 'number' as const })),
    body,
  }) as Statement;

const say = (value: Expression): Statement =>
  ({ ...createStatement('say'), value }) as Statement;

const ret = (value?: Expression): Statement =>
  ({ ...createStatement('return'), value }) as Statement;

const callStatement = (name: string, args: Expression[] = []): Statement =>
  ({ ...createStatement('call'), name, args }) as Statement;

const call = (name: string, args: Expression[] = []): Expression => ({
  kind: 'call',
  name,
  args,
});

const declare = (name: string, value: Expression): Statement =>
  ({ ...createStatement('declare'), name, value, valueKind: 'number' }) as Statement;

describe('functions', () => {
  it('runs a function called as a statement', () => {
    expect(
      spoken([fn('saludar', [], [say(literal('hola', 'text'))]), callStatement('saludar')]),
    ).toEqual(['hola']);
  });

  it('binds arguments to parameters', () => {
    expect(
      spoken([
        fn('saludar', ['nombre'], [say(variable('nombre'))]),
        callStatement('saludar', [literal('Ana', 'text')]),
      ]),
    ).toEqual(['Ana']);
  });

  it('gives a value back to an expression', () => {
    expect(
      spoken([
        fn('doble', ['n'], [ret({ kind: 'binary', operator: '*', left: variable('n'), right: literal(2, 'number') })]),
        say(call('doble', [literal(21, 'number')])),
      ]),
    ).toEqual(['42']);
  });

  it('can be called before it is written, the way a program reads', () => {
    expect(
      spoken([callStatement('saludar'), fn('saludar', [], [say(literal('hola', 'text'))])]),
    ).toEqual(['hola']);
  });

  /*
    The point of a scope: a function must not overwrite the caller's variable
    just because a name is shared.
  */
  it('keeps a parameter separate from a global of the same name', () => {
    expect(
      spoken([
        declare('n', literal(1, 'number')),
        fn('cambiar', ['n'], [say(variable('n'))]),
        callStatement('cambiar', [literal(99, 'number')]),
        say(variable('n')),
      ]),
    ).toEqual(['99', '1']);
  });

  it('a variable declared inside a function does not leak out', () => {
    const state = execute([
      fn('trabajar', [], [declare('interno', literal(5, 'number'))]),
      callStatement('trabajar'),
      say(variable('interno')),
    ]);
    expect(state.status).toBe('error');
  });

  it('returns early, leaving the rest of the body unrun', () => {
    expect(
      spoken([
        fn('parar', [], [say(literal('uno', 'text')), ret(), say(literal('dos', 'text'))]),
        callStatement('parar'),
      ]),
    ).toEqual(['uno']);
  });

  it('returns from inside a loop', () => {
    const loop = {
      ...createStatement('repeat'),
      times: literal(5, 'number'),
      body: [say(literal('x', 'text')), ret()],
    } as Statement;
    expect(spoken([fn('parar', [], [loop]), callStatement('parar')])).toEqual(['x']);
  });

  it('recurses, with each call keeping its own parameter', () => {
    /* cuenta(n): say n; if n > 1 then cuenta(n - 1) */
    const recurse = {
      ...createStatement('if'),
      condition: { kind: 'binary', operator: '>', left: variable('n'), right: literal(1, 'number') },
      then: [
        callStatement('cuenta', [
          { kind: 'binary', operator: '-', left: variable('n'), right: literal(1, 'number') },
        ]),
      ],
    } as Statement;
    expect(spoken([fn('cuenta', ['n'], [say(variable('n')), recurse]), callStatement('cuenta', [literal(3, 'number')])])).toEqual([
      '3',
      '2',
      '1',
    ]);
  });

  it('stops recursion that never ends, rather than hanging', () => {
    const forever = fn('siempre', [], [callStatement('siempre')]);
    expect(execute([forever, callStatement('siempre')]).status).toBe('error');
  });

  it('reports a call to something that does not exist', () => {
    expect(execute([callStatement('fantasma')]).status).toBe('error');
  });

  /* Stepping backwards has to restore the call's own variables with it. */
  it('steps back into a call and sees the parameter again', () => {
    const machine = new Interpreter([
      fn('mostrar', ['x'], [say(variable('x')), say(variable('x'))]),
      callStatement('mostrar', [literal(7, 'number')]),
    ]);
    let guard = 0;
    while (machine.getState().output.length < 2) {
      if (guard++ > 100) throw new Error('never spoke twice');
      machine.step();
    }
    const before = machine.getState().output.length;
    machine.stepBack();
    expect(machine.getState().output.length).toBe(before - 1);
    // and going forward again reproduces it
    machine.step();
    expect(machine.getState().output.length).toBe(before);
  });
});
