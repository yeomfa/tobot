import { createId } from './factory';
import type { Expression, LiteralKind, Statement } from './types';

/**
 * Structural validation for algorithms arriving from outside the app.
 *
 * Everything the app runs is an AST, and the three language views, the
 * interpreter and the flowchart all walk it assuming it is well formed. That
 * assumption holds for a tree the editor built; it does not hold for one
 * parsed out of `localStorage` or read from a `jsonb` column, both of which a
 * determined student can write to directly.
 *
 * So this is a gate, not a type assertion: anything it cannot recognise is
 * dropped rather than cast into place. Nothing here executes or interpolates
 * the values it inspects — the risk being closed off is a malformed tree
 * reaching code that trusts its shape, and unbounded nesting exhausting the
 * stack in a recursive walk.
 */

/** Deeper than any algorithm a student writes, shallow enough to walk safely. */
const MAX_DEPTH = 64;

/** Bounds a pasted or crafted payload, well above any real lesson. */
const MAX_STATEMENTS = 5000;

const LITERAL_KINDS: LiteralKind[] = ['number', 'text', 'boolean'];

const BINARY_OPERATORS = new Set([
  '+', '-', '*', '/', '%',
  '==', '!=', '<', '<=', '>', '>=',
  '&&', '||',
]);

const UNARY_OPERATORS = new Set(['-', '!']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isName(value: unknown): value is string {
  // The same rule the editor enforces when a student types a name.
  return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

function isExpression(value: unknown, depth: number): value is Expression {
  if (depth > MAX_DEPTH || !isRecord(value)) return false;

  switch (value.kind) {
    case 'literal':
      return (
        LITERAL_KINDS.includes(value.valueKind as LiteralKind) &&
        (typeof value.value === 'string' ||
          typeof value.value === 'number' ||
          typeof value.value === 'boolean')
      );
    case 'variable':
      return typeof value.name === 'string';
    /* A group is only its contents, so the depth cap does the work here — a
       file nesting groups a thousand deep is refused like any other. */
    case 'group':
      return isExpression(value.inner, depth + 1);
    case 'binary':
      return (
        BINARY_OPERATORS.has(value.operator as string) &&
        isExpression(value.left, depth + 1) &&
        isExpression(value.right, depth + 1)
      );
    case 'unary':
      return (
        UNARY_OPERATORS.has(value.operator as string) && isExpression(value.operand, depth + 1)
      );
    default:
      return false;
  }
}

/** Counter shared across one sanitize pass, so the cap bounds the whole tree. */
interface Budget {
  remaining: number;
}

function sanitizeList(value: unknown, depth: number, budget: Budget): Statement[] {
  if (!Array.isArray(value) || depth > MAX_DEPTH) return [];

  const kept: Statement[] = [];
  for (const entry of value) {
    if (budget.remaining <= 0) break;
    const statement = sanitizeStatement(entry, depth, budget);
    if (statement) kept.push(statement);
  }
  return kept;
}

function sanitizeStatement(value: unknown, depth: number, budget: Budget): Statement | null {
  if (!isRecord(value) || !isId(value.id) || depth > MAX_DEPTH) return null;
  budget.remaining -= 1;

  const id = value.id;
  const next = depth + 1;

  switch (value.kind) {
    case 'comment':
      return { id, kind: 'comment', text: typeof value.text === 'string' ? value.text : '' };

    case 'declare':
      if (!isName(value.name) || !isExpression(value.value, next)) return null;
      return {
        id,
        kind: 'declare',
        name: value.name,
        value: value.value,
        valueKind: LITERAL_KINDS.includes(value.valueKind as LiteralKind)
          ? (value.valueKind as LiteralKind)
          : 'text',
      };

    case 'assign':
      if (!isName(value.name) || !isExpression(value.value, next)) return null;
      return { id, kind: 'assign', name: value.name, value: value.value };

    case 'say':
      if (!isExpression(value.value, next)) return null;
      return { id, kind: 'say', value: value.value };

    case 'ask':
      if (!isName(value.target) || !isExpression(value.prompt, next)) return null;
      return {
        id,
        kind: 'ask',
        prompt: value.prompt,
        target: value.target,
        expect: LITERAL_KINDS.includes(value.expect as LiteralKind)
          ? (value.expect as LiteralKind)
          : 'text',
      };

    case 'if': {
      if (!isExpression(value.condition, next)) return null;
      const otherwise = Array.isArray(value.otherwise)
        ? sanitizeList(value.otherwise, next, budget)
        : undefined;
      /*
        Each arm is checked like the statement itself: an arm whose condition
        is not a valid expression is dropped rather than kept with a broken
        one, since imported JSON is the one place a malformed tree can arrive.
      */
      const elseIfs = Array.isArray(value.elseIfs)
        ? value.elseIfs
            .filter(
              (arm): arm is Record<string, unknown> =>
                typeof arm === 'object' && arm !== null && isExpression((arm as Record<string, unknown>).condition, next),
            )
            .map((arm) => ({
              id: typeof arm.id === 'string' ? arm.id : createId(),
              condition: arm.condition as Expression,
              body: sanitizeList(arm.body, next, budget),
            }))
        : undefined;
      return {
        id,
        kind: 'if',
        condition: value.condition,
        then: sanitizeList(value.then, next, budget),
        ...(elseIfs && elseIfs.length > 0 ? { elseIfs } : {}),
        ...(otherwise ? { otherwise } : {}),
      };
    }

    case 'while':
      if (!isExpression(value.condition, next)) return null;
      return {
        id,
        kind: 'while',
        condition: value.condition,
        body: sanitizeList(value.body, next, budget),
      };

    case 'repeat':
      if (!isExpression(value.times, next)) return null;
      return { id, kind: 'repeat', times: value.times, body: sanitizeList(value.body, next, budget) };

    case 'forEach':
      if (
        !isName(value.variable) ||
        !isExpression(value.from, next) ||
        !isExpression(value.to, next) ||
        !isExpression(value.step, next)
      ) {
        return null;
      }
      return {
        id,
        kind: 'forEach',
        variable: value.variable,
        from: value.from,
        to: value.to,
        step: value.step,
        body: sanitizeList(value.body, next, budget),
      };

    default:
      // An unknown kind would reach a `switch` somewhere that has no case for
      // it. Dropping it keeps the rest of the algorithm usable.
      return null;
  }
}

/** Keeps every statement it can vouch for, and drops the rest. */
export function sanitizeStatements(value: unknown): Statement[] {
  return sanitizeList(value, 0, { remaining: MAX_STATEMENTS });
}
