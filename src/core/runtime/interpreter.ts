import type { Expression, LiteralKind, Statement, ValueKind } from '../ast/types';
import {
  displayValue,
  MAX_CALL_DEPTH,
  MAX_LOOP_ITERATIONS,
  MAX_STEPS,
  type ExecutionState,
  type OutputEntry,
  type RuntimeError,
  type RuntimeValue,
  type VariableSnapshot,
} from './types';

/**
 * Step-based interpreter.
 *
 * Execution is driven by an explicit frame stack rather than recursion because
 * the machine must be able to freeze mid-program: `ask` suspends until the
 * student types an answer, and the UI steps the program one statement at a time
 * to drive the flowchart highlight. A recursive evaluator cannot pause.
 */

/** Everything that makes up a moment in the run, for stepping backwards. */
interface Snapshot {
  stack: Frame[];
  variables: Map<string, { value: RuntimeValue; kind: ValueKind }>;
  /** Every scope but the global one, innermost last. */
  scopes: Map<string, { value: RuntimeValue; kind: ValueKind }>[];
  output: OutputEntry[];
  status: ExecutionState['status'];
  error: RuntimeError | null;
  stepCount: number;
  pendingAsk: { statement: Extract<Statement, { kind: 'ask' }>; prompt: string } | null;
}

interface Frame {
  statements: Statement[];
  index: number;
  /**
   * Marks the frame a `devolver` unwinds to, and whose scope it discards.
   *
   * Only a call frame carries it. Loops and branches push frames too, and a
   * return inside a loop inside a function has to leave all of them — so the
   * unwind looks for this rather than counting.
   */
  call?: { name: string };
  /** Loop bookkeeping, absent on plain block frames. */
  loop?: LoopState;
}

type LoopState =
  | { kind: 'while'; statement: Extract<Statement, { kind: 'while' }>; iterations: number }
  | { kind: 'repeat'; statement: Extract<Statement, { kind: 'repeat' }>; remaining: number }
  | {
      kind: 'forEach';
      statement: Extract<Statement, { kind: 'forEach' }>;
      current: number;
      limit: number;
      step: number;
      iterations: number;
    }
  | {
      kind: 'forEachItem';
      statement: Extract<Statement, { kind: 'forEachItem' }>;
      /* The list as it was when the loop began. Re-reading the variable each
         time would mean a body that appends to the list it is walking never
         finishes — a hang rather than a lesson. */
      items: RuntimeValue[];
      position: number;
    };

class ProgramError extends Error {
  readonly messageKey: string;
  readonly vars?: Record<string, string | number>;

  constructor(messageKey: string, vars?: Record<string, string | number>) {
    super(messageKey);
    this.name = 'ProgramError';
    this.messageKey = messageKey;
    this.vars = vars;
  }
}

let outputSequence = 0;
function nextOutputId(): string {
  outputSequence += 1;
  return `o_${outputSequence}`;
}

export class Interpreter {
  private stack: Frame[] = [];
  private variables = new Map<string, { value: RuntimeValue; kind: ValueKind }>();
  private output: OutputEntry[] = [];
  private changedNames = new Set<string>();
  private status: ExecutionState['status'] = 'idle';
  private error: RuntimeError | null = null;
  private stepCount = 0;
  private pendingAsk: { statement: Extract<Statement, { kind: 'ask' }>; prompt: string } | null = null;
  private readonly program: Statement[];

  /**
   * Every function in the program, by name.
   *
   * Collected up front rather than as the program runs, so a function can be
   * called from above where it is written — which is how a student reads a
   * program, with the main steps first and the details below.
   */
  private functions = new Map<string, Extract<Statement, { kind: 'function' }>>();

  /**
   * Scopes above the global one, innermost last.
   *
   * A call gets its own, holding its parameters and anything it declares, so
   * a function cannot quietly overwrite a variable of the caller's that
   * happens to share a name. The global scope stays `variables`, which is
   * also what the panel shows.
   */
  private scopes: Map<string, { value: RuntimeValue; kind: ValueKind }>[] = [];

  /** Where a `devolver` leaves its value for the call that is waiting. */
  private returned: RuntimeValue | undefined;

