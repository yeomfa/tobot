import { useEffect, useRef, useState } from 'react';
import './Reveal.css';

interface RevealProps {
  /** Milliseconds to stagger this one behind its neighbours. */
  delay?: number;
  children: React.ReactNode;
}

/**
 * Reveals its children the first time they reach the viewport.
 *
 * Once, not every time: content that re-animates on the way back up draws
 * attention to the animation rather than to itself. Under
 * `prefers-reduced-motion` the CSS shows everything outright, so the observer
 * here only ever flips a flag — nothing depends on it having run.
 */
export function Reveal({ delay = 0, children }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || shown) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      // A little before the edge, so the motion finishes as it arrives rather
      // than starting once it is already being read.
      { rootMargin: '0px 0px -10% 0px' },
    );

    observer.observe(element);

    /*
      A jump straight to the bottom — the End key, a fragment link — can pass
      an element without the observer ever reporting it. Nothing on this page
      may stay invisible because an animation missed its cue, so anything
      already in view after a beat is shown regardless.
    */
    const failsafe = window.setTimeout(() => {
      const box = element.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) setShown(true);
    }, 600);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [shown]);

  return (
    <div
      ref={ref}
      className="reveal"
      data-shown={shown || undefined}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
