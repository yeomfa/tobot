import { memo, useEffect, useRef } from 'react';

import type { NodeId } from '../core/ast/types';
import type { OutputEntry } from '../core/runtime/types';
import { useTranslation } from '../i18n/context';
import './Console.css';

interface ConsoleProps {
  output: OutputEntry[];
  onSelectNode: (id: NodeId) => void;
}

/**
 * The full run transcript.
 *
 * The robot panel shows only the latest line so it stays calm; everything the
 * program has said lives here, where there is room to read it.
 */
export const Console = memo(function Console({ output, onSelectNode }: ConsoleProps) {
  const { d, t } = useTranslation();
  const listRef = useRef<HTMLOListElement>(null);

  // Follow the newest line as the program runs.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [output.length]);

  if (output.length === 0) {
    return (
      <div className="console console--empty">
        <p>{d.console.empty}</p>
      </div>
    );
  }

  return (
    <div className="console">
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
