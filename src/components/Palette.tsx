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
  collapsed: boolean;
  onToggle: () => void;
}

export const Palette = memo(function Palette({ onAdd, collapsed, onToggle }: PaletteProps) {
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
    <div className="palette" data-collapsed={collapsed || undefined}>
      <div className="palette__header">
        <div className="palette__title-row">
          {!collapsed && <h2 className="palette__title">{d.palette.title}</h2>}
          <button
            type="button"
            className="palette__toggle"
            onClick={onToggle}
            title={collapsed ? d.palette.expand : d.palette.collapse}
            aria-label={collapsed ? d.palette.expand : d.palette.collapse}
            aria-expanded={!collapsed}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {!collapsed && (
          <>
            <p className="palette__subtitle">{d.palette.subtitle}</p>
            <input
              className="palette__search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={d.palette.search}
              aria-label={d.palette.search}
            />
          </>
        )}
      </div>

      <div className="palette__groups">
        {!collapsed && groups.length === 0 && <p className="palette__empty">{d.palette.empty}</p>}

        {groups.map((group) => (
          <section key={group.category} className="palette__group" data-category={group.category}>
            {!collapsed && (
              <h3 className="palette__group-title">{d.palette.groups[group.category]}</h3>
            )}
            <ul className="palette__items">
              {group.kinds.map((kind) => (
                <PaletteItem key={kind} kind={kind} onAdd={onAdd} collapsed={collapsed} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
});

interface PaletteItemProps {
  kind: StatementKind;
  onAdd: (statement: Statement) => void;
  collapsed: boolean;
}

function PaletteItem({ kind, onAdd, collapsed }: PaletteItemProps) {
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
        // Collapsed items rely on the tooltip to stay identifiable.
        title={collapsed ? `${copy.label} — ${copy.hint}` : copy.hint}
      >
        <span className="palette__item-icon" aria-hidden="true">
          {statementIcon[kind]}
        </span>
        {!collapsed && (
          <span className="palette__item-text">
            <span className="palette__item-label">{copy.label}</span>
            <span className="palette__item-hint">{copy.hint}</span>
          </span>
        )}
        {collapsed && <span className="sr-only">{copy.label}</span>}
      </button>
    </li>
  );
}
