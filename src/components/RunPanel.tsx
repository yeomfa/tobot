import { memo, useEffect, useRef, useState } from 'react';

import type { NodeId } from '../core/ast/types';
import type { ExecutionState } from '../core/runtime/types';
import { useTranslation } from '../i18n/context';
import type { ExecutionController, Speed } from '../state/useExecution';
import { Robot } from './Robot';
import type { RobotMood } from './Robot';
import './RunPanel.css';

interface RunPanelProps {
  execution: ExecutionController;
  onSelectNode: (id: NodeId) => void;
  onClose: () => void;
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
 * The robot floats over the canvas instead of owning a docked column.
 *
 * Execution is a temporary activity, so it borrows screen space only while it
 * is happening — the algorithm stays visible behind it with the active step
 * highlighted, which is the pairing that actually teaches.
 */
export const RunPanel = memo(function RunPanel({
  execution,
  onSelectNode,
  onClose,
}: RunPanelProps) {
  const { d, t, fill } = useTranslation();
  const { state, isPlaying } = execution;
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLOListElement>(null);

  const mood = moodFor(state, isPlaying);

  useEffect(() => {
    if (state.status === 'awaitingInput') inputRef.current?.focus();
  }, [state.status]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [state.output.length]);

  // Output beyond the first couple of lines is worth showing automatically.
  useEffect(() => {
    if (state.output.length > 2) setExpanded(true);
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
    <section className="run-panel" data-expanded={expanded || undefined} aria-label={d.a11y.robotStage}>
      <header className="run-panel__bar">
        <span className="run-panel__status" data-status={state.status}>
          {statusText}
        </span>
        {state.stepCount > 0 && (
          <span className="run-panel__steps">
            {fill(d.runtime.stepCount, { count: state.stepCount })}
          </span>
        )}
        <button
          type="button"
          className="run-panel__icon-button"
          onClick={() => setExpanded((open) => !open)}
          aria-label={expanded ? d.palette.collapse : d.palette.expand}
          aria-expanded={expanded}
        >
          {expanded ? '▾' : '▴'}
        </button>
        <button
          type="button"
          className="run-panel__icon-button"
          onClick={onClose}
          aria-label={d.actions.close}
        >
          ×
        </button>
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

      <div className="run-panel__controls">
        {isPlaying ? (
          <button type="button" className="run-panel__button" onClick={execution.pause}>
            {d.actions.pause}
          </button>
        ) : (
          <button
            type="button"
            className="run-panel__button run-panel__button--primary"
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
          className="run-panel__button"
          onClick={execution.stepOnce}
          disabled={isPlaying || state.status === 'awaitingInput'}
        >
          {d.actions.next}
        </button>
        <button
          type="button"
          className="run-panel__button"
          onClick={execution.stop}
          disabled={state.stepCount === 0}
        >
          {d.actions.reset}
        </button>
        <select
          className="run-panel__speed"
          value={execution.speed}
          onChange={(event) => execution.setSpeed(event.target.value as Speed)}
          aria-label={d.runtime.speed}
        >
          <option value="slow">{d.runtime.speedSlow}</option>
          <option value="normal">{d.runtime.speedNormal}</option>
          <option value="fast">{d.runtime.speedFast}</option>
        </select>
      </div>

      {/* Output and variables only take space once there is something to show. */}
      {expanded && (
        <div className="run-panel__details">
          {state.variables.length > 0 && (
            <ul className="run-panel__vars">
              {state.variables.map((variable) => (
                <li
                  key={variable.name}
                  className="run-panel__var"
                  data-changed={variable.justChanged || undefined}
                >
                  <span className="run-panel__var-name">{variable.name}</span>
                  <span className="run-panel__var-value" data-kind={variable.kind}>
                    {variable.kind === 'text' ? `"${variable.value}"` : String(variable.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {state.output.length > 0 && (
            <ol className="run-panel__log" ref={logRef}>
              {state.output.map((entry) => (
                <li
                  key={entry.id}
                  className="run-panel__log-entry"
                  data-kind={entry.kind}
                  data-clickable={entry.nodeId !== null || undefined}
                  onClick={() => entry.nodeId && onSelectNode(entry.nodeId)}
                >
                  <span className="run-panel__log-marker" aria-hidden="true" />
                  <span className="run-panel__log-text">
                    {entry.kind === 'error' ? t(entry.text) : entry.text}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
});
