import {
  CheckCircleIcon as Marked,
  PlusIcon as Plus,
  TrashIcon as Trash,
  XCircleIcon as Failed,
} from '@phosphor-icons/react';

import type { AuthorDraft, DraftCase } from '../core/activity';
import { blankCase } from '../core/activity';
import type { Case, CaseResult, WorldExpectation } from '../core/classroom/grade';
import type { WorldDefinition } from '../core/world/types';
import { idFromLabel, templateNames, TEMPLATES, templateWorld } from '../content/worlds';
import type { TemplateId } from '../content/worlds';
import { usePlural, useTranslation } from '../i18n/context';
import './Brief.css';

/** Running the cases against what is on screen, and what came of it. */
export interface CaseCheck {
  cases: Case[];
  results: CaseResult[] | null;
  busy: boolean;
  onRun: () => void;
}

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
  | {
      mode: 'read';
      title: string;
      instructions: string;
      points?: number;
      world?: WorldDefinition;
      /** For practice that checks itself: a built-in challenge's own cases. */
      check?: CaseCheck;
    }
  | {
      mode: 'review';
      title: string;
      instructions: string;
      points: number;
      student: string;
      world?: WorldDefinition;
      check: CaseCheck;
      score: number | null;
      fault: string | null;
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
      world: WorldDefinition | undefined;
      onWorld: (world: WorldDefinition | undefined) => void;
    };

/*
 * Leaving and publishing are in the header, not here. The rail can be closed,
 * and a mode whose only way out is inside a closed panel is a trap.
 */

/** "motor encendido", "arranque activo": a moment's state, said plainly. */
function useMomentText(world: WorldDefinition | undefined) {
  const { d } = useTranslation();
  return (moment: WorldExpectation): string => {
    const role = world?.components.find((one) => one.id === moment.id)?.role ?? 'output';
    const state =
      role === 'input'
        ? moment.value
          ? d.scene.active
          : d.scene.inactive
        : moment.value
          ? d.scene.on
          : d.scene.off;
    return `${moment.at} s · ${moment.id}: ${state}`;
  };
}