  /**
   * One snapshot per completed step, so stepping backwards is possible.
   *
   * Restoring a previous state is the only honest way to go back: undoing a
   * step would mean reversing whatever it did, and a statement that printed a
   * line or overwrote a variable cannot be un-done from its own effects. The
   * frames reference the program's own arrays rather than copying them, so a
   * snapshot costs a shallow clone of the stack and the variable map.
   */
  private history: Snapshot[] = [];

  constructor(program: Statement[]) {
    this.program = program;
    this.reset();
  }

  reset(): void {
    this.stack = [{ statements: this.program, index: 0 }];
    this.functions.clear();
    this.collectFunctions(this.program);
    this.scopes = [];
    this.returned = undefined;
    this.variables.clear();
    this.output = [];
    this.changedNames.clear();
    this.error = null;
    this.stepCount = 0;
    this.pendingAsk = null;
    this.history = [];
    this.status = this.program.length === 0 ? 'finished' : 'idle';
  }

  /** Captures the current moment, cheaply: frames share the program's arrays. */
  private capture(): Snapshot {
    return {
      stack: this.stack.map((frame) => ({ ...frame, loop: frame.loop ? { ...frame.loop } : undefined })),
      variables: new Map(this.variables),
      /* Scopes are part of the moment like everything else, so stepping back
         into a call restores the call's own variables with it. */
      scopes: this.scopes.map((scope) => new Map(scope)),
      output: [...this.output],
      status: this.status,
      error: this.error,
      stepCount: this.stepCount,
      pendingAsk: this.pendingAsk,
    };
  }

  /** True when there is an earlier moment to return to. */
  canStepBack(): boolean {
    return this.history.length > 0;
  }

  /**
   * Returns to the state before the last step.
   *
   * Output printed by the undone step disappears with it, which is the point:
   * the console has to agree with the highlighted statement, or the two tell
   * the student different stories about where the program is.
   */
  stepBack(): ExecutionState {
    const previous = this.history.pop();
    if (!previous) return this.getState();

    this.stack = previous.stack;
    this.variables = previous.variables;
    this.scopes = previous.scopes;
    this.output = previous.output;
    this.status = previous.status;
    this.error = previous.error;
    this.stepCount = previous.stepCount;
    this.pendingAsk = previous.pendingAsk;
    // Nothing changed *now*; the highlight belongs to the restored statement.
    this.changedNames.clear();
    return this.getState();
  }

  getState(): ExecutionState {
    return {
      status: this.status,
      currentNodeId: this.peekNodeId(),
      variables: this.snapshotVariables(),
      output: [...this.output],
      error: this.error,
      stepCount: this.stepCount,
      pendingPrompt: this.pendingAsk?.prompt ?? null,
    };
  }

  /** Statement that will run on the next `step()`, for the UI highlight. */
  private peekNodeId(): string | null {
    if (this.pendingAsk) return this.pendingAsk.statement.id;
    for (let i = this.stack.length - 1; i >= 0; i -= 1) {
      const frame = this.stack[i];
      const statement = frame.statements[frame.index];
      if (statement) return statement.id;
      // An exhausted loop frame still has its header to re-evaluate.
      if (frame.loop) return frame.loop.statement.id;
    }
    return null;
  }

  private snapshotVariables(): VariableSnapshot[] {
    return [...this.variables.entries()].map(([name, entry]) => ({
      name,
      value: entry.value,
      kind: entry.kind,
      justChanged: this.changedNames.has(name),
    }));
  }

  /**
   * Executes one statement. Returns the state afterwards. Safe to call when
   * finished or awaiting input — it becomes a no-op.
   */
  step(): ExecutionState {
    if (this.status === 'finished' || this.status === 'error' || this.status === 'awaitingInput') {
      return this.getState();
    }

    // Recorded before the step runs, so it is the state to come back to.
    this.history.push(this.capture());

    this.status = 'running';
    this.changedNames.clear();

    if (this.stepCount >= MAX_STEPS) {
      return this.fail(new ProgramError('errors.infiniteLoop', { limit: MAX_STEPS }), null);
    }

    try {
      this.advance();
      this.stepCount += 1;
      if (this.stack.length === 0) this.status = 'finished';
      else if (this.status === 'running' && !this.pendingAsk) {
        // Stay in `running`; the driver decides whether to continue.
      }
    } catch (thrown) {
      const nodeId = this.peekNodeId();
      return this.fail(thrown, nodeId);
    }

    return this.getState();
  }

