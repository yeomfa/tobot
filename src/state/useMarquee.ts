import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import type { NodeId } from '../core/ast/types';

/**
 * Selecting by dragging a rectangle over the canvas, the way a design tool does.
 *
 * Starts only on empty canvas: a drag begun on a block is that block being
 * moved, which is a gesture students already have. That split is what lets the
 * two live together without a mode to switch between.
 *
 * Everything the rectangle touches is selected — touched, not enclosed, so a
 * quick sweep across a column of blocks catches them all without having to
 * surround the widest one.
 */
export interface Marquee {
  /** The rectangle to draw, in client coordinates, while one is being dragged. */
  box: { left: number; top: number; width: number; height: number } | null;
  /**
   * Whether the click that follows should be ignored.
   *
   * Releasing a drag fires a click, and the canvas clears its selection on a
   * click — so a rectangle selected three blocks and then dropped them a
   * moment later. True until that click has been swallowed.
   */
  justDragged: () => boolean;
}

export function useMarquee(
  canvas: RefObject<HTMLElement | null>,
  onSelect: (ids: NodeId[], extend: boolean) => void,
): Marquee {
  const [box, setBox] = useState<Marquee['box']>(null);
  /*
    The drag lives in refs, not in the effect's closure.

    Reading `box` inside the effect put it in the dependencies, so every
    movement tore the listeners down and set them up again — losing the origin
    with them, and freezing the rectangle at its first few pixels.
  */
  const origin = useRef<{ x: number; y: number } | null>(null);
  const extend = useRef(false);
  const dragging = useRef(false);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      /* Only from bare canvas. A press on a block starts a drag of that block,
         and a press on a field or a control belongs to it. */
      if (target.closest('.statement-block, .canvas-toolbar, .drop-zone')) return;

      origin.current = { x: event.clientX, y: event.clientY };
      extend.current = event.shiftKey;
      dragging.current = false;
    };

    const onPointerMove = (event: PointerEvent): void => {
      const start = origin.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      /* A few pixels of slack, so a plain click on the canvas — which is how a
         student clears the selection — is not read as a one-pixel rectangle. */
      if (!dragging.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      dragging.current = true;

      const rect = {
        left: Math.min(start.x, event.clientX),
        right: Math.max(start.x, event.clientX),
        top: Math.min(start.y, event.clientY),
        bottom: Math.max(start.y, event.clientY),
      };
      setBox({
        left: rect.left,
        top: rect.top,
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
      });

      /*
        Outermost blocks only.

        A rectangle over a loop touches the loop and everything inside it, and
        selecting both would delete the children twice and paste them twice.
        Taking the outermost means "the loop, with its contents" — which is
        what the rectangle looks like it is saying.
      */
      const hit: NodeId[] = [];
      for (const block of element.querySelectorAll<HTMLElement>('.statement-block')) {
        const id = block.dataset.nodeId;
        if (!id) continue;
        const b = block.getBoundingClientRect();
        const touches =
          b.left < rect.right && b.right > rect.left && b.top < rect.bottom && b.bottom > rect.top;
        if (!touches) continue;
        if (block.parentElement?.closest('.statement-block')) {
          const outer = block.parentElement.closest<HTMLElement>('.statement-block');
          const outerBox = outer?.getBoundingClientRect();
          const outerTouches =
            outerBox &&
            outerBox.left < rect.right &&
            outerBox.right > rect.left &&
            outerBox.top < rect.bottom &&
            outerBox.bottom > rect.top;
          if (outerTouches) continue;
        }
        hit.push(id);
      }
      onSelect(hit, extend.current);
    };

    const onPointerUp = (): void => {
      origin.current = null;
      /* `dragging` is cleared by the click this release produces, not here —
         see `justDragged`. */
      setBox(null);
    };

    element.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [canvas, onSelect]);

  const justDragged = useCallback(() => {
    if (!dragging.current) return false;
    dragging.current = false;
    return true;
  }, []);

  return { box, justDragged };
}
