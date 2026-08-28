import { describe, expect, it } from 'vitest';

import { createId, literal, variable } from '../ast/factory';
import type { Statement } from '../ast/types';
import { Interpreter } from './interpreter';

/** Runs to completion and returns just the printed lines. */
function run(body: Statement[]): string[] {
  const machine = new Interpreter(body);
  let state = machine.step();
  let guard = 0;
  while (state.status !== 'finished' && state.status !== 'error' && guard++ < 200) {
    state = machine.step();
  }
  return state.output.filter((entry) => entry.kind === 'say').map((entry) => entry.text);
}

/** `si n === want` arm. */
function arm(n: string, want: number, say: string) {
  return {
    id: createId(),
    condition: { kind: 'binary' as const, operator: '==' as const, left: variable(n), right: literal(want, 'number') },
    body: [{ id: createId(), kind: 'say' as const, value: literal(say, 'text') }],
  };
}

describe('else-if arms', () => {
  const build = (value: number): Statement[] => [
    { id: createId(), kind: 'declare', name: 'n', valueKind: 'number', value: literal(value, 'number') },
    {
      id: createId(),
      kind: 'if',
      condition: { kind: 'binary', operator: '==', left: variable('n'), right: literal(1, 'number') },
      then: [{ id: createId(), kind: 'say', value: literal('uno', 'text') }],
      elseIfs: [arm('n', 2, 'dos'), arm('n', 3, 'tres')],
      otherwise: [{ id: createId(), kind: 'say', value: literal('otro', 'text') }],
    },
  ];

  it('takes the first branch when it holds', () => {
    expect(run(build(1))).toEqual(['uno']);
  });

  it('takes an arm when the first fails', () => {
    expect(run(build(2))).toEqual(['dos']);
    expect(run(build(3))).toEqual(['tres']);
  });

  it('falls through to otherwise when no arm holds', () => {
    expect(run(build(9))).toEqual(['otro']);
  });

  it('runs only the first arm that holds', () => {
    /*
      The arms are alternatives, not separate decisions: once one runs, the
      rest are not even evaluated. Two arms that both hold must produce one
      line, not two.
    */
    const body: Statement[] = [
      { id: createId(), kind: 'declare', name: 'n', valueKind: 'number', value: literal(5, 'number') },
      {
        id: createId(),
        kind: 'if',
        condition: literal(false, 'boolean'),
        then: [],
        elseIfs: [
          { id: createId(), condition: literal(true, 'boolean'), body: [{ id: createId(), kind: 'say', value: literal('primera', 'text') }] },
          { id: createId(), condition: literal(true, 'boolean'), body: [{ id: createId(), kind: 'say', value: literal('segunda', 'text') }] },
        ],
      },
    ];
    expect(run(body)).toEqual(['primera']);
  });

  it('works without an otherwise', () => {
    const body: Statement[] = [
      {
        id: createId(),
        kind: 'if',
        condition: literal(false, 'boolean'),
        then: [{ id: createId(), kind: 'say', value: literal('no', 'text') }],
        elseIfs: [{ id: createId(), condition: literal(false, 'boolean'), body: [{ id: createId(), kind: 'say', value: literal('tampoco', 'text') }] }],
      },
    ];
    expect(run(body)).toEqual([]);
  });
});
