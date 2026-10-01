import type { Statement } from '../ast/types';
import { runToEnd, spokenLines } from '../runtime/headless';
import type { TimelineEvent, WorldDefinition, WorldState } from '../world/types';
import { createWorld, valuesAt } from '../world/world';

/**
 * One trial of a program: what it is told, and what it should say back.
 *
 * `answers` are handed to each question in the order they are asked, which is
 * the same order a student would be asked them. `expect` is every line the
 * program should print, in order.
 */
export interface Case {
  answers: string[];
  expect: string[];
  /**
   * For a program with a world: how the scenario starts, what it does by
   * itself, and what must be true at given moments. "Start is pressed at
   * second 1, stop at 5; the motor is on at 3 and off at 7" is a case, and it
   * is how a latch is tested on a real panel.
   */
  inputs?: Record<string, boolean>;
  timeline?: TimelineEvent[];
  expectWorld?: WorldExpectation[];
}

/** One thing that must be true of the world at one moment. */
export interface WorldExpectation {
  at: number;
  id: string;
  value: boolean;
}

export interface CaseResult {
  passed: boolean;
  /** What it actually said, so a teacher can see why a case failed. */
  got: string[];
  /** The world expectations it did not meet, for the same reason. */
  misses?: WorldExpectation[];
}

export interface Mark {
  passed: number;
  total: number;
  score: number;
  results: CaseResult[];
}

/**
 * Whether what a program said is what was wanted.
 *
 * Trimmed on both sides, because a trailing space is not a wrong answer and no
 * student will ever find it. Everything else is compared exactly, including how
 * many lines there were: a program that prints the right answer twice has not
 * done what was asked.
 */
export function linesMatch(got: string[], expect: string[]): boolean {
  if (got.length !== expect.length) return false;
  return got.every((line, index) => line.trim() === (expect[index] ?? '').trim());
}

/**
 * What a run is worth.
 *
 * Partial rather than all-or-nothing. A student who gets three cases of four
 * right has understood most of it, and a zero would tell them the opposite of
 * what happened — which for a tool whose whole argument is "understand rather
 * than memorise" is the wrong lesson to teach with a number.
 */
export function scoreFor(points: number, passed: number, total: number): number {
  // An assignment with no cases cannot be marked by machine; it is worth
  // nothing automatically rather than worth everything.
  if (total <= 0) return 0;
  return Math.round((points * passed) / total);
}

/** Folds a set of case results into the mark that gets written down. */
export function markFrom(points: number, results: CaseResult[]): Mark {
  const passed = results.filter((result) => result.passed).length;
  return { passed, total: results.length, score: scoreFor(points, passed, results.length), results };
}

/**
 * Marks a block algorithm, which can be done here and now.
 *
 * The interpreter is synchronous once it is told what the answers are, so a
 * whole class of submissions is marked without leaving this function. Code
 * submissions cannot be: they need the worker, and so they are marked by the
 * caller that owns one.
 */
export function gradeBlocks(
  body: Statement[],
  cases: Case[],
  points: number,
  world: WorldDefinition | null = null,
): Mark {
  const results = cases.map((trial) => {
    const start = world ? createWorld(world, { inputs: trial.inputs, timeline: trial.timeline }) : null;
    const state = runToEnd(body, trial.answers, start);
    const got = spokenLines(state);
    /* A program that failed did not answer the question, whatever it printed
       on the way. */
    return judge(trial, got, state.status !== 'error', state.world ?? null);
  });

  return markFrom(points, results);
}

/** The world expectations a finished run did not meet. */
export function worldMisses(trial: Case, world: WorldState | null): WorldExpectation[] {
  const expected = trial.expectWorld ?? [];
  if (expected.length === 0) return [];
  if (!world) return expected;
  return expected.filter((one) => (valuesAt(world, one.at)[one.id] ?? false) !== one.value);
}

/**
 * Whether one run did what its case asked.
 *
 * Shared by both graders so blocks and code are held to one rule. A case about
 * the world with nothing to print checks the world alone: a student who prints
 * "motor on" while getting it right has not got it wrong.
 */
export function judge(trial: Case, got: string[], completed: boolean, world: WorldState | null): CaseResult {
  const misses = worldMisses(trial, world);
  const checksLines = trial.expect.length > 0 || !trial.expectWorld?.length;
  const passed = completed && misses.length === 0 && (!checksLines || linesMatch(got, trial.expect));
  return misses.length > 0 ? { passed, got, misses } : { passed, got };
}

/** Whether a case has anything to check, which a blank one does not. */
export function caseChecksSomething(trial: Case): boolean {
  return trial.expect.length > 0 || (trial.expectWorld?.length ?? 0) > 0;
}
