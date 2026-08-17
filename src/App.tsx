import { useCallback, useEffect, useMemo, useState } from 'react';

import type { NodeId, Statement } from './core/ast/types';
import type { ConceptId } from './content/concepts';
import { ConceptDrawer } from './components/ConceptDrawer';
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

  /**
   * The welcome example gives a new student something to run immediately.
   * Deliberately built once from the language at mount: regenerating it on a
   * language switch would discard whatever the student has since written.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [openConcept, setOpenConcept] = useState<ConceptId | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);

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
  }, []);

  /**
   * Clicking a code line, a flowchart node or a console entry reveals the
   * matching block in the editor. This is the link that makes the views feel
   * like one artefact rather than separate renderings.
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
    <div className="app" data-palette={paletteOpen ? 'open' : 'closed'}>
      <header className="app__header">
        <div className="app__brand">
          <BrandMark />
          <div className="app__brand-text">
            <span className="app__name">{d.app.name}</span>
            <span className="app__tagline">{d.app.tagline}</span>
          </div>
        </div>

        <div className="app__header-actions">
          <button
            type="button"
            className="app__ghost-button"
            onClick={() => setOpenConcept('variables')}
          >
            {d.concepts.title}
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

          <button type="button" className="app__export" onClick={() => setShowExport(true)}>
            {d.actions.export}
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

          {/* The diagram now owns the whole lower half instead of sharing
              it with a concepts pane that never had room to breathe. */}
          <div className="app__diagram">
            <Flowchart
              program={algorithm.body}
              activeNodeId={activeNodeId}
              erroredNodeId={erroredNodeId}
              onSelectNode={setSelectedNode}
            />
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

      <ConceptDrawer
        conceptId={openConcept}
        onClose={() => setOpenConcept(null)}
        onNavigate={setOpenConcept}
      />

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
