import { useEffect, useMemo, useRef, useState } from 'react';

import { heroAlgorithm } from '../../content/heroDemo';
import { useTranslation } from '../../i18n/context';
import { useExecution } from '../../state/useExecution';
import { StatementBlock } from '../StatementBlock';
import type { BlockCallbacks } from '../StatementBlock';
import { BrowserFrame } from './BrowserFrame';
import { RobotGreeting } from './RobotGreeting';
import './HeroStage.css';

/** Nothing here is editable, so every callback is deliberately inert. */
const INERT: BlockCallbacks = {
  update: () => {},
  remove: () => {},
  add: () => {},
  move: () => {},
  onExplain: () => {},
};

/**
 * The five phases of one demonstration, and how long each lasts.
 *
 * `running` has no duration: it ends when the interpreter says it has
 * finished, which is the only honest way to time something whose length
 * depends on the program.
 */
type Phase = 'assembling' | 'settling' | 'running' | 'celebrating' | 'resetting';

const BLOCK_MS = 520;
const SETTLE_MS = 700;
const CELEBRATE_MS = 2400;
const RESET_MS = 420;

/**
 * The hero's demonstration: an algorithm that builds itself, runs itself, and
 * starts over.
 *
 * These are the editor's own `StatementBlock`s and its own interpreter, not a
 * recreation of them. A screenshot goes stale the moment the editor changes —
 * that already happened here once — and a hand-drawn imitation goes stale
 * silently, which is worse.
 *
 * The whole design is arranged around not startling anyone:
 *
 * - **One timer.** A single phase advances at a time, so nothing races.
 * - **The height never collapses.** It is measured once the algorithm is
 *   complete and held from then on, so the page below never jumps as blocks
 *   arrive or leave.
 * - **The reset fades the group**, not seven blocks individually: one moving
 *   thing rather than seven.
 * - **It stops when nobody is watching** — off screen, on another tab, or
 *   while the pointer rests on it. Someone leaning in to read a block should
 *   not have it vanish mid-sentence.
 */
export function HeroStage() {
  const { d, language } = useTranslation();

  // Memoised on language alone. `useExecution` throws away its interpreter
  // whenever the program's identity changes, so rebuilding this every render
  // would restart the run every render.
  const algorithm = useMemo(() => heroAlgorithm(language), [language]);
  const execution = useExecution(algorithm.body);

  const [phase, setPhase] = useState<Phase>('assembling');
  const [shown, setShown] = useState(0);
  const [paused, setPaused] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [minHeight, setMinHeight] = useState<number | null>(null);

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /*
   * Pausing, from three sources that mean the same thing: nobody is watching,
   * or someone is reading. They share one flag so they cannot contradict.
   */
  useEffect(() => {
    if (reduced) return;
    const element = stageRef.current;
    if (!element) return;

    let onScreen = true;
    const sync = (): void => setPaused(!onScreen || document.visibilityState === 'hidden');

    const observer = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        sync();
      },
      { threshold: 0.3 },
    );
    observer.observe(element);
    document.addEventListener('visibilitychange', sync);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [reduced]);

  /*
   * The phase machine. Every branch schedules exactly one timer, and the
   * cleanup clears it, so a pause or an unmount can never leave one running.
   */
  useEffect(() => {
    if (reduced || paused) return;

    if (phase === 'assembling') {
      if (shown >= algorithm.body.length) {
        const timer = window.setTimeout(() => setPhase('settling'), BLOCK_MS);
        return () => window.clearTimeout(timer);
      }
      const timer = window.setTimeout(() => setShown((count) => count + 1), BLOCK_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'settling') {
      const timer = window.setTimeout(() => setPhase('running'), SETTLE_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'celebrating') {
      const timer = window.setTimeout(() => setPhase('resetting'), CELEBRATE_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'resetting') {
      const timer = window.setTimeout(() => {
        setShown(0);
        setPhase('assembling');
      }, RESET_MS);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [phase, shown, paused, reduced, algorithm.body.length]);

  /* Starting and ending the run are separate from the phase timings, because
     how long a program takes is the interpreter's business, not ours. The
     editor's default pace is 800ms a step, which is right when a student is
     following along and far too slow for a loop nobody asked to watch: at that
     speed one demonstration runs for seven seconds. */
  useEffect(() => {
    if (reduced) return;

    if (phase === 'running') {
      // The interpreter runs on a timer of its own, which knows nothing about
      // the pause flag — so pausing has to be told to it directly, or a
      // backgrounded tab would keep stepping through the program unseen.
      if (paused) execution.pause();
      else {
        execution.setSpeed('fast');
        execution.play();
      }
    }

    if (phase === 'resetting') execution.stop();
    // `execution` is a fresh object each render; depending on it would restart
    // the run continuously. The phase is what should drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, reduced]);

  useEffect(() => {
    if (phase === 'running' && execution.state.status === 'finished') {
      setPhase('celebrating');
    }
  }, [phase, execution.state.status]);

  /*
   * The height is measured once the algorithm is complete and held from then
   * on, so the page below never moves as blocks arrive or leave.
   *
   * Measured on the canvas rather than the list because the canvas is what
   * carries the padding, and it is the canvas the floor is applied to —
   * measuring one box and constraining another leaves exactly that padding as
   * a gap. Taken in `settling` rather than the moment the last block mounts,
   * because the entrance animation is still running then and the box has not
   * reached its resting size.
   */
  useEffect(() => {
    if (minHeight !== null || phase !== 'settling') return;
    const height = canvasRef.current?.getBoundingClientRect().height;
    if (height) setMinHeight(height);
  }, [phase, minHeight]);

  /* Under reduced motion there is no demonstration, just the finished
     algorithm — which is the thing being demonstrated anyway. */
  useEffect(() => {
    if (reduced) setShown(algorithm.body.length);
  }, [reduced, algorithm.body.length]);

  const spoken = execution.state.output.at(-1)?.text ?? null;
  const mood =
    reduced || phase === 'settling'
      ? 'speaking'
      : phase === 'assembling'
        ? 'thinking'
        : phase === 'running'
          ? 'speaking'
          : phase === 'celebrating'
            ? 'done'
            : 'idle';

  const message =
    reduced || phase === 'settling'
      ? d.landing.robotHello
      : phase === 'running'
        ? (spoken ?? d.landing.robotHello)
        : phase === 'celebrating'
          ? d.landing.robotDone
          : null;

  return (
    <div
      className="hero-stage"
      ref={stageRef}
      data-phase={phase}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <BrowserFrame url="tobot.app/app" tilt>
        <div
          className="hero-stage__canvas"
          ref={canvasRef}
          style={minHeight ? { minHeight } : undefined}
        >
          {/* Decorative: the same algorithm is written out in the section
              below, where it can be read properly. */}
          <ul className="hero-stage__list" aria-hidden="true">
            {algorithm.body.slice(0, shown).map((statement) => (
              <li className="hero-stage__block" key={statement.id}>
                <StatementBlock
                  statement={statement}
                  variables={['nombre', 'puntos', 'i']}
                  problems={new Map()}
                  callbacks={INERT}
                  isActive={phase === 'running' && execution.state.currentNodeId === statement.id}
                  isErrored={false}
                  activeNodeId={execution.state.currentNodeId}
                  erroredNodeId={null}
                  depth={0}
                />
              </li>
            ))}
          </ul>
        </div>
      </BrowserFrame>

      <div className="hero-stage__robot">
        <RobotGreeting mood={mood} message={message} follow size="lg" />
      </div>
    </div>
  );
}
