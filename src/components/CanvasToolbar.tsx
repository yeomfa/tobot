import {
  BracketsRoundIcon as BracketsRound,
  CopyIcon as Copy,
  ScissorsIcon as Scissors,
  TrashIcon as Trash,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

import { createStatement } from '../core/ast/factory';
import type { Statement } from '../core/ast/types';
import { useTranslation } from '../i18n/context';
import { armGrouping } from './grouping';
import { categoryIcon, paletteGroups, statementIcon } from './statementMeta';
import type { Category } from './statementMeta';
import './CanvasToolbar.css';

interface CanvasToolbarProps {
  onAdd: (statement: Statement) => void;
  /** How many blocks are selected; the bar acts on all of them. */
  selectedCount: number;
  /** Whether any expression on the canvas has parts that could be grouped. */
  groupable: boolean;
  onCopy: () => void;
  onCut: () => void;
  onRemove: () => void;
  /**
   * Whether the palette is on screen.
   *
   * The adding half of this bar exists because the palette can be closed —
   * including by the layout itself, which hides it below 960px. With the
   * palette visible the two were the same list twice, so the bar steps aside.
   */
  paletteVisible: boolean;
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
export function CanvasToolbar({
  onAdd,
  selectedCount,
  groupable,
  onCopy,
  onCut,
  onRemove,
  paletteVisible,
}: CanvasToolbarProps) {
  const { d, fill } = useTranslation();
  const [open, setOpen] = useState<Category | null>(null);
  const root = useRef<HTMLDivElement>(null);
  /* A completed drag is followed by a click on the same element, and both
     would add a statement. This remembers which gesture it was. */
  const dragged = useRef(false);

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

  /*
    With blocks selected the bar is about them.

    Selecting is a gesture that ends with a question — now what? — and the
    answers were spread between a keyboard shortcut and a right-click. Here
    they are where the student is already looking, and the bar stops being a
    second copy of the palette.
  */
  if (selectedCount > 0) {
    return (
      <div className="canvas-toolbar canvas-toolbar--selection" ref={root}>
        <span className="canvas-toolbar__count">
          {selectedCount === 1
            ? d.actions.selectedOne
            : fill(d.actions.selectedCount, { count: selectedCount })}
        </span>

        <span className="canvas-toolbar__rule" aria-hidden="true" />

        <button type="button" className="canvas-toolbar__action" onClick={onCopy}>
          <Copy weight="bold" aria-hidden="true" />
          <span className="canvas-toolbar__action-label">{d.actions.copyBlock}</span>
        </button>
        <button type="button" className="canvas-toolbar__action" onClick={onCut}>
          <Scissors weight="bold" aria-hidden="true" />
          <span className="canvas-toolbar__action-label">{d.actions.cut}</span>
        </button>
        {/* Grouping arms a mode rather than acting at once, so it belongs with
            the other things done *to* a selection — and it is only offered
            when some expression actually has parts to bracket. */}
        {groupable && (
          <button type="button" className="canvas-toolbar__action" onClick={armGrouping}>
            <BracketsRound weight="bold" aria-hidden="true" />
            <span className="canvas-toolbar__action-label">{d.actions.groupTool}</span>
          </button>
        )}

        <span className="canvas-toolbar__rule" aria-hidden="true" />

        <button
          type="button"
          className="canvas-toolbar__action canvas-toolbar__action--danger"
          onClick={onRemove}
        >
          <Trash weight="bold" aria-hidden="true" />
          <span className="canvas-toolbar__action-label">{d.actions.delete}</span>
        </button>
      </div>
    );
  }

  /*
    Nothing selected: the bar is only a way in when there is no other one.

    With the palette open these were the same five categories twice over, and
    the bar was covering the canvas to offer what the panel beside it already
    did. It stays for the layouts that hide the palette — below 960px it is
    the only way to add anything at all.
  */
  if (paletteVisible) return null;

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
                        // Marks the item the instruction is being pulled out
                        // of, so it can rise while the menu withdraws.
                        event.currentTarget.setAttribute('data-lifted', 'true');
                        // A drag ends in a click too, and both would add a
                        // statement — two blocks for one gesture.
                        dragged.current = true;
                      }}
                      onDragEnd={(event) => {
                        document.body.removeAttribute('data-dragging');
                        event.currentTarget.removeAttribute('data-lifted');
                        // Cleared on the next tick: the click that follows a
                        // drag has not fired yet.
                        setTimeout(() => {
                          dragged.current = false;
                        }, 0);
                        // Closed on the way out rather than on the way in:
                        // unmounting the element mid-gesture cancels the drag,
                        // so the menu stays mounted and `data-dragging` hides
                        // it while the block is in the air.
                        setOpen(null);
                      }}
                      onClick={() => {
                        if (dragged.current) {
                          dragged.current = false;
                          return;
                        }
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
