import { useMemo } from 'react';

import './Starfield.css';

interface StarfieldProps {
  /** How many stars. Enough to feel deep, few enough to stay quiet. */
  count?: number;
  /** Adds the dawn glow along the bottom edge. */
  dawn?: boolean;
  /** Fixes the arrangement, so two fields on one page do not match. */
  seed?: number;
}

/**
 * A small deterministic generator.
 *
 * `Math.random` would rearrange the sky on every render, which is a form of
 * motion nobody asked for. A seed makes each field stable for the life of the
 * page and different from its neighbours.
 */
function shuffled(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

/**
 * A night sky behind a dark band.
 *
 * It replaces a CSS dot grid, which was regular enough to read as graph paper:
 * every dot the same size, the same distance apart, in rows. Stars are not
 * arranged in rows, and the eye notices immediately.
 *
 * Static, like every other decoration here — a twinkling field would be a
 * second thing moving on a page whose one moving thing is the demonstration.
 * Depth comes from varying size and brightness instead.
 */
export function Starfield({ count = 80, dawn = false, seed = 1 }: StarfieldProps) {
  const stars = useMemo(() => {
    const next = shuffled(seed);
    return Array.from({ length: count }, () => {
      const depth = next();
      return {
        x: next() * 100,
        y: next() * 100,
        // Distant stars are small and dim, near ones large and bright: the
        // correlation is what makes a flat plane read as depth.
        size: 0.8 + depth * 2.1,
        opacity: 0.16 + depth * 0.72,
      };
    });
  }, [count, seed]);

  return (
    <div className="starfield" aria-hidden="true">
      {stars.map((star, index) => (
        <span
          className="starfield__star"
          key={index}
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
          }}
        />
      ))}
      {dawn && <span className="starfield__dawn" />}
    </div>
  );
}
