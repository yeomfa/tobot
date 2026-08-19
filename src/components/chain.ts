import type { BinaryOperator, Expression } from '../core/ast/types';

/**
 * Collects the operands of a left-leaning chain of one associative operator,
 * along with the setter that rebuilds the tree when one of them changes.
 *
 * The AST stays a binary tree — the emitters and interpreter rely on that —
 * but a student reading `"x " + i + " = " + total` should see four values in a
 * row, not four boxes inside each other.
 */
export interface ChainPart {
  node: Expression;
  replace: (next: Expression) => Expression;
  /**
   * Rebuilds the tree with the connector *before* this operand changed.
   * Absent on the first operand, which has nothing before it.
   *
   * Every link carries its own setter so that changing one connector leaves
   * the others alone. Sharing a single setter across the row meant picking
   * "×" on the second connector silently rewrote all of them.
   */
  setOperator?: (operator: BinaryOperator) => Expression;
  /** Rebuilds the tree with this operand dropped, keeping the rest in order. */
  remove?: () => Expression;
}

export function flattenChain(expression: Expression, operator: BinaryOperator): ChainPart[] {
  if (expression.kind !== 'binary' || expression.operator !== operator) {
    return [{ node: expression, replace: (next) => next }];
  }

  const left = flattenChain(expression.left, operator).map((part) => ({
    node: part.node,
    replace: (next: Expression): Expression => ({
      ...expression,
      left: part.replace(next),
    }),
    setOperator: part.setOperator
      ? (next: BinaryOperator): Expression => ({
          ...expression,
          left: part.setOperator?.(next) ?? expression.left,
        })
      : undefined,
    // Dropping an operand from the left subtree keeps the right one, so the
    // node itself survives with a smaller left side.
    remove: part.remove
      ? (): Expression => ({ ...expression, left: part.remove?.() ?? expression.left })
      : undefined,
  }));

  return [
    ...left,
    {
      node: expression.right,
      replace: (next: Expression): Expression => ({ ...expression, right: next }),
      setOperator: (next: BinaryOperator): Expression => ({ ...expression, operator: next }),
      // Removing the last operand collapses this node to what came before it.
      remove: (): Expression => expression.left,
    },
  ];
}

/**
 * Drops one operand from a flattened chain.
 *
 * Every part except the first carries its own `remove`, which rebuilds the
 * tree without it. The first has nothing before it to collapse into, so
 * removing it means keeping the chain that follows: the second operand becomes
 * the new head.
 */
export function removeAt(chain: ChainPart[], index: number, operator: BinaryOperator): Expression {
  const part = chain[index];
  if (part?.remove) return part.remove();

  // Removing the head. Nothing before it can absorb the gap, so the chain is
  // rebuilt from the operands that remain — dropping only the first one rather
  // than everything that followed it.
  const rest = chain.slice(1).map((item) => item.node);
  return rest.reduce((left, right) => ({ kind: 'binary', operator, left, right }));
}
