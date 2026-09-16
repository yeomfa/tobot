import { QuestionIcon as Question, WarningIcon as Warning, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react';

import { findStatement } from '../core/ast/operations';
import type { NodeId, Statement } from '../core/ast/types';
import type { Problem } from '../core/ast/validate';
import { conceptForStatement } from '../content/concepts';
import { useTranslation } from '../i18n/context';
import { statementCategory, statementIcon } from './statementMeta';
import './Inspector.css';

interface InspectorProps {
  body: Statement[];
  /** Ids currently selected, in document order. */
  selected: NodeId[];
  problems: Map<NodeId, Problem[]>;
  onExplain: (conceptId: string) => void;
}

/**
 * What is selected, above the robot.
 *
 * Two things the app already knew but kept out of reach: a block's problems,
 * which showed only as a badge you had to hover to read, and its concept,
 * which lived one right-click away under "saber más". Selecting is how a
 * student says "this one" — so that is when to answer.
 *
 * Above the robot rather than instead of it. The robot is what runs the
 * program, and taking it away while inspecting would break the loop the
 * editor is built around: look, run, look again.
 *
 * With several blocks it summarises rather than edits. Editing a set at once
 * is where inspectors turn dangerous — one gesture changing five blocks, with
 * nothing on screen showing what it touched — and counting them honestly is
 * more use to someone learning than a row of shared fields.
 */
export function Inspector({ body, selected, problems, onExplain }: InspectorProps) {
  const { d, t, fill } = useTranslation();

  if (selected.length === 0) return null;

  const statements = selected
    .map((id) => findStatement(body, id))
    .filter((statement): statement is Statement => statement !== null);

  if (statements.length === 0) return null;

  /* Problems of everything selected, so a summary can say how many need
     attention without the student opening each block to find out. */
  const ownProblems = statements.flatMap((statement) => problems.get(statement.id) ?? []);

  if (statements.length > 1) {
    /* Counted by kind, in the order they first appear, so the summary reads
       like the selection looks rather than like a sorted tally. */
    const counts = new Map<Statement['kind'], number>();
    for (const statement of statements) {
      counts.set(statement.kind, (counts.get(statement.kind) ?? 0) + 1);
    }

    return (
      <section className="inspector" aria-label={d.inspector.title}>
        <h2 className="inspector__title">
          {fill(d.actions.selectedCount, { count: statements.length })}
        </h2>

        <ul className="inspector__kinds">
          {[...counts].map(([kind, count]) => {
            const Icon = statementIcon[kind];
            return (
              <li className="inspector__kind" key={kind} data-category={statementCategory[kind]}>
                <Icon weight="duotone" aria-hidden="true" />
                <span className="inspector__kind-label">{d.statements[kind].label}</span>
                <span className="inspector__kind-count">{count}</span>
              </li>
            );
          })}
        </ul>

        {ownProblems.length > 0 && (
          <p className="inspector__note" data-severity="warning">
            <Warning weight="fill" aria-hidden="true" />
            {fill(d.inspector.problemCount, { count: ownProblems.length })}
          </p>
        )}
      </section>
    );
  }

  const statement = statements[0];
  const Icon = statementIcon[statement.kind];
  const concept = conceptForStatement.get(statement.kind);

  return (
    <section className="inspector" aria-label={d.inspector.title}>
      <h2 className="inspector__title" data-category={statementCategory[statement.kind]}>
        <Icon weight="duotone" aria-hidden="true" />
        {d.statements[statement.kind].label}
      </h2>
      <p className="inspector__hint">{d.statements[statement.kind].hint}</p>

      {/* The badge on the block says only that something is wrong; here there
          is room to say what, without hovering to find out. */}
      {(problems.get(statement.id) ?? []).map((problem, index) => (
        <p className="inspector__note" key={index} data-severity={problem.severity}>
          {problem.severity === 'error' ? (
            <WarningCircle weight="fill" aria-hidden="true" />
          ) : (
            <Warning weight="fill" aria-hidden="true" />
          )}
          {t(`problems.${problem.messageKey}`, problem.vars)}
        </p>
      ))}

      {concept && (
        <button
          type="button"
          className="inspector__learn"
          onClick={() => onExplain(concept.id)}
        >
          <Question weight="bold" aria-hidden="true" />
          {d.actions.learnMore}
        </button>
      )}
    </section>
  );
}
