import type { Resizable } from '../state/useResizable';
import './ResizeHandle.css';

interface ResizeHandleProps {
  resizable: Resizable;
  /** Which edge the handle sits on, which decides its cursor and hit area. */
  edge: 'left' | 'right' | 'top';
  label: string;
}

/**
 * A 5px visual seam with a wider invisible hit area, so the handle is easy to
 * grab without drawing a thick divider between panels.
 */
export function ResizeHandle({ resizable, edge, label }: ResizeHandleProps) {
  return (
    <div
      className="resize-handle"
      data-edge={edge}
      data-dragging={resizable.isDragging || undefined}
      aria-label={label}
      title={label}
      {...resizable.handleProps}
    >
      <span className="resize-handle__grip" aria-hidden="true" />
    </div>
  );
}
