import { isBlockStatement } from './types';
import type { Expression, NodeId, Statement, ValueKind } from './types';

/**
 * Static checks that run as the student types.
 *
 * These are the mistakes the interpreter would only report at run time, or
 * would not report at all: a duplicated name, a value that was never filled in,
 * a loop that cannot end. Surfacing them on the block itself turns a silent
 * wrong answer into a teachable moment before the program is even run.
 *
 * Every problem carries the id of the statement it belongs to, so the editor
 * can mark exactly one block.
 */

export type ProblemSeverity = 'error' | 'warning';

export interface Problem {
  nodeId: NodeId;
  severity: ProblemSeverity;
  /** Dictionary path under `problems`. */
  messageKey: string;
  vars?: Record<string, string | number>;
}

/** Reserved in the target languages; using them produces broken output. */
const RESERVED = new Set([
  'let', 'const', 'var', 'if', 'else', 'while', 'for', 'function', 'return',
  'true', 'false', 'null', 'undefined', 'class', 'new', 'this', 'typeof',
  'def', 'elif', 'in', 'and', 'or', 'not', 'None', 'True', 'False', 'print',
  'input', 'import', 'lambda', 'pass', 'break', 'continue', 'global',
]);

const VALID_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * What an expression certainly produces, or null when it is not certain.
 *
 * Deliberately small, and deliberately local. `emitters/inferKind` answers a
 * richer version of this question, but nothing in `ast/` imports from
 * `emitters/` today and tying the static checks to the code generator to reach
 * one warning is not worth that. This needs far less: only enough to tell a
 * declared type from what the value plainly is.
 *
 * Every uncertain case returns null, so nothing is reported. A variable's type
 * is not knowable here, arithmetic on one could be anything, and a wrong
 * warning teaches the student to ignore the badge — which costs more than the
 * warning gains.
 */
function producedKind(expression: Expression): ValueKind | null {
  switch (expression.kind) {
    case 'literal':
      return expression.valueKind;
    case 'list':
      return 'list';
    case 'length':
      return 'number';
    case 'group':
      return producedKind(expression.inner);
    case 'unary':
      return expression.operator === '!' ? 'boolean' : 'number';
    case 'binary': {
      const { operator } = expression;
      if (['==', '!=', '<', '<=', '>', '>=', '&&', '||'].includes(operator)) return 'boolean';
      if (operator !== '+') return 'number';
      /* `+` is the one operator that is two things at once: joining text and
         adding numbers. It only says something definite when both sides do. */
      const left = producedKind(expression.left);
      const right = producedKind(expression.right);
      if (left === null || right === null) return null;
      if (left === 'text' || right === 'text') return 'text';
      if (left === 'number' && right === 'number') return 'number';
      return null;
    }
    /* A variable carries no type here, and an element of a list is whatever
       the list holds — neither is knowable from this walk. */
    default:
      return null;
  }
}

function isEmptyText(expression: Expression): boolean {
  return (
    expression.kind === 'literal' &&
    expression.valueKind === 'text' &&
    String(expression.value).trim() === ''
  );
}

/** Collects every variable an expression reads. */
function referencedNames(expression: Expression, into: Set<string>): void {
  switch (expression.kind) {
    case 'variable':
      into.add(expression.name);
      return;
    case 'binary':
      referencedNames(expression.left, into);
      referencedNames(expression.right, into);
      return;
    case 'unary':
      referencedNames(expression.operand, into);
      return;
    /* Without this a variable inside a group is invisible to validation: an
       undefined name would raise nothing here and fail at run time instead,
       which is exactly the kind of error the static checks exist to catch.
       The list nodes below are here for the same reason — `notas[i]` reads two
       names, and missing either one is a run-time surprise. */
    case 'group':
      referencedNames(expression.inner, into);
      return;
    case 'list':
      for (const item of expression.items) referencedNames(item, into);
      return;
    case 'index':
      referencedNames(expression.list, into);
      referencedNames(expression.index, into);
      return;
    case 'length':
      referencedNames(expression.list, into);
      return;
    default:
  }
}

/**
 * A `while` whose condition reads no variable that the body ever assigns can
 * only be constant — the classic infinite loop. Reported as a warning because
 * the guard makes it survivable, and seeing it run is instructive.
 */