  private fail(thrown: unknown, nodeId: string | null): ExecutionState {
    const error: RuntimeError =
      thrown instanceof ProgramError
        ? { messageKey: thrown.messageKey, vars: thrown.vars, nodeId }
        : { messageKey: 'robot.error', nodeId };
    this.error = error;
    this.status = 'error';
    this.output.push({
      id: nextOutputId(),
      kind: 'error',
      text: error.messageKey,
      nodeId,
    });
    return this.getState();
  }

  /** Pops finished frames, re-entering loops whose condition still holds. */
  private unwind(): void {
    while (this.stack.length > 0) {
      const frame = this.stack[this.stack.length - 1];
      if (frame.index < frame.statements.length) return;

      if (frame.loop && this.reenterLoop(frame)) return;
      const done = this.stack.pop();
      /* A function that simply runs out of statements ends its call as surely
         as one that returns, so its scope goes with it. Without this the
         variables a function declared stayed visible to the caller. */
      if (done?.call) this.scopes.pop();
    }
  }

  /** Returns true when the loop started another iteration. */
  private reenterLoop(frame: Frame): boolean {
    const loop = frame.loop;
    if (!loop) return false;

    if (loop.kind === 'while') {
      loop.iterations += 1;
      if (loop.iterations > MAX_LOOP_ITERATIONS) {
        throw new ProgramError('errors.infiniteLoop', { limit: MAX_LOOP_ITERATIONS });
      }
      if (this.truthy(this.evaluate(loop.statement.condition))) {
        frame.index = 0;
        return true;
      }
      return false;
    }

    if (loop.kind === 'repeat') {
      loop.remaining -= 1;
      if (loop.remaining > 0) {
        frame.index = 0;
        return true;
      }
      return false;
    }

    if (loop.kind === 'forEachItem') {
      loop.position += 1;
      // No iteration guard: the list was fixed when the loop began, so this
      // cannot run away the way a `while` can.
      if (loop.position >= loop.items.length) return false;
      const item = loop.items[loop.position];
      this.currentScope().set(loop.statement.variable, { value: item, kind: this.kindOf(item) });
      this.changedNames.add(loop.statement.variable);
      frame.index = 0;
      return true;
    }

    loop.iterations += 1;
    if (loop.iterations > MAX_LOOP_ITERATIONS) {
      throw new ProgramError('errors.infiniteLoop', { limit: MAX_LOOP_ITERATIONS });
    }
    loop.current += loop.step;
    const keepGoing = loop.step > 0 ? loop.current <= loop.limit : loop.current >= loop.limit;
    if (keepGoing) {
      this.currentScope().set(loop.statement.variable, { value: loop.current, kind: 'number' });
      this.changedNames.add(loop.statement.variable);
      frame.index = 0;
      return true;
    }
    return false;
  }

  /**
   * Finds every function in the program, at any depth.
   *
   * Nested declarations are walked too. Nothing stops a student putting a
   * function inside an `if`, and refusing to see it would make the block
   * silently dead rather than explain anything.
   */
  private collectFunctions(statements: Statement[]): void {
    for (const statement of statements) {
      if (statement.kind === 'function') {
        if (statement.name) this.functions.set(statement.name, statement);
        this.collectFunctions(statement.body);
        continue;
      }
      if (statement.kind === 'if') {
        this.collectFunctions(statement.then);
        for (const arm of statement.elseIfs ?? []) this.collectFunctions(arm.body);
        if (statement.otherwise) this.collectFunctions(statement.otherwise);
        continue;
      }
      const nested = (statement as { body?: Statement[] }).body;
      if (nested) this.collectFunctions(nested);
    }
  }

  /** The scope a name lives in, innermost first, or null when it is unknown. */
  private scopeOf(name: string): Map<string, { value: RuntimeValue; kind: ValueKind }> | null {
    for (let i = this.scopes.length - 1; i >= 0; i -= 1) {
      if (this.scopes[i].has(name)) return this.scopes[i];
    }
    return this.variables.has(name) ? this.variables : null;
  }

  /** Where a new name goes: the innermost scope, which is global at the top. */
  private currentScope(): Map<string, { value: RuntimeValue; kind: ValueKind }> {
    return this.scopes[this.scopes.length - 1] ?? this.variables;
  }

