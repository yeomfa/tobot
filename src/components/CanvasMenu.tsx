import {
  CopySimpleIcon as CopySimple,
  QuestionIcon as Question,
  TrashIcon as Trash,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

import type { NodeId, Statement } from '../core/ast/types';
import { findStatement } from '../core/ast/operations';
import { conceptForStatement } from '../content/concepts';
import { useTranslation } from '../i18n/context';
import './CanvasMenu.css';

interface CanvasMenuProps {
  /** The algorithm, so a right-click can be resolved to the statement under it. */
  body: Statement[];
  onDuplicate: (id: NodeId) => void;
  onRemove: (id: NodeId) => void;
  onExplain: (conceptId: string) => void;
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
 * The canvas's own right-click menu.
 *
 * On a statement it offers that statement's own actions; on empty canvas it
 * offers nothing, so the browser's menu stays where it is still useful.
 *
 * Deliberately short, and deliberately free of anything the header already
 * does. Undo and redo lived here for a day and were simply the header's
 * buttons a second time; emptying the canvas lived here too and was worse — a
 * destructive action with no object, reachable by a gesture people make by
 * accident.
 */
export function CanvasMenu({
  body,
  onDuplicate,
  onRemove,
  onExplain,
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

        // Nothing of ours to offer on bare canvas, so the browser's menu
        // stands. Undo lives in the header, where it always did.
        if (!found) return;

        event.preventDefault();
        setAt({ x: event.clientX, y: event.clientY, statement: found });
      }}
    >
      {children}

      {at && statement && (
        <div
          className="canvas-menu"
          ref={menu}
          role="menu"
          style={{ left: at.x, top: at.y }}
        >
          {/* Which block this is about. The menu opens over a stack of them,
              and at a glance they look alike. */}
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
            className="canvas-menu__item canvas-menu__item--danger"
            onClick={run(() => onRemove(statement.id))}
          >
            <Trash weight="bold" aria-hidden="true" />
            {d.actions.delete}
          </button>
        </div>
      )}
    </div>
  );
}
