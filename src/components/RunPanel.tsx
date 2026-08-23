import {
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  BugBeetleIcon as BugBeetle,
  PauseIcon as Pause,
  PlayIcon as Play,
  SkipBackIcon as SkipBack,
  SkipForwardIcon as SkipForward,
  XIcon as X,
} from '@phosphor-icons/react';
import { memo, useEffect, useRef, useState } from 'react';

import type { ExecutionState } from '../core/runtime/types';
import { useTranslation } from '../i18n/context';
import type { ExecutionController, Speed } from '../state/useExecution';
import { Robot } from './Robot';
import type { RobotMood } from './Robot';
import './RunPanel.css';

interface RunPanelProps {
  execution: ExecutionController;
}

/** Maps interpreter status onto the robot's expression. */
function moodFor(state: ExecutionState, isPlaying: boolean): RobotMood {
  if (state.status === 'error') return 'error';
  if (state.status === 'awaitingInput') return 'asking';
  if (state.status === 'finished') return 'done';
  if (state.status === 'running' || isPlaying) {
    const last = state.output[state.output.length - 1];
    return last?.kind === 'say' ? 'speaking' : 'thinking';
  }
  return 'idle';
}

/**
 * The robot's home in the right rail. It is always present, so a student can
 * run at any moment without first summoning a panel, and the console keeps its
 * history between runs.
 */
export const RunPanel = memo(function RunPanel({ execution }: RunPanelProps) {
  const { d, t, fill } = useTranslation();
  const { state, isPlaying } = execution;
  const [draft, setDraft] = useState('');
  /* Stepping is a mode the student enters, not a state of the interpreter:
     they are walking the program and want to keep walking it. It ends when
     they leave it, or when a fresh run takes over. */
  const [stepping, setStepping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mood = moodFor(state, isPlaying);

  useEffect(() => {
    if (state.status === 'awaitingInput') inputRef.current?.focus();
  }, [state.status]);

  const lastSpoken = [...state.output].reverse().find((entry) => entry.kind === 'say');

  const bubble = (() => {
    if (state.status === 'error' && state.error) {
      return t(state.error.messageKey, state.error.vars);
    }
    if (state.status === 'awaitingInput') return state.pendingPrompt;
    if (state.status === 'idle') return d.robot.greeting;
    if (state.status === 'finished') return lastSpoken?.text ?? d.robot.done;
    return lastSpoken?.text ?? d.robot.thinking;
  })();

  const statusText = (() => {
    if (state.status === 'error') return d.robot.error;
    if (state.status === 'finished') return d.runtime.finished;
    if (state.status === 'awaitingInput') return d.runtime.waitingInput;
    if (isPlaying) return d.runtime.running;
    if (state.stepCount > 0) return d.runtime.paused;
    return d.robot.idle;
  })();

  const submitAnswer = (): void => {
    execution.answer(draft);
    setDraft('');
  };

  return (
    <section className="run-panel" aria-label={d.a11y.robotStage}>
      <header className="run-panel__bar">
        <span className="run-panel__status" data-status={state.status}>
          {statusText}
        </span>
        {state.stepCount > 0 && (
          <span className="run-panel__steps">
            {fill(d.runtime.stepCount, { count: state.stepCount })}
          </span>
        )}
      </header>

      <div className="run-panel__robot">
        <Robot mood={mood} message={bubble} />
      </div>

      {state.status === 'awaitingInput' && (
        <form
          className="run-panel__answer"
          onSubmit={(event) => {
            event.preventDefault();
            submitAnswer();
          }}
        >
          <input
            ref={inputRef}
            className="run-panel__answer-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={d.robot.answerPlaceholder}
            aria-label={d.console.inputLabel}
          />
          <button type="submit" className="run-panel__answer-send">
            {d.actions.send}
          </button>
        </form>
      )}

      {/*
        Two modes, one row. Running is a single decision — go or stop — while
        stepping is a position in the program, so it needs to move both ways.
        The controls cross-fade rather than swapping instantly: the buttons
        change meaning under the pointer, and a beat of motion is what says so.
      */}
      <div className="run-panel__controls" data-mode={stepping ? 'stepping' : 'running'}>
        {stepping ? (
          <>
            <button
              type="button"
              className="run-panel__button"
              onClick={execution.stepBack}
              disabled={!execution.canStepBack}
              title={d.actions.stepBack}
              aria-label={d.actions.stepBack}
            >
              <SkipBack weight="fill" />
            </button>
            <button
              type="button"
              className="run-panel__button run-panel__button--primary"
              onClick={execution.stepOnce}
              disabled={state.status === 'awaitingInput'}
              title={`${d.actions.next}: ${d.actions.stepOne}`}
              aria-label={d.actions.next}
            >
              <SkipForward weight="fill" />
            </button>
            <button
              type="button"
              className="run-panel__button run-panel__button--quiet"
              onClick={() => {
                execution.stop();
                setStepping(false);
              }}
              title={d.actions.exitStepping}
              aria-label={d.actions.exitStepping}
            >
              <X weight="bold" />
            </button>
          </>
        ) : (
          <>
            {isPlaying ? (
              <button
                type="button"
                className="run-panel__button run-panel__button--primary"
                onClick={execution.pause}
                title={d.actions.pause}
                aria-label={d.actions.pause}
              >
                <Pause weight="fill" />
              </button>
            ) : (
              <button
                type="button"
                className="run-panel__button run-panel__button--primary"
                onClick={execution.play}
                disabled={state.status === 'awaitingInput'}
                title={
                  state.stepCount > 0 && state.status !== 'finished' && state.status !== 'error'
                    ? d.actions.resume
                    : d.actions.run
                }
                aria-label={d.actions.run}
              >
                <Play weight="fill" />
              </button>
            )}
            <button
              type="button"
              className="run-panel__button"
              onClick={() => {
                setStepping(true);
                execution.stepOnce();
              }}
              disabled={isPlaying || state.status === 'awaitingInput'}
              title={`${d.actions.next}: ${d.actions.stepOne}`}
              aria-label={d.actions.next}
            >
              <BugBeetle weight="fill" />
            </button>

            {/*
              Start over, and the only way out of a run that is waiting for an
              answer. Stopping used to live inside step mode alone, so a
              continuous run could be paused but never abandoned — and a
              program sitting on `ask` had no exit at all short of reloading
              the page.

              Present only once something has happened: on an untouched
              program there is nothing to reset, and a permanently disabled
              button is just clutter.
            */}
            {state.stepCount > 0 && (
              <button
                type="button"
                className="run-panel__button run-panel__button--quiet"
                onClick={execution.stop}
                title={d.actions.reset}
                aria-label={d.actions.reset}
              >
                <ArrowCounterClockwise weight="bold" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Speed sits on its own line: inside the transport row it pulled the
          three buttons off the panel's centre line. */}
      <div className="run-panel__speed-row">
        <span className="run-panel__speed-label">{d.runtime.speed}</span>
        <div className="run-panel__segmented" role="radiogroup" aria-label={d.runtime.speed}>
          {(['slow', 'normal', 'fast'] as Speed[]).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={execution.speed === option}
              className="run-panel__segment"
              data-selected={execution.speed === option || undefined}
              onClick={() => execution.setSpeed(option)}
            >
              {option === 'slow'
                ? d.runtime.speedSlow
                : option === 'normal'
                  ? d.runtime.speedNormal
                  : d.runtime.speedFast}
            </button>
          ))}
        </div>
      </div>

    </section>
  );
});
