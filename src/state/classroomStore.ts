import type { Algorithm } from '../core/ast/types';
import { sanitizeStatements } from '../core/ast/validateShape';
import type { Case, Mark } from '../core/classroom/grade';
import { getSupabase } from './supabase';

/**
 * Everything a classroom needs from the database.
 *
 * Shaped like `supabaseStore.ts`: a thin layer that validates what comes back
 * rather than asserting it. Rows here were written by other people's browsers,
 * which makes them input, not state — and unlike an algorithm, some of them
 * were written by someone with a reason to lie about their own score.
 *
 * Nothing in this file enforces a rule. Every rule lives in the policies in
 * `supabase/schema.sql`, because that is the only place a public browser key
 * cannot argue with.
 */

export interface Classroom {
  id: string;
  name: string;
  joinCode: string;
  teacherId: string;
  /** Whether the signed-in account is the one that owns this room. */
  mine: boolean;
}

export interface Member {
  userId: string;
  name: string;
  joinedAt: string;
}

export interface Assignment {
  id: string;
  classroomId: string;
  title: string;
  points: number;
  kind: 'blocks' | 'code';
  body: Algorithm['body'];
  source?: string;
  cases: Case[];
  createdAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  userId: string;
  kind: 'blocks' | 'code';
  body: Algorithm['body'];
  source?: string;
  score: number | null;
  passed: number | null;
  total: number | null;
  submittedAt: string;
}

export interface RankRow {
  userId: string;
  name: string;
  points: number;
  handedIn: number;
}

/*
 * The alphabet a join code is drawn from.
 *
 * No O, no 0, no I, no 1: a code is read off a whiteboard at the back of a
 * room and typed by thirty people at once, and those four characters are where
 * that goes wrong. Six of these is about a billion codes, which is more than
 * enough for a table that only ever holds classrooms.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newJoinCode(): string {
  const picks = new Uint32Array(6);
  crypto.getRandomValues(picks);
  return [...picks].map((pick) => CODE_ALPHABET[pick % CODE_ALPHABET.length]).join('');
}

/** A row's cases, which arrive as `jsonb` and are therefore unknown. */
function reviveCases(value: unknown): Case[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const answers = Array.isArray(record.answers) ? record.answers.map(String) : [];
    const expect = Array.isArray(record.expect) ? record.expect.map(String) : [];
    return [{ answers, expect }];
  });
}

function fullName(first: unknown, last: unknown): string {
  return `${typeof first === 'string' ? first : ''} ${typeof last === 'string' ? last : ''}`.trim();
}

export async function myClassrooms(): Promise<Classroom[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data: session } = await supabase.auth.getUser();
  const me = session.user?.id ?? null;

  /* One query, because the policy already answers "which rooms may I see" —
     the ones I teach and the ones I am in. Asking twice and merging would be
     the client re-deriving a rule the database has already applied. */
  const { data, error } = await supabase
    .from('classrooms')
    .select('id, name, join_code, teacher_id')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[tobot] could not list classrooms:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === 'string' ? row.name : '',
    joinCode: typeof row.join_code === 'string' ? row.join_code : '',
    teacherId: String(row.teacher_id),
    mine: String(row.teacher_id) === me,
  }));
}

export async function createClassroom(name: string): Promise<Classroom | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getUser();
  const me = session.user?.id;
  if (!me) return null;

  /* The code is unique in the database, so a collision is a failed insert
     rather than a duplicate. Three attempts is far more than six random
     characters will ever need, and gives up rather than looping forever. */
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const joinCode = newJoinCode();
    const { data, error } = await supabase
      .from('classrooms')
      .insert({ name, join_code: joinCode, teacher_id: me })
      .select('id, name, join_code, teacher_id')
      .single();

    if (!error && data) {
      return {
        id: String(data.id),
        name: String(data.name),
        joinCode: String(data.join_code),
        teacherId: String(data.teacher_id),
        mine: true,
      };
    }
    if (error && !/duplicate key/i.test(error.message)) {
      throw new Error(error.message);
    }
  }
  throw new Error('could not find a free classroom code');
}

/**
 * Joining, which goes through the database function rather than an insert.
 *
 * A student holding a code cannot read the classroom it names, so there is no
 * check they could satisfy from here. The function does the lookup and the
 * insert in one place, past the policies, and tells them nothing about codes
 * that are not theirs.
 */
export async function joinClassroom(code: string): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('join_classroom', { code });
  if (error) throw new Error(error.message);
  return typeof data === 'string' ? data : null;
}

