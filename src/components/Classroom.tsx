import {
  CheckCircleIcon as Marked,
  CopyIcon as CopyMark,
  PlusIcon as Plus,
  TrashIcon as Trash,
  UsersThreeIcon as People,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';

import { createId } from '../core/ast/factory';
import type { Algorithm } from '../core/ast/types';
import type { Case } from '../core/classroom/grade';
import { gradeBlocks } from '../core/classroom/grade';
import { gradeCode } from '../core/classroom/gradeCode';
import { useTranslation } from '../i18n/context';
import type { Assignment, Classroom as Room, Member, RankRow } from '../state/classroomStore';
import {
  assignmentsOf,
  createAssignment,
  createClassroom,
  joinClassroom,
  membersOf,
  myClassrooms,
  rankingOf,
  recordMark,
  removeAssignment,
  submissionsOf,
} from '../state/classroomStore';
import './Classroom.css';

interface ClassroomProps {
  /** Whether there is an account; without one there is no room to be in. */
  signedIn: boolean;
  /** What is open in the editor, which is what a teacher sets as work. */
  current: Algorithm;
  /** Opens an assignment's starting point in the editor. */
  onOpen: (algorithm: Algorithm, assignmentId: string) => void;
}

/** An assignment as a thing the editor can open. */
function asAlgorithm(assignment: Assignment): Algorithm {
  return {
    id: createId(),
    name: assignment.title,
    kind: assignment.kind,
    source: assignment.source,
    body: assignment.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * The classroom.
 *
 * One screen with two faces rather than two screens: a teacher and a student
 * are looking at the same room, and almost everything on it — the code, the
 * people, the work, the leaderboard — is the same for both. What differs is
 * who may act, and that is decided by the database rather than here. Hiding a
 * button a policy would refuse is courtesy, not security.
 */
export function Classroom({ signedIn, current, onOpen }: ClassroomProps) {
  const { d, t } = useTranslation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [work, setWork] = useState<Assignment[]>([]);
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [roomName, setRoomName] = useState('');
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState(false);
  const [copied, setCopied] = useState(false);

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState(10);
  const [cases, setCases] = useState<Case[]>([{ answers: [], expect: [] }]);

  const [grading, setGrading] = useState(false);
  const [gradedCount, setGradedCount] = useState<number | null>(null);

  const active = rooms.find((room) => room.id === activeId) ?? null;

  const loadRooms = useCallback(async () => {
    const list = await myClassrooms();
    setRooms(list);
    setActiveId((current) => current ?? list[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }
    void loadRooms();
  }, [signedIn, loadRooms]);

  const loadRoom = useCallback(async (id: string) => {
    const [people, assignments, board] = await Promise.all([
      membersOf(id),
      assignmentsOf(id),
      rankingOf(id),
    ]);
    setMembers(people);
    setWork(assignments);
    setRanking(board);
  }, []);

  useEffect(() => {
    if (activeId) void loadRoom(activeId);
  }, [activeId, loadRoom]);

  const create = async (): Promise<void> => {
    if (!roomName.trim()) return;
    const room = await createClassroom(roomName.trim());
    setRoomName('');
    if (room) {
      await loadRooms();
      setActiveId(room.id);
    }
  };

  const join = async (): Promise<void> => {
    setJoinError(false);
    try {
      const id = await joinClassroom(code.trim());
      setCode('');
      await loadRooms();
      if (id) setActiveId(id);
    } catch {
      /* The database answers the same way for a code that does not exist and
         one that does but is not yours, so there is only one thing to say. */
      setJoinError(true);
    }
  };

  const saveAssignment = async (): Promise<void> => {
    if (!activeId || !title.trim()) return;
    await createAssignment(activeId, {
      title: title.trim(),
      points,
      algorithm: current,
      cases: cases.filter((one) => one.expect.length > 0),
    });
    setComposing(false);
    setTitle('');
    setCases([{ answers: [], expect: [] }]);
    await loadRoom(activeId);
  };

  /**
   * Marking, which happens here, in the teacher's own browser.
   *
   * There is no server to run a student's program on, and the browser key is
   * public — so a mark computed on the student's machine would be a claim
   * rather than a fact. Running it here makes the teacher's session the thing
   * that decides, which is also the only session the policies let write a
   * score.
   */
  const gradeAll = async (): Promise<void> => {
    if (!activeId) return;
    setGrading(true);
    setGradedCount(null);
    let marked = 0;

    try {
      for (const assignment of work) {
        if (assignment.cases.length === 0) continue;
        const handed = await submissionsOf(assignment.id);

        for (const submission of handed) {
          const mark =
            submission.kind === 'code'
              ? await gradeCode(submission.source ?? '', assignment.cases, assignment.points)
              : gradeBlocks(submission.body, assignment.cases, assignment.points);
          await recordMark(submission.id, mark);
          marked += 1;
        }
      }
      setGradedCount(marked);
      await loadRoom(activeId);
    } finally {
      setGrading(false);
    }
  };

  const copyCode = async (): Promise<void> => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.joinCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Denied permission or an insecure origin; the code is on screen anyway.
    }
  };

  if (!signedIn) {
    return <p className="classroom__notice">{d.classroom.needsAccount}</p>;
  }

  if (loading) return null;

  if (rooms.length === 0) {
    return (
      <div className="classroom__start">
        <section className="classroom__panel">
          <h2>{d.classroom.createTitle}</h2>
          <p>{d.classroom.createHint}</p>
          <div className="classroom__row">
            <input
              type="text"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder={d.classroom.namePlaceholder}
            />
            <button type="button" onClick={() => void create()} disabled={!roomName.trim()}>
              {d.classroom.createAction}
            </button>
          </div>
        </section>

        <section className="classroom__panel">
          <h2>{d.classroom.joinTitle}</h2>
          <p>{d.classroom.joinHint}</p>
          <div className="classroom__row">
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder={d.classroom.codePlaceholder}
              maxLength={8}
              className="classroom__code-input"
            />
            <button type="button" onClick={() => void join()} disabled={!code.trim()}>
              {d.classroom.joinAction}
            </button>
          </div>
          {joinError && <p className="classroom__error">{d.classroom.joinFailed}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="classroom">
      <header className="classroom__head">
        {rooms.length > 1 && (
          <select
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
        )}
        {rooms.length === 1 && <h2>{active?.name}</h2>}

        {active && (
          <div className="classroom__code">
            <span className="classroom__code-label">{d.classroom.code}</span>
            <code>{active.joinCode}</code>
            <button type="button" onClick={() => void copyCode()} title={d.classroom.copyCode}>
              <CopyMark weight="bold" />
              {copied && <span>{d.classroom.copied}</span>}
            </button>
          </div>
        )}

        <span className="classroom__role">
          {active?.mine ? d.classroom.teacherOf : d.classroom.memberOf}
        </span>
      </header>

      <div className="classroom__body">
        <section className="classroom__panel">
          <div className="classroom__panel-head">
            <h3>{d.classroom.assignments}</h3>
            {active?.mine && !composing && (
              <button type="button" className="classroom__add" onClick={() => setComposing(true)}>
                <Plus weight="bold" /> {d.classroom.newAssignment}
              </button>
            )}
          </div>

          {composing && (
            <div className="classroom__compose">
              <label>
                <span>{d.classroom.assignmentTitle}</span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label>
                <span>{d.classroom.points}</span>
                <input
                  type="number"
                  min={0}
                  value={points}
                  onChange={(event) => setPoints(Number(event.target.value))}
                />
              </label>
              <p className="classroom__hint">{d.classroom.fromAlgorithm}</p>

              <h4>{d.classroom.cases}</h4>
              <p className="classroom__hint">{d.classroom.casesHint}</p>
              {cases.map((one, index) => (
                <div className="classroom__case" key={index}>
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
                  {cases.length > 1 && (
                    <button
                      type="button"
                      className="classroom__quiet"
                      onClick={() => setCases((all) => all.filter((_, at) => at !== index))}
                    >
                      {d.classroom.removeCase}
                    </button>
                  )}
                </div>
              ))}

              <div className="classroom__row">
                <button
                  type="button"
                  className="classroom__quiet"
                  onClick={() => setCases((all) => [...all, { answers: [], expect: [] }])}
                >
                  {d.classroom.addCase}
                </button>
                <button type="button" onClick={() => void saveAssignment()} disabled={!title.trim()}>
                  {d.classroom.save}
                </button>
                <button
                  type="button"
                  className="classroom__quiet"
                  onClick={() => setComposing(false)}
                >
                  {d.classroom.cancel}
                </button>
              </div>
            </div>
          )}

          {work.length === 0 && !composing ? (
            <p className="classroom__empty">{d.classroom.noAssignments}</p>
          ) : (
            <ul className="classroom__list">
              {work.map((assignment) => (
                <li key={assignment.id}>
                  <div>
                    <strong>{assignment.title}</strong>
                    <span className="classroom__meta">
                      {assignment.points} · {assignment.cases.length} {d.classroom.cases}
                    </span>
                  </div>
                  <div className="classroom__actions">
                    <button
                      type="button"
                      className="classroom__quiet"
                      onClick={() => onOpen(asAlgorithm(assignment), assignment.id)}
                    >
                      {d.classroom.open}
                    </button>
                    {active?.mine && (
                      <button
                        type="button"
                        className="classroom__quiet"
                        title={d.classroom.deleteAssignment}
                        aria-label={d.classroom.deleteAssignment}
                        onClick={() => {
                          void (async () => {
                            await removeAssignment(assignment.id);
                            if (activeId) await loadRoom(activeId);
                          })();
                        }}
                      >
                        <Trash />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {active?.mine && work.length > 0 && (
            <div className="classroom__row">
              <button type="button" onClick={() => void gradeAll()} disabled={grading}>
                <Marked weight="bold" /> {grading ? d.classroom.grading : d.classroom.grade}
              </button>
              {gradedCount !== null && (
                <span className="classroom__meta">
                  {gradedCount === 0
                    ? d.classroom.nothingToGrade
                    : t('classroom.gradedCount', { count: gradedCount })}
                </span>
              )}
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
                  <th>{d.classroom.rankPosition}</th>
                  <th>{d.classroom.rankStudent}</th>
                  <th>{d.classroom.rankPoints}</th>
                  <th>{d.classroom.rankHandedIn}</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="classroom__people">
            <People weight="bold" /> {d.classroom.members}
          </h3>
          {members.length === 0 ? (
            <p className="classroom__empty">{d.classroom.noMembers}</p>
          ) : (
            <ul className="classroom__members">
              {members.map((member) => (
                <li key={member.userId}>{member.name || d.classroom.unnamed}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
