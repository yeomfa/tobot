import { useTranslation } from '../i18n/context';
import './Skeleton.css';

interface SkeletonProps {
  /**
   * The widths of the bars to draw, as CSS lengths or percentages, in order.
   * Shape rather than a spinner: a skeleton is worth more than a spinner only
   * because it is laid out like the thing that is coming, so nothing jumps
   * when the real content replaces it.
   */
  lines: string[];
  /** Taller bars for headings, so the shape reads as content and not as bars. */
  tall?: boolean;
}

/**
 * One block of placeholder content.
 *
 * Extracted from the library, which is where the reasoning was earned: every
 * other view either showed a blank, an empty box, or nothing at all, and each
 * had reinvented its own answer. One component means one answer, including the
 * parts that are easy to forget — the grace period, the announcement, and what
 * happens when motion is turned off.
 */
export function Skeleton({ lines, tall }: SkeletonProps) {
  return (
    <div className="skeleton" data-tall={tall || undefined} aria-hidden="true">
      {lines.map((width, index) => (
        <span key={index} className="skeleton__line" style={{ width }} />
      ))}
    </div>
  );
}

interface LoadingProps {
  /** How many blocks to draw, for a view that is about to be a list. */
  count?: number;
  lines: string[];
  tall?: boolean;
  /** What a screen reader is told, since the bars say nothing to it. */
  label?: string;
  className?: string;
}

/** A group of skeletons, announced once rather than once per block. */
export function Loading({ count = 3, lines, tall, label, className }: LoadingProps) {
  const { d } = useTranslation();

  return (
    <div className={className} aria-busy="true" aria-live="polite">
      <span className="skeleton__sr">{label ?? d.library.loading}</span>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} lines={lines} tall={tall} />
      ))}
    </div>
  );
}
