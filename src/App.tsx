import { useCallback, useEffect, useMemo, useState } from 'react';

import type { NodeId, Statement } from './core/ast/types';
import type { ConceptId } from './content/concepts';
import { Concepts } from './components/Concepts';
import { CodePanel } from './components/CodePanel';
import { Editor } from './components/Editor';
import { ExportDialog } from './components/ExportDialog';
import { Flowchart } from './components/Flowchart';
import { Palette } from './components/Palette';
import { Stage } from './components/Stage';
import type { BlockCallbacks } from './components/StatementBlock';
import { I18nProvider, useTranslation } from './i18n/context';
import { DEFAULT_LANGUAGE, isLanguage, languageNames, LANGUAGES } from './i18n';
import type { Language } from './i18n';
import { createAlgorithmStore, createPreferenceStore } from './state/storage';
import type { Preferences } from './state/storage';
import { useAlgorithm } from './state/useAlgorithm';
import { useExecution } from './state/useExecution';
import { welcomeAlgorithm } from './content/examples';
import './App.css';

type Theme = Preferences['theme'];
type LowerTab = 'flowchart' | 'concepts';

const preferenceStore = createPreferenceStore();

/** Reads persisted preferences once, before the first paint. */
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

  // `system` leaves the attribute off so the media query in tokens.css wins.
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

function Workbench({ theme, onThemeChange, onLanguageChange }: WorkbenchProps) {
  const { d, language } = useTranslation();

  // The welcome example gives a new student something to run immediately.
  const initial = useMemo(() => welcomeAlgorithm(language), []);
  const controller = useAlgorithm(initial);
  const { algorithm, load } = controller;

  /**
   * Restore the last algorithm the student worked on. This runs once, after
   * mount, because the store is async — the welcome example is what they see
   * in the meantime, and it is replaced only if saved work actually exists.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await createAlgorithmStore().list();
      if (cancelled || saved.length === 0) return;
      // `list` is newest-first, so the head is the most recently edited.
      load(saved[0]);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const execution = useExecution(algorithm.body);
  const [lowerTab, setLowerTab] = useState<LowerTab>('flowchart');
  const [openConcept, setOpenConcept] = useState<ConceptId | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null);
  const [showExport, setShowExport] = useState(false);

  // Keyboard shortcuts for undo/redo, matching every other editor.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      // Let text fields handle their own undo.
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
    setLowerTab('concepts');
  }, []);

  /**
   * Clicking a code line, a flowchart node or a console entry reveals the
   * matching block in the editor. This is the link that makes the four views
   * feel like one artefact rather than four separate renderings.
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
      controller.add(statement, {
        parentId: null,
        slot: null,
        index: algorithm.body.length,
      });
    },
    [controller, algorithm.body.length],
  );

  const activeNodeId = execution.state.currentNodeId;
  const erroredNodeId = execution.state.error?.nodeId ?? null;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <BrandMark />
          <div className="app__brand-text">
            <span className="app__name">{d.app.name}</span>
            <span className="app__tagline">{d.app.tagline}</span>
          </div>
        </div>

        <div className="app__header-actions">
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

          <button
            type="button"
            className="app__export"
            onClick={() => setShowExport(true)}
          >
            {d.actions.export}
          </button>
        </div>
      </header>

      <main className="app__main">
        <aside className="app__palette">
          <Palette onAdd={appendStatement} />
        </aside>

        <div className="app__center">
          <div className="app__editor">
            <Editor
              algorithm={algorithm}
              callbacks={callbacks}
              activeNodeId={activeNodeId}
              erroredNodeId={erroredNodeId}
              onRename={controller.setName}
              canUndo={controller.canUndo}
              canRedo={controller.canRedo}
              onUndo={controller.undo}
              onRedo={controller.redo}
            />
          </div>

          <div className="app__lower">
            <div className="app__lower-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className="app__lower-tab"
                data-selected={lowerTab === 'flowchart' || undefined}
                aria-selected={lowerTab === 'flowchart'}
                onClick={() => setLowerTab('flowchart')}
              >
                {d.tabs.flowchart}
              </button>
              <button
                type="button"
                role="tab"
                className="app__lower-tab"
                data-selected={lowerTab === 'concepts' || undefined}
                aria-selected={lowerTab === 'concepts'}
                onClick={() => setLowerTab('concepts')}
              >
                {d.tabs.concepts}
              </button>
            </div>

            <div className="app__lower-body">
              {/* The flowchart stays mounted so its SVG is always exportable. */}
              <div className="app__lower-pane" data-hidden={lowerTab !== 'flowchart' || undefined}>
                <Flowchart
                  program={algorithm.body}
                  activeNodeId={activeNodeId}
                  erroredNodeId={erroredNodeId}
                  onSelectNode={setSelectedNode}
                />
              </div>
              <div className="app__lower-pane" data-hidden={lowerTab !== 'concepts' || undefined}>
                <Concepts selected={openConcept} onSelect={setOpenConcept} />
              </div>
            </div>
          </div>
        </div>

        <aside className="app__right">
          <div className="app__code">
            <CodePanel
              algorithm={algorithm}
              activeNodeId={activeNodeId}
              erroredNodeId={erroredNodeId}
              onSelectNode={setSelectedNode}
              onExport={() => setShowExport(true)}
            />
          </div>
          <div className="app__stage">
            <Stage execution={execution} onSelectNode={setSelectedNode} />
          </div>
        </aside>
      </main>

      {showExport && (
        <ExportDialog algorithm={algorithm} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}

/** Small robot glyph used as the product mark. */
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
