import { memo } from 'react';

import { collectVariables } from '../core/ast/operations';
import type { Algorithm, NodeId } from '../core/ast/types';
import { useTranslation } from '../i18n/context';
import { DropZone, StatementBlock } from './StatementBlock';
import type { BlockCallbacks } from './StatementBlock';
import './Editor.css';

interface EditorProps {
  algorithm: Algorithm;
  callbacks: BlockCallbacks;
  activeNodeId: NodeId | null;
  erroredNodeId: NodeId | null;
  onRename: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const Editor = memo(function Editor({
  algorithm,
  callbacks,
  activeNodeId,
  erroredNodeId,
  onRename,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: EditorProps) {
  const { d, fill } = useTranslation();
  // Every declared name is offered wherever an expression can reference one.
  const variables = collectVariables(algorithm.body);
  const count = algorithm.body.length;

  return (
    <section className="editor" aria-label={d.a11y.algorithmEditor}>
      <header className="editor__header">
        <div className="editor__title-row">
          <input
            className="editor__title"
            value={algorithm.name}
            onChange={(event) => onRename(event.target.value)}
            aria-label={d.actions.rename}
            placeholder={d.app.untitled}
          />
          <div className="editor__history">
            <button
              type="button"
              className="editor__history-button"
              onClick={onUndo}
              disabled={!canUndo}
              title="⌘Z"
              aria-label="Undo"
            >
              ↶
            </button>
            <button
              type="button"
              className="editor__history-button"
              onClick={onRedo}
              disabled={!canRedo}
              title="⇧⌘Z"
              aria-label="Redo"
            >
              ↷
            </button>
          </div>
        </div>
        <p className="editor__count">
          {count === 1 ? d.editor.statementCountOne : fill(d.editor.statementCount, { count })}
        </p>
      </header>

      <div className="editor__canvas">
        {count === 0 && (
          <div className="editor__empty">
            <p className="editor__empty-title">{d.editor.empty}</p>
            <p className="editor__empty-hint">{d.editor.emptyHint}</p>
          </div>
        )}

        <ul className="editor__list">
          <DropZone
            location={{ parentId: null, slot: null, index: 0 }}
            callbacks={callbacks}
            empty={count === 0}
          />
          {algorithm.body.map((statement, index) => (
            <div key={statement.id} className="editor__item">
              <StatementBlock
                statement={statement}
                variables={variables}
                callbacks={callbacks}
                isActive={statement.id === activeNodeId}
                isErrored={statement.id === erroredNodeId}
                activeNodeId={activeNodeId}
                erroredNodeId={erroredNodeId}
                depth={0}
              />
              <DropZone
                location={{ parentId: null, slot: null, index: index + 1 }}
                callbacks={callbacks}
                empty={false}
              />
            </div>
          ))}
        </ul>
      </div>
    </section>
  );
});
