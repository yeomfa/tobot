import { describe, expect, it } from 'vitest';

import { precedenceOf } from '../core/emitters/precedence';
import { literal, variable } from '../core/ast/factory';
import type { BinaryOperator, Expression } from '../core/ast/types';

const bin = (operator: BinaryOperator, left: Expression, right: Expression): Expression => ({
  kind: 'binary',
  operator,
  left,
  right,
});

/**
 * The rule the editor marks with: an operand binds tighter than the expression
 * holding it, so it resolves first.
 */
function marks(parent: Expression, child: Expression): boolean {
  return child.kind === 'binary' && precedenceOf(child) > precedenceOf(parent);
}

describe('what resolves first', () => {
  const a = variable('a');
  const b = variable('b');
  const c = variable('c');

  it('marks a multiplication inside an addition', () => {
    const times = bin('*', b, c);
    expect(marks(bin('+', a, times), times)).toBe(true);
  });

  it('marks it on either side', () => {
    const times = bin('*', a, b);
    expect(marks(bin('+', times, c), times)).toBe(true);
  });

  it('marks nothing when the order is already left to right', () => {
    // `a + b + c` needs no explanation: same operator, order does not matter.
    const inner = bin('+', a, b);
    expect(marks(bin('+', inner, c), inner)).toBe(false);
  });

  it('marks nothing once the student has grouped it themselves', () => {
    /*
      `(a + b) * c` — the addition is inside the multiplication, so it already
      runs first *because the student built it that way*. There is nothing
      hidden left to reveal, and marking it would claim the editor did
      something the student did.
    */
    const sum = bin('+', a, b);
    expect(marks(bin('*', sum, c), sum)).toBe(false);
  });

  it('marks a comparison against nothing, since it binds loosest', () => {
    const sum = bin('+', a, b);
    // `a + b > c`: the sum runs first, and that is worth showing.
    expect(marks(bin('>', sum, c), sum)).toBe(true);
  });

  it('does not mark a plain value', () => {
    expect(marks(bin('+', a, literal(2, 'number')), literal(2, 'number'))).toBe(false);
  });
});
