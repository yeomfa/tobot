import {
  DotsSixVerticalIcon as DotsSixVertical,
  QuestionIcon as Question,
  TrashIcon as Trash,
  WarningIcon as Warning,
  WarningCircleIcon as WarningCircle,
} from '@phosphor-icons/react';
import { memo } from 'react';

import { castExpression, createStatement } from '../core/ast/factory';
import type { Location } from '../core/ast/operations';
import type { LiteralKind, NodeId, Statement } from '../core/ast/types';
import type { Problem } from '../core/ast/validate';
import { conceptForStatement } from '../content/concepts';
import { useTranslation } from '../i18n/context';
import { ExpressionEditor } from './ExpressionEditor';
import { Picker } from './Picker';
import { PLACEHOLDER_NAME } from '../core/ast/factory';
import { VariablePicker } from './VariablePicker';
import { statementCategory, statementIcon, typeIcon } from './statementMeta';
import './StatementBlock.css';

export interface BlockCallbacks {
  update: (id: NodeId, update: (statement: Statement) => Statement) => void;
  remove: (id: NodeId) => void;
  add: (statement: Statement, location: Location) => void;
  move: (id: NodeId, destination: Location) => void;
  onExplain: (conceptId: string) => void;
}

interface StatementBlockProps {
  statement: Statement;
  variables: string[];
  /** Static-check results, keyed by statement id. */
  problems: Map<NodeId, Problem[]>;
  callbacks: BlockCallbacks;
  /** Highlighted while the interpreter is on this statement. */
  isActive: boolean;
  /** Statement the runtime error points at. */
  isErrored: boolean;
  activeNodeId: NodeId | null;
  erroredNodeId: NodeId | null;
  depth: number;
}

/** Renders a valid identifier from student input, or keeps the old one. */
function sanitizeName(raw: string, fallback: string): string {
  const trimmed = raw.trim().replace(/\s+/g, '_');
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed) ? trimmed : fallback;
}

