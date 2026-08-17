import { memo, useMemo, useState } from 'react';

import { createStatement } from '../core/ast/factory';
import type { Statement } from '../core/ast/types';
import { useTranslation } from '../i18n/context';
import { paletteGroups, statementIcon } from './statementMeta';
import type { StatementKind } from './statementMeta';
import './Palette.css';

interface PaletteProps {
  /** Appends to the end of the program; dragging allows precise placement. */
  onAdd: (statement: Statement) => void;
}

export const Palette = memo(function Palette({ onAdd }: PaletteProps) {
  const { d } = useTranslation();
  const [query, setQuery] = useState('');

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
        <h2 className="palette__title">{d.palette.title}</h2>
        <p className="palette__subtitle">{d.palette.subtitle}</p>
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
      </div>
    </div>
  );
});

function PaletteItem({ kind, onAdd }: { kind: StatementKind; onAdd: (s: Statement) => void }) {
  const { d } = useTranslation();
  const copy = d.statements[kind];

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
        }}
        onDragEnd={() => document.body.removeAttribute('data-dragging')}
        onClick={() => onAdd(createStatement(kind))}
        title={copy.hint}
      >
        <span className="palette__item-icon" aria-hidden="true">
          {statementIcon[kind]}
        </span>
        <span className="palette__item-text">
          <span className="palette__item-label">{copy.label}</span>
          <span className="palette__item-hint">{copy.hint}</span>
        </span>
      </button>
    </li>
  );
}
