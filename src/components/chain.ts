import type { BinaryOperator, Expression, Statement } from '../core/ast/types';

/**
 * The operators whose chains render as a flat row, and so can be grouped.
 *
 * `a + b + c` reads as three values in a row because `+` associates; `a - b -
 * c` does not, and flattening it would let the student rebracket it into a
 * different sum.
 */
export const ASSOCIATIVE = new Set<BinaryOperator>(['+', '*', '&&', '||']);

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
  /*
    A group is one part, whatever is inside it. That is the whole reason the
    node exists: `a + b + c` and `(a + b) + c` are the same tree otherwise, so
    flattening would open a grouping the moment the student made it.
  */
  if (expression.kind === 'group' || expression.kind !== 'binary' || expression.operator !== operator) {
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

/**
 * Groups a run of neighbouring parts so they resolve first.
 *
 * A range rather than a pair, because pairs do not compose: grouping three
 * parts two at a time leaves `((a + b) + c)`, which is a different tree from
 * `(a + b + c)` — the student wanted one bracket and got two nested ones, then
 * had to unpick the inner one by hand.
 *
 * The group becomes a `group` node, which is what survives the next render:
 * without it the editor flattens the chain straight back out and the grouping
 * disappears the moment it is made.
 */
export function groupParts(
  parts: ChainPart[],
  from: number,
  to: number,
  operator: BinaryOperator,
): Expression | null {
  const start = Math.min(from, to);
  const end = Math.max(from, to);

  // A single part is already a unit; a range must reach outside the chain to
  // be impossible.
  if (start < 0 || end >= parts.length || end - start < 1) return null;

  const nodes = parts.map((part) => part.node);

  /* Folded left, the way a chain is read apart, so the inside of the group
     keeps the shape it had before it was bracketed. */
  const inner = nodes
    .slice(start, end + 1)
    .reduce((left, right) => ({ kind: 'binary', operator, left, right }));

  const rebuilt = [
    ...nodes.slice(0, start),
    { kind: 'group', inner } as Expression,
    ...nodes.slice(end + 1),
  ];

  return rebuilt.reduce((left, right) => ({ kind: 'binary', operator, left, right }));
}

/** Undoes a grouping, leaving the expression it held. */
export function ungroup(expression: Expression): Expression {
  return expression.kind === 'group' ? expression.inner : expression;
}

/**
 * Whether an expression holds a chain long enough to be worth grouping.
 *
 * Two parts are already a unit — bracketing them says nothing the row does not
 * — so three is the threshold, the same one the block's own tool uses.
 */
function hasGroupableChain(expression: Expression): boolean {
  if (expression.kind === 'binary') {
    if (ASSOCIATIVE.has(expression.operator) && flattenChain(expression, expression.operator).length > 2) {
      return true;
    }
    return hasGroupableChain(expression.left) || hasGroupableChain(expression.right);
  }
  if (expression.kind === 'unary') return hasGroupableChain(expression.operand);
  if (expression.kind === 'group') return hasGroupableChain(expression.inner);
  return false;
}

/** Every expression a statement holds, ignoring the statements nested in it. */
function ownExpressions(statement: Statement): Expression[] {
  switch (statement.kind) {
    case 'declare':
    case 'assign':
    case 'say':
      return [statement.value];
    case 'if':
      return [statement.condition, ...(statement.elseIfs?.map((arm) => arm.condition) ?? [])];
    case 'while':
      return [statement.condition];
    case 'repeat':
      return [statement.times];
    case 'forEach':
      return [statement.from, statement.to, statement.step];
    default:
      return [];
  }
}

/** The statement lists a block statement holds. */
function ownBodies(statement: Statement): Statement[][] {
  if (statement.kind === 'if') {
    return [
      statement.then,
      ...(statement.elseIfs?.map((arm) => arm.body) ?? []),
      ...(statement.otherwise ? [statement.otherwise] : []),
    ];
  }
  if (statement.kind === 'while' || statement.kind === 'repeat' || statement.kind === 'forEach') {
    return [statement.body];
  }
  return [];
}

/**
 * Whether anything in the algorithm can be grouped.
 *
 * The canvas menu offers grouping as a tool, and a tool that does nothing is
 * worse than one that is missing: the student clicks it, no part lights up,
 * and nothing says why. This is what lets the menu leave it out instead.
 */
export function canGroupAnything(statements: Statement[]): boolean {
  return statements.some(
    (statement) =>
      ownExpressions(statement).some(hasGroupableChain) ||
      ownBodies(statement).some(canGroupAnything),
  );
}