export const StatementBlock = memo(function StatementBlock({
  statement,
  variables,
  problems,
  callbacks,
  isActive,
  isErrored,
  activeNodeId,
  erroredNodeId,
  depth,
}: StatementBlockProps) {
  const { d, t } = useTranslation();
  const category = statementCategory[statement.kind];
  const concept = conceptForStatement.get(statement.kind);

  const Icon = statementIcon[statement.kind];
  const ownProblems = problems.get(statement.id) ?? [];
  // One badge per block: an error outranks a warning.
  const worst = ownProblems.some((problem) => problem.severity === 'error')
    ? 'error'
    : ownProblems.length > 0
      ? 'warning'
      : null;

  const setName = (name: string): void => {
    callbacks.update(statement.id, (current) =>
      current.kind === 'declare' || current.kind === 'assign'
        ? { ...current, name }
        : current.kind === 'ask'
          ? { ...current, target: name }
          : current.kind === 'forEach'
            ? { ...current, variable: name }
            : current,
    );
  };

  const currentName =
    statement.kind === 'declare' || statement.kind === 'assign'
      ? statement.name
      : statement.kind === 'ask'
        ? statement.target
        : statement.kind === 'forEach'
          ? statement.variable
          : '';

  return (
    <li
      className="statement-block"
      /* Lets the other views scroll this block into view when clicked. */
      data-node-id={statement.id}
      data-category={category}
      /* Distinguishes statements inside a family: `decir` and `preguntar` are
         both io, and opposite operations, so they should not look identical. */
      data-kind={statement.kind}
      data-active={isActive || undefined}
      data-errored={isErrored || undefined}
      data-problem={worst ?? undefined}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/tobot-move', statement.id);
        event.dataTransfer.effectAllowed = 'move';
        event.stopPropagation();
        // Tells the canvas a drag is running, and marks this block as the one
        // in flight so it can fade where it used to be.
        document.body.setAttribute('data-dragging', 'true');
        event.currentTarget.setAttribute('data-lifted', 'true');
      }}
      onDragEnd={(event) => {
        event.currentTarget.removeAttribute('data-lifted');
        document.body.removeAttribute('data-dragging');
      }}
    >
      <div className="statement-block__row">
        <span className="statement-block__handle" aria-label={d.a11y.dragHandle}>
          {/* The grip only shows on hover; at rest the kind icon identifies
              the statement, which is what a reader needs. */}
          <DotsSixVertical className="statement-block__grip" weight="bold" aria-hidden="true" />
          <span className="statement-block__icon" aria-hidden="true">
            <Icon weight="duotone" />
          </span>
        </span>

        <div className="statement-block__content">
          <StatementBody
            statement={statement}
            variables={variables}
            callbacks={callbacks}
            currentName={currentName}
            setName={setName}
          />
        </div>

        <div className="statement-block__actions">
          {worst && (
            <span
              className="statement-block__badge"
              data-severity={worst}
              role="status"
              /* Focusable so the explanation is reachable by keyboard too. */
              tabIndex={0}
            >
              {worst === 'error' ? <WarningCircle weight="fill" /> : <Warning weight="fill" />}
              {/*
                A popover of our own rather than the browser's `title`, which
                takes a second to appear, is styled by the operating system and
                cannot show more than plain text. This one carries the severity
                colour and lists every problem on the statement.
              */}
              <span className="statement-block__problems" data-severity={worst}>
                {ownProblems.map((problem, index) => (
                  <span
                    className="statement-block__problem"
                    data-severity={problem.severity}
                    key={index}
                  >
                    {problem.severity === 'error' ? (
                      <WarningCircle weight="fill" />
                    ) : (
                      <Warning weight="fill" />
                    )}
                    {t(`problems.${problem.messageKey}`, problem.vars)}
                  </span>
                ))}
              </span>
            </span>
          )}
          {concept && (
            <button
              type="button"
              className="statement-block__action"
              onClick={() => callbacks.onExplain(concept.id)}
              title={d.actions.learnMore}
              aria-label={d.actions.learnMore}
            >
              <Question />
            </button>
          )}
          <button
            type="button"
            className="statement-block__action statement-block__action--danger"
            onClick={() => callbacks.remove(statement.id)}
            title={d.actions.delete}
            aria-label={d.actions.delete}
          >
            <Trash />
          </button>
        </div>
      </div>

      {/* Nested branches and loop bodies. */}
      {statement.kind === 'if' && (
        <div className="statement-block__branches">
          <Branch
            label={d.editor.then}
            statements={statement.then}
            parentId={statement.id}
            slot="then"
            variables={variables}
            problems={problems}
            callbacks={callbacks}
            activeNodeId={activeNodeId}
            erroredNodeId={erroredNodeId}
            depth={depth + 1}
          />
          {statement.otherwise ? (
            <Branch
              label={d.editor.otherwise}
              statements={statement.otherwise}
              parentId={statement.id}
              slot="otherwise"
              variables={variables}
              problems={problems}
              callbacks={callbacks}
              activeNodeId={activeNodeId}
              erroredNodeId={erroredNodeId}
              depth={depth + 1}
              onRemove={() =>
                callbacks.update(statement.id, (current) =>
                  current.kind === 'if' ? { ...current, otherwise: undefined } : current,
                )
              }
            />
          ) : (
            <button
              type="button"
              className="statement-block__add-else"
              onClick={() =>
                callbacks.update(statement.id, (current) =>
                  current.kind === 'if' ? { ...current, otherwise: [] } : current,
                )
              }
            >
              + {d.actions.addElse}
            </button>
          )}
        </div>
      )}

      {(statement.kind === 'while' ||
        statement.kind === 'repeat' ||
        statement.kind === 'forEach') && (
        <div className="statement-block__branches">
          <Branch
            label={d.editor.do}
            statements={statement.body}
            parentId={statement.id}
            slot="body"
            /* Inside a loop the counter is what a student reaches for, so it
               leads the dropdown instead of sorting wherever it was declared —
               usually last, under every other name in the program. */
            variables={
              statement.kind === 'forEach'
                ? [statement.variable, ...variables.filter((n) => n !== statement.variable)]
                : variables
            }
            problems={problems}
            callbacks={callbacks}
            activeNodeId={activeNodeId}
            erroredNodeId={erroredNodeId}
            depth={depth + 1}
          />
        </div>
      )}
    </li>
  );
});

interface StatementBodyProps {
  statement: Statement;
  variables: string[];
  callbacks: BlockCallbacks;
  currentName: string;
  setName: (name: string) => void;
}

