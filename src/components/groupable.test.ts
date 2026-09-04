import { describe, expect, it } from 'vitest';

import { createStatement, literal, variable } from '../core/ast/factory';
import type { BinaryOperator, Expression, Statement } from '../core/ast/types';
import { canGroupAnything } from './chain';

/** `a + b + c` as the left-leaning tree the AST actually holds. */
function chainOf(operator: BinaryOperator, count: number): Expression {
  return Array.from({ length: count }, (_, i) => variable(`v${i}`)).reduce((left, right) => ({
    kind: 'binary',
    operator,
    left,
    right,
  }));
}

/** A `say` carrying one expression, which is the simplest way to hold one. */
function say(value: Expression): Statement {
  return { ...createStatement('say'), value } as Statement;
}

/**
 * The canvas menu offers grouping as a tool, and a tool that does nothing is
 * worse than one that is missing — the student clicks it, no part lights up,
 * and nothing says why. These are the cases that decide whether it is offered.
 */
describe('canGroupAnything', () => {
  it('says no for an empty algorithm', () => {
    expect(canGroupAnything([])).toBe(false);
  });

  it('says no for a single value, which is already one unit', () => {
    expect(canGroupAnything([say(literal('hola', 'text'))])).toBe(false);
  });

  it('says no for two parts: bracketing them adds nothing the row does not say', () => {
    expect(canGroupAnything([say(chainOf('+', 2))])).toBe(false);
  });

  it('says yes at three parts, the same threshold the block tool uses', () => {
    expect(canGroupAnything([say(chainOf('+', 3))])).toBe(true);
  });

  it('says no for an operator that does not associate', () => {
    // `a - b - c` cannot be rebracketed without changing what it computes, so
    // it never renders as a flat row and never offers grouping.
    expect(canGroupAnything([say(chainOf('-', 3))])).toBe(false);
  });

  it('finds a chain nested inside a loop body', () => {
    const loop = { ...createStatement('repeat'), body: [say(chainOf('*', 4))] } as Statement;
    expect(canGroupAnything([loop])).toBe(true);
  });

  it('finds a chain in an else-if arm, which is a body like any other', () => {
    const branch = createStatement('if') as Extract<Statement, { kind: 'if' }>;
    const withArm: Statement = {
      ...branch,
      elseIfs: [{ id: 'arm', condition: literal(true, 'boolean'), body: [say(chainOf('+', 3))] }],
    };
    expect(canGroupAnything([withArm])).toBe(true);
  });

  it('finds a chain in a condition, not only in a value', () => {
    const branch = createStatement('if') as Extract<Statement, { kind: 'if' }>;
    expect(canGroupAnything([{ ...branch, condition: chainOf('&&', 3) }])).toBe(true);
  });

  it('looks inside a group, so a grouped chain can still be regrouped', () => {
    const grouped: Expression = { kind: 'group', inner: chainOf('+', 3) };
    expect(canGroupAnything([say(grouped)])).toBe(true);
  });

  it('looks into both sides of a tighter-binding operator', () => {
    // `x * (a + b + c)` as the tree holds it: the groupable chain is on the
    // right of a `*`, which is not itself a flat row.
    const mixed: Expression = { kind: 'binary', operator: '*', left: variable('x'), right: chainOf('+', 3) };
    expect(canGroupAnything([say(mixed)])).toBe(true);
  });
});
