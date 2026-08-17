import { memo, useEffect, useRef, useState } from 'react';

import type { NodeId } from '../core/ast/types';
import type { ExecutionState } from '../core/runtime/types';
import { useTranslation } from '../i18n/context';
import type { ExecutionController, Speed } from '../state/useExecution';
import { Robot } from './Robot';
import type { RobotMood } from './Robot';
import './Stage.css';

interface StageProps {
  execution: ExecutionController;
  onSelectNode: (id: NodeId) => void;
}

/** Maps interpreter status onto the robot's expression. */
function moodFor(state: ExecutionState, isPlaying: boolean): RobotMood {
  if (state.status === 'error') return 'error';
  if (state.status === 'awaitingInput') return 'asking';
  if (state.status === 'finished') return 'done';
  if (state.status === 'running' || isPlaying) {
    // Speaking whenever the last thing that happened was output.
    const last = state.output[state.output.length - 1];
    return last?.kind === 'say' ? 'speaking' : 'thinking';
  }
  return 'idle';
}

export const Stage = memo(function Stage({ execution, onSelectNode }: StageProps) {
  const { d, t } = useTranslation();
  const { state, isPlaying } = execution;
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLOListElement>(null);

  const mood = moodFor(state, isPlaying);

  // Focus the answer field the moment the robot asks.
  useEffect(() => {
    if (state.status === 'awaitingInput') inputRef.current?.focus();
  }, [state.status]);

  // Keep the newest output visible.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [state.output.length]);

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

  const submitAnswer = (): void => {
    execution.answer(draft);
    setDraft('');
  };

  return (
    <section className="stage" aria-label={d.a11y.robotStage}>
      <div className="stage__robot">
        <Robot mood={mood} message={bubble} />

        {state.status === 'awaitingInput' && (
          <form
            className="stage__answer"
            onSubmit={(event) => {
              event.preventDefault();
              submitAnswer();
            }}
          >
            <input
              ref={inputRef}
              className="stage__answer-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={d.robot.answerPlaceholder}
              aria-label={d.console.inputLabel}
            />
            <button type="submit" className="stage__answer-send">
              {d.actions.send}
            </button>
          </form>
        )}
      </div>

      <Controls execution={execution} />

      <div className="stage__panels">
        {/* Variables sit beside the robot rather than below it: stacking every
            region vertically pushed the console off-screen entirely. */}
        <div className="stage__panel stage__panel--vars">
          <h3 className="stage__panel-title">{d.console.variablesTitle}</h3>
          {state.variables.length === 0 ? (
            <p className="stage__panel-empty">{d.console.variablesEmpty}</p>
          ) : (
            <ul className="stage__vars">
              {state.variables.map((variable) => (
                <li
                  key={variable.name}
                  className="stage__var"
                  data-changed={variable.justChanged || undefined}
                >
                  <span className="stage__var-name">{variable.name}</span>
                  <span className="stage__var-value" data-kind={variable.kind}>
                    {variable.kind === 'text' ? `"${variable.value}"` : String(variable.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="stage__panel stage__panel--console">
          <h3 className="stage__panel-title">{d.console.title}</h3>
          {state.output.length === 0 ? (
            <p className="stage__panel-empty">{d.console.empty}</p>
          ) : (
            <ol className="stage__log" ref={logRef}>
              {state.output.map((entry) => (
                <li
                  key={entry.id}
                  className="stage__log-entry"
                  data-kind={entry.kind}
                  data-clickable={entry.nodeId !== null || undefined}
                  onClick={() => entry.nodeId && onSelectNode(entry.nodeId)}
                >
                  <span className="stage__log-marker" aria-hidden="true" />
                  <span className="stage__log-text">
                    {entry.kind === 'error' ? t(entry.text) : entry.text}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
});

function Controls({ execution }: { execution: ExecutionController }) {
  const { d, fill } = useTranslation();
  const { state, isPlaying } = execution;
  const running = state.status === 'running' || state.status === 'awaitingInput';

  const statusText = (() => {
    if (state.status === 'error') return d.robot.error;
    if (state.status === 'finished') return d.runtime.finished;
    if (state.status === 'awaitingInput') return d.runtime.waitingInput;
    if (isPlaying) return d.runtime.running;
    if (state.stepCount > 0) return d.runtime.paused;
    return d.robot.idle;
  })();

  return (
    <div className="controls">
      <div className="controls__buttons">
        {isPlaying ? (
          <button type="button" className="controls__button" onClick={execution.pause}>
            {d.actions.pause}
          </button>
        ) : (
          <button
            type="button"
            className="controls__button controls__button--primary"
            onClick={execution.play}
            disabled={state.status === 'awaitingInput'}
          >
            {state.stepCount > 0 && state.status !== 'finished' && state.status !== 'error'
              ? d.actions.resume
              : d.actions.run}
          </button>
        )}

        <button
          type="button"
          className="controls__button"
          onClick={execution.stepOnce}
          disabled={isPlaying || state.status === 'awaitingInput'}
        >
          {d.actions.next}
        </button>

        <button
          type="button"
          className="controls__button"
          onClick={execution.stop}
          disabled={state.stepCount === 0 && !running}
        >
          {d.actions.reset}
        </button>
      </div>

      <div className="controls__meta">
        <span className="controls__status" data-status={state.status}>
          {statusText}
        </span>
        {/* Total steps are unknowable before running (loops depend on input),
            so the readout reports progress rather than a fraction. */}
        {state.stepCount > 0 && (
          <span className="controls__steps">
            {fill(d.runtime.stepCount, { count: state.stepCount })}
          </span>
        )}
      </div>

      <label className="controls__speed">
        <span className="sr-only">{d.runtime.speed}</span>
        <select
          value={execution.speed}
          onChange={(event) => execution.setSpeed(event.target.value as Speed)}
        >
          <option value="slow">{d.runtime.speedSlow}</option>
          <option value="normal">{d.runtime.speedNormal}</option>
          <option value="fast">{d.runtime.speedFast}</option>
        </select>
      </label>
    </div>
  );
}
