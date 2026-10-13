import './BrandMark.css';

interface BrandMarkProps {
  /** Rendered size in pixels. The mark is drawn on a 32-unit grid. */
  size?: number;
  className?: string;
}

/**
 * Tobot's mark.
 *
 * A robot made of an algorithm: the head *is* a statement block — the notch-
 * less top, the tab hanging from its bottom edge — and it snaps into the block
 * below, which is its body. Robot and code are the same shape, which is the
 * whole idea of the app in two pieces.
 *
 * The face is the character's: a dark navy visor with two cyan pill eyes and
 * an orange antenna, so the mark is the Tobot of the illustrations reduced to
 * its minimum rather than a separate drawing.
 *
 * On a dark background the navy head would sink into it, so it carries a rim
 * whose colour comes from the theme (`--brand-mark-rim`), transparent on light.
 *
 * One component, used by the header, the landing page and the sign-in screen;
 * `public/favicon.svg` and the PNG icons are drawn from the same geometry.
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
      <path className="brand-mark__antenna" d="M16 3.8V6.6" strokeWidth="1.8" strokeLinecap="round" />
      <circle className="brand-mark__spark" cx="16" cy="3" r="2.3" />

      {/* The head: a statement block, its tab reaching into the block below. */}
      <path
        className="brand-mark__head"
        d="M7.2 6.6H24.8Q28 6.6 28 9.8V16.2Q28 19.4 24.8 19.4H14.2l-1.3 1.7H10.3l-1.3-1.7H7.2Q4 19.4 4 16.2V9.8Q4 6.6 7.2 6.6Z"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect className="brand-mark__eye" x="11.2" y="9.6" width="2.8" height="6.6" rx="1.4" />
      <rect className="brand-mark__eye" x="18" y="9.6" width="2.8" height="6.6" rx="1.4" />

      {/* The body: the next statement, notched to take the head's tab. */}
      <path
        className="brand-mark__body"
        d="M6.6 22H9l1.3 1.7H12.9l1.3-1.7H25.4Q28 22 28 24.6V26.8Q28 29.4 25.4 29.4H6.6Q4 29.4 4 26.8V24.6Q4 22 6.6 22Z"
      />
    </svg>
  );
}