function loopCanProgress(condition: Expression, body: Statement[]): boolean {
  const read = new Set<string>();
  referencedNames(condition, read);
  if (read.size === 0) return false;

  const assigned = new Set<string>();
  const walk = (list: Statement[]): void => {
    for (const statement of list) {
      if (statement.kind === 'assign' || statement.kind === 'declare') assigned.add(statement.name);
      if (statement.kind === 'ask') assigned.add(statement.target);
      if (statement.kind === 'if') {
        walk(statement.then);
        for (const arm of statement.elseIfs ?? []) walk(arm.body);
        if (statement.otherwise) walk(statement.otherwise);
      } else if (isBlockStatement(statement)) {
        walk((statement as { body: Statement[] }).body);
      }
    }
  };
  walk(body);

  for (const name of read) if (assigned.has(name)) return true;
  return false;
}

export function validate(program: Statement[]): Problem[] {
  const problems: Problem[] = [];
  /** Names declared so far, in execution order. */
  const declared = new Set<string>();

  const checkExpression = (expression: Expression, nodeId: NodeId): void => {
    const names = new Set<string>();
    referencedNames(expression, names);
    for (const name of names) {
      if (name === '') {
        problems.push({ nodeId, severity: 'error', messageKey: 'noVariableChosen' });
      } else if (!declared.has(name)) {
        problems.push({
          nodeId,
          severity: 'error',
          messageKey: 'undefinedVariable',
          vars: { name },
        });
      }
    }
  };

  const checkName = (name: string, nodeId: NodeId, isNew: boolean): void => {
    if (name.trim() === '') {
      problems.push({ nodeId, severity: 'error', messageKey: 'emptyName' });
      return;
    }
    if (!VALID_NAME.test(name)) {
      problems.push({ nodeId, severity: 'error', messageKey: 'invalidName', vars: { name } });
      return;
    }
    if (RESERVED.has(name)) {
      problems.push({ nodeId, severity: 'error', messageKey: 'reservedName', vars: { name } });
      return;
    }
    if (isNew && declared.has(name)) {
      problems.push({ nodeId, severity: 'warning', messageKey: 'duplicateName', vars: { name } });
    }
  };

  const walk = (statements: Statement[]): void => {
    for (const statement of statements) {
      switch (statement.kind) {
        case 'declare': {
          checkExpression(statement.value, statement.id);
          checkName(statement.name, statement.id, true);
          /*
            The chip and the value can disagree, and nothing used to say so.

            Changing a declaration's type re-reads a plain literal, but an
            expression the student built out of several parts is left alone —
            correctly, since rewriting it would discard their work. The result
            is a variable labelled "texto" holding a sum of numbers: it runs,
            and all four views agree with each other, so only the label is
            wrong. Said rather than corrected, which is the same bargain as an
            empty name: the block keeps what it has and the badge explains it.

            A warning, not an error. The program is runnable and the generated
            code is right; what is off is the promise the type makes.
          */
          const produced = producedKind(statement.value);
          if (produced !== null && produced !== statement.valueKind) {
            problems.push({
              nodeId: statement.id,
              severity: 'warning',
              messageKey: 'kindMismatch',
              vars: { name: statement.name },
            });
          }
          declared.add(statement.name);
          break;
        }

        case 'assign':
          checkName(statement.name, statement.id, false);
          if (!declared.has(statement.name)) {
            problems.push({
              nodeId: statement.id,
              severity: 'error',
              messageKey: 'assignBeforeDeclare',
              vars: { name: statement.name },
            });
          }
          checkExpression(statement.value, statement.id);
          break;

        case 'say':
          if (isEmptyText(statement.value)) {
            problems.push({ nodeId: statement.id, severity: 'warning', messageKey: 'emptySay' });
          }
          checkExpression(statement.value, statement.id);
          break;

        case 'ask':
          if (isEmptyText(statement.prompt)) {
            problems.push({ nodeId: statement.id, severity: 'warning', messageKey: 'emptyAsk' });
          }
          // Asking into an existing variable overwrites it, which is normal in
          // a loop — only the first `ask` introduces the name.
          checkName(statement.target, statement.id, !declared.has(statement.target));
          declared.add(statement.target);
          break;

        case 'if': {
          checkExpression(statement.condition, statement.id);
          const arms = statement.elseIfs ?? [];
          // Every arm's condition is checked too, and against the statement's
          // own id, so a problem inside one still marks the block it is in.
          for (const arm of arms) checkExpression(arm.condition, statement.id);

          const nothingAnywhere =
            statement.then.length === 0 &&
            arms.every((arm) => arm.body.length === 0) &&
            (statement.otherwise?.length ?? 0) === 0;
          if (nothingAnywhere) {
            problems.push({ nodeId: statement.id, severity: 'warning', messageKey: 'emptyBranches' });
          }

          walk(statement.then);
          for (const arm of arms) walk(arm.body);
          if (statement.otherwise) walk(statement.otherwise);
          break;
        }

        case 'while':
          checkExpression(statement.condition, statement.id);
          if (statement.body.length === 0) {
            problems.push({ nodeId: statement.id, severity: 'warning', messageKey: 'emptyLoop' });
          } else if (!loopCanProgress(statement.condition, statement.body)) {
            problems.push({ nodeId: statement.id, severity: 'warning', messageKey: 'endlessLoop' });
          }
          walk(statement.body);
          break;

        case 'repeat':
          checkExpression(statement.times, statement.id);
          if (statement.times.kind === 'literal' && Number(statement.times.value) < 0) {
            problems.push({ nodeId: statement.id, severity: 'error', messageKey: 'negativeTimes' });
          }
          if (statement.body.length === 0) {
            problems.push({ nodeId: statement.id, severity: 'warning', messageKey: 'emptyLoop' });
          }
          walk(statement.body);
          break;

        case 'forEach': {
          checkExpression(statement.from, statement.id);
          checkExpression(statement.to, statement.id);
          checkExpression(statement.step, statement.id);
          checkName(statement.variable, statement.id, false);

          const step = statement.step;
          if (step.kind === 'literal' && Number(step.value) === 0) {
            problems.push({ nodeId: statement.id, severity: 'error', messageKey: 'zeroStep' });
          }
          // A literal range that runs the wrong way never executes.
          if (
            statement.from.kind === 'literal' &&
            statement.to.kind === 'literal' &&
            step.kind === 'literal'
          ) {
            const from = Number(statement.from.value);
            const to = Number(statement.to.value);
            const by = Number(step.value);
            if (by !== 0 && (by > 0 ? from > to : from < to)) {
              problems.push({
                nodeId: statement.id,
                severity: 'warning',
                messageKey: 'rangeNeverRuns',
              });
            }
          }

          // The loop variable exists inside the body.
          declared.add(statement.variable);
          if (statement.body.length === 0) {
            problems.push({ nodeId: statement.id, severity: 'warning', messageKey: 'emptyLoop' });
          }
          walk(statement.body);
          break;
        }

        /* Without these two the static checks say nothing about a list: an
           operation on an undeclared name, or a walk over one, would raise
           only at run time — which is the class of error these checks exist to
           catch before the student presses play. */
        case 'listOp': {
          checkName(statement.name, statement.id, false);
          if (statement.value) checkExpression(statement.value, statement.id);
          if (statement.index) checkExpression(statement.index, statement.id);
          break;
        }

        case 'forEachItem': {
          checkExpression(statement.list, statement.id);
          checkName(statement.variable, statement.id, false);
          // The element name exists inside the body, like a loop counter.
          declared.add(statement.variable);
          if (statement.body.length === 0) {
            problems.push({ nodeId: statement.id, severity: 'warning', messageKey: 'emptyLoop' });
          }
          walk(statement.body);
          break;
        }
      }
    }
  };

  walk(program);
  return problems;
}

/** Groups problems by the statement they belong to, for fast lookup. */
export function problemsByNode(problems: Problem[]): Map<NodeId, Problem[]> {
  const map = new Map<NodeId, Problem[]>();
  for (const problem of problems) {
    const existing = map.get(problem.nodeId);
    if (existing) existing.push(problem);
    else map.set(problem.nodeId, [problem]);
  }
  return map;
}
