import {
  BracketsRoundIcon as BracketsRound,
  ClipboardTextIcon as ClipboardText,
  CopyIcon as Copy,
  ScissorsIcon as Scissors,
  CopySimpleIcon as CopySimple,
  QuestionIcon as Question,
  TrashIcon as Trash,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

import type { NodeId, Statement } from '../core/ast/types';
import { findStatement } from '../core/ast/operations';
import { conceptForStatement } from '../content/concepts';
import { useTranslation } from '../i18n/context';
import { canGroupAnything } from './chain';
import { armGrouping } from './grouping';
import './CanvasMenu.css';

interface CanvasMenuProps {
  /** The algorithm, so a right-click can be resolved to the statement under it. */
  body: Statement[];
  onDuplicate: (id: NodeId) => void;
  onRemove: (id: NodeId) => void;
  onExplain: (conceptId: string) => void;
  /** Copy, cut and paste, so the menu offers what the keyboard does. */
  clipboard: {
    copy: () => void;
    cut: () => void;
    paste: () => void;
    /** Whether anything is selected to act on. */
    hasSelection: boolean;
  };
  /** Right-clicking a block selects it first, so the actions have a subject. */
  onSelect: (id: NodeId) => void;
  children: React.ReactNode;
}

/** Where the menu opened, and what it opened on. */
interface Opened {
  x: number;
  y: number;
  /** The statement under the pointer, if the click landed on one. */
  statement: Statement | null;
}

/**
 * The canvas's own right-click menu, which has two faces.
 *
 * On a statement it offers that statement's own actions. On bare canvas it
 * offers the tools — the things that act on the work rather than on one
 * instruction — because that is where there is room for them and where a
 * student reaches when no block is what they mean.
 *
 * The bar below the canvas is for building: instructions to add. Tools were
 * never going to fit there alongside a category list that still has functions,
 * arrays and objects to grow into.
 *
 * Deliberately free of anything the header already does. Undo and redo lived
 * here for a day and were simply the header's buttons a second time; emptying
 * the canvas lived here too and was worse — a destructive action with no
 * object, reachable by a gesture people make by accident.
 */
export function CanvasMenu({
  body,
  onDuplicate,
  onRemove,
  onExplain,
  clipboard,
  onSelect,
  children,
}: CanvasMenuProps) {
  const { d } = useTranslation();
  const [at, setAt] = useState<Opened | null>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!at) return;
    const close = (): void => setAt(null);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setAt(null);
    };
    /*
      Closed on `click`, not on `pointerdown`.

      Listening for the press unmounted the button between its own pointerdown
      and its click, so the click never landed on anything and no item in the
      menu did anything at all. The press is not the gesture; the click is.
    */
    const onClick = (event: MouseEvent): void => {
      // A click inside the menu is an item doing its job, which closes the
      // menu itself. Everything else is a click past it.
      if (menu.current?.contains(event.target as Node)) return;
      setAt(null);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', close, true);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('blur', close);
    };
  }, [at]);

  /*
    Kept inside the viewport. Opening near the right or bottom edge would
    otherwise put half the menu off screen, which is exactly where someone
    working at the end of a long algorithm tends to click.
  */
  useEffect(() => {
    const element = menu.current;
    if (!at || !element) return;
    const box = element.getBoundingClientRect();
    const overflowX = box.right - window.innerWidth + 8;
    const overflowY = box.bottom - window.innerHeight + 8;
    if (overflowX > 0 || overflowY > 0) {
      setAt({
        ...at,
        x: at.x - Math.max(0, overflowX),
        y: at.y - Math.max(0, overflowY),
      });
    }
  }, [at]);

  const statement = at?.statement ?? null;
  const concept = statement ? conceptForStatement.get(statement.kind) : undefined;
  const groupable = canGroupAnything(body);

  /** Runs an action and closes, which every item here does. */
  const run = (action: () => void) => () => {
    action();
    setAt(null);
  };

  return (
    <div
      className="canvas-menu__host"
      onContextMenu={(event) => {
        const target = event.target as HTMLElement;

        /*
          Fields keep the browser's menu. Copying a value the student typed,
          pasting one in, correcting a spelling — all of it is exactly what
          right-clicking text is for, and none of it is ours to replace.
        */
        if (target.closest('input, textarea')) return;

        const block = target.closest<HTMLElement>('.statement-block');
        const id = block?.dataset.nodeId;
        const found = id ? findStatement(body, id) : null;

        event.preventDefault();
        /* Right-clicking a block that is not selected selects it: the menu's
           actions need a subject, and acting on something the student cannot
           see highlighted is how a menu deletes the wrong thing. */
        if (found) onSelect(found.id);
        setAt({ x: event.clientX, y: event.clientY, statement: found });
      }}
    >
      {children}

      {at && (
        <div
          className="canvas-menu"
          ref={menu}
          role="menu"
          style={{ left: at.x, top: at.y }}
        >
          {statement ? (
            <>
              {/* Which block this is about. The menu opens over a stack of
                  them, and at a glance they look alike. */}
              <span className="canvas-menu__head">{d.statements[statement.kind].label}</span>

              <button
                type="button"
                role="menuitem"
                className="canvas-menu__item"
                onClick={run(() => onDuplicate(statement.id))}
              >
                <CopySimple weight="bold" aria-hidden="true" />
                {d.actions.duplicate}
              </button>

              {concept && (
                <button
                  type="button"
                  role="menuitem"
                  className="canvas-menu__item"
                  onClick={run(() => onExplain(concept.id))}
                >
                  <Question weight="bold" aria-hidden="true" />
                  {d.actions.learnMore}
                </button>
              )}

              <span className="canvas-menu__rule" />

              <button
                type="button"
                role="menuitem"
                className="canvas-menu__item"
                onClick={run(clipboard.copy)}
              >
                <Copy weight="bold" aria-hidden="true" />
                {d.actions.copyBlock}
                <span className="canvas-menu__shortcut">Ctrl+C</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="canvas-menu__item"
                onClick={run(clipboard.cut)}
              >
                <Scissors weight="bold" aria-hidden="true" />
                {d.actions.cut}
                <span className="canvas-menu__shortcut">Ctrl+X</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="canvas-menu__item"
                onClick={run(clipboard.paste)}
              >
                <ClipboardText weight="bold" aria-hidden="true" />
                {d.actions.paste}
                <span className="canvas-menu__shortcut">Ctrl+V</span>
              </button>

              <span className="canvas-menu__rule" />

              <button
                type="button"
                role="menuitem"
                className="canvas-menu__item canvas-menu__item--danger"
                onClick={run(() => onRemove(statement.id))}
              >
                <Trash weight="bold" aria-hidden="true" />
                {d.actions.delete}
              </button>
            </>
          ) : (
            <>
              <span className="canvas-menu__head">{d.actions.tools}</span>

              {/*
                Arming grouping from here is what makes it a tool rather than a
                property of one part. The menu is on bare canvas and has no
                expression to aim at, so it arms every chain long enough to
                group and the student drags over the one they meant.

                Disabled rather than absent when nothing can be grouped. A tool
                that vanishes leaves the student wondering where it went; one
                that is visibly unavailable, with the reason under it, teaches
                what grouping needs — three parts in a row.
              */}
              <button
                type="button"
                role="menuitem"
                className="canvas-menu__item"
                disabled={!groupable}
                onClick={run(armGrouping)}
              >
                <BracketsRound weight="bold" aria-hidden="true" />
                {d.actions.groupTool}
              </button>
              <span className="canvas-menu__hint">
                {groupable ? d.actions.groupHint : d.actions.groupUnavailable}
              </span>

              <span className="canvas-menu__rule" />

              {/* Pasting works with nothing selected: it goes where the
                  pointer is, which on bare canvas is exactly where the student
                  right-clicked. */}
              <button
                type="button"
                role="menuitem"
                className="canvas-menu__item"
                onClick={run(clipboard.paste)}
              >
                <ClipboardText weight="bold" aria-hidden="true" />
                {d.actions.paste}
                <span className="canvas-menu__shortcut">Ctrl+V</span>
              </button>
            </>
          )}
        </div>
      )}

    </div>
  );
}
