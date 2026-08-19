import { describe, expect, it } from 'vitest';

import { literal, variable } from '../core/ast/factory';
import type { BinaryOperator, Expression } from '../core/ast/types';
import { flattenChain, removeAt } from './chain';

/** `a + b + c` as the left-leaning tree the AST actually holds. */
function chainOf(operator: BinaryOperator, ...values: string[]): Expression {
  return values
    .map((name) => variable(name))
    .reduce((left, right) => ({ kind: 'binary', operator, left, right }));
}

/** Reads a tree back as "a + b + c" so assertions stay legible. */
function render(expression: Expression): string {
  if (expression.kind === 'variable') return expression.name;
  if (expression.kind === 'literal') return String(expression.value);
  if (expression.kind === 'binary') {
    return `(${render(expression.left)} ${expression.operator} ${render(expression.right)})`;
  }
  return '?';
}

describe('flattenChain', () => {
  it('draws a left-leaning chain as a flat row', () => {
    const parts = flattenChain(chainOf('+', 'a', 'b', 'c'), '+');
    expect(parts.map((part) => render(part.node))).toEqual(['a', 'b', 'c']);
  });

  it('stops at an operator that is not the chain', () => {
    // `(a × b) + c` is two operands at the top level, not three.
    const inner: Expression = { kind: 'binary', operator: '*', left: variable('a'), right: variable('b') };
    const parts = flattenChain({ kind: 'binary', operator: '+', left: inner, right: variable('c') }, '+');
    expect(parts.map((part) => render(part.node))).toEqual(['(a * b)', 'c']);
  });

  /**
   * The bug this exists to prevent: every connector shared one setter, so
   * changing the middle one silently rewrote all of them.
   */
  it('changes only the connector that was picked', () => {
    const parts = flattenChain(chainOf('+', 'a', 'b', 'c'), '+');
    // parts[1] is the connector between a and b.
    expect(render(parts[1]!.setOperator!('*'))).toBe('((a * b) + c)');
    // parts[2] is the connector between b and c.
    expect(render(parts[2]!.setOperator!('*'))).toBe('((a + b) * c)');
  });

  it('gives the first operand no connector before it', () => {
    const parts = flattenChain(chainOf('+', 'a', 'b'), '+');
    expect(parts[0]!.setOperator).toBeUndefined();
  });

  it('replaces one operand without disturbing the others', () => {
    const parts = flattenChain(chainOf('+', 'a', 'b', 'c'), '+');
    expect(render(parts[0]!.replace(literal(9, 'number')))).toBe('((9 + b) + c)');
    expect(render(parts[1]!.replace(literal(9, 'number')))).toBe('((a + 9) + c)');
    expect(render(parts[2]!.replace(literal(9, 'number')))).toBe('((a + b) + 9)');
  });
});

describe('removeAt', () => {
  it('drops the last operand', () => {
    const parts = flattenChain(chainOf('+', 'a', 'b', 'c'), '+');
    expect(render(removeAt(parts, 2, '+'))).toBe('(a + b)');
  });

  it('drops one from the middle, keeping the rest in order', () => {
    const parts = flattenChain(chainOf('+', 'a', 'b', 'c'), '+');
    expect(render(removeAt(parts, 1, '+'))).toBe('(a + c)');
  });

  /** The head has nothing before it to collapse into, so it is rebuilt. */
  it('drops the first operand without losing what followed it', () => {
    const parts = flattenChain(chainOf('+', 'a', 'b', 'c'), '+');
    expect(render(removeAt(parts, 0, '+'))).toBe('(b + c)');
  });

  it('leaves a lone value behind when two become one', () => {
    const parts = flattenChain(chainOf('+', 'a', 'b'), '+');
    expect(render(removeAt(parts, 0, '+'))).toBe('b');
    expect(render(removeAt(parts, 1, '+'))).toBe('a');
  });

  it('keeps a four-part chain intact around the gap', () => {
    const parts = flattenChain(chainOf('+', 'a', 'b', 'c', 'd'), '+');
    expect(render(removeAt(parts, 1, '+'))).toBe('((a + c) + d)');
    expect(render(removeAt(parts, 0, '+'))).toBe('((b + c) + d)');
  });
});