export async function membersOf(classroomId: string): Promise<Member[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('classroom_members')
    .select('user_id, joined_at, profiles(first_name, last_name)')
    .eq('classroom_id', classroomId);

  if (error) {
    console.error('[tobot] could not list members:', error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const profile = (row as { profiles?: unknown }).profiles as
      | { first_name?: unknown; last_name?: unknown }
      | null;
    return {
      userId: String(row.user_id),
      name: fullName(profile?.first_name, profile?.last_name),
      joinedAt: String(row.joined_at),
    };
  });
}

export async function assignmentsOf(classroomId: string): Promise<Assignment[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[tobot] could not list assignments:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    classroomId: String(row.classroom_id),
    title: typeof row.title === 'string' ? row.title : '',
    points: typeof row.points === 'number' ? row.points : 0,
    kind: row.kind === 'code' ? 'code' : 'blocks',
    // The same standard the algorithm store holds: a tree from someone else's
    // browser is walked, not trusted.
    body: sanitizeStatements(row.body),
    source: typeof row.source === 'string' ? row.source : undefined,
    cases: reviveCases(row.cases),
    createdAt: String(row.created_at),
  }));
}

export async function createAssignment(
  classroomId: string,
  draft: { title: string; points: number; algorithm: Algorithm; cases: Case[] },
): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from('assignments').insert({
    classroom_id: classroomId,
    title: draft.title,
    points: draft.points,
    kind: draft.algorithm.kind ?? 'blocks',
    body: draft.algorithm.body,
    source: draft.algorithm.kind === 'code' ? (draft.algorithm.source ?? '') : null,
    cases: draft.cases,
  });
  if (error) throw new Error(error.message);
}

export async function removeAssignment(id: string): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Every submission for one assignment — which only its teacher can read. */
export async function submissionsOf(assignmentId: string): Promise<Submission[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId);

  if (error) {
    console.error('[tobot] could not list submissions:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    assignmentId: String(row.assignment_id),
    userId: String(row.user_id),
    kind: row.kind === 'code' ? 'code' : 'blocks',
    body: sanitizeStatements(row.body),
    source: typeof row.source === 'string' ? row.source : undefined,
    score: typeof row.score === 'number' ? row.score : null,
    passed: typeof row.passed === 'number' ? row.passed : null,
    total: typeof row.total === 'number' ? row.total : null,
    submittedAt: String(row.submitted_at),
  }));
}

/**
 * Handing work in, or handing it in again.
 *
 * `upsert` on the pair, because a student who improves their program should
 * replace what they sent rather than queue a second copy — and the unique
 * constraint in the schema says the same thing.
 *
 * Nothing about a score is sent. The trigger would refuse it, which is the
 * point: this path cannot award marks even by accident.
 */
export async function handIn(assignmentId: string, algorithm: Algorithm): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  const { data: session } = await supabase.auth.getUser();
  const me = session.user?.id;
  if (!me) return;

  const { error } = await supabase.from('submissions').upsert(
    {
      assignment_id: assignmentId,
      user_id: me,
      kind: algorithm.kind ?? 'blocks',
      body: algorithm.body,
      source: algorithm.kind === 'code' ? (algorithm.source ?? '') : null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: 'assignment_id,user_id' },
  );
  if (error) throw new Error(error.message);
}

export async function mySubmission(assignmentId: string): Promise<Submission | null> {
  const list = await submissionsOf(assignmentId);
  return list[0] ?? null;
}

/**
 * Writing a mark, which only a teacher's request will survive.
 *
 * The policy allows it and a trigger double-checks it. If this ever starts
 * failing for a teacher, the room is not theirs — which is worth the error
 * rather than a silent zero.
 */
export async function recordMark(submissionId: string, mark: Mark): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from('submissions')
    .update({
      score: mark.score,
      passed: mark.passed,
      total: mark.total,
      checked_at: new Date().toISOString(),
    })
    .eq('id', submissionId);
  if (error) throw new Error(error.message);
}

export async function rankingOf(classroomId: string): Promise<RankRow[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('classroom_ranking', { room: classroomId });
  if (error) {
    console.error('[tobot] could not read the ranking:', error.message);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    userId: String(row.user_id),
    name: fullName(row.first_name, row.last_name),
    points: typeof row.points === 'number' ? row.points : 0,
    handedIn: typeof row.handed_in === 'number' ? row.handed_in : 0,
  }));
}
