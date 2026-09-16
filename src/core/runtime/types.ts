import type { NodeId, ValueKind } from '../ast/types';

/**
 * A value at run time.
 *
 * The list case is why `ValueKind` exists alongside `LiteralKind`: everything
 * that asks "what can the student type here" still deals in the three scalar
 * kinds, and only the places that ask "what does this hold" widen to include a
 * list. Lists hold `RuntimeValue`, so a list of lists is representable — the
 * interpreter allows it, and the editor is what decides whether it can be
 * built.
 */
export type RuntimeValue = string | number | boolean | RuntimeValue[];

export interface VariableSnapshot {
  name: string;
  value: RuntimeValue;
  kind: ValueKind;
  /** Set on the step that changed it, so the UI can flash the row. */
  justChanged: boolean;
}

/** What the machine is waiting on between steps. */
export type ExecutionStatus =
  | 'idle'
  | 'running'
  | 'awaitingInput'
  | 'finished'
  | 'error';

export interface OutputEntry {
  id: string;
  kind: 'say' | 'ask' | 'answer' | 'error';
  text: string;
  /** Statement that produced it, for click-to-highlight. */
  nodeId: NodeId | null;
}

export interface RuntimeError {
  messageKey: string;
  vars?: Record<string, string | number>;
  nodeId: NodeId | null;
}

/** Snapshot the UI renders after every step. */
export interface ExecutionState {
  status: ExecutionStatus;
  /** Statement about to run (or the one awaiting input). */
  currentNodeId: NodeId | null;
  variables: VariableSnapshot[];
  output: OutputEntry[];
  error: RuntimeError | null;
  /** Steps executed so far; drives the "step N" readout. */
  stepCount: number;
  /** Prompt text while `status === 'awaitingInput'`. */
  pendingPrompt: string | null;
}

/**
 * Guards against a runaway `while` freezing the browser tab. Kept deliberately
 * low: a student's infinite loop should surface as a teaching moment within a
 * blink, and no exercise at this level legitimately needs thousands of
 * iterations. Both limits report `errors.infiniteLoop` rather than hanging.
 */
export const MAX_STEPS = 5000;

/**
 * How deep calls may nest before the program is stopped.
 *
 * Recursion with no base case is among the first things a student writes by
 * accident, and the honest failure is a message naming the limit rather than
 * a frozen tab.
 */
export const MAX_CALL_DEPTH = 64;
export const MAX_LOOP_ITERATIONS = 1000;

/**
 * How Tobot writes a value, wherever one is shown.
 *
 * The console used to call `String()`, which renders a list as `0,0,0` while
 * the robot said `[0, 0, 0]` — two spellings of the same value, a metre apart
 * on screen. The interpreter uses this too, so there is one answer.
 */
export function displayValue(value: RuntimeValue): string {
  if (Array.isArray(value)) return `[${value.map(displayValue).join(', ')}]`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
  }
  return value;
}
