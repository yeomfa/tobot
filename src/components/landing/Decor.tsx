import './Decor.css';

/**
 * The page's decorative shapes.
 *
 * Static, `aria-hidden` and inert to the pointer: they carry no meaning that
 * is not already in the text beside them.
 */

/** A dashed connector between the four view names in the dark band. */
export function DashRule() {
  return (
    <svg className="decor-rule" viewBox="0 0 28 2" aria-hidden="true" focusable="false">
      <line
        x1="0"
        y1="1"
        x2="28"
        y2="1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        strokeLinecap="round"
      />
    </svg>
  );
}
