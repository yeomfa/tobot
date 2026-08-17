import { useCallback, useEffect, useRef, useState } from 'react';

export type ResizeAxis = 'x' | 'y';

interface ResizableOptions {
  /** Starting size in pixels, used when nothing is persisted yet. */
  initial: number;
  min: number;
  max: number;
  axis: ResizeAxis;
  /**
   * `end` means the handle sits on the panel's leading edge, so dragging
   * towards the start of the axis grows it — true for a right-hand rail or a
   * bottom drawer.
   */
  from: 'start' | 'end';
  /** localStorage key; omit to keep the size in memory only. */
  storageKey?: string;
}

export interface Resizable {
  size: number;
  isDragging: boolean;
  /** Spread onto the drag handle element. */
  handleProps: {
    onPointerDown: (event: React.PointerEvent) => void;
    onKeyDown: (event: React.KeyboardEvent) => void;
    role: 'separator';
    tabIndex: number;
    'aria-orientation': 'vertical' | 'horizontal';
    'aria-valuenow': number;
    'aria-valuemin': number;
    'aria-valuemax': number;
  };
  setSize: (next: number) => void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function readStored(key: string | undefined, fallback: number): number {
  if (!key) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Drag-to-resize for a panel edge.
 *
 * Pointer events are captured on the handle so a fast drag cannot outrun the
 * cursor and drop the gesture, and the size is committed to storage only when
 * the drag ends — writing on every move would hammer localStorage.
 *
 * Arrow keys move the handle too, which keeps the panel resizable without a
 * pointer.
 */
export function useResizable({
  initial,
  min,
  max,
  axis,
  from,
  storageKey,
}: ResizableOptions): Resizable {
  const [size, setSizeState] = useState(() => clamp(readStored(storageKey, initial), min, max));
  const [isDragging, setIsDragging] = useState(false);
  const origin = useRef({ pointer: 0, size: 0 });

  const persist = useCallback(
    (value: number) => {
      if (!storageKey) return;
      try {
        window.localStorage.setItem(storageKey, String(Math.round(value)));
      } catch {
        // Storage may be unavailable; the size still applies for this session.
      }
    },
    [storageKey],
  );

  const setSize = useCallback(
    (next: number) => {
      const clamped = clamp(next, min, max);
      setSizeState(clamped);
      persist(clamped);
    },
    [min, max, persist],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      const target = event.currentTarget as HTMLElement;
      target.setPointerCapture(event.pointerId);
      origin.current = {
        pointer: axis === 'x' ? event.clientX : event.clientY,
        size,
      };
      setIsDragging(true);
    },
    [axis, size],
  );

  // Move and release are bound to the window so the drag survives the cursor
  // leaving the handle.
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (event: PointerEvent): void => {
      const current = axis === 'x' ? event.clientX : event.clientY;
      const delta = current - origin.current.pointer;
      // A handle on the leading edge grows the panel as the pointer moves back.
      const next = origin.current.size + (from === 'end' ? -delta : delta);
      setSizeState(clamp(next, min, max));
    };

    const onUp = (): void => {
      setIsDragging(false);
      setSizeState((current) => {
        persist(current);
        return current;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    // A resize cursor everywhere, and no text selection mid-drag.
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [isDragging, axis, from, min, max, persist]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const grow = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
      const shrink = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
      // `from: 'start'` panels grow in the opposite direction.
      const growKey = from === 'end' ? grow : shrink;
      const shrinkKey = from === 'end' ? shrink : grow;
      const step = event.shiftKey ? 48 : 16;

      if (event.key === growKey) {
        event.preventDefault();
        setSize(size + step);
      } else if (event.key === shrinkKey) {
        event.preventDefault();
        setSize(size - step);
      }
    },
    [axis, from, size, setSize],
  );

  return {
    size,
    isDragging,
    setSize,
    handleProps: {
      onPointerDown,
      onKeyDown,
      role: 'separator',
      tabIndex: 0,
      'aria-orientation': axis === 'x' ? 'vertical' : 'horizontal',
      'aria-valuenow': Math.round(size),
      'aria-valuemin': min,
      'aria-valuemax': max,
    },
  };
}