  /**
   * Binds arguments to parameters and pushes the call's frame and scope.
   *
   * Arguments are evaluated in the *caller's* scope before the new one is
   * pushed, which is the only order that makes `sumar(a, b)` mean what it
   * looks like it means.
   */
  private pushCall(fn: Extract<Statement, { kind: 'function' }>, args: Expression[]): void {
    if (this.scopes.length >= MAX_CALL_DEPTH) {
      throw new ProgramError('errors.tooDeep', { limit: MAX_CALL_DEPTH });
    }
    const values = args.map((arg) => this.evaluate(arg));
    const scope = new Map<string, { value: RuntimeValue; kind: ValueKind }>();
    fn.params.forEach((param, index) => {
      if (!param) return;
      const value = values[index] ?? '';
      scope.set(param, { value, kind: this.kindOf(value) });
    });
    this.scopes.push(scope);
    this.stack.push({ statements: fn.body, index: 0, call: { name: fn.name } });
  }

  /**
   * Runs a function to completion and hands back what it returned.
   *
   * Used where a call appears inside an expression, which cannot pause
   * half-way through evaluating a tree. Stepping into a call is what the
   * statement form is for; this is the "step over" every debugger offers.
   */
  private callForValue(name: string, args: Expression[]): RuntimeValue {
    const fn = this.functions.get(name);
    if (!fn) throw new ProgramError('errors.unknownFunction', { name });

    const depth = this.stack.length;
    this.pushCall(fn, args);
    this.returned = undefined;

    let guard = 0;
    while (this.stack.length > depth) {
      if (guard++ > MAX_STEPS) {
        throw new ProgramError('errors.infiniteLoop', { limit: MAX_STEPS });
      }
      this.advance();
    }
    const value = this.returned;
    this.returned = undefined;
    return value ?? '';
  }

  private advance(): void {
    this.unwind();
    if (this.stack.length === 0) return;

    const frame = this.stack[this.stack.length - 1];
    const statement = frame.statements[frame.index];
    if (!statement) return;

    frame.index += 1;
    this.execute(statement);
  }

