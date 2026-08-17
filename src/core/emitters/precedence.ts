import type { BinaryOperator, Expression } from '../ast/types';

/** Higher binds tighter. Mirrors JavaScript so emitted code needs no extra parens. */
const BINARY_PRECEDENCE: Record<BinaryOperator, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};

const UNARY_PRECEDENCE = 7;
const ATOM_PRECEDENCE = 8;

export function precedenceOf(expression: Expression): number {
  if (expression.kind === 'binary') return BINARY_PRECEDENCE[expression.operator];
  if (expression.kind === 'unary') return UNARY_PRECEDENCE;
  return ATOM_PRECEDENCE;
}

/**
 * Decides whether a child needs parentheses inside its parent. `isRight`
 * matters for left-associative operators: `a - (b - c)` must keep its parens
 * while `(a - b) - c` does not.
 */
export function needsParentheses(
  parent: BinaryOperator,
  child: Expression,
  isRight: boolean,
): boolean {
  const parentPrecedence = BINARY_PRECEDENCE[parent];
  const childPrecedence = precedenceOf(child);
  if (childPrecedence > parentPrecedence) return false;
  if (childPrecedence < parentPrecedence) return true;
  // Equal precedence: only the right operand can change meaning.
  return isRight;
}
