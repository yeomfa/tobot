import './Decor.css';

/**
 * The page's decorative shapes.
 *
 * Every one is static. A landing page whose background pulses, drifts or
 * morphs competes with the one thing that *should* be moving — the robot
 * building its algorithm — and the result reads as restless rather than
 * lively. These add depth and colour and then hold still.
 *
 * All are `aria-hidden` and inert to the pointer: they carry no meaning that
 * is not already in the text beside them.
 */

/** Two soft colour fields behind the hero, in two of the category hues. */
export function Blobs() {
  return (
    <div className="decor-blobs" aria-hidden="true">
      <span className="decor-blobs__a" />
      <span className="decor-blobs__b" />
    </div>
  );
}

/**
 * Loose blocks scattered around the hero, tilted, as though waiting to be
 * dropped into place. They borrow the four category hues, so the palette a
 * student will learn inside the editor is already on screen here.
 */
export function Chips() {
  return (
    <div className="decor-chips" aria-hidden="true">
      <span className="decor-chips__chip" data-hue="variable" />
      <span className="decor-chips__chip" data-hue="io" />
      <span className="decor-chips__chip" data-hue="conditional" />
      <span className="decor-chips__chip" data-hue="loop" />
    </div>
  );
}

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