/** The editable sentence for one statement. */
function StatementBody({
  statement,
  variables,
  callbacks,
  currentName,
  setName,
}: StatementBodyProps) {
  const { d } = useTranslation();

  const nameField = (
    <input
      className="statement-block__name"
      value={currentName}
      onChange={(event) => setName(event.target.value)}
      onBlur={(event) => setName(sanitizeName(event.target.value, currentName || 'x'))}
      aria-label={d.fields.name}
      style={{ width: `${Math.max(currentName.length, 3) + 2}ch` }}
      spellCheck={false}
    />
  );

  switch (statement.kind) {
    case 'comment':
      return (
        <textarea
          className="statement-block__comment"
          value={statement.text}
          rows={1}
          onChange={(event) => {
            // Grow to fit: an instruction sheet written as a comment can run
            // to several lines, and a scrollbar inside a block reads badly.
            const field = event.currentTarget;
            field.style.height = 'auto';
            field.style.height = `${field.scrollHeight}px`;
            const { value } = event.target;
            callbacks.update(statement.id, (current) =>
              current.kind === 'comment' ? { ...current, text: value } : current,
            );
          }}
          ref={(field) => {
            // Also size it on mount, for comments loaded from a file.
            if (field) {
              field.style.height = 'auto';
              field.style.height = `${field.scrollHeight}px`;
            }
          }}
          placeholder={d.statements.comment.hint}
          aria-label={d.statements.comment.label}
        />
      );

    case 'declare':
      return (
        <>
          <Keyword>{d.verbs.declare}</Keyword>
          {nameField}
          <Keyword muted>=</Keyword>
          <ExpressionEditor
            value={statement.value}
            onChange={(value) =>
              callbacks.update(statement.id, (current) =>
                current.kind === 'declare' ? { ...current, value } : current,
              )
            }
            variables={variables}
            expect={statement.valueKind}
          />
          <TypeSelect
            value={statement.valueKind}
            onChange={(valueKind) =>
              callbacks.update(statement.id, (current) =>
                // The value has to follow the type: leaving a text literal in
                // place after switching to number left the field editing the
                // old kind, so picking "number" appeared to do nothing.
                current.kind === 'declare'
                  ? { ...current, valueKind, value: castExpression(current.value, valueKind) }
                  : current,
              )
            }
          />
        </>
      );

    case 'assign':
      return (
        <>
          <Keyword>{d.verbs.assign}</Keyword>
          {/*
            Chosen, not typed. `assign` always targets a variable that already
            exists, so a free-text field could only ever get it right by the
            student spelling it exactly — and a typo did not raise an error, it
            quietly wrote to a name nothing had declared.

            `declare` keeps its text field, because that is where a name is
            invented rather than referred to.
          */}
          {variables.length > 0 ? (
            <VariablePicker
              value={currentName}
              variables={variables}
              onChange={setName}
              /* What `createStatement` fills in when a block is dropped. Until
                 the student picks something, the field shows empty rather than
                 naming a variable no algorithm has. */
              placeholder={PLACEHOLDER_NAME}
            />
          ) : (
            /*
              Nothing declared yet, so there is no list to choose from. The
              field shows empty rather than the placeholder: `cambiar x` when
              no `x` exists states something untrue, and the student would have
              to notice and delete it before typing.
            */
            <input
              className="statement-block__name"
              value={currentName === PLACEHOLDER_NAME ? '' : currentName}
              onChange={(event) => setName(event.target.value)}
              onBlur={(event) => setName(sanitizeName(event.target.value, currentName || 'x'))}
              aria-label={d.fields.name}
              placeholder="···"
              style={{ width: `${Math.max(currentName.length, 3) + 2}ch` }}
              spellCheck={false}
            />
          )}
          <Keyword muted>=</Keyword>
          <ExpressionEditor
            value={statement.value}
            onChange={(value) =>
              callbacks.update(statement.id, (current) =>
                current.kind === 'assign' ? { ...current, value } : current,
              )
            }
            variables={variables}
          />
        </>
      );

    case 'say':
      return (
        <>
          <Keyword>{d.verbs.say}</Keyword>
          <ExpressionEditor
            value={statement.value}
            onChange={(value) =>
              callbacks.update(statement.id, (current) =>
                current.kind === 'say' ? { ...current, value } : current,
              )
            }
            variables={variables}
            placeholder={d.fields.message}
          />
        </>
      );

    case 'ask':
      return (
        <>
          <Keyword>{d.verbs.ask}</Keyword>
          <ExpressionEditor
            value={statement.prompt}
            onChange={(prompt) =>
              callbacks.update(statement.id, (current) =>
                current.kind === 'ask' ? { ...current, prompt } : current,
              )
            }
            variables={variables}
            placeholder={d.fields.question}
          />
          <Keyword muted>{d.fields.saveIn}</Keyword>
          {nameField}
          <TypeSelect
            value={statement.expect}
            onChange={(expect) =>
              callbacks.update(statement.id, (current) =>
                current.kind === 'ask' ? { ...current, expect } : current,
              )
            }
          />
        </>
      );

    case 'if':
      return (
        <>
          <Keyword>{d.verbs.if}</Keyword>
          <ExpressionEditor
            value={statement.condition}
            onChange={(condition) =>
              callbacks.update(statement.id, (current) =>
                current.kind === 'if' ? { ...current, condition } : current,
              )
            }
            variables={variables}
            mode="condition"
          />
        </>
      );

    case 'while':
      return (
        <>
          <Keyword>{d.verbs.while}</Keyword>
          <ExpressionEditor
            value={statement.condition}
            onChange={(condition) =>
              callbacks.update(statement.id, (current) =>
                current.kind === 'while' ? { ...current, condition } : current,
              )
            }
            variables={variables}
            mode="condition"
          />
        </>
      );

    case 'repeat':
      return (
        <>
          <Keyword>{d.verbs.repeat}</Keyword>
          <ExpressionEditor
            value={statement.times}
            onChange={(times) =>
              callbacks.update(statement.id, (current) =>
                current.kind === 'repeat' ? { ...current, times } : current,
              )
            }
            variables={variables}
            expect="number"
          />
          <Keyword muted>{d.fields.times}</Keyword>
        </>
      );

    case 'forEach':
      return (
        <>
          <Keyword>{d.verbs.forEach}</Keyword>
          {nameField}
          <Keyword muted>=</Keyword>
          <ExpressionEditor
            value={statement.from}
            onChange={(from) =>
              callbacks.update(statement.id, (current) =>
                current.kind === 'forEach' ? { ...current, from } : current,
              )
            }
            variables={variables}
            expect="number"
          />
          <Keyword muted>{d.fields.to}</Keyword>
          <ExpressionEditor
            value={statement.to}
            onChange={(to) =>
              callbacks.update(statement.id, (current) =>
                current.kind === 'forEach' ? { ...current, to } : current,
              )
            }
            variables={variables}
            expect="number"
          />
          <Keyword muted>{d.fields.step}</Keyword>
          <ExpressionEditor
            value={statement.step}
            onChange={(step) =>
              callbacks.update(statement.id, (current) =>
                current.kind === 'forEach' ? { ...current, step } : current,
              )
            }
            variables={variables}
            expect="number"
          />
        </>
      );
  }
}

