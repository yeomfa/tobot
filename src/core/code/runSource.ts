import { worldFunction, worldNames } from '../world/registry';
import type { WorldState } from '../world/types';
import { WorldFault } from '../world/types';
import { topLevelNames } from './scope';

/**
 * Running a student's JavaScript, separated from the thread it runs on.
 *
 * The worker owns the thread, the messages and being killed; this owns what
 * running means. Split so the same function can run in a test, which is what
 * makes it possible to check — without spawning a worker — that a program
 * written in code and the same program built in blocks leave the world in the
 * same state.
 */

/** Where a running program's effects go. */
export interface SourceHost {
  say: (text: string) => void;
  ask: (text: string) => Promise<string>;
  vars?: (values: [string, unknown][]) => void;
  /** Every change to the world, as it happens. */
  world?: (state: WorldState) => void;
}

export type SourceOutcome =
  | { status: 'done'; world: WorldState | null }
  | {
      status: 'error';
      text: string;
      line: number | null;
      /** Set for a mistake made against the world, so the app can translate it. */
      key?: string;
      vars?: Record<string, string | number>;
      world: WorldState | null;
    };

/**
 * How a value is written when the program prints it.
 *
 * `String(…)` alone turns an array into `1,2,3` and an object into
 * `[object Object]`, which is exactly the moment a student stops trusting what
 * they see. Lists are written the way they are written in the source.
 */
export function describe(value: unknown): string {
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

/**
 * Which line of the student's program a thrown error came from.
 *
 * `new Function` wraps the body in a preamble of its own, and the async arrow
 * below adds one more line, so a stack trace counts from somewhere the student
 * never wrote. Rather than hard-coding how many lines that is — which differs
 * between engines and has changed between versions — the offset is measured
 * once by throwing from a known position and reading what the stack calls it.
 * The parameter list does not move it: however many names are handed in, the
 * engine writes them on the preamble's one line.
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

/** The scenario's time is up: the program stops here, and has not failed. */
class WorldEnded extends Error {
  constructor() {
    super('the scenario has ended');
    this.name = 'WorldEnded';
  }
}

export async function runSource(
  source: string,
  host: SourceHost,
  initialWorld: WorldState | null = null,
): Promise<SourceOutcome> {
  let world = initialWorld;

  /*
    The world's functions, every name of every one, handed in as parameters.

    Every name and not only the interface language's, so a program written in
    Spanish still runs for a student who has since switched to English. Only
    when there is a world: otherwise nothing new is in scope, and a program
    that names its own `wait` is exactly as it was.

    Synchronous on purpose. The world lives in this thread, so a read is an
    ordinary call that returns a boolean — no `await`, and so nothing a student
    can forget — and the same program reads the same way as its blocks do.
  */
  const worldParams = world ? worldNames() : [];
  const worldArgs = worldParams.map((name) => (...args: unknown[]) => {
    const fn = worldFunction(name);
    if (!fn || !world) return undefined;
    const result = fn.apply(world, args);
    if (result.state !== world) {
      world = result.state;
      host.world?.(world);
    }
    if (world.ended) throw new WorldEnded();
    return result.value;
  });

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
      ...worldParams,
      `return (async () => {\n${source}${report}\n})();`,
    ) as (...args: unknown[]) => Promise<void>;

    const say = (...values: unknown[]): void => host.say(values.map(describe).join(' '));
    const question = (text: unknown): Promise<string> => host.ask(describe(text ?? ''));

    await program(
      { log: say, info: say, warn: say, error: say, debug: say },
      question,
      question,
      (values: Record<string, unknown>) => {
        host.vars?.(Object.entries(values).map(([name, value]) => [name, portable(value)]));
      },
      ...worldArgs,
    );
    return { status: 'done', world };
  } catch (thrown) {
    if (thrown instanceof WorldEnded) return { status: 'done', world };
    if (thrown instanceof WorldFault) {
      return {
        status: 'error',
        text: thrown.message,
        line: lineOf(thrown),
        key: thrown.messageKey,
        vars: thrown.vars,
        world,
      };
    }
    return {
      status: 'error',
      text: thrown instanceof Error ? thrown.message : String(thrown),
      line: lineOf(thrown),
      world,
    };
  }
}
