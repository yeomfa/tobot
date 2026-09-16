import { memo, useMemo, useState } from 'react';

import { createStatement } from '../core/ast/factory';
import type { Statement } from '../core/ast/types';
import { collectVariables } from '../core/ast/operations';
import { collectVariableKinds } from '../core/emitters/inferKind';
import { useTranslation } from '../i18n/context';
import { paletteGroups, statementIcon, typeIcon } from './statementMeta';
import type { StatementKind } from './statementMeta';
import './Palette.css';

interface PaletteProps {
  /** Appends to the end of the program; dragging allows precise placement. */
  onAdd: (statement: Statement) => void;
  /**
   * The algorithm, for the list of variables in play.
   *
   * Which names exist and what each holds is the thing most often looked up
   * while writing a program, and until now it could only be seen by opening
   * the picker inside an expression — one at a time, and only where a value
   * was being edited.
   */
  body: Statement[];
}

/** Hiding is handled by the app shell, so this only renders the list. */
export const Palette = memo(function Palette({ onAdd, body }: PaletteProps) {
  const { d } = useTranslation();
  const [query, setQuery] = useState('');

  /*
    Names in declaration order, each with what it holds.

    `collectVariables` decides what counts as a name in scope — including the
    one a `para cada elemento` binds — and `collectVariableKinds` says what
    kind each one is. Both already existed; neither was ever shown.
  */
  const variables = useMemo(() => {
    const kinds = collectVariableKinds(body);
    return collectVariables(body).map((name) => ({ name, kind: kinds.get(name) ?? 'unknown' }));
  }, [body]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return paletteGroups;

    return paletteGroups
      .map((group) => ({
        ...group,
        kinds: group.kinds.filter((kind) => {
          const copy = d.statements[kind];
          return (
            copy.label.toLowerCase().includes(needle) ||
            copy.hint.toLowerCase().includes(needle)
          );
        }),
      }))
      .filter((group) => group.kinds.length > 0);
  }, [query, d]);

  return (
    <div className="palette">
      <div className="palette__header">
        <input
          className="palette__search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={d.palette.search}
          aria-label={d.palette.search}
        />
      </div>

      <div className="palette__groups">
        {groups.length === 0 && <p className="palette__empty">{d.palette.empty}</p>}

        {groups.map((group) => (
          <section key={group.category} className="palette__group" data-category={group.category}>
            <h3 className="palette__group-title">{d.palette.groups[group.category]}</h3>
            <ul className="palette__items">
              {group.kinds.map((kind) => (
                <PaletteItem key={kind} kind={kind} onAdd={onAdd} />
              ))}
            </ul>
          </section>
        ))}

        {/*
          The variables in play, at the foot of the list.

          Below the blocks rather than above them: the palette's first job is
          still to answer "what can I build with", and this answers "what have
          I got" — a question that only exists once something has been built.
          It is absent entirely until then, so an empty program shows an empty
          panel rather than an empty heading.
        */}
        {!query && variables.length > 0 && (
          <section className="palette__group palette__group--vars">
            <h3 className="palette__group-title">{d.palette.variables}</h3>
            <ul className="palette__vars">
              {variables.map(({ name, kind }) => {
                const Glyph = kind === 'unknown' ? null : typeIcon[kind];
                return (
                  <li className="palette__var" key={name} data-kind={kind}>
                    {Glyph ? (
                      <Glyph weight="duotone" aria-hidden="true" />
                    ) : (
                      <span className="palette__var-unknown" aria-hidden="true">
                        ?
                      </span>
                    )}
                    <span className="palette__var-name">{name}</span>
                    {/* The kind is the point of the row, so it is named rather
                        than left to the icon alone — a student learning what a
                        type is has not yet learned the icons. */}
                    <span className="palette__var-kind">
                      {kind === 'unknown' ? d.palette.kindUnknown : d.kinds[kind]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
});

interface PaletteItemProps {
  kind: StatementKind;
  onAdd: (statement: Statement) => void;
}

function PaletteItem({ kind, onAdd }: PaletteItemProps) {
  const { d } = useTranslation();
  const copy = d.statements[kind];
  const Icon = statementIcon[kind];

  return (
    <li>
      <button
        type="button"
        className="palette__item"
        draggable
        onDragStart={(event) => {
          // A distinct type lets drop zones tell "new" from "reorder".
          event.dataTransfer.setData('text/tobot-new', kind);
          event.dataTransfer.effectAllowed = 'copy';
          document.body.setAttribute('data-dragging', 'true');
          // The same mark a statement in the canvas gets while it is being
          // moved: one visual language for "this is in your hand", wherever
          // the block came from.
          event.currentTarget.setAttribute('data-lifted', 'true');
        }}
        onDragEnd={(event) => {
          document.body.removeAttribute('data-dragging');
          event.currentTarget.removeAttribute('data-lifted');
        }}
        onClick={() => onAdd(createStatement(kind))}
        title={copy.hint}
      >
        <span className="palette__item-icon" aria-hidden="true">
          <Icon weight="duotone" />
        </span>
        <span className="palette__item-text">
          <span className="palette__item-label">{copy.label}</span>
          <span className="palette__item-hint">{copy.hint}</span>
        </span>
      </button>
    </li>
  );
}
