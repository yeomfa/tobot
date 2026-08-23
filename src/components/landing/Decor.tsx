import {
  ArrowsClockwiseIcon as ArrowsClockwise,
  ArrowsSplitIcon as ArrowsSplit,
  ChatCircleTextIcon as ChatCircleText,
  ListNumbersIcon as ListNumbers,
  PencilSimpleIcon as PencilSimple,
  QuestionIcon as Question,
  RepeatIcon as Repeat,
  TagIcon as Tag,
} from '@phosphor-icons/react';

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
 * Loose blocks scattered around the hero, tilted at different angles and
 * sizes, as though waiting to be dropped into place.
 *
 * Each carries the icon the editor gives that kind of statement, so they are
 * recognisable as blocks rather than as coloured rectangles — and a student
 * who scrolls down to the palette meets the same eight shapes again.
 */
const FLOATING = [
  { hue: 'variable', icon: Tag, size: 'lg' },
  { hue: 'io', icon: ChatCircleText, size: 'md' },
  { hue: 'conditional', icon: ArrowsSplit, size: 'sm' },
  { hue: 'loop', icon: Repeat, size: 'md' },
  { hue: 'io', icon: Question, size: 'sm' },
  { hue: 'loop', icon: ListNumbers, size: 'lg' },
  { hue: 'variable', icon: PencilSimple, size: 'sm' },
  { hue: 'conditional', icon: ArrowsClockwise, size: 'md' },
] as const;

export function Chips() {
  return (
    <div className="decor-chips" aria-hidden="true">
      {FLOATING.map(({ hue, icon: Icon, size }, index) => (
        <span className="decor-chips__chip" data-hue={hue} data-size={size} key={index}>
          <Icon weight="duotone" />
        </span>
      ))}
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
