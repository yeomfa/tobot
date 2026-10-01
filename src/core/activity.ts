import type { Statement } from './ast/types';
import { createId } from './ast/factory';
import type { Case } from './classroom/grade';
import { parseMoments, writeMoments } from './world/lines';
import type { Language } from '../i18n/types';

/**
 * A piece of work set for a student: what to do, where to start, and how it
 * will be checked.
 *
 * One shape for every kind of exercise, so the brief panel, the authoring mode
 * and the marking have one thing to understand. A classroom assignment is an
 * activity plus the classroom's own fields (`points`, who set it); a built-in
 * challenge is an activity resolved into the reader's language; and a
 * teacher-made challenge, later, will be an activity with no classroom at all.
 * That last one is why this is its own type rather than a field on an
 * assignment: the same engine has to carry work that belongs to no room.
 */
export interface Activity {
  title: string;
  /** What the student reads before starting, in the author's own words. */
  instructions: string;
  starter: { kind: 'blocks' | 'code'; body: Statement[]; source?: string };
  cases: Case[];
}

/**
 * What the brief panel shows a student: the part of an activity that is read.
 *
 * Separate from `Activity` because what reaches a student is never the whole
 * of it — the cases are the answer key, and stay with the teacher.
 */
export interface Brief {
  title: string;
  instructions: string;
  /** What it is worth, for work that is marked. */
  points?: number;
  /**
   * Cases a student may run against their own work. Only ever a built-in
   * challenge's: practice, whose cases are its specification. A classroom's
   * stay with the teacher and never reach this.
   */
  cases?: Case[];
}

/**
 * A case being edited, held as the text the author is typing.
 *
 * Text, not lists. Splitting on every keystroke and dropping blank lines —
 * which is what turning "4\n" into `["4"]` does — swallowed the newline the
 * moment it was typed, so a second answer could only ever be pasted in. The
 * text is read into a case once, when it is used.
 */
export interface DraftCase {
  key: string;
  answers: string;
  expect: string;
  /** What the scenario does by itself: `1 arranque sí`, one per line. */
  timeline: string;
  /** What must be true, and when: `4 motor sí`, one per line. */
  expectWorld: string;
}

export const blankCase = (): DraftCase => ({
  key: createId(),
  answers: '',
  expect: '',
  timeline: '',
  expectWorld: '',
});

const lines = (text: string): string[] => text.split('\n').filter((line) => line.trim() !== '');

/** A stored case as text to edit. */
export function draftFromCase(trial: Case, language: Language): DraftCase {
  return {
    key: createId(),
    answers: trial.answers.join('\n'),
    expect: trial.expect.join('\n'),
    timeline: writeMoments(trial.timeline ?? [], language),
    expectWorld: writeMoments(trial.expectWorld ?? [], language),
  };
}

/**
 * The text read back into a case, with any line that could not be read.
 *
 * The world's lines are kept only with a world to apply them to: a case
 * cannot press a button on a panel the assignment does not have.
 */
export function caseFromDraft(draft: DraftCase, withWorld: boolean): { trial: Case; bad: string[] } {
  const trial: Case = { answers: lines(draft.answers), expect: lines(draft.expect) };
  if (!withWorld) return { trial, bad: [] };
  const timeline = parseMoments(draft.timeline);
  const expected = parseMoments(draft.expectWorld);
  if (timeline.events.length > 0) trial.timeline = timeline.events;
  if (expected.events.length > 0) trial.expectWorld = expected.events;
  return { trial, bad: [...timeline.bad, ...expected.bad] };
}

/** An assignment while its author is writing it; the program is in the editor. */
export interface AuthorDraft {
  title: string;
  instructions: string;
  points: number;
  cases: DraftCase[];
}
