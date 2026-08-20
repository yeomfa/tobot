import './BrandMark.css';

interface BrandMarkProps {
  /** Rendered size in pixels. The mark is drawn on a 32-unit grid. */
  size?: number;
  className?: string;
}

/**
 * Tobot's mark: the T of the name, read as a robot.
 *
 * The crossbar of the T is the head and the stem is the body standing under
 * it, so the letter and the character are one drawing rather than a robot
 * glyph placed next to a wordmark. The antenna doubles as the T's ascender.
 *
 * Teal against the orange because it is the orange's actual complement: the
 * first attempt paired it with purple and blue, two cool colours that competed
 * with the orange without ever contrasting against it. Teal also survives
 * best at 16px, which is the size that decides whether a mark works at all.
 *
 * One component, used by the header, the landing page, the sign-in screen and
 * the favicon, so the identity cannot drift between them.
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
      <path
        className="brand-mark__antenna"
        d="M16 1.7v2.6"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle className="brand-mark__spark" cx="16" cy="1.9" r="1.6" />

      {/* The crossbar: the head. */}
      <rect className="brand-mark__head" x="3.5" y="5.2" width="25" height="12.4" rx="4.4" />
      {/* Knocked out of the solid head — a filled eye on a filled head
          disappears entirely at favicon size. */}
      <circle className="brand-mark__pupil" cx="11.4" cy="11.4" r="2.15" />
      <circle className="brand-mark__pupil" cx="20.6" cy="11.4" r="2.15" />

      {/* The stem: the body. */}
      <rect className="brand-mark__stem" x="12.1" y="17.6" width="7.8" height="12.5" rx="2.4" />
    </svg>
  );
}
