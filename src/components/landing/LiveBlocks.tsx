import { useEffect, useRef, useState } from 'react';

import { literal } from '../../core/ast/factory';
import type { Statement } from '../../core/ast/types';
import { StatementBlock } from '../StatementBlock';
import type { BlockCallbacks } from '../StatementBlock';
import './LiveBlocks.css';

/**
 * The algorithm that types itself out.
 *
 * Short on purpose: long enough to show a variable, a question, an output and
 * a branch — the shape of a real program — and short enough that the loop
 * comes round while someone is still looking at it.
 */
const DEMO: Statement[] = [
  {
    id: 'demo-ask',
    kind: 'ask',
    prompt: literal('¿Cómo te llamas?', 'text'),
    target: 'nombre',
    expect: 'text',
  },
  {
    id: 'demo-say',
    kind: 'say',
    value: {
      kind: 'binary',
      operator: '+',
      left: literal('Hola, ', 'text'),
      right: { kind: 'variable', name: 'nombre' },
    },
  },
  {
    id: 'demo-declare',
    kind: 'declare',
    name: 'nota',
    value: literal(4, 'number'),
    valueKind: 'number',
  },
  {
    id: 'demo-if',
    kind: 'if',
    condition: {
      kind: 'binary',
      operator: '>=',
      left: { kind: 'variable', name: 'nota' },
      right: literal(3, 'number'),
    },
    then: [{ id: 'demo-then', kind: 'say', value: literal('¡Aprobaste!', 'text') }],
  },
];

/** Nothing here is editable, so every callback is deliberately inert. */
const INERT: BlockCallbacks = {
  update: () => {},
  remove: () => {},
  add: () => {},
  move: () => {},
  onExplain: () => {},
};

const STEP_MS = 900;
const HOLD_MS = 2600;

/**
 * The editor's own blocks, assembling themselves.
 *
 * Not a picture of Tobot: these are the same `StatementBlock` components the
 * app renders, given a fixed algorithm and callbacks that do nothing. A
 * screenshot goes stale the moment the editor changes — that already happened
 * once here — while this cannot, because it *is* the editor.
 *
 * The loop only runs while the section is on screen, and not at all for
 * someone who asked for less motion: they get the finished algorithm, which is
 * the thing being demonstrated anyway.
 */
export function LiveBlocks() {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setShown(DEMO.length);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => setActive(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: '0px 0px -15% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;

    // One block at a time, then a pause on the finished algorithm before it
    // starts over — the pause is what makes it readable rather than restless.
    const done = shown >= DEMO.length;
    const timer = window.setTimeout(
      () => setShown(done ? 0 : shown + 1),
      done ? HOLD_MS : STEP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, shown]);

  return (
    <div className="live-blocks" ref={ref} aria-hidden="true">
      <ul className="live-blocks__list">
        {DEMO.slice(0, shown).map((statement, index) => (
          <li className="live-blocks__item" key={statement.id} style={{ '--i': index } as React.CSSProperties}>
            <StatementBlock
              statement={statement}
              variables={['nombre', 'nota']}
              problems={new Map()}
              callbacks={INERT}
              isActive={false}
              isErrored={false}
              activeNodeId={null}
              erroredNodeId={null}
              depth={0}
            />
          </li>
        ))}
      </ul>

      {/* Holds the full height from the first frame, so the surrounding page
          does not jump as blocks arrive. */}
      <div className="live-blocks__spacer" />
    </div>
  );
}