/** The cases, and how each went: shared by reviewing and by checking oneself. */
function CaseList({ check, world }: { check: CaseCheck; world?: WorldDefinition }) {
  const { d, fill } = useTranslation();
  const momentText = useMomentText(world);
  const passed = check.results?.filter((result) => result.passed).length ?? 0;

  if (check.cases.length === 0) return <p className="brief__hint">{d.classroom.noCases}</p>;

  return (
    <>
      <ol className="brief__cases" aria-live="polite">
        {check.cases.map((one, index) => {
          const result = check.results?.[index];
          const missed = new Set(result?.misses?.map((miss) => `${miss.at}|${miss.id}`));
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
                {(one.timeline?.length ?? 0) > 0 && (
                  <>
                    <dt>{d.brief.happens}</dt>
                    <dd>
                      {one.timeline?.map((moment, at) => (
                        <code key={at} className="brief__moment">
                          {momentText(moment)}
                        </code>
                      ))}
                    </dd>
                  </>
                )}
                {(one.expect.length > 0 || !one.expectWorld?.length) && (
                  <>
                    <dt>{d.classroom.expected}</dt>
                    <dd>
                      <code>{one.expect.join(' / ') || '—'}</code>
                    </dd>
                  </>
                )}
                {(one.expectWorld?.length ?? 0) > 0 && (
                  <>
                    <dt>{d.brief.mustBe}</dt>
                    <dd>
                      {one.expectWorld?.map((moment, at) => (
                        <code
                          key={at}
                          className="brief__moment"
                          data-missed={missed.has(`${moment.at}|${moment.id}`) || undefined}
                        >
                          {momentText(moment)}
                        </code>
                      ))}
                    </dd>
                  </>
                )}
                {result && !result.passed && (one.expect.length > 0 || !one.expectWorld?.length) && (
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
      {check.results && (
        <p className="brief__hint">
          {fill(d.classroom.casesPassed, { passed, total: check.cases.length })}
        </p>
      )}
    </>
  );
}

/** The scenario an assignment is played in: a template, and its parts renamed. */
function WorldPicker({
  world,
  onWorld,
}: {
  world: WorldDefinition | undefined;
  onWorld: (world: WorldDefinition | undefined) => void;
}) {
  const { d, language } = useTranslation();
  return (
    <div className="brief__world">
      <label className="brief__field">
        <span>{d.brief.scenario}</span>
        <select
          value={world ? world.template : ''}
          onChange={(event) =>
            onWorld(
              event.target.value
                ? templateWorld(event.target.value as TemplateId, language)
                : undefined,
            )
          }
        >
          <option value="">{d.brief.noScenario}</option>
          {TEMPLATES.map((id) => (
            <option key={id} value={id}>
              {templateNames[id][language]}
            </option>
          ))}
        </select>
      </label>

      {world && (
        <>
          <p className="brief__hint">{d.brief.scenarioHint}</p>
          <div className="brief__parts">
            {world.components.map((part, index) => (
              <label key={index} className="brief__part">
                <span data-role={part.role}>
                  {part.role === 'input' ? d.scene.inputs : d.scene.outputs}
                </span>
                <input
                  type="text"
                  value={part.label}
                  onChange={(event) => {
                    const label = event.target.value;
                    const id = idFromLabel(label) || part.id;
                    onWorld({
                      ...world,
                      components: world.components.map((other, at) =>
                        at === index ? { ...other, label, id } : other,
                      ),
                    });
                  }}
                />
                <code>"{part.id}"</code>
              </label>
            ))}
          </div>
          <label className="brief__field brief__field--short">
            <span>{d.brief.duration}</span>
            <input
              type="number"
              min={1}
              max={600}
              value={world.duration}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next) && next > 0) onWorld({ ...world, duration: Math.min(next, 600) });
              }}
            />
          </label>
        </>
      )}
    </div>
  );
}

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
        {props.check && props.check.cases.length > 0 && (
          <>
            <div className="brief__mark">
              <button
                type="button"
                className="brief__primary"
                onClick={props.check.onRun}
                disabled={props.check.busy}
              >
                <Marked weight="bold" aria-hidden="true" />
                {props.check.busy ? d.brief.checking : d.brief.check}
              </button>
              {props.check.results && (
                <span className="brief__score">
                  {props.check.results.every((result) => result.passed)
                    ? d.brief.allPassed
                    : d.brief.notYet}
                </span>
              )}
            </div>
            <CaseList check={props.check} world={props.world} />
          </>
        )}
      </section>
    );
  }

  if (props.mode === 'review') {
    return (
      <section className="brief" aria-label={d.brief.label}>
        <p className="brief__eyebrow">{fill(d.brief.reviewing, { student: props.student })}</p>
        <h2 className="brief__title">{props.title}</h2>
        {props.instructions && <p className="brief__text">{props.instructions}</p>}

        <div className="brief__mark">
          <button
            type="button"
            className="brief__primary"
            onClick={props.check.onRun}
            disabled={props.check.busy || props.check.cases.length === 0}
          >
            <Marked weight="bold" aria-hidden="true" />
            {props.check.busy ? d.classroom.grading : d.brief.markThis}
          </button>
          {props.score !== null && (
            <span className="brief__score">
              {fill(d.classroom.yourScore, { score: props.score, points: props.points })}
            </span>
          )}
        </div>

        <CaseList check={props.check} world={props.world} />
        {props.fault && (
          <p className="brief__fault" role="alert">
            {props.fault}
          </p>
        )}
      </section>
    );
  }

  const { draft, onChange, world } = props;
  const set = (patch: Partial<AuthorDraft>): void => onChange({ ...draft, ...patch });
  const setCase = (key: string, patch: Partial<DraftCase>): void =>
    set({ cases: draft.cases.map((one) => (one.key === key ? { ...one, ...patch } : one)) });
  const empty = (one: DraftCase): boolean =>
    one.expect.trim() === '' && (!world || one.expectWorld.trim() === '');
  const blank = draft.cases.filter(empty).length;

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

      <WorldPicker world={world} onWorld={props.onWorld} />

      <h3 className="brief__subhead">{d.classroom.cases}</h3>
      <p className="brief__hint">{world ? d.brief.casesWorldHint : d.classroom.casesHint}</p>
      {draft.cases.map((one, index) => (
        <div className="brief__case" key={one.key}>
          <span className="brief__case-n">{index + 1}</span>
          <div className="brief__case-fields">
            <label className="brief__field">
              <span>{d.classroom.caseAnswers}</span>
              <textarea
                rows={2}
                value={one.answers}
                onChange={(event) => setCase(one.key, { answers: event.target.value })}
              />
            </label>
            <label className="brief__field">
              <span>{d.classroom.caseExpect}</span>
              <textarea
                rows={2}
                value={one.expect}
                onChange={(event) => setCase(one.key, { expect: event.target.value })}
              />
            </label>
            {world && (
              <>
                <label className="brief__field">
                  <span>{d.brief.happens}</span>
                  <textarea
                    rows={2}
                    value={one.timeline}
                    placeholder={d.brief.happensExample}
                    onChange={(event) => setCase(one.key, { timeline: event.target.value })}
                  />
                </label>
                <label className="brief__field">
                  <span>{d.brief.mustBe}</span>
                  <textarea
                    rows={2}
                    value={one.expectWorld}
                    placeholder={d.brief.mustBeExample}
                    onChange={(event) => setCase(one.key, { expectWorld: event.target.value })}
                  />
                </label>
              </>
            )}
          </div>
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

      {/* Said before publishing rather than discovered after: a case with
          nothing to check is dropped, and an assignment with none cannot be
          marked by machine at all. */}
      {blank > 0 && (
        <p className="brief__hint">
          {blank === draft.cases.length ? d.classroom.noCases : d.brief.someEmpty}
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
