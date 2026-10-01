import type { Algorithm } from '../core/ast/types';
import { sanitizeStatements } from '../core/ast/validateShape';
import type { Case, Mark } from '../core/classroom/grade';
import type { WorldDefinition } from '../core/world/types';
import { reviveExpectations, reviveInputs, reviveTimeline, reviveWorld } from '../core/world/revive';
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
  /** What the work asks for, in the teacher's words. Empty when they wrote none. */
  instructions: string;
  points: number;
  kind: 'blocks' | 'code';
  body: Algorithm['body'];
  source?: string;
  /** The scenario it is played in, if any. */
  world?: WorldDefinition;
  /** How many cases it has. The cases themselves are the teacher's. */
  caseCount: number;
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
  /** When it was marked. Without it "sin calificar" cannot be told apart from
      "marked, and then handed in again". */
  checkedAt: string | null;
  submittedAt: string;
}

export interface RankRow {
  userId: string;
  name: string;
  points: number;
  handedIn: number;
}

/**
 * An assignment as a thing the editor can open.
 *
 * The id is derived from the assignment rather than minted fresh. A new id on
 * every open meant the autosave wrote a *new library row each time*, so a
 * student who opened the same exercise five times had five copies of it saved.
 * Derived, the work on one assignment is one document, updated.
 */
export function assignmentAsAlgorithm(assignment: Assignment): Algorithm {
  const now = new Date().toISOString();
  return {
    id: `alg_${assignment.id.replace(/-/g, '').slice(0, 12)}`,
    name: assignment.title,
    kind: assignment.kind,
    source: assignment.source,
    body: assignment.body,
    world: assignment.world,
    createdAt: now,
    updatedAt: now,
  };
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
    const inputs = reviveInputs(record.inputs);
    const timeline = reviveTimeline(record.timeline);
    const expectWorld = reviveExpectations(record.expectWorld);
    return [
      {
        answers,
        expect,
        ...(inputs && Object.keys(inputs).length > 0 ? { inputs } : {}),
        ...(timeline?.length ? { timeline } : {}),
        ...(expectWorld?.length ? { expectWorld } : {}),
      },
    ];
  });
}

function fullName(first: unknown, last: unknown): string {
  return `${typeof first === 'string' ? first : ''} ${typeof last === 'string' ? last : ''}`.trim();
}

/**
 * Thrown when the classroom tables are not there yet.
 *
 * Distinct from "you are in no classrooms", which looks identical from the
 * client and is not remotely the same thing: without it, a teacher whose
 * project had not been migrated was shown the cheerful create screen, and
 * joining then told a student their teacher's code did not exist.
 */
export class ClassroomsNotSetUp extends Error {
  constructor() {
    super('the classroom tables are not in this project yet');
    this.name = 'ClassroomsNotSetUp';
  }
}

