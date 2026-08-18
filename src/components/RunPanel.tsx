import {
  ArrowCounterClockwise,
  CaretDown,
  Pause,
  Play,
  Steps,
} from '@phosphor-icons/react';
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
  /** Opens the console tab in the bottom drawer, where the full log lives. */
  onShowConsole: () => void;
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
export const RunPanel = memo(function RunPanel({
  execution,
  onSelectNode,
  onShowConsole,
}: RunPanelProps) {
  const { d, t, fill } = useTranslation();
  const { state, isPlaying } = execution;
  const [draft, setDraft] = useState('');
  /** The output section starts closed and opens on the first line of output. */
  const [outputOpen, setOutputOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mood = moodFor(state, isPlaying);

  useEffect(() => {
    if (state.status === 'awaitingInput') inputRef.current?.focus();
  }, [state.status]);

  // Reveal itself the moment the robot has something to say, and fold away
  // again when the run is cleared.
  useEffect(() => {
    if (state.output.length > 0) setOutputOpen(true);
    else setOutputOpen(false);
  }, [state.output.length]);

  const lastSpoken = [...state.output].reverse().find((entry) => entry.kind === 'say');
  const latest = state.output[state.output.length - 1] ?? null;

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

      {/* Icon-only transport: the three actions are universal shapes, and
          spelling them out crowded a panel this narrow. */}
      <div className="run-panel__controls">
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
          onClick={execution.stepOnce}
          disabled={isPlaying || state.status === 'awaitingInput'}
          title={`${d.actions.next} — ${d.actions.stepOne}`}
          aria-label={d.actions.next}
        >
          <Steps />
        </button>
        <button
          type="button"
          className="run-panel__button"
          onClick={execution.stop}
          disabled={state.stepCount === 0}
          title={d.actions.reset}
          aria-label={d.actions.reset}
        >
          <ArrowCounterClockwise />
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

      {/* Closed by default: at rest the panel is just the robot. It opens
          itself once the program starts producing output, then shows the
          current line, with the full transcript one click away. */}
      <div className="run-panel__output" data-open={outputOpen || undefined}>
        <button
          type="button"
          className="run-panel__output-toggle"
          onClick={() => setOutputOpen((open) => !open)}
          aria-expanded={outputOpen}
        >
          <CaretDown className="run-panel__output-caret" weight="bold" aria-hidden="true" />
          <span className="run-panel__output-label">{d.console.title}</span>
          {state.output.length > 0 && (
            <span className="run-panel__output-count">{state.output.length}</span>
          )}
        </button>

        <div className="run-panel__output-body">
          <div className="run-panel__output-inner">
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

          {latest ? (
            <>
              {/* Keyed on the entry id so each new line animates in, which is
                  what makes the panel feel like the robot speaking. */}
              <button
                key={latest.id}
                type="button"
                className="run-panel__latest"
                data-kind={latest.kind}
                onClick={() => latest.nodeId && onSelectNode(latest.nodeId)}
                title={latest.nodeId ? d.a11y.activeStep : undefined}
              >
                {latest.kind === 'error' ? t(latest.text) : latest.text}
              </button>
              {state.output.length > 1 && (
                <button type="button" className="run-panel__more" onClick={onShowConsole}>
                  {fill(d.console.seeAll, { count: state.output.length })}
                </button>
              )}
            </>
          ) : (
            <p className="run-panel__empty">{d.console.empty}</p>
          )}
          </div>
        </div>
      </div>
    </section>
  );
});
