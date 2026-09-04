import { describe, expect, it } from 'vitest';

import { createId, literal, variable } from '../core/ast/factory';
import { expressionToJs } from '../core/emitters/javascript';
import { Interpreter } from '../core/runtime/interpreter';
import type { BinaryOperator, Expression, Statement } from '../core/ast/types';
import { flattenChain, groupParts, ungroup } from './chain';

const bin = (operator: BinaryOperator, left: Expression, right: Expression): Expression => ({
  kind: 'binary',
  operator,
  left,
  right,
});

const n = (value: number): Expression => literal(value, 'number');

/** Runs one expression and returns what it printed. */
function evaluate(expression: Expression): string {
  const body: Statement[] = [{ id: createId(), kind: 'say', value: expression }];
  const machine = new Interpreter(body);
  let state = machine.step();
  let guard = 0;
  while (state.status !== 'finished' && state.status !== 'error' && guard++ < 50) {
    state = machine.step();
  }
  return state.output.map((entry) => entry.text).join('');
}

function group(
  expression: Expression,
  operator: BinaryOperator,
  from: number,
  to = from + 1,
): Expression {
  const grouped = groupParts(flattenChain(expression, operator), from, to, operator);
  if (!grouped) throw new Error('nothing to group');
  return grouped;
}

describe('grouping', () => {
  const a = variable('a');
  const b = variable('b');
  const c = variable('c');

  it('survives being flattened again', () => {
    /*
      The reason the node exists. Without it, `a + (b + c)` and `(a + b) + c`
      are indistinguishable trees, so the editor flattened the grouping open on
      the very next render — grouping appeared to do nothing.
    */
    const chain = bin('+', bin('+', a, b), c);
    const grouped = group(chain, '+', 1);
    expect(flattenChain(grouped, '+')).toHaveLength(2);
  });

  it('is a single part, whatever it holds', () => {
    const grouped = group(bin('+', bin('+', a, b), c), '+', 0);
    const parts = flattenChain(grouped, '+');
    expect(parts).toHaveLength(2);
    expect(parts[0]?.node.kind).toBe('group');
  });

  it('changes the answer when the operators differ', () => {
    // 2 + 3 * 4 is 14; grouping the addition first makes it 20.
    const mixed = bin('+', n(2), bin('*', n(3), n(4)));
    expect(evaluate(mixed)).toBe('14');

    const regrouped: Expression = bin('*', { kind: 'group', inner: bin('+', n(2), n(3)) }, n(4));
    expect(evaluate(regrouped)).toBe('20');
    expect(expressionToJs(regrouped)).toBe('(2 + 3) * 4');
  });

  it('does not change the answer on an associative chain', () => {
    const chain = bin('+', bin('+', n(1), n(2)), n(3));
    expect(evaluate(chain)).toBe('6');
    expect(evaluate(group(chain, '+', 1))).toBe('6');
  });

  it('shows its brackets in the emitted code', () => {
    const grouped = group(bin('+', bin('+', a, b), c), '+', 1);
    expect(expressionToJs(grouped)).toBe('a + (b + c)');
  });

  it('comes apart again', () => {
    const chain = bin('+', bin('+', a, b), c);
    const grouped = group(chain, '+', 1);
    const part = flattenChain(grouped, '+')[1]?.node;
    expect(part && expressionToJs(ungroup(part))).toBe('b + c');
  });

  it('groups three parts into one bracket, not two nested ones', () => {
    /*
      What pairwise grouping could not do. Taking `a + b + c` two at a time
      gives `((a + b) + c)` — the student asked for one group and got two, and
      had to delete the inner one by hand.
    */
    const chain = bin('+', bin('+', a, b), c);
    const grouped = group(chain, '+', 0, 2);

    expect(expressionToJs(grouped)).toBe('(a + b + c)');
    expect(flattenChain(grouped, '+')).toHaveLength(1);

    const only = flattenChain(grouped, '+')[0]?.node;
    expect(only?.kind).toBe('group');
    // One group, not a group inside a group.
    expect(only?.kind === 'group' && only.inner.kind).toBe('binary');
  });

  it('refuses when there is no neighbour', () => {
    const parts = flattenChain(bin('+', bin('+', a, b), c), '+');
    // Past the end, before the start, and a range of one — all impossible.
    expect(groupParts(parts, parts.length - 1, parts.length, '+')).toBeNull();
    expect(groupParts(parts, -1, 0, '+')).toBeNull();
    expect(groupParts(parts, 1, 1, '+')).toBeNull();
  });
});

describe('grouping more than once', () => {
  const n = (value: number): Expression => literal(value, 'number');

  it('can group a group with what follows it', () => {
    /*
      The reported gap: after grouping a pair, the option disappeared. With
      `(1 + 2) + 3 + 4` there are still two joins available, and refusing them
      made grouping a once-only move on any chain.
    */
    const chain = bin('+', bin('+', bin('+', n(1), n(2)), n(3)), n(4));

    const once = group(chain, '+', 0);
    expect(expressionToJs(once)).toBe('(1 + 2) + 3 + 4');

    const twice = group(once, '+', 0);
    expect(expressionToJs(twice)).toBe('((1 + 2) + 3) + 4');
  });

  it('keeps the same answer however it is nested', () => {
    // Regrouping an associative chain changes shape, never the result.
    const chain = bin('+', bin('+', bin('+', n(1), n(2)), n(3)), n(4));
    expect(evaluate(chain)).toBe('10');
    expect(evaluate(group(chain, '+', 0))).toBe('10');
    expect(evaluate(group(group(chain, '+', 0), '+', 0))).toBe('10');
  });
});

describe('grouping a run in one action', () => {
  const n = (value: number): Expression => literal(value, 'number');
  const chain = (): Expression => bin('+', bin('+', bin('+', n(1), n(2)), n(3)), n(4));

  it('makes one bracket, not a stack of nested ones', () => {
    /*
      What grouping in pairs could not do. Joining three parts two at a time
      gives `((1 + 2) + 3)` — three brackets deep where the student asked for
      one — so the menu offers each run length instead.
    */
    const parts = flattenChain(chain(), '+');
    const grouped = groupParts(parts, 0, 2, '+');
    expect(grouped && expressionToJs(grouped)).toBe('(1 + 2 + 3) + 4');
  });

  it('can take the whole chain', () => {
    const parts = flattenChain(chain(), '+');
    const grouped = groupParts(parts, 0, 3, '+');
    expect(grouped && expressionToJs(grouped)).toBe('(1 + 2 + 3 + 4)');
  });

  it('can start anywhere in the chain', () => {
    const parts = flattenChain(chain(), '+');
    const grouped = groupParts(parts, 1, 3, '+');
    expect(grouped && expressionToJs(grouped)).toBe('1 + (2 + 3 + 4)');
  });

  it('leaves the answer alone', () => {
    const parts = flattenChain(chain(), '+');
    const grouped = groupParts(parts, 0, 2, '+');
    expect(evaluate(chain())).toBe('10');
    expect(grouped && evaluate(grouped)).toBe('10');
  });
});
