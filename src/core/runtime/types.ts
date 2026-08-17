import type { LiteralKind, NodeId } from '../ast/types';

export type RuntimeValue = string | number | boolean;

export interface VariableSnapshot {
  name: string;
  value: RuntimeValue;
  kind: LiteralKind;
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
export const MAX_LOOP_ITERATIONS = 1000;
