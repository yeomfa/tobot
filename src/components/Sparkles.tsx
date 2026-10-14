import { useMemo } from 'react';

import { shuffled } from './seeded';
import './Sparkles.css';

interface SparklesProps {
  /** How many. A handful: these are an accent, not a sky. */
  count?: number;
  /** Fixes the arrangement, so two clusters on one page do not match. */
  seed?: number;
  /** Positions the cluster; by default it fills its positioned parent. */
  className?: string;
}

/**
 * The four-point sparkles the illustrations scatter around Tobot, so the
 * interface around a drawing speaks the drawing's language.
 *
 * Each twinkles slowly and out of step with the others; under reduced motion
 * they hold still. Decorative and inert to the pointer.
 */
export function Sparkles({ count = 8, seed = 1, className }: SparklesProps) {
  const sparkles = useMemo(() => {
    const next = shuffled(seed);
    return Array.from({ length: count }, () => ({
      x: 4 + next() * 92,
      y: 6 + next() * 88,
      size: 6 + next() * 12,
      delay: next() * -6,
      duration: 4 + next() * 4,
    }));
  }, [count, seed]);

  return (
    <div className={className ? `sparkles ${className}` : 'sparkles'} aria-hidden="true">
      {sparkles.map((sparkle, index) => (
        <svg
          className="sparkles__star"
          key={index}
          viewBox="0 0 24 24"
          focusable="false"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            width: `${sparkle.size}px`,
            height: `${sparkle.size}px`,
            animationDelay: `${sparkle.delay}s`,
            animationDuration: `${sparkle.duration}s`,
          }}
        >
          <path d="M12 0c1 8 4 11 12 12-8 1-11 4-12 12-1-8-4-11-12-12 8-1 11-4 12-12z" />
        </svg>
      ))}
    </div>
  );
}
