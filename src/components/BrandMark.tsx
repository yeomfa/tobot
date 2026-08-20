import './BrandMark.css';

/**
 * The shapes on offer while the identity is being chosen.
 *
 * `robot` is the head over two statement bars; `letter` builds the same robot
 * out of the T of the name, its crossbar becoming the head. Both are drawn on
 * the same 32-unit grid so they are interchangeable everywhere the mark
 * appears.
 */
export type BrandShape = 'robot' | 'letter';

/**
 * The accent that pairs with the orange.
 *
 * Purple and blue were the first attempt and the weakest: both are cool, both
 * compete with the orange for attention, and neither actually contrasts with
 * it. The rest are picked against the orange rather than against each other.
 */
export type BrandPalette = 'cool' | 'warm' | 'teal' | 'neutral';

interface BrandMarkProps {
  /** Rendered size in pixels. The mark is drawn on a 32-unit grid. */
  size?: number;
  shape?: BrandShape;
  palette?: BrandPalette;
  className?: string;
}

/**
 * Tobot's mark.
 *
 * Not a robot icon: a robot *built out of an algorithm*. In the `robot` shape
 * the head sits over two stacked bars — the statement blocks of the editor,
 * read as a shape — and in the `letter` shape the T of the name is the robot
 * itself. Either way the two ideas the app is about are the same drawing,
 * which is what a borrowed robot glyph could never say.
 *
 * One component, used by the header, the landing page, the sign-in screen and
 * the generated favicon, so the identity cannot drift between them.
 */
export function BrandMark({
  size = 32,
  shape = 'robot',
  palette = 'teal',
  className,
}: BrandMarkProps) {
  const classes = ['brand-mark', `brand-mark--${palette}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Tobot"
    >
      {shape === 'letter' ? (
        <>
          {/* The T of the name, read as a robot: the crossbar is the head and
              the stem is the body standing under it. */}
          <path className="brand-mark__antenna" d="M16 1.7v2.6" strokeWidth="1.9" strokeLinecap="round" />
          <circle className="brand-mark__spark" cx="16" cy="1.9" r="1.6" />
          <rect className="brand-mark__head brand-mark__head--solid" x="3.5" y="5.2" width="25" height="12.4" rx="4.4" />
          <circle className="brand-mark__pupil" cx="11.4" cy="11.4" r="2.15" />
          <circle className="brand-mark__pupil" cx="20.6" cy="11.4" r="2.15" />
          <rect className="brand-mark__stem" x="12.1" y="17.6" width="7.8" height="12.5" rx="2.4" />
        </>
      ) : (
        <>
          {/* Antenna: the stalk reads as the "t" of the name at small sizes. */}
          <path className="brand-mark__antenna" d="M16 2.5v3.5" strokeWidth="2" strokeLinecap="round" />
          <circle className="brand-mark__spark" cx="16" cy="2.6" r="1.9" />

          <rect className="brand-mark__head" x="5" y="6" width="22" height="13" rx="5" />
          <circle className="brand-mark__eye" cx="11.6" cy="12.5" r="2" />
          <circle className="brand-mark__eye" cx="20.4" cy="12.5" r="2" />

          {/* The algorithm the robot is made of: two statements, indented. */}
          <rect className="brand-mark__bar brand-mark__bar--1" x="5" y="21.4" width="22" height="3.1" rx="1.55" />
          <rect className="brand-mark__bar brand-mark__bar--2" x="8.6" y="26" width="18.4" height="3.1" rx="1.55" />
        </>
      )}
    </svg>
  );
}