function Keyword({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className="statement-block__keyword" data-muted={muted || undefined}>
      {children}
    </span>
  );
}

/**
 * The data type as a labelled chip rather than a bare select.
 *
 * As plain grey words next to the value, "texto" and "número" read as
 * placeholder text — something unfilled. A chip with the type's own icon and
 * colour reads as a property of the variable, which is what it is.
 */
function TypeSelect({
  value,
  onChange,
}: {
  value: LiteralKind;
  onChange: (kind: LiteralKind) => void;
}) {
  const { d } = useTranslation();
  const Glyph = typeIcon[value];
  const label =
    value === 'number' ? d.kinds.number : value === 'text' ? d.kinds.text : d.kinds.boolean;

  // The chip used to be a styled span with an invisible native select laid over
  // it: it looked right until clicked, when the operating system drew its own
  // list and its own arrow. The Picker keeps the chip and owns the list too.
  return (
    <span className="statement-block__type" data-kind={value} title={`${d.fields.expect}: ${label}`}>
      <Glyph weight="bold" aria-hidden="true" />
      <Picker
        value={value}
        groups={[
          {
            options: (['number', 'text', 'boolean'] as LiteralKind[]).map((kind) => ({
              value: kind,
              label: d.kinds[kind],
              icon: typeIcon[kind],
            })),
          },
        ]}
        onChange={onChange}
        label={d.fields.expect}
        variant="chip"
      />
    </span>
  );
}

