import {
  ArrowCounterClockwiseIcon as Undo,
  ArrowClockwiseIcon as Redo,
  TrashIcon as Trash,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

import { useTranslation } from '../i18n/context';
import './CanvasMenu.css';

interface CanvasMenuProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Empties the algorithm; asks first, since it cannot be pointed at. */
  onClear: () => void;
  /** Whether there is anything to clear. */
  hasStatements: boolean;
  children: React.ReactNode;
}

/**
 * The canvas's own right-click menu.
 *
 * The browser's default menu offers to reload the page, view source and save
 * images — nothing that has anything to do with an algorithm, on a surface
 * where right-clicking is a reasonable thing to try. Replacing it costs
 * nothing and turns a dead gesture into a way to reach the actions that
 * otherwise live only in the header.
 *
 * Deliberately short. A context menu that lists everything is a menu nobody
 * reads; these are the three that apply to the canvas as a whole rather than
 * to one statement, which has its own controls already.
 */
export function CanvasMenu({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  hasStatements,
  children,
}: CanvasMenuProps) {
  const { d } = useTranslation();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!at) return;
    const close = (): void => setAt(null);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setAt(null);
    };
    /* Closes on any press, including one inside the menu: every item does
       something and then there is nothing left to keep it open for. */
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
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
        x: at.x - Math.max(0, overflowX),
        y: at.y - Math.max(0, overflowY),
      });
    }
  }, [at]);

  return (
    <div
      className="canvas-menu__host"
      onContextMenu={(event) => {
        // Not over a statement: those keep the browser menu, where copying a
        // value the student typed still works.
        if ((event.target as HTMLElement).closest('.statement-block')) return;
        event.preventDefault();
        setAt({ x: event.clientX, y: event.clientY });
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
          <button
            type="button"
            role="menuitem"
            className="canvas-menu__item"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo weight="bold" aria-hidden="true" />
            {d.actions.undo}
          </button>
          <button
            type="button"
            role="menuitem"
            className="canvas-menu__item"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <Redo weight="bold" aria-hidden="true" />
            {d.actions.redo}
          </button>

          <span className="canvas-menu__rule" />

          <button
            type="button"
            role="menuitem"
            className="canvas-menu__item canvas-menu__item--danger"
            disabled={!hasStatements}
            onClick={onClear}
          >
            <Trash weight="bold" aria-hidden="true" />
            {d.actions.clearCanvas}
          </button>
        </div>
      )}
    </div>
  );
}
