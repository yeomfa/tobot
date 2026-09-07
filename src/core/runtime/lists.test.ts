import { describe, expect, it } from 'vitest';

import { createId, literal, variable } from '../ast/factory';
import type { Expression, Statement } from '../ast/types';
import { Interpreter } from './interpreter';

const id = (): string => createId();

const declare = (name: string, value: Expression): Statement =>
  ({ id: id(), kind: 'declare', name, valueKind: 'number', value }) as Statement;
const say = (value: Expression): Statement => ({ id: id(), kind: 'say', value }) as Statement;
const list = (...items: Expression[]): Expression => ({ kind: 'list', items });
const index = (l: Expression, i: Expression): Expression => ({ kind: 'index', list: l, index: i });
const length = (l: Expression): Expression => ({ kind: 'length', list: l });
const num = (n: number): Expression => literal(n, 'number');
const text = (t: string): Expression => literal(t, 'text');

/** Runs to completion, the same way `core.test.ts` drives the machine. */
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

/** What the robot said, for a program expected to finish. */
function run(...body: Statement[]): string[] {
  const state = execute(body);
  if (state.status === 'error') throw new Error(state.error?.messageKey ?? 'unknown');
  return state.output.filter((entry) => entry.kind === 'say').map((entry) => entry.text);
}

/** The error a program stopped on, or null when it finished cleanly. */
function runFailing(...body: Statement[]): string | null {
  const state = execute(body);
  return state.status === 'error' ? (state.error?.messageKey ?? 'unknown') : null;
}

describe('lists at run time', () => {
  it('says a list the way a student would write one', () => {
    expect(run(declare('n', list(num(1), num(2), num(3))), say(variable('n')))).toEqual(['[1, 2, 3]']);
  });

  it('builds a list from what the program already knows', () => {
    expect(
      run(declare('a', num(7)), declare('n', list(variable('a'), num(2))), say(variable('n'))),
    ).toEqual(['[7, 2]']);
  });

  it('reads one element by position', () => {
    expect(
      run(declare('n', list(num(10), num(20), num(30))), say(index(variable('n'), num(1)))),
    ).toEqual(['20']);
  });

  it('counts how many it holds', () => {
    expect(run(declare('n', list(num(1), num(2))), say(length(variable('n'))))).toEqual(['2']);
  });

  it('writes one element without touching the others', () => {
    expect(
      run(
        declare('n', list(num(1), num(2), num(3))),
        { id: id(), kind: 'assign', name: 'n', index: num(0), value: num(9) } as Statement,
        say(variable('n')),
      ),
    ).toEqual(['[9, 2, 3]']);
  });

  it('refuses a position past the end, rather than saying nothing', () => {
    expect(runFailing(declare('n', list(num(1))), say(index(variable('n'), num(5))))).toBe(
      'errors.indexOutOfRange',
    );
  });

  it('refuses a fractional position', () => {
    expect(
      runFailing(declare('n', list(num(1), num(2))), say(index(variable('n'), literal(0.5, 'number')))),
    ).toBe('errors.indexNotWhole');
  });

  it('refuses arithmetic on a whole list, which is always a mistake', () => {
    expect(
      runFailing(
        declare('n', list(num(1))),
        say({ kind: 'binary', operator: '-', left: variable('n'), right: num(1) }),
      ),
    ).toBe('errors.listNotANumber');
  });

  it('treats an empty list as false, like an empty string', () => {
    expect(
      run(
        declare('n', list()),
        {
          id: id(), kind: 'if', condition: variable('n'),
          then: [say(text('lleno'))], otherwise: [say(text('vacío'))],
        } as Statement,
      ),
    ).toEqual(['vacío']);
  });
});

describe('list operations', () => {
  const op = (operation: string, name: string, extra: Record<string, unknown> = {}): Statement =>
    ({ id: id(), kind: 'listOp', operation, name, ...extra }) as Statement;

  it('appends to the end', () => {
    expect(
      run(declare('n', list(num(1))), op('append', 'n', { value: num(2) }), say(variable('n'))),
    ).toEqual(['[1, 2]']);
  });

  it('inserts at a position', () => {
    expect(
      run(
        declare('n', list(num(1), num(3))),
        op('insert', 'n', { value: num(2), index: num(1) }),
        say(variable('n')),
      ),
    ).toEqual(['[1, 2, 3]']);
  });

  it('allows inserting one past the end, which is appending', () => {
    expect(
      run(
        declare('n', list(num(1))),
        op('insert', 'n', { value: num(2), index: num(1) }),
        say(variable('n')),
      ),
    ).toEqual(['[1, 2]']);
  });

  it('removes at a position', () => {
    expect(
      run(
        declare('n', list(num(1), num(2), num(3))),
        op('removeAt', 'n', { index: num(1) }),
        say(variable('n')),
      ),
    ).toEqual(['[1, 3]']);
  });

  it('refuses to remove from an empty list', () => {
    expect(runFailing(declare('n', list()), op('removeAt', 'n', { index: num(0) }))).toBe(
      'errors.emptyList',
    );
  });

  it('sorts numbers as numbers, not as text', () => {
    // The bug this guards: JavaScript's default sort puts 10 before 2.
    expect(
      run(declare('n', list(num(10), num(2), num(33))), op('sort', 'n'), say(variable('n'))),
    ).toEqual(['[2, 10, 33]']);
  });

  it('sorts largest first when asked', () => {
    expect(
      run(
        declare('n', list(num(2), num(10))),
        op('sort', 'n', { descending: true }),
        say(variable('n')),
      ),
    ).toEqual(['[10, 2]']);
  });

  it('sorts text alphabetically', () => {
    expect(
      run(
        declare('n', list(text('pera'), text('ana'))),
        op('sort', 'n'),
        say(variable('n')),
      ),
    ).toEqual(['[ana, pera]']);
  });

  it('reverses', () => {
    expect(
      run(declare('n', list(num(1), num(2), num(3))), op('reverse', 'n'), say(variable('n'))),
    ).toEqual(['[3, 2, 1]']);
  });

  it('refuses to operate on something that is not a list', () => {
    expect(runFailing(declare('n', num(5)), op('append', 'n', { value: num(1) }))).toBe(
      'errors.notAList',
    );
  });
});

describe('visiting every element', () => {
  const forEachItem = (variableName: string, l: Expression, body: Statement[]): Statement =>
    ({ id: id(), kind: 'forEachItem', variable: variableName, list: l, body }) as Statement;

  it('visits each one in turn', () => {
    expect(
      run(
        declare('n', list(num(1), num(2), num(3))),
        forEachItem('x', variable('n'), [say(variable('x'))]),
      ),
    ).toEqual(['1', '2', '3']);
  });

  it('does nothing with an empty list', () => {
    expect(run(declare('n', list()), forEachItem('x', variable('n'), [say(text('hola'))]))).toEqual([]);
  });

  it('walks the list as it was, so appending inside cannot hang it', () => {
    // Re-reading the variable each time would loop forever here.
    const appended = run(
      declare('n', list(num(1), num(2))),
      forEachItem('x', variable('n'), [
        { id: id(), kind: 'listOp', operation: 'append', name: 'n', value: num(9) } as Statement,
      ]),
      say(variable('n')),
    );
    expect(appended).toEqual(['[1, 2, 9, 9]']);
  });
});
