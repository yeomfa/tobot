import { memo, useMemo, useRef } from 'react';

import { collectVariables } from '../core/ast/operations';
import { problemsByNode, validate } from '../core/ast/validate';
import type { Algorithm, NodeId } from '../core/ast/types';
import { useTranslation } from '../i18n/context';
import { useMagneticDrop } from '../state/useMagneticDrop';
import { DropZone, StatementBlock } from './StatementBlock';
import type { BlockCallbacks } from './StatementBlock';
import './Editor.css';

interface EditorProps {
  algorithm: Algorithm;
  callbacks: BlockCallbacks;
  activeNodeId: NodeId | null;
  erroredNodeId: NodeId | null;
}

/**
 * The algorithm canvas. It is intentionally chrome-free — the document title,
 * undo and run controls live in the app header — so the whole surface belongs
 * to the statements themselves.
 */
export const Editor = memo(function Editor({
  algorithm,
  callbacks,
  activeNodeId,
  erroredNodeId,
}: EditorProps) {
  const { d } = useTranslation();
  // Every declared name is offered wherever an expression can reference one.
  const variables = collectVariables(algorithm.body);
  const count = algorithm.body.length;

  // Static checks re-run on every edit; the tree is small enough that this is
  // cheaper than tracking which statement changed.
  const problems = useMemo(() => problemsByNode(validate(algorithm.body)), [algorithm.body]);

  const canvas = useRef<HTMLDivElement>(null);
  useMagneticDrop(canvas);

  return (
    <section className="editor" aria-label={d.a11y.algorithmEditor}>
      {/* The whole canvas accepts the drag; the nearest zone claims it. */}
      <div className="editor__canvas" ref={canvas}>
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
                problems={problems}
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
