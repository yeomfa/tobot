import type { Statement } from './ast/types';
import { createId } from './ast/factory';
import type { Case } from './classroom/grade';

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
}

/** A case being edited, which keeps its identity while it is typed into. */
export interface DraftCase extends Case {
  key: string;
}

export const blankCase = (): DraftCase => ({ key: createId(), answers: [], expect: [] });

/** An assignment while its author is writing it; the program is in the editor. */
export interface AuthorDraft {
  title: string;
  instructions: string;
  points: number;
  cases: DraftCase[];
}
