import { useEffect, useRef } from 'react';

/**
 * Makes the nearest drop zone claim the block, instead of asking the student
 * to hit one.
 *
 * Dropping used to require landing on a drop zone exactly: a 10px strip that
 * grew to 26px mid-drag, which together covered under a third of the
 * algorithm's height. The other two thirds — every block, every gap inside a
 * branch — silently rejected the drag, so a drop that looked right did
 * nothing and the block sprang back.
 *
 * Now the whole canvas accepts the drag and the closest zone wins. Nothing
 * about where a statement may go changes; only how hard it is to say so.
 *
 * Distance is measured to each zone's vertical centre, and horizontally only
 * when the pointer is outside a zone's own column. A nested branch sits inside
 * its parent, so two zones can be a few pixels apart vertically while
 * belonging to quite different places in the tree; without the horizontal term
 * a drop meant for the outer list lands inside the branch.
 */
export function useMagneticDrop(container: React.RefObject<HTMLElement | null>): void {
  /* Remembered so the class is removed from the previous winner rather than
     swept off every zone on each pointer move. */
  const active = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = container.current;
    if (!root) return;

    const clear = (): void => {
      active.current?.removeAttribute('data-over');
      active.current = null;
    };

    const nearest = (x: number, y: number): HTMLElement | null => {
      let best: HTMLElement | null = null;
      let bestDistance = Infinity;


      /*
        The two slots touching the block being dragged are where it already is,
        so dropping into either changes nothing. Offering them was confusing in
        a specific way: the student saw "Suelta aquí" directly above and below
        the block they were holding, which reads as two choices when it is
        really none.

        Only for a block already in the algorithm — dragging a new one from the
        palette has no current position, so every slot is a real destination.
      */
      const lifted = root.querySelector<HTMLElement>('.statement-block[data-lifted]');
      const dead = new Set<Element>();
      if (lifted) {
        const item = lifted.closest('.editor__item') ?? lifted.parentElement;
        const before = item?.previousElementSibling;
        if (before?.classList.contains('drop-zone')) dead.add(before);
        for (const child of item?.children ?? []) {
          if (child.classList.contains('drop-zone')) dead.add(child);
        }
      }

      for (const zone of root.querySelectorAll<HTMLElement>('.drop-zone')) {
        if (dead.has(zone)) continue;

        const box = zone.getBoundingClientRect();
        // A zone inside a collapsed branch has no size and cannot be a target.
        if (box.height === 0 && box.width === 0) continue;

        const dy = y - (box.top + box.height / 2);
        const dx = x < box.left ? box.left - x : x > box.right ? x - box.right : 0;

        /*
          Horizontal distance counts for more than vertical. Slots are stacked,
          so a few pixels sideways can mean a different branch entirely while a
          few pixels up or down usually means the same place — weighting them
          equally made the magnet jump into nested branches whose left edge the
          pointer had merely drifted past.
        */
        const distance = Math.hypot(dx * 2.5, dy);

        if (distance < bestDistance) {
          bestDistance = distance;
          best = zone;
        }
      }
      return best;
    };

    const onDragOver = (event: DragEvent): void => {
      // Without this the browser refuses the drop and shows a "no entry"
      // cursor over everything that is not a zone — which is most of the page.
      event.preventDefault();

      const zone = nearest(event.clientX, event.clientY);
      if (zone === active.current) return;

      active.current?.removeAttribute('data-over');
      zone?.setAttribute('data-over', 'true');
      active.current = zone;
    };

    /*
      The forwarded drop bubbles by design, so it reaches this same listener
      again on its way up. Marking the event itself is what works: a flag set
      around `dispatchEvent` is already cleared by the time the bubble arrives,
      because dispatch is synchronous and the re-entry happens inside it.

      Left unguarded, the canvas handles its own dispatch and the statement is
      inserted twice — or, since a move removes before it adds, disappears.
    */
    const FORWARDED = Symbol.for('tobot.forwardedDrop');

    const onDrop = (event: DragEvent): void => {
      if ((event as unknown as Record<symbol, boolean>)[FORWARDED]) return;

      const zone = active.current;
      clear();
      if (!zone) return;

      /*
        The drop is handed to the winning zone rather than handled here, so the
        rules about what a zone accepts stay in one place. Dispatching a real
        DragEvent carries the dataTransfer with it, which is the whole payload.
      */
      event.preventDefault();
      /*
        `bubbles: true` is required, not cosmetic: React listens at the root
        and matches the event to a component by its path, so an event that
        does not bubble never reaches the zone's `onDrop` — the DOM node
        receives it and the handler never runs.
      */
      const forwarded = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: event.dataTransfer,
      });
      (forwarded as unknown as Record<symbol, boolean>)[FORWARDED] = true;
      zone.dispatchEvent(forwarded);
    };

    const onDragLeave = (event: DragEvent): void => {
      /*
        Only when the pointer leaves the canvas for good.

        `dragleave` bubbles, so crossing from one child to another fires it
        here too — and `relatedTarget` is null for a synthetic event or when
        the pointer moves over a child that is not focusable, which made the
        highlight vanish the moment the pointer entered a slot. Checking the
        pointer against the canvas box is the reliable test: it does not
        depend on what the browser reports as the element being entered.
      */
      // A leave carrying no position (0,0) is one bubbling up from a child
      // rather than the pointer crossing the canvas edge; ignore it.
      if (event.clientX === 0 && event.clientY === 0) return;

      const box = root.getBoundingClientRect();
      const inside =
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom;
      if (!inside) clear();
    };

    root.addEventListener('dragover', onDragOver);
    root.addEventListener('drop', onDrop);
    root.addEventListener('dragleave', onDragLeave);
    root.addEventListener('dragend', clear);

    return () => {
      root.removeEventListener('dragover', onDragOver);
      root.removeEventListener('drop', onDrop);
      root.removeEventListener('dragleave', onDragLeave);
      root.removeEventListener('dragend', clear);
      clear();
    };
  }, [container]);
}
