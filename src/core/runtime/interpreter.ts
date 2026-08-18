import type { Expression, LiteralKind, Statement } from '../ast/types';
import {
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

interface Frame {
  statements: Statement[];
  index: number;
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
  private variables = new Map<string, { value: RuntimeValue; kind: LiteralKind }>();
  private output: OutputEntry[] = [];
  private changedNames = new Set<string>();
  private status: ExecutionState['status'] = 'idle';
  private error: RuntimeError | null = null;
  private stepCount = 0;
  private pendingAsk: { statement: Extract<Statement, { kind: 'ask' }>; prompt: string } | null = null;
  private readonly program: Statement[];

  constructor(program: Statement[]) {
    this.program = program;
    this.reset();
  }

  reset(): void {
    this.stack = [{ statements: this.program, index: 0 }];
    this.variables.clear();
    this.output = [];
    this.changedNames.clear();
    this.error = null;
    this.stepCount = 0;
    this.pendingAsk = null;
    this.status = this.program.length === 0 ? 'finished' : 'idle';
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
      this.stack.pop();
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

    loop.iterations += 1;
    if (loop.iterations > MAX_LOOP_ITERATIONS) {
      throw new ProgramError('errors.infiniteLoop', { limit: MAX_LOOP_ITERATIONS });
    }
    loop.current += loop.step;
    const keepGoing = loop.step > 0 ? loop.current <= loop.limit : loop.current >= loop.limit;
    if (keepGoing) {
      this.variables.set(loop.statement.variable, { value: loop.current, kind: 'number' });
      this.changedNames.add(loop.statement.variable);
      frame.index = 0;
      return true;
    }
    return false;
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

      case 'declare': {
        const value = this.evaluate(statement.value);
        this.variables.set(statement.name, { value, kind: statement.valueKind });
        this.changedNames.add(statement.name);
        return;
      }

      case 'assign': {
        if (!this.variables.has(statement.name)) {
          throw new ProgramError('errors.undefinedVariable', { name: statement.name });
        }
        const value = this.evaluate(statement.value);
        const kind = this.kindOf(value);
        this.variables.set(statement.name, { value, kind });
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
        const branch = this.truthy(this.evaluate(statement.condition))
          ? statement.then
          : (statement.otherwise ?? []);
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
        this.variables.set(statement.variable, { value: from, kind: 'number' });
        this.changedNames.add(statement.variable);
        if (!shouldRun || statement.body.length === 0) return;

        this.stack.push({
          statements: statement.body,
          index: 0,
          loop: { kind: 'forEach', statement, current: from, limit: to, step, iterations: 0 },
        });
        return;
      }
    }
  }

  /** Resolves a pending `ask` with the student's answer. */
  provideInput(raw: string): ExecutionState {
    const pending = this.pendingAsk;
    if (!pending) return this.getState();

    this.pendingAsk = null;
    this.changedNames.clear();

    try {
      const value = this.coerce(raw, pending.statement.expect);
      this.variables.set(pending.statement.target, { value, kind: pending.statement.expect });
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

  private evaluate(expression: Expression): RuntimeValue {
    switch (expression.kind) {
      case 'literal':
        return expression.value;

      case 'variable': {
        const entry = this.variables.get(expression.name);
        if (!entry) throw new ProgramError('errors.undefinedVariable', { name: expression.name });
        return entry.value;
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

  private toNumber(value: RuntimeValue): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) throw new ProgramError('errors.notANumber', { value });
    return parsed;
  }

  private truthy(value: RuntimeValue): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return value.length > 0;
  }

  private kindOf(value: RuntimeValue): LiteralKind {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'text';
  }

  /** Renders a value the way the robot should say it. */
  private display(value: RuntimeValue): string {
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
    }
    return value;
  }
}
