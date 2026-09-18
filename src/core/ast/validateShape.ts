import { createId } from './factory';
import type { Expression, ListOperation, LiteralKind, Param, Statement, ValueKind } from './types';

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

/* A literal list in the editor is something a student typed out by hand; this
   is far past anything anyone builds that way, and stops a crafted file from
   arriving with a million-element array. */
const MAX_LIST_ITEMS = 500;

/** Bounds a pasted or crafted payload, well above any real lesson. */
const MAX_STATEMENTS = 5000;

const LITERAL_KINDS: LiteralKind[] = ['number', 'text', 'boolean'];

/**
 * What a variable can be declared as, which includes a list.
 *
 * Separate from `LITERAL_KINDS` because the two answer different questions: a
 * literal is something the student types, and `preguntar` can only ever store
 * one of those — an answer typed at the keyboard is never a list. A
 * declaration is the one place a list is a kind you can choose.
 */
const VALUE_KINDS: ValueKind[] = [...LITERAL_KINDS, 'list'];

const LIST_OPERATIONS = new Set(['append', 'insert', 'removeAt', 'sort', 'reverse']);

const BINARY_OPERATORS = new Set([
  '+', '-', '*', '/', '%',
  '==', '!=', '<', '<=', '>', '>=',
  '&&', '||',
]);

const UNARY_OPERATORS = new Set(['-', '!']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A name a statement can carry, including none yet.
 *
 * The empty string is what `PLACEHOLDER_NAME` is: a block dropped on the
 * canvas has no name until the student types one. Requiring a well-formed name
 * here made that block structurally invalid, so it could not be copied, could
 * not be pasted, and did not survive a reload — the work vanished for the one
 * reason that is never the student's fault, namely not having finished yet.
 *
 * This is the structural gate: it decides whether a block exists at all.
 * Whether a name is *usable* is a different question, asked by `validate.ts`,
 * which reports a missing name to the student as a problem to fix rather than
 * deleting the block that has it.
 */
function isName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  // The same rule the editor enforces when a student types a name.
  return value === '' || /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
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
    /* Missing these does not fail loudly: it refuses the whole algorithm on
       load, so a student who saved work using lists would open an empty
       canvas. The depth cap covers nesting, as it does for groups. */
    case 'list':
      return (
        Array.isArray(value.items) &&
        value.items.length <= MAX_LIST_ITEMS &&
        value.items.every((item) => isExpression(item, depth + 1))
      );
    case 'index':
      return isExpression(value.list, depth + 1) && isExpression(value.index, depth + 1);
    case 'length':
      return isExpression(value.list, depth + 1);
    /* A call used as a value. Without this every expression holding one was
       refused, which took the whole statement with it. */
    case 'call':
      return (
        typeof value.name === 'string' &&
        Array.isArray(value.args) &&
        value.args.every((arg) => isExpression(arg, depth + 1))
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
        /* `VALUE_KINDS`, not `LITERAL_KINDS`: a declaration saved as a list
           came back as text on reload, because 'list' failed this check and
           fell to the default. The chip then disagreed with a value that was
           still list-shaped. */
        valueKind: VALUE_KINDS.includes(value.valueKind as ValueKind)
          ? (value.valueKind as ValueKind)
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

    /*
      The two statements that arrived with lists.

      Both were missing here, so both fell to the default and were dropped:
      a `para cada elemento` disappeared on reload, and so did every
      `cambiar lista`. The same pair was missing from `renameVariable` and
      `countReferences` — a silent `default` in a walk over statement kinds is
      the recurring shape of this bug, and this is the one place where it
      costs the student their work rather than a stale name.
    */
    case 'listOp': {
      if (!isName(value.name) || !LIST_OPERATIONS.has(value.operation as string)) return null;
      /* `value` and `index` belong to some operations and not others, and an
         absent one is correct rather than malformed — but a present one that
         is not an expression is not something to keep. */
      if (value.value !== undefined && !isExpression(value.value, next)) return null;
      if (value.index !== undefined && !isExpression(value.index, next)) return null;
      return {
        id,
        kind: 'listOp',
        operation: value.operation as ListOperation,
        name: value.name,
        ...(value.value !== undefined ? { value: value.value as Expression } : {}),
        ...(value.index !== undefined ? { index: value.index as Expression } : {}),
        ...(typeof value.descending === 'boolean' ? { descending: value.descending } : {}),
      };
    }

    case 'forEachItem':
      if (!isName(value.variable) || !isExpression(value.list, next)) return null;
      return {
        id,
        kind: 'forEachItem',
        variable: value.variable,
        list: value.list,
        body: sanitizeList(value.body, next, budget),
      };

    /*
      The three that came with functions, and all three were missing.

      Everything loaded from storage and everything arriving on the clipboard
      goes through this gate, so without them a function could not be copied,
      could not be pasted, and would not survive a reload. The same shape of
      omission as `listOp` and `forEachItem` before them — a silent `default`
      in a walk over statement kinds, in the one place where it costs the
      student their work.
    */
    case 'function': {
      if (!isName(value.name) || !Array.isArray(value.params)) return null;
      const params: Param[] = [];
      for (const entry of value.params) {
        if (!isRecord(entry) || !isName(entry.name)) return null;
        params.push({
          name: entry.name,
          type: VALUE_KINDS.includes(entry.type as ValueKind)
            ? (entry.type as ValueKind)
            : 'number',
        });
      }
      return {
        id,
        kind: 'function',
        name: value.name,
        params,
        body: sanitizeList(value.body, next, budget),
        ...(typeof value.isAsync === 'boolean' ? { isAsync: value.isAsync } : {}),
      };
    }

    case 'return':
      /* The value is optional: a function that only does something still needs
         a way to stop early. An unreadable one is refused rather than dropped,
         since that is a malformed tree and not an absent value. */
      if (value.value !== undefined && !isExpression(value.value, next)) return null;
      return {
        id,
        kind: 'return',
        ...(value.value !== undefined ? { value: value.value as Expression } : {}),
      };

    case 'call': {
      if (!isName(value.name) || !Array.isArray(value.args)) return null;
      if (!value.args.every((arg) => isExpression(arg, next))) return null;
      return { id, kind: 'call', name: value.name, args: value.args as Expression[] };
    }

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