  private execute(statement: Statement): void {
    switch (statement.kind) {
      // Comments are notes for the reader; running one is a no-op, though it
      // still counts as a step so the highlight moves through it.
      case 'comment':
        return;

      /* Declaring a function does nothing when reached: they were all
         collected before the first step, so the block is a definition the
         program steps over. */
      case 'function':
        return;

      case 'call': {
        const fn = this.functions.get(statement.name);
        if (!fn) throw new ProgramError('errors.unknownFunction', { name: statement.name });
        this.pushCall(fn, statement.args);
        return;
      }

      case 'return': {
        this.returned = statement.value ? this.evaluate(statement.value) : undefined;
        /* Leaves every frame up to and including the call's own — a return
           inside a loop inside a function has to leave all of them. */
        while (this.stack.length > 0) {
          const frame = this.stack.pop();
          if (frame?.call) {
            this.scopes.pop();
            break;
          }
        }
        return;
      }

      case 'declare': {
        const value = this.evaluate(statement.value);
        this.currentScope().set(statement.name, { value, kind: statement.valueKind });
        this.changedNames.add(statement.name);
        return;
      }

      case 'assign': {
        const scope = this.scopeOf(statement.name);
        const entry = scope?.get(statement.name);
        if (!entry) {
          throw new ProgramError('errors.undefinedVariable', { name: statement.name });
        }
        const value = this.evaluate(statement.value);

        /*
          Writing one element rather than the whole variable.

          A copy, not a write in place: the snapshots the UI renders hold the
          value itself, so mutating the array would silently rewrite the
          history of the run and every earlier step would show the final list.
        */
        if (statement.index) {
          if (!Array.isArray(entry.value)) throw new ProgramError('errors.notAList');
          const at = this.indexOf(statement.index, entry.value.length);
          const next = [...entry.value];
          next[at] = value;
          (this.scopeOf(statement.name) ?? this.currentScope()).set(statement.name, { value: next, kind: 'list' });
          this.changedNames.add(statement.name);
          return;
        }

        (this.scopeOf(statement.name) ?? this.currentScope()).set(statement.name, { value, kind: this.kindOf(value) });
        this.changedNames.add(statement.name);
        return;
      }

      case 'say': {
        const value = this.evaluate(statement.value);
        this.output.push({
          id: nextOutputId(),
          kind: 'say',
          text: this.display(value),
          nodeId: statement.id,
        });
        return;
      }

      case 'ask': {
        const prompt = this.display(this.evaluate(statement.prompt));
        this.pendingAsk = { statement, prompt };
        this.status = 'awaitingInput';
        this.output.push({ id: nextOutputId(), kind: 'ask', text: prompt, nodeId: statement.id });
        return;
      }

      case 'if': {
        /*
          The arms are tried in order and the first that holds wins, which is
          what makes them alternatives rather than separate decisions: once one
          runs, none of the others is even evaluated.
        */
        let branch: Statement[] | null = null;

        if (this.truthy(this.evaluate(statement.condition))) {
          branch = statement.then;
        } else {
          for (const arm of statement.elseIfs ?? []) {
            if (this.truthy(this.evaluate(arm.condition))) {
              branch = arm.body;
              break;
            }
          }
          branch ??= statement.otherwise ?? [];
        }

        if (branch.length > 0) this.stack.push({ statements: branch, index: 0 });
        return;
      }

      case 'while': {
        if (!this.truthy(this.evaluate(statement.condition))) return;
        this.stack.push({
          statements: statement.body,
          index: 0,
          loop: { kind: 'while', statement, iterations: 0 },
        });
        return;
      }

      case 'repeat': {
        const times = Math.floor(this.toNumber(this.evaluate(statement.times)));
        if (times < 0) throw new ProgramError('errors.negativeTimes');
        if (times === 0 || statement.body.length === 0) return;
        this.stack.push({
          statements: statement.body,
          index: 0,
          loop: { kind: 'repeat', statement, remaining: times },
        });
        return;
      }

      case 'forEach': {
        const from = this.toNumber(this.evaluate(statement.from));
        const to = this.toNumber(this.evaluate(statement.to));
        const step = this.toNumber(this.evaluate(statement.step));
        if (step === 0) throw new ProgramError('errors.zeroStep');

        const shouldRun = step > 0 ? from <= to : from >= to;
        this.currentScope().set(statement.variable, { value: from, kind: 'number' });
        this.changedNames.add(statement.variable);
        if (!shouldRun || statement.body.length === 0) return;

        this.stack.push({
          statements: statement.body,
          index: 0,
          loop: { kind: 'forEach', statement, current: from, limit: to, step, iterations: 0 },
        });
        return;
      }

      case 'forEachItem': {
        const list = this.evaluate(statement.list);
        if (!Array.isArray(list)) throw new ProgramError('errors.notAList');
        // Copied, so the loop walks the list as it was — see the frame's note.
        const items = [...list];
        if (items.length === 0 || statement.body.length === 0) return;

        this.currentScope().set(statement.variable, {
          value: items[0],
          kind: this.kindOf(items[0]),
        });
        this.changedNames.add(statement.variable);
        this.stack.push({
          statements: statement.body,
          index: 0,
          loop: { kind: 'forEachItem', statement, items, position: 0 },
        });
        return;
      }

      case 'listOp': {
        const entry = this.scopeOf(statement.name)?.get(statement.name);
        if (!entry) throw new ProgramError('errors.undefinedVariable', { name: statement.name });
        if (!Array.isArray(entry.value)) throw new ProgramError('errors.notAList');

        // A copy for the same reason as an indexed write: the UI's snapshots
        // hold these values, and mutating in place rewrites the run's history.
        const items = [...entry.value];
        (this.scopeOf(statement.name) ?? this.currentScope()).set(statement.name, {
          value: this.applyListOp(statement, items),
          kind: 'list',
        });
        this.changedNames.add(statement.name);
        return;
      }
    }
  }

