import {
  CheckCircleIcon as Marked,
  PlusIcon as Plus,
  TrashIcon as Trash,
  XCircleIcon as Failed,
} from '@phosphor-icons/react';

import type { AuthorDraft } from '../core/activity';
import { blankCase } from '../core/activity';
import type { Case, CaseResult } from '../core/classroom/grade';
import { usePlural, useTranslation } from '../i18n/context';
import './Brief.css';

/**
 * What the panel is showing, and to whom.
 *
 * Four uses of one component rather than four components: the author writes
 * the brief, the student reads it, the teacher reviews against it, and a
 * built-in challenge shows its goal through it. The model behind all four is
 * the same activity, which is the point — the engine that authors an
 * assignment today is the one that will author a challenge later.
 */
export type BriefProps =
  | { mode: 'read'; title: string; instructions: string; points?: number }
  | {
      mode: 'review';
      title: string;
      instructions: string;
      points: number;
      student: string;
      cases: Case[];
      results: CaseResult[] | null;
      score: number | null;
      marking: boolean;
      fault: string | null;
      onMark: () => void;
    }
  | {
      mode: 'author';
      draft: AuthorDraft;
      editing: boolean;
      fault: string | null;
      onChange: (next: AuthorDraft) => void;
      /** Which kind of program the starter is, while it can still change. */
      kind: 'blocks' | 'code';
      /** Null once the starter has content: switching would throw it away. */
      onKind: ((kind: 'blocks' | 'code') => void) | null;
    };

/*
 * Leaving and publishing are in the header, not here. The rail can be closed,
 * and a mode whose only way out is inside a closed panel is a trap.
 */

/** One line per answer, which is how the textareas read and write them. */
const lines = (text: string): string[] => text.split('\n').filter((line) => line.trim() !== '');

