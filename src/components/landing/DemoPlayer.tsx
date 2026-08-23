import {
  CaretLeftIcon as CaretLeft,
  CaretRightIcon as CaretRight,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '../../i18n/context';
import { BlockPreview } from './BlockPreview';
import type { Demo } from '../../content/landingDemo';
import './DemoPlayer.css';

interface DemoPlayerProps {
  demo: Demo;
  /** Milliseconds each step holds. Slower where there is more to read. */
  pace?: number;
  /** Reports the current step, so anything outside can follow along. */
  onStep?: (says: string | null, index: number) => void;
}

/**
 * Plays a demonstration, and hands over control to anyone who reaches for it.
 *
 * It runs by itself, because a visitor who has to press something mostly does
 * not. But the moment the pointer arrives it stops and offers arrows: someone
 * leaning in is reading, and the worst thing a demonstration can do is move
 * on while they are still on the previous line.
 *
 * It also stops off screen and on a hidden tab. Between the three, it only
 * ever animates for someone who is actually looking at it.
 */
export function DemoPlayer({ demo, pace = 1800, onStep }: DemoPlayerProps) {
  const { d } = useTranslation();
  const [index, setIndex] = useState(0);
  const [engaged, setEngaged] = useState(false);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const step = demo.steps[index] ?? demo.steps[0];

  useEffect(() => {
    onStep?.(step?.says ?? null, index);
  }, [step, index, onStep]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    let onScreen = false;
    const sync = (): void => setVisible(onScreen && document.visibilityState !== 'hidden');

    const observer = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        sync();
      },
      { threshold: 0.35 },
    );
    observer.observe(element);
    document.addEventListener('visibilitychange', sync);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  /* One timer, and only while nobody has taken over. */
  useEffect(() => {
    if (reduced || engaged || !visible) return;
    const timer = window.setTimeout(
      () => setIndex((current) => (current + 1) % demo.steps.length),
      pace,
    );
    return () => window.clearTimeout(timer);
  }, [index, engaged, visible, reduced, pace, demo.steps.length]);

  const move = useCallback(
    (delta: number) => {
      setIndex((current) => (current + delta + demo.steps.length) % demo.steps.length);
    },
    [demo.steps.length],
  );

  return (
    <div
      className="demo-player"
      ref={rootRef}
      data-engaged={engaged || undefined}
      onPointerEnter={() => setEngaged(true)}
      onPointerLeave={() => setEngaged(false)}
      onFocusCapture={() => setEngaged(true)}
      onBlurCapture={() => setEngaged(false)}
    >
      <div className="demo-player__blocks">
        {demo.blocks.map((block) => (
          <BlockPreview
            block={block}
            key={block.id}
            active={
              // A parent stays lit while one of its children is running, which
              // is how the editor shows you where you are inside a loop.
              step?.activeId === block.id ||
              (block.children?.some((child) => child.id === step?.activeId) ?? false)
            }
          />
        ))}
      </div>

      {/* Appears under the pointer, so at rest the demo is just the blocks. */}
      <div className="demo-player__controls" aria-hidden={!engaged}>
        <button
          type="button"
          className="demo-player__button"
          onClick={() => move(-1)}
          tabIndex={engaged ? 0 : -1}
          aria-label={d.actions.stepBack}
        >
          <CaretLeft weight="bold" />
        </button>

        <span className="demo-player__dots">
          {demo.steps.map((_, dot) => (
            <span className="demo-player__dot" data-on={dot === index || undefined} key={dot} />
          ))}
        </span>

        <button
          type="button"
          className="demo-player__button"
          onClick={() => move(1)}
          tabIndex={engaged ? 0 : -1}
          aria-label={d.actions.next}
        >
          <CaretRight weight="bold" />
        </button>
      </div>
    </div>
  );
}