  /** Carries out one list operation, returning the new list. */
  private applyListOp(
    statement: Extract<Statement, { kind: 'listOp' }>,
    items: RuntimeValue[],
  ): RuntimeValue[] {
    switch (statement.operation) {
      case 'append':
        items.push(statement.value ? this.evaluate(statement.value) : '');
        return items;

      case 'insert': {
        /* Inserting is allowed one past the end — that is appending, and
           refusing it would make "put it last" a different operation from
           "put it anywhere else". */
        const at = statement.index
          ? this.indexOf(statement.index, items.length + 1)
          : items.length;
        items.splice(at, 0, statement.value ? this.evaluate(statement.value) : '');
        return items;
      }

      case 'removeAt': {
        if (items.length === 0) throw new ProgramError('errors.emptyList');
        const at = statement.index ? this.indexOf(statement.index, items.length) : items.length - 1;
        items.splice(at, 1);
        return items;
      }

      case 'reverse':
        return items.reverse();

      case 'sort':
        return this.sortItems(items, statement.descending === true);
    }
  }

  /**
   * Sorts numbers as numbers and everything else as text.
   *
   * JavaScript's default sort compares stringified values, which puts 10
   * before 2 — the first thing a student would notice, and impossible to
   * explain in terms of anything they have been taught. A mixed list falls
   * back to text so it still has a defined order rather than throwing.
   */
  private sortItems(items: RuntimeValue[], descending: boolean): RuntimeValue[] {
    const allNumbers = items.every((item) => typeof item === 'number');
    const sorted = [...items].sort((a, b) => {
      if (allNumbers) return (a as number) - (b as number);
      return this.display(a).localeCompare(this.display(b));
    });
    return descending ? sorted.reverse() : sorted;
  }

  /** Resolves a pending `ask` with the student's answer. */
  provideInput(raw: string): ExecutionState {
    const pending = this.pendingAsk;
    if (!pending) return this.getState();

    this.pendingAsk = null;
    this.changedNames.clear();

    try {
      const value = this.coerce(raw, pending.statement.expect);
      (this.scopeOf(pending.statement.target) ?? this.currentScope()).set(pending.statement.target, { value, kind: pending.statement.expect });
      this.changedNames.add(pending.statement.target);
      this.output.push({
        id: nextOutputId(),
        kind: 'answer',
        text: raw,
        nodeId: pending.statement.id,
      });
      this.status = 'running';
      this.stepCount += 1;
      this.unwind();
      if (this.stack.length === 0) this.status = 'finished';
    } catch (thrown) {
      return this.fail(thrown, pending.statement.id);
    }

    return this.getState();
  }

  private coerce(raw: string, expect: LiteralKind): RuntimeValue {
    if (expect === 'number') {
      const parsed = Number(raw.trim().replace(',', '.'));
      if (raw.trim() === '' || Number.isNaN(parsed)) {
        throw new ProgramError('errors.notANumber', { value: raw });
      }
      return parsed;
    }
    if (expect === 'boolean') {
      const normalized = raw.trim().toLowerCase();
      return ['true', 'verdadero', 'si', 'sí', 'yes', '1'].includes(normalized);
    }
    return raw;
  }

  /**
   * Resolves an index expression to a position, or explains why it cannot.
   *
   * Reading and writing share this so the two report the same errors for the
   * same mistakes. Out of range is by far the most common one a student hits,
   * and the message carries both the position asked for and the size of the
   * list — "5" alone tells them nothing about what went wrong.
   */
  private indexOf(expression: Expression, length: number): number {
    const raw = this.evaluate(expression);
    const index = this.toNumber(raw);
    if (!Number.isInteger(index)) {
      throw new ProgramError('errors.indexNotWhole', { index: this.display(raw) });
    }
    if (index < 0 || index >= length) {
      /* `last` as well as `length`: "tiene 3 elementos" and "van de 0 a 2"
         are the two halves a student needs, and working the second out from
         the first is exactly the off-by-one that put them here. */
      throw new ProgramError('errors.indexOutOfRange', { index, length, last: length - 1 });
    }
    return index;
  }

