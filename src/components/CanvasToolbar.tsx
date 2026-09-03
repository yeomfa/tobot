import { useEffect, useRef, useState } from 'react';

import { createStatement } from '../core/ast/factory';
import type { Statement } from '../core/ast/types';
import { useTranslation } from '../i18n/context';
import { categoryIcon, paletteGroups, statementIcon } from './statementMeta';
import type { Category } from './statementMeta';
import './CanvasToolbar.css';

interface CanvasToolbarProps {
  onAdd: (statement: Statement) => void;
}

/**
 * Adding instructions from the canvas itself.
 *
 * The palette used to be the only way in, so closing the left panel left the
 * editor with nothing to add and no hint that anything was missing. That is
 * the bug this fixes; the rest is a consequence of fixing it properly.
 *
 * Grouped by category rather than laid out flat: nine icons in a row are hard
 * to tell apart at a glance, and the five groups are the same ones the student
 * meets in the palette, in the block colours, and in the concept list. The
 * toolbar teaches that grouping every time it is opened.
 */
export function CanvasToolbar({ onAdd }: CanvasToolbarProps) {
  const { d } = useTranslation();
  const [open, setOpen] = useState<Category | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(null);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="canvas-toolbar" ref={root}>
      {paletteGroups.map(({ category, kinds }) => {
        const CategoryIcon = categoryIcon[category];
        const isOpen = open === category;

        return (
          <div className="canvas-toolbar__group" key={category} data-category={category}>
            {isOpen && (
              <div className="canvas-toolbar__menu" role="menu">
                {kinds.map((kind) => {
                  const KindIcon = statementIcon[kind];
                  return (
                    <button
                      type="button"
                      role="menuitem"
                      className="canvas-toolbar__item"
                      key={kind}
                      /*
                        Draggable as well as clickable, the same as the palette
                        items: clicking appends to the end, which is right most
                        of the time, but a statement that belongs inside a loop
                        or between two others had to be added and then moved.
                        The drag data type is what lets a drop zone tell a new
                        statement from one being reordered.
                      */
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/tobot-new', kind);
                        event.dataTransfer.effectAllowed = 'copy';
                        document.body.setAttribute('data-dragging', 'true');
                      }}
                      onDragEnd={() => {
                        document.body.removeAttribute('data-dragging');
                        // Closed on the way out rather than on the way in:
                        // unmounting the element mid-gesture cancels the drag,
                        // so the menu stays mounted and `data-dragging` hides
                        // it while the block is in the air.
                        setOpen(null);
                      }}
                      onClick={() => {
                        onAdd(createStatement(kind));
                        setOpen(null);
                      }}
                    >
                      <KindIcon weight="duotone" />
                      <span className="canvas-toolbar__item-text">
                        <span className="canvas-toolbar__item-label">
                          {d.statements[kind].label}
                        </span>
                        <span className="canvas-toolbar__item-hint">{d.statements[kind].hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              className="canvas-toolbar__button"
              data-open={isOpen || undefined}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              onClick={() => setOpen(isOpen ? null : category)}
              title={d.palette.groups[category]}
            >
              <CategoryIcon weight="duotone" />
              <span className="canvas-toolbar__button-label">{d.palette.groups[category]}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
