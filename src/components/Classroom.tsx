import {
  CheckCircleIcon as Marked,
  CopyIcon as CopyMark,
  PlusIcon as Plus,
  SignOutIcon as SignOut,
  TrashIcon as Trash,
  UsersThreeIcon as People,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { createId } from '../core/ast/factory';
import type { Algorithm } from '../core/ast/types';
import type { Case, CaseResult } from '../core/classroom/grade';
import { gradeBlocks } from '../core/classroom/grade';
import { gradeCode } from '../core/classroom/gradeCode';
import { emitters, renderLines } from '../core/emitters';
import { usePlural, useTranslation } from '../i18n/context';
import type { Assignment, Classroom as Room, Member, RankRow, Submission } from '../state/classroomStore';
import {
  assignmentsOf,
  casesFor,
  ClassroomsNotSetUp,
  createAssignment,
  createClassroom,
  joinClassroom,
  leaveClassroom,
  membersOf,
  myClassrooms,
  mySubmission,
  rankingOf,
  recordMark,
  removeAssignment,
  removeMember,
  submissionsOf,
} from '../state/classroomStore';
import { useSlowWait } from '../state/useSlowWait';
import { Loading } from './Skeleton';
import './Classroom.css';

interface ClassroomProps {
  /** Whether there is an account; without one there is no room to be in. */
  signedIn: boolean;
  /** What is open in the editor, which is what a teacher sets as work. */
  current: Algorithm;
  /** Opens an assignment's starting point in the editor. */
  /* `null` when the opener has nothing to hand in — a teacher is not a
     member of their own room, so the policy refuses their submission. */
  onOpen: (algorithm: Algorithm, assignmentId: string | null) => void;
}

/**
 * An assignment as a thing the editor can open.
 *
 * The id is derived from the assignment rather than minted fresh. A new id on
 * every open meant the autosave wrote a *new library row each time*, so a
 * student who opened the same exercise five times had five copies of it saved.
 * Derived, the work on one assignment is one document, updated.
 */
function asAlgorithm(assignment: Assignment): Algorithm {
  return {
    id: `alg_${assignment.id.replace(/-/g, '').slice(0, 12)}`,
    name: assignment.title,
    kind: assignment.kind,
    source: assignment.source,
    body: assignment.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** A case row keeps its identity while it is being edited. */
interface DraftCase extends Case {
  key: string;
}

const blankCase = (): DraftCase => ({ key: createId(), answers: [], expect: [] });

/**
 * The last room this session looked at, so returning does not start from
 * nothing. The same reasoning as the library's `lastKnown`: the screen unmounts
 * every time the editor opens, and refetching from a blank is what made it
 * blink.
 */
let lastRooms: Room[] | null = null;

interface RosterProps {
  assignment: Assignment;
  submissions: Submission[];
  members: Member[];
  detail: Record<string, CaseResult[]>;
  reading: string | null;
  onRead: (submissionId: string) => void;
}

/**
 * One assignment's class: who handed in, what they scored, and why.
 *
 * The list a teacher actually chases is the one that includes the people who
 * handed in *nothing*, so it is built from the room's members rather than from
 * the submissions — those who have not are the rows with no work behind them,
 * and they sort to the top.
 */
function RosterList({ assignment, submissions, members, detail, reading, onRead }: RosterProps) {
  const { d, fill, language, formatDate } = useTranslation();
  const byUser = new Map(submissions.map((one) => [one.userId, one]));

  const rows = members
    .map((member) => ({ member, submission: byUser.get(member.userId) ?? null }))
    .sort((a, b) => {
      // Ungraded and unsubmitted first: those are the rows that need a teacher.
      const weight = (row: typeof a): number =>
        !row.submission ? 0 : row.submission.score === null ? 1 : 2;
      return weight(a) - weight(b);
    });

  if (rows.length === 0) return <p className="classroom__empty">{d.classroom.noMembers}</p>;

  return (
    <ul className="classroom__roster-list">
      {rows.map(({ member, submission }) => {
        const results = submission ? detail[submission.id] : undefined;
        const open = submission !== null && reading === submission.id;

        return (
          <li key={member.userId}>
            <div className="classroom__roster-row">
              <span className="classroom__roster-name">{member.name || d.classroom.unnamed}</span>
              <span className="classroom__roster-state" data-state={!submission ? 'out' : submission.score === null ? 'pending' : 'marked'}>
                {!submission
                  ? d.classroom.notHandedInYet
                  : submission.score === null
                    ? d.classroom.notMarked
                    : `${submission.score} / ${assignment.points}`}
              </span>
              {submission && submission.total !== null && (
                <span className="classroom__meta">
                  {fill(d.classroom.casesPassed, {
                    passed: submission.passed ?? 0,
                    total: submission.total,
                  })}
                </span>
              )}
              {submission && (
                <span className="classroom__meta">
                  {fill(d.classroom.handedInAt, { date: formatDate(submission.submittedAt) })}
                </span>
              )}
              {submission && (
                <button type="button" className="classroom__quiet" onClick={() => onRead(submission.id)}>
                  {open ? d.classroom.hideProgram : d.classroom.seeProgram}
                </button>
              )}
            </div>

            {open && submission && (
              <div className="classroom__work">
                <pre>
                  {submission.kind === 'code'
                    ? (submission.source ?? '')
                    : renderLines(
                        emitters.pseudocode.emit(
                          {
                            id: submission.id,
                            name: assignment.title,
                            body: submission.body,
                            createdAt: submission.submittedAt,
                            updatedAt: submission.submittedAt,
                          },
                          { locale: language },
                        ),
                      )}
                </pre>

                {/* The part that was computed and discarded: what each case
                    actually printed, beside what it should have. */}
                {results ? (
                  <ol className="classroom__cases">
                    {results.map((result, index) => (
                      <li key={index} data-passed={result.passed || undefined}>
                        <strong>{fill(d.classroom.caseLabel, { n: index + 1 })}</strong>
                        <span className="classroom__meta">{result.passed ? '✓' : '✗'}</span>
                        {!result.passed && (
                          <>
                            <span className="classroom__meta">{d.classroom.got}</span>
                            <code>{result.got.join(' / ') || '—'}</code>
                          </>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="classroom__hint">{d.classroom.detailOnlyNow}</p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The room's shape while it is being fetched: a header, work, a leaderboard. */
function RoomSkeleton() {
  const { d } = useTranslation();
  return (
    <div className="classroom">
      <Loading
        className="classroom__body"
        count={2}
        lines={['40%', '100%', '100%', '70%']}
        tall
        label={d.classroom.section}
      />
    </div>
  );
}

/**
 * The classroom.
 *
 * One screen with two faces rather than two screens: a teacher and a student
 * look at the same room, and almost everything on it is the same for both.
 * What differs is who may act, and that is decided by the database. Hiding a
 * button a policy would refuse is courtesy, not security.
 */
export function Classroom({ signedIn, current, onOpen }: ClassroomProps) {
  const { d, fill } = useTranslation();
  const plural = usePlural();

  const [rooms, setRooms] = useState<Room[]>(() => lastRooms ?? []);
  const [loaded, setLoaded] = useState(lastRooms !== null);
  const hasLoaded = useRef(lastRooms !== null);
  const [notSetUp, setNotSetUp] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [work, setWork] = useState<Assignment[]>([]);
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const [mine, setMine] = useState<Record<string, Submission | null>>({});

  const [roomName, setRoomName] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  /** One place for "that did not work", so no action can fail in silence. */
  const [fault, setFault] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState(10);
  const [cases, setCases] = useState<DraftCase[]>([blankCase()]);

  /* Switching rooms used to leave the previous room's assignments, ranking
     and members on screen until three round-trips finished. */
  const [switching, setSwitching] = useState(false);
  /* Which assignment is open, and what its class handed in. Fetched when it is
     opened rather than with the room: a teacher looks at one assignment at a
     time, and fetching every roster up front is a request per assignment for
     work nobody asked to see. */
  const [openWork, setOpenWork] = useState<string | null>(null);
  const [roster, setRoster] = useState<Submission[]>([]);
  const [rosterBusy, setRosterBusy] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  /*
    Why each case failed, from the last marking run.

    `gradeAll` has had this in its hands all along — `Mark.results` carries what
    the program actually printed, with a comment saying it exists so a teacher
    can see why a case failed — and threw it away one line after computing it.
    Held for the session rather than stored: it covers the moment a teacher
    cares, which is right after marking, and the panel says so rather than
    pretending it is permanent.
  */
  const [detail, setDetail] = useState<Record<string, CaseResult[]>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [gradedCount, setGradedCount] = useState<number | null>(null);

  /* Armed is a state a reader can get into by accident, and the only ways out
     were to go through with it or to leave the room. */
  useEffect(() => {
    if (!confirming) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setConfirming(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming]);

  const active = rooms.find((room) => room.id === activeId) ?? null;
  /* Only once the swap is slow enough to notice; a cached room never flashes. */
  const slowSwitch = useSlowWait(switching);

  const loadRooms = useCallback(async () => {
    try {
      const list = await myClassrooms();
      lastRooms = list;
      setRooms(list);
      setActiveId((chosen) => chosen ?? list[0]?.id ?? null);
      setNotSetUp(false);
    } catch (thrown) {
      if (thrown instanceof ClassroomsNotSetUp) setNotSetUp(true);
      else console.error('[tobot] could not list classrooms:', thrown);
    } finally {
      /* Settled either way. Without this a failed dynamic import left the
         section blank for good — the same hole the library had. */
      hasLoaded.current = true;
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setLoaded(true);
      return;
    }
    void loadRooms();
  }, [signedIn, loadRooms]);

  const fillRoom = useCallback(async (id: string, teaching: boolean) => {
    const [people, assignments, board] = await Promise.all([
      membersOf(id),
      assignmentsOf(id),
      rankingOf(id),
    ]);
    setMembers(people);
    setWork(assignments);
    setRanking(board);

    /* A student's own marks, which the screen had no way of showing. Skipped
       for a teacher, who has no submissions of their own — they are not a
       member of their room, and the policy would refuse the insert. */
    if (teaching) {
      setMine({});
      return;
    }
    const pairs = await Promise.all(
      assignments.map(async (one) => [one.id, await mySubmission(one.id)] as const),
    );
    setMine(Object.fromEntries(pairs));
  }, []);

  const loadRoom = useCallback(
    async (id: string, teaching: boolean) => {
      setSwitching(true);
      try {
        await fillRoom(id, teaching);
      } finally {
        setSwitching(false);
      }
    },
    [fillRoom],
  );

  useEffect(() => {
    setGradedCount(null);
    if (activeId) void loadRoom(activeId, active?.mine ?? false);
  }, [activeId, active?.mine, loadRoom]);

  /** Every action goes through here, so none of them can fail quietly. */
  const attempt = useCallback(async (job: () => Promise<void>) => {
    setBusy(true);
    setFault(null);
    try {
      await job();
    } catch (thrown) {
      console.error('[tobot] classroom action failed:', thrown);
      setFault(d.classroom.failed);
    } finally {
      setBusy(false);
    }
  }, [d.classroom.failed]);

  const create = (): void => {
    void attempt(async () => {
      const room = await createClassroom(roomName.trim());
      setRoomName('');
      await loadRooms();
      if (room) setActiveId(room.id);
    });
  };

  const join = (): void => {
    void attempt(async () => {
      let id: string | null = null;
      try {
        id = await joinClassroom(code.trim());
      } catch {
        /* The database answers the same way for a code that does not exist and
           one that is not yours, so there is only one thing to say. */
        setFault(d.classroom.joinFailed);
        return;
      }
      setCode('');
      await loadRooms();
      if (id) setActiveId(id);
    });
  };

  const saveAssignment = (): void => {
    void attempt(async () => {
      if (!activeId) return;
      await createAssignment(activeId, {
        title: title.trim(),
        points,
        algorithm: current,
        cases: cases
          .filter((one) => one.expect.length > 0)
          .map(({ answers, expect }) => ({ answers, expect })),
      });
      setComposing(false);
      setTitle('');
      setCases([blankCase()]);
      await loadRoom(activeId, true);
    });
  };

  /**
   * Marking, which happens here, in the teacher's own browser.
   *
   * There is no server to run a student's program on and the browser key is
   * public, so a mark computed on the student's machine would be a claim
   * rather than a fact. The cases are fetched here too, and only here: they are
   * the answer key, and a student's session cannot read them.
   */
  const gradeAll = (): void => {
    void attempt(async () => {
      if (!activeId) return;
      const sets = await Promise.all(
        work.map(async (one) => ({ assignment: one, cases: await casesFor(one.id) })),
      );
      const runnable = sets.filter((set) => set.cases.length > 0);

      const queued: { submission: Submission; cases: Case[]; points: number }[] = [];
      for (const set of runnable) {
        for (const submission of await submissionsOf(set.assignment.id)) {
          queued.push({ submission, cases: set.cases, points: set.assignment.points });
        }
      }

      setProgress({ done: 0, total: queued.length });
      let marked = 0;
      try {
        for (const job of queued) {
          const mark =
            job.submission.kind === 'code'
              ? await gradeCode(job.submission.source ?? '', job.cases, job.points)
              : gradeBlocks(job.submission.body, job.cases, job.points);
          await recordMark(job.submission.id, mark);
          setDetail((all) => ({ ...all, [job.submission.id]: mark.results }));
          marked += 1;
          setProgress({ done: marked, total: queued.length });
        }
      } finally {
        /* Reported even if it stopped halfway, so a half-marked class is
           visible rather than silent. */
        setProgress(null);
        setGradedCount(marked);
        await loadRoom(activeId, true);
      }
    });
  };

  const openRoster = (assignmentId: string): void => {
    if (openWork === assignmentId) {
      setOpenWork(null);
      return;
    }
    setOpenWork(assignmentId);
    setReading(null);
    setRosterBusy(true);
    void (async () => {
      try {
        setRoster(await submissionsOf(assignmentId));
      } finally {
        setRosterBusy(false);
      }
    })();
  };

  const copyCode = (): void => {
    if (!active) return;
    void navigator.clipboard.writeText(active.joinCode).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => {
        // Denied permission or an insecure origin; the code is on screen anyway.
      },
    );
  };

  if (!signedIn) return <p className="classroom__notice">{d.classroom.needsAccount}</p>;
  if (notSetUp) return <p className="classroom__notice">{d.classroom.notConfigured}</p>;
  if (!loaded) return <RoomSkeleton />;

  const fail = fault && (
    <p className="classroom__error" role="alert">
      {fault}
    </p>
  );

  if (rooms.length === 0) {
    return (
      <div className="classroom__start">
        <section className="classroom__panel">
          <h2>{d.classroom.createTitle}</h2>
          <p>{d.classroom.createHint}</p>
          <div className="classroom__row">
            <label className="classroom__sr" htmlFor="room-name">
              {d.classroom.nameLabel}
            </label>
            <input
              id="room-name"
              type="text"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder={d.classroom.namePlaceholder}
            />
            <button type="button" className="classroom__primary" onClick={create} disabled={busy || !roomName.trim()}>
              {d.classroom.createAction}
            </button>
          </div>
        </section>

        <section className="classroom__panel">
          <h2>{d.classroom.joinTitle}</h2>
          <p>{d.classroom.joinHint}</p>
          <div className="classroom__row">
            <label className="classroom__sr" htmlFor="room-code">
              {d.classroom.codeLabel}
            </label>
            <input
              id="room-code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder={d.classroom.codePlaceholder}
              maxLength={8}
              className="classroom__code-input"
            />
            <button type="button" className="classroom__primary" onClick={join} disabled={busy || !code.trim()}>
              {d.classroom.joinAction}
            </button>
          </div>
          {fail}
        </section>
      </div>
    );
  }

  const teaching = active?.mine ?? false;

  return (
    <div className="classroom">
      <header className="classroom__head">
        {rooms.length > 1 ? (
          <>
            {/* A heading as well as the picker. Replacing the title with a
                control left the screen with no heading at all, and the room's
                name living inside a `select`. */}
            <h2>{active?.name}</h2>
            <label className="classroom__sr" htmlFor="room-picker">
              {d.classroom.roomLabel}
            </label>
            <select
              id="room-picker"
              className="classroom__picker"
              value={activeId ?? ''}
              onChange={(event) => setActiveId(event.target.value)}
            >
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <h2>{active?.name}</h2>
        )}

        {/* The code is the teacher's to hand out. A student holding it can only
            rejoin a room they are already in, but showing it alongside "te
            damos un código para repartir" told them it was theirs to give. */}
        {active && teaching && (
          <div className="classroom__code">
            <span className="classroom__code-label">{d.classroom.code}</span>
            <code>{active.joinCode}</code>
            <button
              type="button"
              onClick={copyCode}
              title={d.classroom.copyCode}
              aria-label={d.classroom.copyCode}
            >
              <CopyMark weight="bold" aria-hidden="true" />
            </button>
            <span className="classroom__sr" role="status">
              {copied ? d.classroom.copied : ''}
            </span>
          </div>
        )}

        <span className="classroom__role">
          {teaching ? d.classroom.teacherOf : d.classroom.memberOf}
        </span>

        {active && !teaching && (
          <button
            type="button"
            className="classroom__quiet"
            onClick={() =>
              confirming === 'leave'
                ? void attempt(async () => {
                    await leaveClassroom(active.id);
                    setConfirming(null);
                    lastRooms = null;
                    setActiveId(null);
                    await loadRooms();
                  })
                : setConfirming('leave')
            }
          >
            <SignOut weight="bold" aria-hidden="true" />{' '}
            {confirming === 'leave' ? d.actions.confirm : d.classroom.leave}
          </button>
        )}
      </header>

      {fail}

      {slowSwitch ? (
        <Loading className="classroom__body" count={2} lines={['40%', '100%', '70%']} tall />
      ) : (
      <div className="classroom__body">
        <section className="classroom__panel">
          <div className="classroom__panel-head">
            <h3>{d.classroom.assignments}</h3>
            {teaching && !composing && (
              <button type="button" className="classroom__add" onClick={() => setComposing(true)}>
                <Plus weight="bold" aria-hidden="true" /> {d.classroom.newAssignment}
              </button>
            )}
          </div>

          {composing && (
            <div className="classroom__compose">
              <label>
                <span>{d.classroom.assignmentTitle}</span>
                <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label>
                <span>{d.classroom.points}</span>
                <input
                  type="number"
                  min={0}
                  value={points}
                  onChange={(event) => {
                    /* An emptied field is `NaN`, which the column refuses, and
                       a typed `-5` passes the `min` hint. Both used to reach
                       the database and fail there. */
                    const next = Number(event.target.value);
                    setPoints(Number.isFinite(next) && next >= 0 ? next : 0);
                  }}
                />
              </label>
              <p className="classroom__hint">{d.classroom.fromAlgorithm}</p>

              <h4>{d.classroom.cases}</h4>
              <p className="classroom__hint">{d.classroom.casesHint}</p>
              {cases.map((one, index) => (
                <div className="classroom__case" key={one.key}>
                  <label>
                    <span>{d.classroom.caseAnswers}</span>
                    <textarea
                      rows={2}
                      value={one.answers.join('\n')}
                      onChange={(event) =>
                        setCases((all) =>
                          all.map((item, at) =>
                            at === index
                              ? { ...item, answers: event.target.value.split('\n').filter(Boolean) }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>{d.classroom.caseExpect}</span>
                    <textarea
                      rows={2}
                      value={one.expect.join('\n')}
                      onChange={(event) =>
                        setCases((all) =>
                          all.map((item, at) =>
                            at === index
                              ? { ...item, expect: event.target.value.split('\n').filter(Boolean) }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="classroom__quiet"
                    disabled={cases.length === 1}
                    onClick={() => setCases((all) => all.filter((_, at) => at !== index))}
                  >
                    {d.classroom.removeCase}
                  </button>
                </div>
              ))}

              {cases.every((one) => one.expect.length === 0) && (
                <p className="classroom__hint">{d.classroom.noCases}</p>
              )}

              <div className="classroom__row">
                <button
                  type="button"
                  className="classroom__quiet"
                  onClick={() => setCases((all) => [...all, blankCase()])}
                >
                  {d.classroom.addCase}
                </button>
                <button type="button" className="classroom__primary" onClick={saveAssignment} disabled={busy || !title.trim()}>
                  {d.classroom.save}
                </button>
                <button type="button" className="classroom__quiet" onClick={() => setComposing(false)}>
                  {d.classroom.cancel}
                </button>
              </div>
            </div>
          )}

          {work.length === 0 && !composing ? (
            <p className="classroom__empty">{d.classroom.noAssignments}</p>
          ) : (
            <ul className="classroom__list">
              {work.map((assignment) => {
                const handed = mine[assignment.id];
                return (
                  <li key={assignment.id}>
                    <div>
                      <strong className="classroom__title">{assignment.title}</strong>
                      <span className="classroom__meta">
                        {plural(assignment.points, d.classroom.pointsWorthOne, d.classroom.pointsWorth)}
                        {teaching &&
                          ` · ${plural(assignment.caseCount, d.classroom.caseCountOne, d.classroom.caseCount)}`}
                      </span>
                      {/* What a student opens this screen for, and could not
                          see: whether they handed in, and what it scored. */}
                      {!teaching && (
                        <span className="classroom__mine" data-state={handed ? 'in' : 'out'}>
                          {!handed
                            ? d.classroom.notHandedIn
                            : handed.score === null
                              ? d.classroom.pending
                              : fill(d.classroom.yourScore, {
                                  score: handed.score,
                                  points: assignment.points,
                                })}
                        </span>
                      )}
                    </div>
                    <div className="classroom__actions">
                      <button
                        type="button"
                        className="classroom__quiet"
                        onClick={() => onOpen(asAlgorithm(assignment), teaching ? null : assignment.id)}
                      >
                        {d.classroom.open}
                      </button>
                      {teaching && (
                        <button
                          type="button"
                          className="classroom__quiet"
                          data-active={openWork === assignment.id || undefined}
                          onClick={() => openRoster(assignment.id)}
                        >
                          {openWork === assignment.id ? d.classroom.reviewClose : d.classroom.review}
                        </button>
                      )}
                      {teaching &&
                        (confirming === assignment.id ? (
                          <button
                            type="button"
                            className="classroom__confirm"
                            title={d.classroom.confirmDelete}
                            aria-label={d.classroom.confirmDelete}
                            onClick={() =>
                              void attempt(async () => {
                                await removeAssignment(assignment.id);
                                setConfirming(null);
                                if (activeId) await loadRoom(activeId, true);
                              })
                            }
                          >
                            {d.actions.confirm}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="classroom__quiet classroom__quiet--danger"
                            title={d.classroom.deleteAssignment}
                            aria-label={d.classroom.deleteAssignment}
                            onClick={() => setConfirming(assignment.id)}
                          >
                            <Trash weight="bold" aria-hidden="true" />
                          </button>
                        ))}
                    </div>

                    {openWork === assignment.id && (
                      <div className="classroom__roster">
                        {rosterBusy ? (
                          <Loading count={2} lines={['40%', '70%']} />
                        ) : (
                          <RosterList
                            assignment={assignment}
                            submissions={roster}
                            members={members}
                            detail={detail}
                            reading={reading}
                            onRead={(id) => setReading(reading === id ? null : id)}
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {teaching && work.length > 0 && (
            <div className="classroom__row">
              <button type="button" className="classroom__primary" onClick={gradeAll} disabled={busy}>
                <Marked weight="bold" aria-hidden="true" /> {progress ? d.classroom.grading : d.classroom.grade}
              </button>
              <span className="classroom__meta" role="status">
                {progress
                  ? fill(d.classroom.gradingProgress, { done: progress.done, total: progress.total })
                  : gradedCount === null
                    ? ''
                    : gradedCount === 0
                      ? d.classroom.nothingToGrade
                      : plural(gradedCount, d.classroom.gradedOne, d.classroom.gradedCount)}
              </span>
            </div>
          )}
        </section>

        <section className="classroom__panel">
          <h3>{d.classroom.ranking}</h3>
          {ranking.length === 0 ? (
            <p className="classroom__empty">{d.classroom.noRanking}</p>
          ) : (
            <table className="classroom__table">
              <thead>
                <tr>
                  <th scope="col">{d.classroom.rankPosition}</th>
                  <th scope="col">{d.classroom.rankStudent}</th>
                  <th scope="col">{d.classroom.rankPoints}</th>
                  <th scope="col">{d.classroom.rankHandedIn}</th>
                  {teaching && <th scope="col" />}
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, index) => (
                  <tr key={row.userId}>
                    <td>{index + 1}</td>
                    <td>{row.name || d.classroom.unnamed}</td>
                    <td>
                      <strong>{row.points}</strong>
                    </td>
                    <td>{row.handedIn}</td>
                    {teaching && (
                      <td>
                        {confirming === row.userId ? (
                          <button
                            type="button"
                            className="classroom__confirm"
                            title={d.classroom.confirmRemove}
                            aria-label={d.classroom.confirmRemove}
                            onClick={() =>
                              void attempt(async () => {
                                if (!activeId) return;
                                await removeMember(activeId, row.userId);
                                setConfirming(null);
                                await loadRoom(activeId, true);
                              })
                            }
                          >
                            {d.actions.confirm}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="classroom__quiet classroom__quiet--danger"
                            title={d.classroom.remove}
                            aria-label={d.classroom.remove}
                            onClick={() => setConfirming(row.userId)}
                          >
                            <Trash weight="bold" aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* The count only; the names are in the table above, and listing them
              twice on one screen was saying the same thing twice. */}
          <p className="classroom__people">
            <People weight="bold" aria-hidden="true" />{' '}
            {members.length === 0
              ? d.classroom.noMembers
              : `${members.length} · ${d.classroom.members}`}
          </p>
        </section>
      </div>
      )}
    </div>
  );
}
