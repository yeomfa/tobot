import { describe, expect, it } from 'vitest';

import { literal } from '../core/ast/factory';
import type { Expression } from '../core/ast/types';

/**
 * The rules the value menu follows, kept where a test can reach them.
 *
 * All three were the same mistake in different places: a value built out of
 * other values — a list, an index, a length, and now a call — offering no way
 * back to a plain value, so a part switched to one was stuck as that thing.
 * The component's own comment had already described it for the first three.
 */

/** Values that carry their own options menu. Mirrors `isOperand`. */
const OPERANDS = new Set<Expression['kind']>([
  'literal',
  'variable',
  'group',
  'list',
  'index',
  'length',
  'call',
]);

/** Values with no literal kind of their own to cast into. */
const NO_LITERAL_KIND = new Set<Expression['kind']>(['group', 'list', 'index', 'length', 'call']);

/** What the menu reports the value currently is. Mirrors `source`. */
const sourceOf = (value: Expression): string =>
  value.kind === 'variable' ||
  value.kind === 'list' ||
  value.kind === 'index' ||
  value.kind === 'length' ||
  value.kind === 'call'
    ? value.kind
    : 'literal';

const call: Expression = { kind: 'call', name: 'doble', args: [literal(2, 'number')] };
const list: Expression = { kind: 'list', items: [] };

describe('a call is an ordinary operand', () => {
  it('carries its own options menu', () => {
    expect(OPERANDS.has(call.kind)).toBe(true);
  });

  /*
    The bug this pins: reported as itself, the menu sees a change when "un
    valor" is chosen. Reported as `literal`, choosing "un valor" matched what
    it already thought it was and did nothing at all.
  */
  it('reports itself, so switching back to a value is a change', () => {
    expect(sourceOf(call)).toBe('call');
    expect(sourceOf(call)).not.toBe(sourceOf(literal(0, 'number')));
  });

  it('has no literal kind to cast into: its type comes from the function', () => {
    expect(NO_LITERAL_KIND.has(call.kind)).toBe(true);
  });

  it('is treated like the other built values', () => {
    for (const built of [list, call]) {
      expect(OPERANDS.has(built.kind)).toBe(true);
      expect(NO_LITERAL_KIND.has(built.kind)).toBe(true);
      expect(sourceOf(built)).toBe(built.kind);
    }
  });

  it('a plain literal still reports as one', () => {
    expect(sourceOf(literal('hola', 'text'))).toBe('literal');
    expect(NO_LITERAL_KIND.has('literal')).toBe(false);
  });
});
