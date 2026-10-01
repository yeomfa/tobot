import { worldFunction } from '../world/registry';
import type { WorldDefinition } from '../world/types';
import { isBlockStatement } from './types';
import type { Expression, NodeId, Statement, ValueKind } from './types';

/**
 * What a program can call besides its own functions.
 *
 * Optional, so the checks stay what they were for every program without a
 * world — and so this file depends on no domain: it is told what exists, and
 * asks the registry only what a name means.
 */
export interface ValidationContext {
  world?: WorldDefinition | null;
}

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
    /* The arguments of a call are ordinary expressions, and without this a
       name used only there was invisible to every check — `doble(fantasma)`
       raised nothing until it ran. The same silent `default` that hid groups
       and lists before it. */
    case 'call':
      for (const arg of expression.args) referencedNames(arg, into);
      return;
    default:
  }
}

/** Every function called anywhere in an expression, with its arguments. */
function calledFunctions(
  expression: Expression,
  into: { name: string; args: Expression[] }[],
): void {
  switch (expression.kind) {
    case 'call':
      into.push({ name: expression.name, args: expression.args });
      for (const arg of expression.args) calledFunctions(arg, into);
      return;
    case 'binary':
      calledFunctions(expression.left, into);
      calledFunctions(expression.right, into);
      return;
    case 'unary':
      calledFunctions(expression.operand, into);
      return;
    case 'group':
      calledFunctions(expression.inner, into);
      return;
    case 'list':
      for (const item of expression.items) calledFunctions(item, into);
      return;
    case 'index':
      calledFunctions(expression.list, into);
      calledFunctions(expression.index, into);
      return;
    case 'length':
      calledFunctions(expression.list, into);
      return;
    default:
  }
}

/**
 * A `while` whose condition reads no variable that the body ever assigns can
 * only be constant — the classic infinite loop. Reported as a warning because
 * the guard makes it survivable, and seeing it run is instructive.
 */
