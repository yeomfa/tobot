import './BrandMark.css';

interface BrandMarkProps {
  /** Rendered size in pixels. The mark is drawn on a 32-unit grid. */
  size?: number;
  className?: string;
}

/**
 * Tobot's mark.
 *
 * Not a robot icon: a robot *built out of an algorithm*. The head is a rounded
 * square with an antenna, and the body below it is three stacked bars of
 * decreasing width — the statement blocks of the editor, read as a shape. The
 * two ideas the app is about are the same drawing, which is what a borrowed
 * robot glyph could never say.
 *
 * The bars carry the editor's own category hues (variable, output, loop) so
 * the mark and the canvas are visibly the same product, and the eyes are left
 * as holes rather than dots: at favicon size a filled eye closes up into a
 * blob, while a knocked-out one stays legible.
 *
 * One component, used by the header, the landing page, the sign-in screen and
 * the generated favicon, so the identity cannot drift between them.
 */
export function BrandMark({ size = 32, className }: BrandMarkProps) {
  return (
    <svg
      className={className ? `brand-mark ${className}` : 'brand-mark'}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Tobot"
    >
      {/* Antenna: the stalk reads as the "t" of the name at small sizes. */}
      <path
        className="brand-mark__antenna"
        d="M16 2.5v3.5"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle className="brand-mark__spark" cx="16" cy="2.6" r="1.9" />

      {/* Head. */}
      <rect className="brand-mark__head" x="5" y="6" width="22" height="13" rx="5" />
      <circle className="brand-mark__eye" cx="11.6" cy="12.5" r="2" />
      <circle className="brand-mark__eye" cx="20.4" cy="12.5" r="2" />

      {/* The algorithm the robot is made of: three statements, indented. */}
      <rect className="brand-mark__bar brand-mark__bar--1" x="5" y="21.4" width="22" height="3.1" rx="1.55" />
      <rect className="brand-mark__bar brand-mark__bar--2" x="8.6" y="26" width="18.4" height="3.1" rx="1.55" />
    </svg>
  );
}
