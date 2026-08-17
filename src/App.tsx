import { useCallback, useEffect, useMemo, useState } from 'react';

import type { NodeId, Statement } from './core/ast/types';
import type { ConceptId } from './content/concepts';
import { ConceptDrawer } from './components/ConceptDrawer';
import { CodePanel } from './components/CodePanel';
import { Editor } from './components/Editor';
import { ExportDialog } from './components/ExportDialog';
import { Flowchart } from './components/Flowchart';
import { Palette } from './components/Palette';
import { RunPanel } from './components/RunPanel';
import type { BlockCallbacks } from './components/StatementBlock';
import { I18nProvider, useTranslation } from './i18n/context';
import { DEFAULT_LANGUAGE, isLanguage, languageNames, LANGUAGES } from './i18n';
import type { Dictionary, Language } from './i18n';
import { createAlgorithmStore, createPreferenceStore } from './state/storage';
import type { Preferences } from './state/storage';
import { useAlgorithm } from './state/useAlgorithm';
import { useExecution } from './state/useExecution';
import { welcomeAlgorithm } from './content/examples';
import './App.css';

type Theme = Preferences['theme'];

/**
 * The right rail shows exactly one view at a time. The three language views
 * and the flowchart sit in a single flat tab row — nesting a "Code" tab inside
 * a "Code" tab made the same word appear twice at two different levels.
 */
type SideView = 'natural' | 'pseudocode' | 'code' | 'flowchart';

const SIDE_TABS: SideView[] = ['natural', 'pseudocode', 'code', 'flowchart'];

/** Short labels keep all four tabs on one row in the rail. */
function sideTabLabel(d: Dictionary, id: SideView): string {
  if (id === 'natural') return d.tabs.naturalShort;
  if (id === 'pseudocode') return d.tabs.pseudocodeShort;
  if (id === 'code') return d.tabs.code;
  return d.tabs.flowchart;
}

const preferenceStore = createPreferenceStore();

function initialPreferences(): Preferences {
  const stored = preferenceStore.read();
  return {
    language: isLanguage(stored?.language) ? stored.language : DEFAULT_LANGUAGE,
    theme: stored?.theme === 'dark' || stored?.theme === 'light' ? stored.theme : 'system',
    activeAlgorithmId: stored?.activeAlgorithmId ?? null,
  };
}

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(initialPreferences);
  const language = preferences.language as Language;

  useEffect(() => {
    preferenceStore.write(preferences);
  }, [preferences]);

  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', preferences.theme);
  }, [preferences.theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <I18nProvider language={language}>
      <Workbench
        theme={preferences.theme}
        onThemeChange={(theme) => setPreferences((current) => ({ ...current, theme }))}
        onLanguageChange={(next) =>
          setPreferences((current) => ({ ...current, language: next }))
        }
      />
    </I18nProvider>
  );
}

interface WorkbenchProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onLanguageChange: (language: Language) => void;
}

/**
 * Layout principle: the algorithm canvas dominates, everything else is context
 * that appears when needed.
 *
 * An earlier version gave six regions a permanent slice each, which left the
 * editor showing only half the algorithm. Here the canvas is the grid's `1fr`,
 * the side rail shows one view at a time, and execution floats over the canvas
 * only while it runs.
 */