  private evaluate(expression: Expression): RuntimeValue {
    switch (expression.kind) {
      case 'literal':
        return expression.value;

      /* Transparent by design. The tree already puts this subexpression where
         it is evaluated; the node only records that the student put it there
         deliberately, which matters to the editor and to nothing else. */
      case 'group':
        return this.evaluate(expression.inner);

      case 'variable': {
        /* Innermost scope first: a parameter has to shadow a global of the
           same name, or calling `promedio(notas)` from a program that also
           has a `notas` would read the wrong one. */
        const entry = this.scopeOf(expression.name)?.get(expression.name);
        if (!entry) throw new ProgramError('errors.undefinedVariable', { name: expression.name });
        return entry.value;
      }

      case 'list':
        return expression.items.map((item) => this.evaluate(item));

      /* A call inside an expression runs to completion here: the evaluator
         walks a tree and cannot pause in the middle of one. Stepping into a
         call is what the statement form is for. */
      case 'call':
        return this.callForValue(expression.name, expression.args);

      case 'length': {
        const list = this.evaluate(expression.list);
        if (!Array.isArray(list)) throw new ProgramError('errors.notAList');
        return list.length;
      }

      case 'index': {
        const list = this.evaluate(expression.list);
        if (!Array.isArray(list)) throw new ProgramError('errors.notAList');
        return list[this.indexOf(expression.index, list.length)];
      }

      case 'unary': {
        const operand = this.evaluate(expression.operand);
        if (expression.operator === '!') return !this.truthy(operand);
        return -this.toNumber(operand);
      }

      case 'binary':
        return this.evaluateBinary(expression);
    }
  }

  private evaluateBinary(expression: Extract<Expression, { kind: 'binary' }>): RuntimeValue {
    const { operator } = expression;

    // Short-circuit before evaluating the right side, as the real languages do.
    if (operator === '&&') {
      return this.truthy(this.evaluate(expression.left))
        ? this.truthy(this.evaluate(expression.right))
        : false;
    }
    if (operator === '||') {
      return this.truthy(this.evaluate(expression.left))
        ? true
        : this.truthy(this.evaluate(expression.right));
    }

    const left = this.evaluate(expression.left);
    const right = this.evaluate(expression.right);

    switch (operator) {
      case '+':
        // Text on either side concatenates, matching JavaScript's behaviour.
        if (typeof left === 'string' || typeof right === 'string') {
          return this.display(left) + this.display(right);
        }
        return this.toNumber(left) + this.toNumber(right);
      case '-':
        return this.toNumber(left) - this.toNumber(right);
      case '*':
        return this.toNumber(left) * this.toNumber(right);
      case '/': {
        const divisor = this.toNumber(right);
        if (divisor === 0) throw new ProgramError('errors.divisionByZero');
        return this.toNumber(left) / divisor;
      }
      case '%': {
        const divisor = this.toNumber(right);
        if (divisor === 0) throw new ProgramError('errors.divisionByZero');
        return this.toNumber(left) % divisor;
      }
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      case '<':
        return this.compare(left, right) < 0;
      case '<=':
        return this.compare(left, right) <= 0;
      case '>':
        return this.compare(left, right) > 0;
      case '>=':
        return this.compare(left, right) >= 0;
      default:
        return false;
    }
  }

  /** Compares numbers numerically and text lexicographically. */
  private compare(left: RuntimeValue, right: RuntimeValue): number {
    if (typeof left === 'string' && typeof right === 'string') {
      return left.localeCompare(right);
    }
    const a = this.toNumber(left);
    const b = this.toNumber(right);
    return a === b ? 0 : a < b ? -1 : 1;
  }

  /*
    The four coercions below each end by naming the list case rather than
    falling through to the scalar one.

    Before lists existed their last line was `return value` or `value.length`,
    which an array satisfies without complaint — `truthy` and `kindOf` were not
    flagged by the compiler even after the type was widened, because an array
    has a `length` and 'text' is a valid return. That is the same silent shape
    that once let a variable inside a group escape validation, so each one says
    what it does with a list on purpose.
  */
  private toNumber(value: RuntimeValue): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    // Arithmetic on a whole list is a mistake worth naming: the student almost
    // always meant one element, or how many there are.
    if (Array.isArray(value)) throw new ProgramError('errors.listNotANumber');
    const parsed = Number(value);
    if (Number.isNaN(parsed)) throw new ProgramError('errors.notANumber', { value });
    return parsed;
  }

  private truthy(value: RuntimeValue): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    // An empty list is false, like an empty string — the same rule, so there
    // is one idea to learn rather than two.
    return value.length > 0;
  }

  private kindOf(value: RuntimeValue): ValueKind {
    if (Array.isArray(value)) return 'list';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'text';
  }

  /** Renders a value the way the robot should say it. */
  private display(value: RuntimeValue): string {
    return displayValue(value);
  }
}
