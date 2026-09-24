import { useCallback, useEffect, useRef, useState } from 'react';

import type { RunnerEvent, RunnerRequest } from '../core/code/runner.worker';
import type {
  ExecutionState,
  OutputEntry,
  RuntimeValue,
  VariableSnapshot,
} from '../core/runtime/types';

/**
 * How long a program may run without finishing or asking something.
 *
 * The block interpreter counts steps, which it can do because it owns every
 * one of them. Nothing here owns anything: the worker is running code this app
 * never looked at, so the only honest limit is the clock. Generous enough that
 * no exercise at this level reaches it, short enough that a `while (true)`
 * becomes a sentence on screen rather than a spinner.
 */
const PATIENCE_MS = 5000;

/**
 * Turns a thrown message and the line it came from into something to read.
 *
 * Supplied by the caller because this hook has no language: it owns a worker
 * and a clock, and the moment it starts writing sentences it owns a dictionary
 * too.
 */
export type ErrorText = (message: string, line: number | null) => string;

export interface CodeExecutionController {
  /** The same snapshot the interpreter produces, so the console and the robot
      can render a run without knowing which surface produced it. */
  state: ExecutionState;
  isRunning: boolean;
  run: (source: string) => void;
  stop: () => void;
  answer: (value: string) => void;
  clear: () => void;
}

const IDLE: ExecutionState = {
  status: 'idle',
  currentNodeId: null,
  variables: [],
  output: [],
  error: null,
  stepCount: 0,
  pendingPrompt: null,
};

/**
 * What kind the variables panel should call this.
 *
 * The same four the block model has, because the panel is the same panel. A
 * value that is none of them is shown as text rather than given a fifth kind
 * nothing knows how to colour.
 */
function kindOf(value: unknown): VariableSnapshot['kind'] {
  if (Array.isArray(value)) return 'list';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'text';
}

let sequence = 0;
function entry(kind: OutputEntry['kind'], text: string): OutputEntry {
  sequence += 1;
  return { id: `c${sequence}`, kind, text, nodeId: null };
}

/**
 * Runs written JavaScript, and reports it exactly as a stepped program is
 * reported.
 *
 * Deliberately not an interpreter: this hook decides nothing about the
 * program, it only owns the worker's life and turns four messages into the
 * state shape the rest of the app already renders. What it does own is the
 * part a student cannot be left holding — killing a run that will not end.
 */
export function useCodeExecution(describe?: ErrorText): CodeExecutionController {
  const [state, setState] = useState<ExecutionState>(IDLE);
  const worker = useRef<Worker | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);

  const describeRef = useRef(describe);
  describeRef.current = describe;

  const clearDeadline = useCallback(() => {
    if (deadline.current) {
      clearTimeout(deadline.current);
      deadline.current = null;
    }
  }, []);

  const dispose = useCallback(() => {
    clearDeadline();
    worker.current?.terminate();
    worker.current = null;
  }, [clearDeadline]);

  // A worker outlives the component that made it unless something says so.
  useEffect(() => dispose, [dispose]);

  const startDeadline = useCallback(() => {
    clearDeadline();
    deadline.current = setTimeout(() => {
      dispose();
      setState((current) => ({
        ...current,
        status: 'error',
        pendingPrompt: null,
        // The key rather than the sentence: the component that renders this
        // owns the language, and this hook has no business knowing it.
        output: [...current.output, entry('error', 'code.tooLong')],
      }));
    }, PATIENCE_MS);
  }, [clearDeadline, dispose]);

  const run = useCallback(
    (source: string) => {
      dispose();

      const created = new Worker(new URL('../core/code/runner.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.current = created;

      created.onmessage = (event: MessageEvent<RunnerEvent>) => {
        const message = event.data;

        if (message.type === 'say') {
          setState((current) => ({ ...current, output: [...current.output, entry('say', message.text)] }));
          return;
        }

        if (message.type === 'ask') {
          /* The clock stops while a person is being waited on: a student
             thinking about their answer is not a runaway program. */
          clearDeadline();
          setState((current) => ({
            ...current,
            status: 'awaitingInput',
            pendingPrompt: message.text,
            output: [...current.output, entry('ask', message.text)],
          }));
          return;
        }

        if (message.type === 'vars') {
          setState((current) => ({
            ...current,
            variables: message.values.map(([name, value]) => ({
              name,
              value: value as RuntimeValue,
              kind: kindOf(value),
              /* Nothing to flash: these arrive once, at the end, rather than
                 step by step the way the interpreter reports them. */
              justChanged: false,
            })),
          }));
          return;
        }

        if (message.type === 'error') {
          clearDeadline();
          const said = describeRef.current
            ? describeRef.current(message.text, message.line)
            : message.text;
          setState((current) => ({
            ...current,
            status: 'error',
            pendingPrompt: null,
            output: [...current.output, entry('error', said)],
          }));
          dispose();
          return;
        }

        clearDeadline();
        setState((current) => ({ ...current, status: 'finished', pendingPrompt: null }));
        dispose();
      };

      setState({ ...IDLE, status: 'running' });
      startDeadline();
      const request: RunnerRequest = { type: 'run', source };
      created.postMessage(request);
    },
    [clearDeadline, dispose, startDeadline],
  );

  const answer = useCallback(
    (value: string) => {
      if (!worker.current) return;
      setState((current) => ({
        ...current,
        status: 'running',
        pendingPrompt: null,
        output: [...current.output, entry('answer', value)],
      }));
      startDeadline();
      const request: RunnerRequest = { type: 'answer', value };
      worker.current.postMessage(request);
    },
    [startDeadline],
  );

  const stop = useCallback(() => {
    dispose();
    setState((current) => ({ ...current, status: 'idle', pendingPrompt: null }));
  }, [dispose]);

  const clear = useCallback(() => {
    dispose();
    setState(IDLE);
  }, [dispose]);

  return {
    state,
    isRunning: state.status === 'running' || state.status === 'awaitingInput',
    run,
    stop,
    answer,
    clear,
  };
}
