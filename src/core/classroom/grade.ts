import type { Statement } from '../ast/types';
import { runToEnd, spokenLines } from '../runtime/headless';

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
}

export interface CaseResult {
  passed: boolean;
  /** What it actually said, so a teacher can see why a case failed. */
  got: string[];
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
export function gradeBlocks(body: Statement[], cases: Case[], points: number): Mark {
  const results = cases.map((trial) => {
    const state = runToEnd(body, trial.answers);
    const got = spokenLines(state);
    /* A program that failed did not answer the question, whatever it printed
       on the way. */
    const passed = state.status !== 'error' && linesMatch(got, trial.expect);
    return { passed, got };
  });

  return markFrom(points, results);
}