interface BranchProps {
  label: string;
  statements: Statement[];
  parentId: NodeId;
  slot: 'then' | 'otherwise' | 'body';
  variables: string[];
  problems: Map<NodeId, Problem[]>;
  callbacks: BlockCallbacks;
  activeNodeId: NodeId | null;
  erroredNodeId: NodeId | null;
  depth: number;
  onRemove?: () => void;
}

/** A nested statement list with its own drop target. */
function Branch({
  label,
  statements,
  parentId,
  slot,
  variables,
  problems,
  callbacks,
  activeNodeId,
  erroredNodeId,
  depth,
  onRemove,
}: BranchProps) {
  const { d } = useTranslation();

  return (
    <div className="branch">
      <div className="branch__label">
        <span>{label}</span>
        {onRemove && (
          <button
            type="button"
            className="branch__remove"
            onClick={onRemove}
            title={d.actions.removeElse}
            aria-label={d.actions.removeElse}
          >
            <Trash />
          </button>
        )}
      </div>

      <ul className="branch__list">
        <DropZone
          location={{ parentId, slot, index: 0 }}
          callbacks={callbacks}
          empty={statements.length === 0}
        />
        {statements.map((child, index) => (
          <div key={child.id} className="branch__item">
            <StatementBlock
              statement={child}
              variables={variables}
              problems={problems}
              callbacks={callbacks}
              isActive={child.id === activeNodeId}
              isErrored={child.id === erroredNodeId}
              activeNodeId={activeNodeId}
              erroredNodeId={erroredNodeId}
              depth={depth}
            />
            <DropZone
              location={{ parentId, slot, index: index + 1 }}
              callbacks={callbacks}
              empty={false}
            />
          </div>
        ))}
      </ul>
    </div>
  );
}

interface DropZoneProps {
  location: Location;
  callbacks: BlockCallbacks;
  empty: boolean;
}

/**
 * Marks a statement as just-landed, so the canvas shows something happened.
 *
 * Without it a drop can be invisible: moving a `say` between two other `say`
 * blocks rearranges the tree and leaves the screen looking identical, so the
 * student cannot tell the drag worked. The mark is a class rather than state
 * because it belongs to one paint, not to the algorithm — nothing about the
 * document changed, only what the eye needs pointing at.
 *
 * Applied after a frame so the element exists: React has not rendered the new
 * position at the moment the drop handler runs.
 */
function announceLanding(id: string): void {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
    if (!el) return;
    el.classList.remove('statement-block--landed');
    // Reading a layout property restarts the animation when the same block is
    // dropped twice in a row; without it the class is already there and the
    // browser skips it.
    void el.offsetWidth;
    el.classList.add('statement-block--landed');
    el.addEventListener(
      'animationend',
      () => el.classList.remove('statement-block--landed'),
      { once: true },
    );
  });
}

/**
 * Accepts both a new statement dragged from the palette and an existing
 * statement being reordered, distinguished by the drag data type.
 */
export function DropZone({ location, callbacks, empty }: DropZoneProps) {
  const { d } = useTranslation();

  return (
    <li
      className="drop-zone"
      data-empty={empty || undefined}
      /*
        No dragover or dragleave of its own. `useMagneticDrop` decides which
        zone is highlighted, and a zone that also managed its own `data-over`
        fought that: crossing one cleared the mark the magnet had just set, so
        the highlight vanished exactly when the pointer was nearest a slot.

        The drop handler stays, because what a zone accepts is still a zone's
        business — the magnet only forwards to it.
      */
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.removeAttribute('data-over');
        document.body.removeAttribute('data-dragging');

        const moveId = event.dataTransfer.getData('text/tobot-move');
        if (moveId) {
          callbacks.move(moveId, location);
          announceLanding(moveId);
          return;
        }
        const kind = event.dataTransfer.getData('text/tobot-new');
        if (kind) {
          const created = createStatement(kind as Statement['kind']);
          callbacks.add(created, location);
          announceLanding(created.id);
        }
      }}
    >
      <span className="drop-zone__hint">{empty ? d.editor.emptyBranch : d.editor.dropHere}</span>
    </li>
  );
}
