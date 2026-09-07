import { describe, expect, it } from 'vitest';

import { createId, literal, variable } from '../ast/factory';
import type { Algorithm, Expression, Statement } from '../ast/types';
import { Interpreter } from '../runtime/interpreter';
import { emitters } from './index';
import { renderLines } from './types';

const id = (): string => createId();
const num = (n: number): Expression => literal(n, 'number');
const text = (t: string): Expression => literal(t, 'text');
const list = (...items: Expression[]): Expression => ({ kind: 'list', items });
const declare = (name: string, value: Expression): Statement =>
  ({ id: id(), kind: 'declare', name, valueKind: 'number', value }) as Statement;
const say = (value: Expression): Statement => ({ id: id(), kind: 'say', value }) as Statement;

function wrap(body: Statement[]): Algorithm {
  return { id: 'a', name: 'test', body, createdAt: '', updatedAt: '' };
}

/** What the robot says when it runs the program itself. */
function spoken(body: Statement[]): string[] {
  const machine = new Interpreter(body);
  let state = machine.getState();
  let guard = 0;
  while (state.status !== 'finished' && state.status !== 'error') {
    if (guard++ > 5000) throw new Error('program did not terminate');
    state = machine.step();
  }
  if (state.status === 'error') throw new Error(state.error?.messageKey ?? 'unknown');
  return state.output.filter((entry) => entry.kind === 'say').map((entry) => entry.text);
}

/** What the emitted JavaScript prints when actually executed. */
function fromJs(body: Statement[]): string[] {
  const source = renderLines(emitters.javascript.emit(wrap(body), { locale: 'es' }));
  const logged: string[] = [];
  const sandbox = new Function('prompt', 'console', source);
  sandbox(
    () => '',
    { log: (value: unknown) => logged.push(Array.isArray(value) ? `[${value.join(', ')}]` : String(value)) },
  );
  return logged;
}

/**
 * The robot and the code the student can copy out have to agree.
 *
 * Asserting on emitted text proves only that the emitter wrote what this file
 * expected; running it proves the program does what the student watched the
 * robot do. Sorting is the case that motivated this — JavaScript's default
 * comparison puts 10 before 2, so a bare `.sort()` would read correctly and
 * disagree with the robot on the very first example anyone tries.
 */
describe('lists: the robot and the emitted JavaScript agree', () => {
  const cases: Array<[string, Statement[]]> = [
    ['a literal list', [declare('n', list(num(1), num(2), num(3))), say(variable('n'))]],
    [
      'an element by position',
      [declare('n', list(num(10), num(20))), say({ kind: 'index', list: variable('n'), index: num(1) })],
    ],
    [
      'how many it holds',
      [declare('n', list(num(1), num(2), num(3))), say({ kind: 'length', list: variable('n') })],
    ],
    [
      'writing one element',
      [
        declare('n', list(num(1), num(2))),
        { id: id(), kind: 'assign', name: 'n', index: num(0), value: num(9) } as Statement,
        say(variable('n')),
      ],
    ],
    [
      'appending',
      [
        declare('n', list(num(1))),
        { id: id(), kind: 'listOp', operation: 'append', name: 'n', value: num(2) } as Statement,
        say(variable('n')),
      ],
    ],
    [
      'inserting',
      [
        declare('n', list(num(1), num(3))),
        { id: id(), kind: 'listOp', operation: 'insert', name: 'n', value: num(2), index: num(1) } as Statement,
        say(variable('n')),
      ],
    ],
    [
      'removing',
      [
        declare('n', list(num(1), num(2), num(3))),
        { id: id(), kind: 'listOp', operation: 'removeAt', name: 'n', index: num(1) } as Statement,
        say(variable('n')),
      ],
    ],
    [
      'sorting numbers, where a bare .sort() would disagree',
      [
        declare('n', list(num(10), num(2), num(33))),
        { id: id(), kind: 'listOp', operation: 'sort', name: 'n' } as Statement,
        say(variable('n')),
      ],
    ],
    [
      'sorting largest first',
      [
        declare('n', list(num(2), num(10), num(33))),
        { id: id(), kind: 'listOp', operation: 'sort', name: 'n', descending: true } as Statement,
        say(variable('n')),
      ],
    ],
    [
      'sorting text',
      [
        declare('n', list(text('pera'), text('ana'), text('uva'))),
        { id: id(), kind: 'listOp', operation: 'sort', name: 'n' } as Statement,
        say(variable('n')),
      ],
    ],
    [
      'reversing',
      [
        declare('n', list(num(1), num(2), num(3))),
        { id: id(), kind: 'listOp', operation: 'reverse', name: 'n' } as Statement,
        say(variable('n')),
      ],
    ],
    [
      'visiting every element',
      [
        declare('n', list(num(1), num(2), num(3))),
        {
          id: id(), kind: 'forEachItem', variable: 'x', list: variable('n'),
          body: [say(variable('x'))],
        } as Statement,
      ],
    ],
    [
      'a total built by visiting each one',
      [
        declare('n', list(num(1), num(2), num(3))),
        declare('total', num(0)),
        {
          id: id(), kind: 'forEachItem', variable: 'x', list: variable('n'),
          body: [
            {
              id: id(), kind: 'assign', name: 'total',
              value: { kind: 'binary', operator: '+', left: variable('total'), right: variable('x') },
            } as Statement,
          ],
        } as Statement,
        say(variable('total')),
      ],
    ],
  ];

  for (const [label, body] of cases) {
    it(label, () => {
      expect(fromJs(body)).toEqual(spoken(body));
    });
  }
});
