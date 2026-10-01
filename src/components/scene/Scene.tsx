import { useEffect, useMemo, useRef, useState } from 'react';

import type { WorldComponent, WorldDefinition, WorldState } from '../../core/world/types';
import { createWorld, valuesAt } from '../../core/world/world';
import { useTranslation } from '../../i18n/context';
import { layoutScene } from './layout';
import { Part } from './Part';
import './Scene.css';

interface SceneProps {
  definition: WorldDefinition;
  /** The world as the run left it, or null before anything has run. */
  world: WorldState | null;
  /** How the inputs start, set by hand before running. */
  inputs: Record<string, boolean>;
  /** Null while a run is under way: changing the scenario mid-run would make
      the run depend on when the student clicked, and it must not. */
  onToggle: ((id: string) => void) | null;
  /**
   * Replay the run at the pace of its own clock.
   *
   * Code finishes in an instant, so a sequence of two motors three seconds
   * apart would only ever be seen at its end. Blocks are already paced by the
   * step timer and are shown as they stand.
   */
  playback: boolean;
}

/** One world second, in real milliseconds. Real time: `esperar(3)` takes three. */
const SECOND_MS = 1000;

function prefersLessMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The time on the scene's clock, chasing the world's own.
 *
 * Advances in real time towards wherever the run has got to, and starts again
 * from zero when a new run does. With reduced motion it simply is the world's
 * time: the end state, at once, which is all the information without the
 * movement.
 */
function usePlayback(world: WorldState | null, enabled: boolean): number {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const target = world?.time ?? 0;

  useEffect(() => {
    if (!enabled || prefersLessMotion()) return;
    // A new run: its clock is behind the one on screen.
    if (target < shownRef.current) {
      shownRef.current = 0;
      setShown(0);
    }
    if (shownRef.current >= target) return;

    let frame = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      const next = Math.min(target, shownRef.current + (now - last) / SECOND_MS);
      last = now;
      shownRef.current = next;
      setShown(next);
      if (next < target) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled]);

  return !enabled || prefersLessMotion() ? target : Math.min(shown, target);
}

/**
 * The world a program acts on, drawn as a panel.
 *
 * In the rail beside the robot rather than in a canvas tab: the tabs are the
 * same program drawn differently, while this is what the program *does* —
 * which is what the rail already holds — and a tab would hide the blocks at
 * exactly the moment a student needs to watch the highlight move.
 */
export function Scene({ definition, world, inputs, onToggle, playback }: SceneProps) {
  const { d, fill } = useTranslation();
  const layout = useMemo(() => layoutScene(definition), [definition]);
  const preview = useMemo(() => createWorld(definition, { inputs }), [definition, inputs]);
  const shownWorld = world ?? preview;
  const time = usePlayback(world, playback);
  const values = playback && world ? valuesAt(world, time) : shownWorld.values;
  const clock = playback && world ? time : shownWorld.time;
  /* Code has already finished by the time the scene starts to move, so the
     robot says "done" while the motor is still running on screen. Said here,
     so the two do not seem to disagree. */
  const replaying = playback && world !== null && time < world.time;
  const ended = clock >= definition.duration;

  const describeState = (part: WorldComponent, on: boolean): string =>
    part.role === 'input'
      ? on
        ? d.scene.active
        : d.scene.inactive
      : on
        ? d.scene.on
        : d.scene.off;

  const tile = (part: WorldComponent) => {
    const on = values[part.id] ?? false;
    const body = (
      <>
        <Part skin={part.skin} />
        <span className="scene__label">{part.label}</span>
        <code className="scene__id">"{part.id}"</code>
      </>
    );
    return part.role === 'input' && onToggle ? (
      <button
        key={part.id}
        type="button"
        className="scene__part"
        data-skin={part.skin}
        data-state={on ? 'on' : 'off'}
        aria-pressed={on}
        title={d.scene.toggle}
        onClick={() => onToggle(part.id)}
      >
        {body}
      </button>
    ) : (
      <div
        key={part.id}
        className="scene__part"
        data-skin={part.skin}
        data-state={on ? 'on' : 'off'}
        role="img"
        aria-label={`${part.label}: ${describeState(part, on)}`}
      >
        {body}
      </div>
    );
  };

  return (
    <section className="scene" aria-label={d.scene.label}>
      <div className="scene__head">
        <h2>
          {d.scene.label}
          {replaying && <span className="scene__replay">{d.scene.replaying}</span>}
        </h2>
        <span className="scene__clock" data-ended={ended || undefined}>
          {fill(d.scene.clock, {
            now: clock.toFixed(1).replace(/\.0$/, ''),
            total: definition.duration,
          })}
        </span>
      </div>
      <div className="scene__progress" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (clock / definition.duration) * 100)}%` }} />
      </div>

      <div className="scene__board">
        {layout.inputs.length > 0 && (
          <div className="scene__column">
            <h3>{d.scene.inputs}</h3>
            <div className="scene__parts">{layout.inputs.map(tile)}</div>
          </div>
        )}
        <div className="scene__column">
          <h3>{d.scene.outputs}</h3>
          <div className="scene__parts">{layout.outputs.map(tile)}</div>
        </div>
      </div>

      {onToggle && layout.inputs.length > 0 && <p className="scene__hint">{d.scene.hint}</p>}
    </section>
  );
}
