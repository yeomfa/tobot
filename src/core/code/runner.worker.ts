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

export type RunnerRequest = { type: 'run'; source: string } | { type: 'answer'; value: string };

export type RunnerEvent =
  | { type: 'say'; text: string }
  | { type: 'ask'; text: string }
  | { type: 'error'; text: string; line: number | null }
  | { type: 'vars'; values: [string, unknown][] }
  | { type: 'done' };

import { topLevelNames } from './scope';

const scope = self as unknown as DedicatedWorkerGlobalScope;

function post(event: RunnerEvent): void {
  scope.postMessage(event);
}

/**
 * How a value is written when the program prints it.
 *
 * `String(…)` alone turns an array into `1,2,3` and an object into
 * `[object Object]`, which is exactly the moment a student stops trusting what
 * they see. Lists are written the way they are written in the source.
 */
function describe(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `[${value.map(describe).join(', ')}]`;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
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
function question(text: unknown): Promise<string> {
  post({ type: 'ask', text: describe(text ?? '') });
  return new Promise<string>((resolve) => {
    pendingAnswer = resolve;
  });
}

function say(...values: unknown[]): void {
  post({ type: 'say', text: values.map(describe).join(' ') });
}

/**
 * Which line of the student's program a thrown error came from.
 *
 * `new Function` wraps the body in a preamble of its own, and the async arrow
 * below adds one more line, so a stack trace counts from somewhere the student
 * never wrote. Rather than hard-coding how many lines that is — which differs
 * between engines and has changed between versions — the offset is measured
 * once by throwing from a known position and reading what the stack calls it.
 */
const probeOffset = ((): number | null => {
  try {
    new Function('throw new Error("probe");')();
  } catch (thrown) {
    const stack = thrown instanceof Error ? (thrown.stack ?? '') : '';
    const found = /<anonymous>:(\d+):/.exec(stack);
    return found ? Number(found[1]) : null;
  }
  return null;
})();

function lineOf(thrown: unknown): number | null {
  if (probeOffset === null || !(thrown instanceof Error) || !thrown.stack) return null;
  const found = /<anonymous>:(\d+):/.exec(thrown.stack);
  if (!found) return null;

  /* The probe sat on the first line of its body; the program's first line sits
     one lower, because of the `return (async () => {` above it. So the student's
     line number is simply the difference. */
  const line = Number(found[1]) - probeOffset;
  return line >= 1 ? line : null;
}

/**
 * A value as the variables panel can carry it.
 *
 * Whatever crosses back has to survive being cloned between threads, and a
 * function or a DOM-ish object does not. Anything that will not travel is
 * described instead of sent, which is more use than a run that dies reporting
 * its own variables.
 */
function portable(value: unknown): unknown {
  if (value === null) return null;
  const kind = typeof value;
  if (kind === 'string' || kind === 'number' || kind === 'boolean') return value;
  if (Array.isArray(value)) return value.map(portable);
  if (kind === 'undefined') return 'undefined';
  if (kind === 'function') return 'función';
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
}

async function run(source: string): Promise<void> {
  try {
    /*
      Reporting the variables without touching the program.

      The names are read from the source and the call that reports them is
      *appended*, never woven in: everything the student wrote keeps the line
      it was on, which is what lets a thrown error still name the right one.
      The cost of appending rather than wrapping is that a program which
      throws reports no variables — the error already says where it stopped.
    */
    const names = topLevelNames(source);
    const report = names.length > 0 ? `\n;try{__vars({${names.join(',')}})}catch(e){}` : '';

    /*
      Wrapped in an async arrow so the student can `await` at the top level of
      what they wrote, and so their `const` declarations do not leak between
      runs. `new Function` rather than `eval` keeps the program out of this
      file's scope: it can reach nothing here but the names handed to it.
    */
    const program = new Function(
      'console',
      'ask',
      'prompt',
      '__vars',
      `return (async () => {\n${source}${report}\n})();`,
    ) as (
      console: unknown,
      ask: unknown,
      prompt: unknown,
      vars: (values: Record<string, unknown>) => void,
    ) => Promise<void>;

    await program(
      { log: say, info: say, warn: say, error: say, debug: say },
      question,
      question,
      (values) => {
        post({
          type: 'vars',
          values: Object.entries(values).map(([name, value]) => [name, portable(value)]),
        });
      },
    );
    post({ type: 'done' });
  } catch (thrown) {
    post({
      type: 'error',
      text: thrown instanceof Error ? thrown.message : String(thrown),
      line: lineOf(thrown),
    });
  }
}

scope.onmessage = (event: MessageEvent<RunnerRequest>) => {
  const request = event.data;

  if (request.type === 'run') {
    void run(request.source);
    return;
  }

  if (request.type === 'answer' && pendingAnswer) {
    const resolve = pendingAnswer;
    pendingAnswer = null;
    resolve(request.value);
  }
};