/** PostgREST's answer when the table itself is missing from its schema cache. */
function isMissingTable(code: string | undefined, message: string): boolean {
  return code === 'PGRST205' || code === '42P01' || /could not find the table/i.test(message);
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
    if (isMissingTable(error.code, error.message)) throw new ClassroomsNotSetUp();
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

/**
 * Who is in a room, and what they are called.
 *
 * Two queries rather than one embedded select. PostgREST can only join tables
 * that a foreign key connects, and `classroom_members.user_id` points at
 * `auth.users` — the same id a profile has, but not the same table. Asking for
 * `profiles(...)` from here returns "could not find a relationship", which is
 * exactly what it said.
 *
 * The obvious fix is a second foreign key onto `profiles`, and it is the wrong
 * one: it would make a profile row a *requirement* for being in a class, so an
 * account without one could not join at all. A missing name is a small
 * problem; a student who cannot enter the room is not. So the names are looked
 * up separately and anyone without one simply has none.
 */
export async function membersOf(classroomId: string): Promise<Member[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('classroom_members')
    .select('user_id, joined_at')
    .eq('classroom_id', classroomId);

  if (error) {
    console.error('[tobot] could not list members:', error.message);
    return [];
  }

  const rows = data ?? [];
  const ids = rows.map((row) => String(row.user_id));
  const names = new Map<string, string>();

  if (ids.length > 0) {
    /* Readable because of the `shares_classroom` policy, which is the whole
       reason classmates can be named at all. A failure here costs the names
       and not the list. */
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', ids);

    if (profileError) {
      console.error('[tobot] could not read member names:', profileError.message);
    } else {
      for (const profile of profiles ?? []) {
        names.set(String(profile.id), fullName(profile.first_name, profile.last_name));
      }
    }
  }

  return rows.map((row) => ({
    userId: String(row.user_id),
    name: names.get(String(row.user_id)) ?? '',
    joinedAt: String(row.joined_at),
  }));
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

  const rows = data ?? [];

  /* How many cases each has, without the cases themselves. A student is not
     allowed to read them — that is the whole point of the separate table — but
     both sides need to know whether an assignment can be marked at all, and a
     count gives nothing away. Counting is free for a student: the policy
     returns no rows, so every count is zero and the screen says so. */
  const counts = new Map<string, number>();
  if (rows.length > 0) {
    const { data: caseRows } = await supabase
      .from('assignment_cases')
      .select('assignment_id, cases')
      .in(
        'assignment_id',
        rows.map((row) => String(row.id)),
      );
    for (const row of caseRows ?? []) {
      counts.set(String(row.assignment_id), reviveCases(row.cases).length);
    }
  }

  return rows.map((row) => ({
    id: String(row.id),
    classroomId: String(row.classroom_id),
    title: typeof row.title === 'string' ? row.title : '',
    instructions: typeof row.instructions === 'string' ? row.instructions : '',
    points: typeof row.points === 'number' ? row.points : 0,
    kind: row.kind === 'code' ? 'code' : 'blocks',
    // The same standard the algorithm store holds: a tree from someone else's
    // browser is walked, not trusted.
    body: sanitizeStatements(row.body),
    source: typeof row.source === 'string' ? row.source : undefined,
    world: reviveWorld(row.world),
    caseCount: counts.get(String(row.id)) ?? 0,
    createdAt: String(row.created_at),
  }));
}

/**
 * The cases for one assignment, which only its teacher can read.
 *
 * Asked for at marking time rather than carried around with the assignment, so
 * there is no moment where a student's session is holding them.
 */
export async function casesFor(assignmentId: string): Promise<Case[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('assignment_cases')
    .select('cases')
    .eq('assignment_id', assignmentId)
    .maybeSingle();

  if (error) {
    console.error('[tobot] could not read the cases:', error.message);
    return [];
  }
  return data ? reviveCases(data.cases) : [];
}

/**
 * Publishing an assignment, or saving changes to one already published.
 *
 * One function for both, because they are one form: the authoring mode opens
 * on a blank draft or on an existing assignment, and saving is the same act
 * either way. Editing keeps the row's id, so what students handed in stays
 * attached to it.
 */
export async function saveAssignment(
  classroomId: string,
  draft: {
    title: string;
    instructions: string;
    points: number;
    algorithm: Algorithm;
    cases: Case[];
  },
  existingId?: string,
): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const row = {
    title: draft.title,
    instructions: draft.instructions,
    points: draft.points,
    kind: draft.algorithm.kind ?? 'blocks',
    body: draft.algorithm.body,
    source: draft.algorithm.kind === 'code' ? (draft.algorithm.source ?? '') : null,
    // Null clears a scenario the author has just removed.
    world: draft.algorithm.world ?? null,
  };

  let id = existingId;
  if (id) {
    const { error } = await supabase.from('assignments').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from('assignments')
      .insert({ ...row, classroom_id: classroomId })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    id = String(data.id);
  }

  /* The cases go to their own table, which only the teacher may read. A
     failure here leaves an assignment nobody can mark rather than one whose
     answers everyone can see, which is the right way round to fail. */
  const { error: caseError } = await supabase
    .from('assignment_cases')
    .upsert({ assignment_id: id, cases: draft.cases }, { onConflict: 'assignment_id' });
  if (caseError) throw new Error(caseError.message);
  return id;
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
    checkedAt: typeof row.checked_at === 'string' ? row.checked_at : null,
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

/**
 * The signed-in student's own submission, asked for by name.
 *
 * It used to take the first row of "every submission for this assignment" and
 * call it mine. For a student the policy narrows that to one row, so it worked
 * by accident; for a teacher the same query returns the whole class, and the
 * first row was whichever student Postgres happened to return — handed back as
 * the teacher's own work. Leaning on a policy to mean something the query does
 * not say is how that happens.
 */
export async function mySubmission(assignmentId: string): Promise<Submission | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getUser();
  const me = session.user?.id;
  if (!me) return null;

  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('user_id', me)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: String(data.id),
    assignmentId: String(data.assignment_id),
    userId: String(data.user_id),
    kind: data.kind === 'code' ? 'code' : 'blocks',
    body: sanitizeStatements(data.body),
    source: typeof data.source === 'string' ? data.source : undefined,
    score: typeof data.score === 'number' ? data.score : null,
    passed: typeof data.passed === 'number' ? data.passed : null,
    total: typeof data.total === 'number' ? data.total : null,
    checkedAt: typeof data.checked_at === 'string' ? data.checked_at : null,
    submittedAt: String(data.submitted_at),
  };
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

/** Leaving a room, which the policy allows and nothing offered. */
export async function leaveClassroom(classroomId: string): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  const { data: session } = await supabase.auth.getUser();
  const me = session.user?.id;
  if (!me) return;
  const { error } = await supabase
    .from('classroom_members')
    .delete()
    .eq('classroom_id', classroomId)
    .eq('user_id', me);
  if (error) throw new Error(error.message);
}

/** The same row, removed by the teacher instead of by its owner. */
export async function removeMember(classroomId: string, userId: string): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from('classroom_members')
    .delete()
    .eq('classroom_id', classroomId)
    .eq('user_id', userId);
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