export function Brief(props: BriefProps) {
  const { d, fill } = useTranslation();
  const plural = usePlural();

  if (props.mode === 'read') {
    return (
      <section className="brief" aria-label={d.brief.label}>
        <h2 className="brief__title">{props.title}</h2>
        {props.points !== undefined && (
          <span className="brief__points">
            {plural(props.points, d.classroom.pointsWorthOne, d.classroom.pointsWorth)}
          </span>
        )}
        {props.instructions ? (
          <p className="brief__text">{props.instructions}</p>
        ) : (
          <p className="brief__hint">{d.brief.noInstructions}</p>
        )}
      </section>
    );
  }

  if (props.mode === 'review') {
    const passed = props.results?.filter((result) => result.passed).length ?? 0;
    return (
      <section className="brief" aria-label={d.brief.label}>
        <p className="brief__eyebrow">{fill(d.brief.reviewing, { student: props.student })}</p>
        <h2 className="brief__title">{props.title}</h2>
        {props.instructions && <p className="brief__text">{props.instructions}</p>}

        <div className="brief__mark">
          <button
            type="button"
            className="brief__primary"
            onClick={props.onMark}
            disabled={props.marking || props.cases.length === 0}
          >
            <Marked weight="bold" aria-hidden="true" />
            {props.marking ? d.classroom.grading : d.brief.markThis}
          </button>
          {props.score !== null && (
            <span className="brief__score">
              {fill(d.classroom.yourScore, { score: props.score, points: props.points })}
            </span>
          )}
        </div>

        {props.cases.length === 0 ? (
          <p className="brief__hint">{d.classroom.noCases}</p>
        ) : (
          <ol className="brief__cases" aria-live="polite">
            {props.cases.map((one, index) => {
              const result = props.results?.[index];
              return (
                <li key={index} data-state={!result ? 'idle' : result.passed ? 'pass' : 'fail'}>
                  <div className="brief__case-head">
                    {result &&
                      (result.passed ? (
                        <Marked weight="fill" aria-hidden="true" />
                      ) : (
                        <Failed weight="fill" aria-hidden="true" />
                      ))}
                    <strong>{fill(d.classroom.caseLabel, { n: index + 1 })}</strong>
                    {one.answers.length > 0 && (
                      <span className="brief__muted">
                        {fill(d.classroom.withAnswers, { answers: one.answers.join(', ') })}
                      </span>
                    )}
                  </div>
                  <dl className="brief__io">
                    <dt>{d.classroom.expected}</dt>
                    <dd>
                      <code>{one.expect.join(' / ')}</code>
                    </dd>
                    {result && !result.passed && (
                      <>
                        <dt>{d.classroom.got}</dt>
                        <dd>
                          <code>{result.got.join(' / ') || '—'}</code>
                        </dd>
                      </>
                    )}
                  </dl>
                </li>
              );
            })}
          </ol>
        )}
        {props.results && (
          <p className="brief__hint">
            {fill(d.classroom.casesPassed, { passed, total: props.cases.length })}
          </p>
        )}
        {props.fault && (
          <p className="brief__fault" role="alert">
            {props.fault}
          </p>
        )}
      </section>
    );
  }

  const { draft, onChange } = props;
  const set = (patch: Partial<AuthorDraft>): void => onChange({ ...draft, ...patch });
  const setCase = (key: string, patch: Partial<Case>): void =>
    set({ cases: draft.cases.map((one) => (one.key === key ? { ...one, ...patch } : one)) });
  const filled = draft.cases.filter((one) => one.expect.length > 0).length;

  return (
    <section className="brief brief--author" aria-label={d.brief.label}>
      <p className="brief__eyebrow">{props.editing ? d.brief.editing : d.brief.authoring}</p>

      <label className="brief__field">
        <span>{d.classroom.assignmentTitle}</span>
        <input type="text" value={draft.title} onChange={(event) => set({ title: event.target.value })} />
      </label>

      <label className="brief__field">
        <span>{d.brief.instructions}</span>
        <textarea
          rows={4}
          value={draft.instructions}
          placeholder={d.brief.instructionsHint}
          onChange={(event) => set({ instructions: event.target.value })}
        />
      </label>

      <label className="brief__field brief__field--short">
        <span>{d.classroom.points}</span>
        <input
          type="number"
          min={0}
          value={draft.points}
          onChange={(event) => {
            /* An emptied field is `NaN`, which the column refuses, and a typed
               `-5` passes the `min` hint. Both used to reach the database. */
            const next = Number(event.target.value);
            set({ points: Number.isFinite(next) && next >= 0 ? next : 0 });
          }}
        />
      </label>

      <div className="brief__field">
        <span>{d.brief.starter}</span>
        <div className="brief__kinds" role="group" aria-label={d.brief.starter}>
          {(['blocks', 'code'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={props.kind === kind}
              data-active={props.kind === kind || undefined}
              disabled={props.kind !== kind && !props.onKind}
              onClick={() => props.kind !== kind && props.onKind?.(kind)}
            >
              {kind === 'blocks' ? d.brief.kindBlocks : d.brief.kindCode}
            </button>
          ))}
        </div>
      </div>
      <p className="brief__hint">{props.onKind ? d.brief.programHint : d.brief.kindLocked}</p>

      <h3 className="brief__subhead">{d.classroom.cases}</h3>
      <p className="brief__hint">{d.classroom.casesHint}</p>
      {draft.cases.map((one, index) => (
        <div className="brief__case" key={one.key}>
          <span className="brief__case-n">{index + 1}</span>
          <label className="brief__field">
            <span>{d.classroom.caseAnswers}</span>
            <textarea
              rows={2}
              value={one.answers.join('\n')}
              onChange={(event) => setCase(one.key, { answers: lines(event.target.value) })}
            />
          </label>
          <label className="brief__field">
            <span>{d.classroom.caseExpect}</span>
            <textarea
              rows={2}
              value={one.expect.join('\n')}
              onChange={(event) => setCase(one.key, { expect: lines(event.target.value) })}
            />
          </label>
          <button
            type="button"
            className="brief__icon"
            disabled={draft.cases.length === 1}
            title={d.classroom.removeCase}
            aria-label={d.classroom.removeCase}
            onClick={() => set({ cases: draft.cases.filter((other) => other.key !== one.key) })}
          >
            <Trash weight="bold" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="brief__quiet"
        onClick={() => set({ cases: [...draft.cases, blankCase()] })}
      >
        <Plus weight="bold" aria-hidden="true" /> {d.classroom.addCase}
      </button>

      {/* Said before publishing rather than discovered after: a case with no
          expected output is dropped, and an assignment with none cannot be
          marked by machine at all. */}
      {filled < draft.cases.length && (
        <p className="brief__hint">
          {filled === 0 ? d.classroom.noCases : d.brief.someEmpty}
        </p>
      )}

      {props.fault && (
        <p className="brief__fault" role="alert">
          {props.fault}
        </p>
      )}
    </section>
  );
}
