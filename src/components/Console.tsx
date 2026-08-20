import { Broom } from '@phosphor-icons/react';
import { memo, useEffect, useRef } from 'react';

import type { NodeId } from '../core/ast/types';
import type { OutputEntry, VariableSnapshot } from '../core/runtime/types';
import { useTranslation } from '../i18n/context';
import './Console.css';

interface ConsoleProps {
  output: OutputEntry[];
  /** Shown above the log; they left the robot panel to keep it uncluttered. */
  variables: VariableSnapshot[];
  onSelectNode: (id: NodeId) => void;
  /** Discards the run. Lives here because this is what it visibly empties. */
  onClear: () => void;
}

/**
 * The full run transcript.
 *
 * The robot panel shows only the latest line so it stays calm; everything the
 * program has said lives here, where there is room to read it.
 */
export const Console = memo(function Console({ output, variables, onSelectNode, onClear }: ConsoleProps) {
  const { d, t } = useTranslation();
  const listRef = useRef<HTMLOListElement>(null);

  // Follow the newest line as the program runs.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [output.length]);

  if (output.length === 0 && variables.length === 0) {
    return (
      <div className="console console--empty">
        <p>{d.console.empty}</p>
      </div>
    );
  }

  return (
    <div className="console">
      {/*
        Clearing belongs to the console, not to the robot's status bar: this is
        the thing it empties, and a broom tucked beside a status line gave no
        clue what it would sweep.
      */}
      <button
        type="button"
        className="console__clear"
        onClick={onClear}
        title={d.actions.clearConsole}
        aria-label={d.actions.clearConsole}
      >
        <Broom weight="bold" />
        <span>{d.actions.clear}</span>
      </button>

      {variables.length > 0 && (
        <div className="console__vars">
          <span className="console__vars-label">{d.console.variablesTitle}</span>
          <ul className="console__vars-list">
            {variables.map((variable) => (
              <li
                key={variable.name}
                className="console__var"
                data-changed={variable.justChanged || undefined}
              >
                <span className="console__var-name">{variable.name}</span>
                <span className="console__var-value" data-kind={variable.kind}>
                  {variable.kind === 'text' ? `"${variable.value}"` : String(variable.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="console__list" ref={listRef}>
        {output.map((entry) => (
          <li
            key={entry.id}
            className="console__entry"
            data-kind={entry.kind}
            data-clickable={entry.nodeId !== null || undefined}
            onClick={() => entry.nodeId && onSelectNode(entry.nodeId)}
          >
            <span className="console__marker" aria-hidden="true" />
            <span className="console__text">
              {entry.kind === 'error' ? t(entry.text) : entry.text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
});
