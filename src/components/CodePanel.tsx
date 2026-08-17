import { memo, useMemo, useState } from 'react';

import type { Algorithm, NodeId } from '../core/ast/types';
import { codeTargets, emitters } from '../core/emitters';
import type { EmittedLine, TargetId } from '../core/emitters';
import { useTranslation } from '../i18n/context';
import { highlight } from './highlight';
import './CodePanel.css';

export type PanelTab = 'natural' | 'pseudocode' | 'code';

interface CodePanelProps {
  algorithm: Algorithm;
  /** Statement the interpreter is on, highlighted in every tab. */
  activeNodeId: NodeId | null;
  erroredNodeId: NodeId | null;
  /** Clicking a line selects the statement it came from. */
  onSelectNode: (id: NodeId) => void;
  onExport: () => void;
}

/**
 * The three views of the same algorithm.
 *
 * All tabs render from `EmittedLine[]`, so line-level highlighting and
 * click-to-select work identically no matter which language is showing — that
 * shared shape is what makes the transition between them legible.
 */
export const CodePanel = memo(function CodePanel({
  algorithm,
  activeNodeId,
  erroredNodeId,
  onSelectNode,
  onExport,
}: CodePanelProps) {
  const { d, language } = useTranslation();
  const [tab, setTab] = useState<PanelTab>('natural');
  const [codeTarget, setCodeTarget] = useState<TargetId>('javascript');
  const [copied, setCopied] = useState(false);

  const target: TargetId = tab === 'code' ? codeTarget : tab;
  const emitter = emitters[target];

  const lines = useMemo(
    () => emitter.emit(algorithm, { locale: language }),
    [emitter, algorithm, language],
  );

  const copy = async (): Promise<void> => {
    const text = lines
      .map((line) => `${'  '.repeat(line.indent)}${line.text}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the export dialog is the fallback.
      onExport();
    }
  };

  const tabs: Array<{ id: PanelTab; label: string }> = [
    { id: 'natural', label: d.tabs.natural },
    { id: 'pseudocode', label: d.tabs.pseudocode },
    { id: 'code', label: d.tabs.code },
  ];

  return (
    <section className="code-panel" aria-label={d.a11y.codePanel}>
      <div className="code-panel__tabs" role="tablist">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            role="tab"
            type="button"
            className="code-panel__tab"
            data-selected={tab === entry.id || undefined}
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="code-panel__toolbar">
        {tab === 'code' ? (
          <select
            className="code-panel__lang"
            value={codeTarget}
            onChange={(event) => setCodeTarget(event.target.value as TargetId)}
            aria-label={d.panel.languageSelect}
          >
            {codeTargets.map((id) => (
              <option key={id} value={id}>
                {emitters[id].label}
              </option>
            ))}
          </select>
        ) : (
          <span className="code-panel__hint">{d.panel.viewHint}</span>
        )}

        <div className="code-panel__toolbar-actions">
          <button type="button" className="code-panel__button" onClick={copy}>
            {copied ? d.actions.copied : d.actions.copy}
          </button>
          <button type="button" className="code-panel__button" onClick={onExport}>
            {d.actions.export}
          </button>
        </div>
      </div>

      <div className="code-panel__body" data-syntax={emitter.syntax}>
        {lines.length === 0 ? (
          <p className="code-panel__empty">{d.editor.emptyHint}</p>
        ) : (
          <ol className="code-panel__lines">
            {lines.map((line, index) => (
              <CodeLine
                key={index}
                line={line}
                index={index}
                syntax={emitter.syntax}
                isActive={line.nodeId !== null && line.nodeId === activeNodeId}
                isErrored={line.nodeId !== null && line.nodeId === erroredNodeId}
                onSelect={onSelectNode}
                showNumbers={emitter.syntax !== 'natural'}
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
});

interface CodeLineProps {
  line: EmittedLine;
  index: number;
  syntax: string;
  isActive: boolean;
  isErrored: boolean;
  onSelect: (id: NodeId) => void;
  showNumbers: boolean;
}

function CodeLine({
  line,
  index,
  syntax,
  isActive,
  isErrored,
  onSelect,
  showNumbers,
}: CodeLineProps) {
  const tokens = useMemo(() => highlight(line.text, syntax), [line.text, syntax]);

  return (
    <li
      className="code-line"
      data-active={isActive || undefined}
      data-errored={isErrored || undefined}
      data-clickable={line.nodeId !== null || undefined}
      onClick={() => line.nodeId && onSelect(line.nodeId)}
    >
      {showNumbers && <span className="code-line__number">{index + 1}</span>}
      <span className="code-line__text" style={{ paddingLeft: `${line.indent * 1.5}em` }}>
        {tokens.map((token, tokenIndex) => (
          <span key={tokenIndex} className={`tok tok--${token.type}`}>
            {token.text}
          </span>
        ))}
      </span>
    </li>
  );
}