function loopCanProgress(
  condition: Expression,
  body: Statement[],
  movesTime: (list: Statement[]) => boolean,
): boolean {
  /* A loop that lets world time pass ends when the scenario does. That is the
     shape of every control program — read, act, wait, again — and it is not
     the classic mistake, however constant its condition looks. Exact rather
     than hopeful: with no wait inside, time cannot move and the condition
     cannot change, so `mientras no leer("fin")` alone is reported. */
  if (movesTime(body)) return true;
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

export function validate(program: Statement[], context: ValidationContext = {}): Problem[] {
  const problems: Problem[] = [];
  const world = context.world ?? null;
  /** A world function, but only when there is a world to call it on. */
  const worldCall = (name: string) => (world ? worldFunction(name) : null);
  /** Names declared so far, in execution order. */
  const declared = new Set<string>();

  /*
    Every function in the program, collected before anything is checked.

    Order does not apply here the way it does to variables: the interpreter
    gathers functions up front, so calling one written further down is not a
    mistake — it is how a program reads, main steps first.
  */
  const functions = new Map<string, number>();
  const collect = (list: Statement[]): void => {
    for (const statement of list) {
      if (statement.kind === 'function') {
        if (statement.name) functions.set(statement.name, statement.params.length);
        collect(statement.body);
        continue;
      }
      if (statement.kind === 'if') {
        collect(statement.then);
        for (const arm of statement.elseIfs ?? []) collect(arm.body);
        if (statement.otherwise) collect(statement.otherwise);
        continue;
      }
      const nested = (statement as { body?: Statement[] }).body;
      if (nested) collect(nested);
    }
  };
  collect(program);

  /**
   * Whether running these statements lets world time pass: directly, or
   * through a function of the student's that does. Memoised per function, and
   * a function is assumed not to while it is being looked at, so recursion
   * ends.
   */
  const waits = new Map<string, boolean>();
  const bodies = new Map<string, Statement[]>();
  const gatherBodies = (list: Statement[]): void => {
    for (const statement of list) {
      if (statement.kind === 'function' && statement.name) bodies.set(statement.name, statement.body);
      if (statement.kind === 'if') {
        gatherBodies(statement.then);
        for (const arm of statement.elseIfs ?? []) gatherBodies(arm.body);
        if (statement.otherwise) gatherBodies(statement.otherwise);
      } else {
        const nested = (statement as { body?: Statement[] }).body;
        if (nested) gatherBodies(nested);
      }
    }
  };
  if (world) gatherBodies(program);
  const callMovesTime = (name: string): boolean => {
    const own = bodies.get(name);
    if (own) {
      if (!waits.has(name)) {
        waits.set(name, false);
        waits.set(name, movesTime(own));
      }
      return waits.get(name) ?? false;
    }
    return worldCall(name)?.effect === 'time';
  };
  const movesTime = (list: Statement[]): boolean => {
    if (!world) return false;
    for (const statement of list) {
      if (statement.kind === 'call' && callMovesTime(statement.name)) return true;
      if (statement.kind === 'function') continue;
      if (statement.kind === 'if') {
        if (movesTime(statement.then)) return true;
        for (const arm of statement.elseIfs ?? []) if (movesTime(arm.body)) return true;
        if (statement.otherwise && movesTime(statement.otherwise)) return true;
        continue;
      }
      const nested = (statement as { body?: Statement[] }).body;
      if (nested && movesTime(nested)) return true;
    }
    return false;
  };

  /**
   * A call to the world: the right number of arguments, and — when the name is
   * written out — a component that exists and may be used that way. Caught
   * here, the misspelt lamp is a mark on the block before the program runs,
   * rather than an error halfway through it.
   */
  const checkWorldCall = (name: string, args: Expression[], nodeId: NodeId): boolean => {
    const fn = worldCall(name);
    if (!fn || !world) return false;
    if (args.length !== fn.params.length) {
      problems.push({
        nodeId,
        severity: 'error',
        messageKey: 'wrongArgumentCount',
        vars: { name, expected: fn.params.length, got: args.length },
      });
      return true;
    }
    const first = args[0];
    if (fn.params[0]?.kind === 'text' && first?.kind === 'literal' && first.valueKind === 'text') {
      const target = world.components.find((one) => one.id === first.value);
      if (!target) {
        problems.push({
          nodeId,
          severity: 'error',
          messageKey: 'worldUnknown',
          vars: { name: String(first.value), known: world.components.map((one) => one.id).join(', ') },
        });
      } else if (fn.effect === 'write' && target.role !== 'output') {
        problems.push({ nodeId, severity: 'error', messageKey: 'worldNotOutput', vars: { name: target.id } });
      }
    }
    return true;
  };

  /** Checks one call, wherever it appears. */
  const checkCall = (name: string, args: Expression[], nodeId: NodeId): void => {
    const count = args.length;
    if (name === '') {
      problems.push({ nodeId, severity: 'error', messageKey: 'noFunctionChosen' });
      return;
    }
    if (!functions.has(name) && checkWorldCall(name, args, nodeId)) return;
    if (!functions.has(name)) {
      problems.push({ nodeId, severity: 'error', messageKey: 'unknownFunction', vars: { name } });
      return;
    }
    const expected = functions.get(name) ?? 0;
    if (expected !== count) {
      problems.push({
        nodeId,
        severity: 'error',
        messageKey: 'wrongArgumentCount',
        vars: { name, expected, got: count },
      });
    }
  };

  const checkExpression = (expression: Expression, nodeId: NodeId): void => {
    const calls: { name: string; args: Expression[] }[] = [];
    calledFunctions(expression, calls);
    for (const call of calls) checkCall(call.name, call.args, nodeId);

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

  /* Whether the walk is currently inside a function, so a stray `devolver`
     can be told from one that has something to return to. */
  let insideFunction = 0;

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
          } else if (!loopCanProgress(statement.condition, statement.body, movesTime)) {
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

        /*
          A function's body is checked with its parameters in scope and
          without the caller's variables: a name that happens to exist outside
          is not in scope inside, and pretending otherwise would hide exactly
          the mistake a scope exists to prevent.
        */
        case 'function': {
          checkName(statement.name, statement.id, false);
          /* Named like something the world already does. Code would let the
             student's own win and the world function would quietly stop
             working, so it is said here instead. */
          if (worldCall(statement.name)) {
            problems.push({
              nodeId: statement.id,
              severity: 'error',
              messageKey: 'worldReserved',
              vars: { name: statement.name },
            });
          }
          const outer = new Set(declared);
          declared.clear();
          for (const param of statement.params) {
            if (param.name === '') {
              problems.push({ nodeId: statement.id, severity: 'error', messageKey: 'emptyParam' });
              continue;
            }
            declared.add(param.name);
          }
          insideFunction += 1;
          walk(statement.body);
          insideFunction -= 1;
          declared.clear();
          for (const name of outer) declared.add(name);
          if (statement.body.length === 0) {
            problems.push({
              nodeId: statement.id,
              severity: 'warning',
              messageKey: 'emptyFunction',
            });
          }
          break;
        }

        case 'call':
          for (const arg of statement.args) checkExpression(arg, statement.id);
          checkCall(statement.name, statement.args, statement.id);
          break;

        case 'return':
          if (statement.value) checkExpression(statement.value, statement.id);
          /* Outside a function there is nothing to return to: the interpreter
             unwinds to nowhere and the program simply stops, which looks like
             the block did nothing at all. */
          if (insideFunction === 0) {
            problems.push({
              nodeId: statement.id,
              severity: 'error',
              messageKey: 'returnOutsideFunction',
            });
          }
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
