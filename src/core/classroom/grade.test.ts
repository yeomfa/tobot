import { describe, expect, it } from 'vitest';

import { createId, literal, variable } from '../ast/factory';
import type { Statement } from '../ast/types';
import { gradeBlocks, linesMatch, markFrom, scoreFor } from './grade';

describe('comparing what a program said', () => {
  it('accepts an exact match', () => {
    expect(linesMatch(['12'], ['12'])).toBe(true);
  });

  // A trailing space is not a wrong answer, and no student will ever find it.
  it('forgives surrounding space', () => {
    expect(linesMatch(['  El área es: 12 '], ['El área es: 12'])).toBe(true);
  });

  it('refuses a different answer', () => {
    expect(linesMatch(['11'], ['12'])).toBe(false);
  });

  // Printing the right answer twice is not doing what was asked.
  it('counts the lines as well as their contents', () => {
    expect(linesMatch(['12', '12'], ['12'])).toBe(false);
    expect(linesMatch([], ['12'])).toBe(false);
  });

  it('cares about the order', () => {
    expect(linesMatch(['b', 'a'], ['a', 'b'])).toBe(false);
  });
});

describe('what a run is worth', () => {
  it('gives everything for everything', () => {
    expect(scoreFor(10, 4, 4)).toBe(10);
  });

  it('gives part of it for part of it', () => {
    expect(scoreFor(10, 3, 4)).toBe(8);
    expect(scoreFor(10, 1, 4)).toBe(3);
  });

  it('gives nothing for nothing', () => {
    expect(scoreFor(10, 0, 4)).toBe(0);
  });

  /*
    An assignment with no cases cannot be marked by machine. Worth nothing
    automatically rather than worth everything: the teacher has not said what
    correct looks like, so the machine must not decide it has seen it.
  */
  it('refuses to mark an assignment that defined nothing', () => {
    expect(scoreFor(10, 0, 0)).toBe(0);
  });

  it('folds results into a mark', () => {
    const mark = markFrom(20, [
      { passed: true, got: ['a'] },
      { passed: false, got: ['x'] },
    ]);
    expect(mark).toMatchObject({ passed: 1, total: 2, score: 10 });
  });
});

/** `di <valor>` — the smallest program that prints something. */
function says(value: string): Statement[] {
  return [{ id: createId(), kind: 'say', value: literal(value, 'text') }];
}

describe('marking a block algorithm', () => {
  it('passes a program that says the right thing', () => {
    const mark = gradeBlocks(says('hola'), [{ answers: [], expect: ['hola'] }], 10);
    expect(mark).toMatchObject({ passed: 1, total: 1, score: 10 });
  });

  it('fails a program that says the wrong thing, and keeps what it said', () => {
    const mark = gradeBlocks(says('adios'), [{ answers: [], expect: ['hola'] }], 10);
    expect(mark.score).toBe(0);
    expect(mark.results[0]?.got).toEqual(['adios']);
  });

  it('feeds the answers to the questions in order', () => {
    const program: Statement[] = [
      { id: createId(), kind: 'ask', prompt: literal('¿base?', 'text'), target: 'base', expect: 'number' },
      { id: createId(), kind: 'say', value: variable('base') },
    ];
    const mark = gradeBlocks(program, [{ answers: ['7'], expect: ['7'] }], 10);
    expect(mark.score).toBe(10);
  });

  // A program that crashed did not answer the question, whatever it managed to
  // print before it stopped.
  it('fails a program that errored, even if its lines matched', () => {
    const program: Statement[] = [
      ...says('hola'),
      { id: createId(), kind: 'say', value: variable('fantasma') },
    ];
    const mark = gradeBlocks(program, [{ answers: [], expect: ['hola'] }], 10);
    expect(mark.score).toBe(0);
  });

  it('marks several cases and gives part marks', () => {
    const mark = gradeBlocks(
      says('hola'),
      [
        { answers: [], expect: ['hola'] },
        { answers: [], expect: ['otra cosa'] },
      ],
      10,
    );
    expect(mark).toMatchObject({ passed: 1, total: 2, score: 5 });
  });
});
