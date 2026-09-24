import type { Statement } from '../ast/types';
import { Interpreter } from './interpreter';
import type { ExecutionState } from './types';
import { MAX_STEPS } from './types';

/**
 * Runs a program to the end with its answers written down in advance.
 *
 * The interpreter is a state machine that suspends: something has to decide
 * when to advance it, and in the app that something is a timer driven by the
 * student pressing play. Marking work has no student and no timer — it has a
 * list of answers and a question about what the program printed.
 *
 * This lived inside `core.test.ts` first, which is where it was needed first.
 * It is here now because the grader needs exactly the same thing, and two
 * copies of "how to drive the interpreter" would be two things to keep in step.
 */
export function runToEnd(body: Statement[], answers: string[] = []): ExecutionState {
  const machine = new Interpreter(body);
  let state = machine.getState();
  const pending = [...answers];
  let guard = 0;

  while (state.status !== 'finished' && state.status !== 'error') {
    /* The interpreter counts its own steps and stops at `MAX_STEPS`, but a
       program that keeps asking never reaches that count — it keeps being
       handed the empty string and going round again. This is the loop's own
       way out. */
    if (guard > MAX_STEPS) {
      return { ...state, status: 'error' };
    }
    guard += 1;

    if (state.status === 'awaitingInput') {
      state = machine.provideInput(pending.shift() ?? '');
      continue;
    }
    state = machine.step();
  }

  return state;
}

/** Just the lines a program said, which is what a marker compares. */
export function spokenLines(state: ExecutionState): string[] {
  return state.output.filter((entry) => entry.kind === 'say').map((entry) => entry.text);
}