function Workbench({ theme, onThemeChange, onLanguageChange }: WorkbenchProps) {
  const { d, language } = useTranslation();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => welcomeAlgorithm(language), []);
  const controller = useAlgorithm(initial);
  const { algorithm, load } = controller;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await createAlgorithmStore().list();
      if (cancelled || saved.length === 0) return;
      load(saved[0]);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const execution = useExecution(algorithm.body);
  const [openConcept, setOpenConcept] = useState<ConceptId | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [sideView, setSideView] = useState<SideView>('natural');
  const [sideOpen, setSideOpen] = useState(true);
  const [runOpen, setRunOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      event.preventDefault();
      if (event.shiftKey) controller.redo();
      else controller.undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controller]);

  const showConcept = useCallback((conceptId: string) => {
    setOpenConcept(conceptId as ConceptId);
  }, []);

  /**
   * Clicking a code line, a flowchart node or a console entry reveals the
   * matching block on the canvas — the link that makes the views feel like one
   * artefact rather than separate renderings.
   */
  useEffect(() => {
    if (!selectedNode) return;
    const element = document.querySelector<HTMLElement>(`[data-node-id="${selectedNode}"]`);
    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.setAttribute('data-selected', 'true');
    const timer = setTimeout(() => element.removeAttribute('data-selected'), 1400);
    return () => clearTimeout(timer);
  }, [selectedNode]);

  const callbacks = useMemo<BlockCallbacks>(
    () => ({
      update: controller.update,
      remove: controller.remove,
      add: controller.add,
      move: controller.move,
      onExplain: showConcept,
    }),
    [controller.update, controller.remove, controller.add, controller.move, showConcept],
  );

  const appendStatement = useCallback(
    (statement: Statement) => {
      controller.add(statement, { parentId: null, slot: null, index: algorithm.body.length });
    },
    [controller, algorithm.body.length],
  );

  /** Opening the run panel and starting the program are one action. */
  const startRun = useCallback(() => {
    setRunOpen(true);
    execution.play();
  }, [execution]);

  const closeRun = useCallback(() => {
    execution.stop();
    setRunOpen(false);
  }, [execution]);

  const activeNodeId = execution.state.currentNodeId;
  const erroredNodeId = execution.state.error?.nodeId ?? null;

  return (
    <div
      className="app"
      data-palette={paletteOpen ? 'open' : 'closed'}
      data-side={sideOpen ? 'open' : 'closed'}
    >
      <header className="app__header">
        <div className="app__brand">
          <BrandMark />
          <span className="app__name">{d.app.name}</span>
        </div>

        {/* The document title lives in the header, not in a second toolbar. */}
        <input
          className="app__doc-title"
          value={algorithm.name}
          onChange={(event) => controller.setName(event.target.value)}
          aria-label={d.actions.rename}
          placeholder={d.app.untitled}
        />

        <div className="app__header-actions">
          <div className="app__history">
            <button
              type="button"
              className="app__icon-button"
              onClick={controller.undo}
              disabled={!controller.canUndo}
              title="⌘Z"
              aria-label="Undo"
            >
              ↶
            </button>
            <button
              type="button"
              className="app__icon-button"
              onClick={controller.redo}
              disabled={!controller.canRedo}
              title="⇧⌘Z"
              aria-label="Redo"
            >
              ↷
            </button>
          </div>

          <span className="app__divider" aria-hidden="true" />

          <button
            type="button"
            className="app__ghost-button"
            onClick={() => setOpenConcept('variables')}
          >
            {d.concepts.title}
          </button>
          <button type="button" className="app__ghost-button" onClick={() => setShowExport(true)}>
            {d.actions.export}
          </button>

          <span className="app__divider" aria-hidden="true" />

          <select
            className="app__select"
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as Language)}
            aria-label={d.settings.language}
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {languageNames[code]}
              </option>
            ))}
          </select>

          <select
            className="app__select"
            value={theme}
            onChange={(event) => onThemeChange(event.target.value as Theme)}
            aria-label={d.settings.theme}
          >
            <option value="system">{d.settings.themeSystem}</option>
            <option value="light">{d.settings.themeLight}</option>
            <option value="dark">{d.settings.themeDark}</option>
          </select>

          <button type="button" className="app__run" onClick={startRun}>
            <span aria-hidden="true">▶</span> {d.actions.run}
          </button>
        </div>
      </header>

      <main className="app__main">
        <aside className="app__palette">
          <Palette
            onAdd={appendStatement}
            collapsed={!paletteOpen}
            onToggle={() => setPaletteOpen((open) => !open)}
          />
        </aside>

        {/* The canvas. The run panel floats over it, so execution never
            permanently shrinks the workspace. */}
        <div className="app__canvas">
          <Editor
            algorithm={algorithm}
            callbacks={callbacks}
            activeNodeId={activeNodeId}
            erroredNodeId={erroredNodeId}
          />

          {runOpen && (
            <RunPanel execution={execution} onSelectNode={setSelectedNode} onClose={closeRun} />
          )}
        </div>

        <aside className="app__side">
          <div className="app__side-tabs" role="tablist">
            {SIDE_TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                className="app__side-tab"
                data-selected={sideOpen && sideView === id ? true : undefined}
                aria-selected={sideOpen && sideView === id}
                onClick={() => {
                  setSideView(id);
                  setSideOpen(true);
                }}
              >
                {sideTabLabel(d, id)}
              </button>
            ))}
            <button
              type="button"
              className="app__icon-button app__side-collapse"
              onClick={() => setSideOpen((open) => !open)}
              title={sideOpen ? d.palette.collapse : d.palette.expand}
              aria-label={sideOpen ? d.palette.collapse : d.palette.expand}
            >
              {sideOpen ? '»' : '«'}
            </button>
          </div>

          {sideOpen && (
            <div className="app__side-body">
              {/* Both panes stay mounted: the flowchart's SVG must exist in the
                  DOM for export, and re-emitting on each switch is wasteful. */}
              <div className="app__side-pane" data-hidden={sideView === 'flowchart' || undefined}>
                <CodePanel
                  algorithm={algorithm}
                  view={sideView === 'flowchart' ? 'natural' : sideView}
                  activeNodeId={activeNodeId}
                  erroredNodeId={erroredNodeId}
                  onSelectNode={setSelectedNode}
                  onExport={() => setShowExport(true)}
                />
              </div>
              <div className="app__side-pane" data-hidden={sideView !== 'flowchart' || undefined}>
                <Flowchart
                  program={algorithm.body}
                  activeNodeId={activeNodeId}
                  erroredNodeId={erroredNodeId}
                  onSelectNode={setSelectedNode}
                />
              </div>
            </div>
          )}
        </aside>
      </main>

      <ConceptDrawer
        conceptId={openConcept}
        onClose={() => setOpenConcept(null)}
        onNavigate={setOpenConcept}
      />

      {showExport && <ExportDialog algorithm={algorithm} onClose={() => setShowExport(false)} />}
    </div>
  );
}

function BrandMark() {
  return (
    <svg className="app__mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5" y="9" width="22" height="17" rx="6" />
      <line x1="16" y1="4" x2="16" y2="9" />
      <circle cx="16" cy="3" r="2.2" className="app__mark-dot" />
      <circle cx="12" cy="17" r="2.4" className="app__mark-eye" />
      <circle cx="20" cy="17" r="2.4" className="app__mark-eye" />
    </svg>
  );
}
