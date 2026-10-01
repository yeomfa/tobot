/// <reference lib="webworker" />

/**
 * Where a student's JavaScript actually runs.
 *
 * A worker rather than the page, for one reason that decides it: in blocks a
 * runaway loop is caught by the validator before it ever runs, and in text
 * nothing catches it. Only a worker can be killed without taking the tab with
 * it, so the moment the app accepts written code it also accepts that the
 * code has to run somewhere disposable.
 *
 * It talks to the app in four messages and understands two. Everything the
 * program says, asks, or fails at arrives as one of them, which is what lets
 * the console and the robot be reused untouched: they are handed the same
 * shape the interpreter hands them.
 */

import type { WorldState } from '../world/types';
import { runSource } from './runSource';

export type RunnerRequest =
  | { type: 'run'; source: string; world?: WorldState | null }
  | { type: 'answer'; value: string };

export type RunnerEvent =
  | { type: 'say'; text: string }
  | { type: 'ask'; text: string }
  | {
      type: 'error';
      text: string;
      line: number | null;
      /** A dictionary key, for a mistake the app can say in the student's language. */
      key?: string;
      vars?: Record<string, string | number>;
    }
  | { type: 'vars'; values: [string, unknown][] }
  /** The world as it now stands, posted as each change happens. */
  | { type: 'world'; state: WorldState }
  | { type: 'done' };

const scope = self as unknown as DedicatedWorkerGlobalScope;

function post(event: RunnerEvent): void {
  scope.postMessage(event);
}

/** Set while a question is on screen; cleared by the answer that resolves it. */
let pendingAnswer: ((value: string) => void) | null = null;

/**
 * Asking, which is the one thing a worker cannot do the way a browser does.
 *
 * `prompt` in a page blocks the thread until the person types. Nothing here
 * can block — so this returns a promise instead, and both names the student
 * might reach for resolve to it. The cost is the `await` in front, and the
 * editor marks its absence rather than letting the program quietly compute
 * with a promise.
 */
function question(text: string): Promise<string> {
  post({ type: 'ask', text });
  return new Promise<string>((resolve) => {
    pendingAnswer = resolve;
  });
}

async function run(source: string, world: WorldState | null): Promise<void> {
  const outcome = await runSource(
    source,
    {
      say: (text) => post({ type: 'say', text }),
      ask: question,
      vars: (values) => post({ type: 'vars', values }),
      world: (state) => post({ type: 'world', state }),
    },
    world,
  );
  if (outcome.status === 'done') post({ type: 'done' });
  else post({ type: 'error', text: outcome.text, line: outcome.line, key: outcome.key, vars: outcome.vars });
}

scope.onmessage = (event: MessageEvent<RunnerRequest>) => {
  const request = event.data;

  if (request.type === 'run') {
    void run(request.source, request.world ?? null);
    return;
  }

  if (request.type === 'answer' && pendingAnswer) {
    const resolve = pendingAnswer;
    pendingAnswer = null;
    resolve(request.value);
  }
};
