import { memo, useMemo, useRef } from 'react';

import { collectFunctions, collectVariables } from '../core/ast/operations';
import { problemsByNode, validate } from '../core/ast/validate';
import type { Problem } from '../core/ast/validate';
import type { Algorithm, NodeId } from '../core/ast/types';
import { useTranslation } from '../i18n/context';
import { useMarquee } from '../state/useMarquee';
import { useMagneticDrop } from '../state/useMagneticDrop';
import { DropZone, StatementBlock } from './StatementBlock';
import type { BlockCallbacks } from './StatementBlock';
import './Editor.css';

interface EditorProps {
  algorithm: Algorithm;
  callbacks: BlockCallbacks;
  activeNodeId: NodeId | null;
  erroredNodeId: NodeId | null;
  /**
   * Blocks where changing the declared type discarded content.
   *
   * Kept beside the static checks rather than inside them: `validate` reads
   * the tree, and a converted value carries no trace of what it used to be.
   */
  retypeLosses: ReadonlySet<NodeId>;
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
  retypeLosses,
}: EditorProps) {
  const { d } = useTranslation();
  // Every declared name is offered wherever an expression can reference one.
  const variables = collectVariables(algorithm.body);
  const count = algorithm.body.length;

  // Static checks re-run on every edit; the tree is small enough that this is
  // cheaper than tracking which statement changed.
  /* Every function in the program, so a call can offer them by name. */
  const functions = useMemo(() => collectFunctions(algorithm.body), [algorithm.body]);

  const problems = useMemo(() => {
    const found = problemsByNode(validate(algorithm.body));
    /* Merged in rather than pushed through `validate`, which only ever sees
       the tree as it is now. A block can carry both: a type that disagrees
       with its value, and a conversion that threw something away. */
    for (const nodeId of retypeLosses) {
      const entry: Problem = { nodeId, severity: 'warning', messageKey: 'retypeLostContent' };
      const existing = found.get(nodeId);
      if (existing) existing.push(entry);
      else found.set(nodeId, [entry]);
    }
    return found;
  }, [algorithm.body, retypeLosses]);

  const canvas = useRef<HTMLDivElement>(null);
  useMagneticDrop(canvas);
  /* Dragging on bare canvas selects; dragging on a block moves it. */
  const marquee = useMarquee(canvas, callbacks.onSelectMany);

  return (
    <section className="editor" aria-label={d.a11y.algorithmEditor}>
      {/* The whole canvas accepts the drag; the nearest zone claims it. */}
      <div
        className="editor__canvas"
        ref={canvas}
        /* Clicking bare canvas clears the selection, the way it does anywhere
           a selection can be made. A click on a block stops before here. */
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('.statement-block')) return;
          /* The click that ends a rectangle drag is not a click on the canvas;
             clearing here would drop what the rectangle just selected. */
          if (marquee.justDragged()) return;
          callbacks.onSelectMany([], false);
        }}
      >
        {/* The rectangle being dragged. Fixed, because it is measured in the
            same client coordinates the pointer reports. */}
        {marquee.box && (
          <div className="editor__marquee" style={{ position: 'fixed', ...marquee.box }} />
        )}
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
                functions={functions}
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
