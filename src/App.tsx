import { useCallback, useEffect, useMemo, useState } from 'react';

import type { NodeId, Statement } from './core/ast/types';
import type { ConceptId } from './content/concepts';
import { ConceptDrawer } from './components/ConceptDrawer';
import { CodePanel } from './components/CodePanel';
import { Editor } from './components/Editor';
import { ExportDialog } from './components/ExportDialog';
import { Flowchart } from './components/Flowchart';
import { Sidebar } from './components/Sidebar';
import type { SidebarView } from './components/Sidebar';
import { ResizeHandle } from './components/ResizeHandle';
import { RunPanel } from './components/RunPanel';
import type { BlockCallbacks } from './components/StatementBlock';
import { I18nProvider, useTranslation } from './i18n/context';
import { DEFAULT_LANGUAGE, isLanguage, languageNames, LANGUAGES } from './i18n';
import type { Dictionary, Language } from './i18n';
import { createAlgorithmStore, createPreferenceStore } from './state/storage';
import type { Preferences } from './state/storage';
import { useAlgorithm } from './state/useAlgorithm';
import { useExecution } from './state/useExecution';
import { useResizable } from './state/useResizable';
import { welcomeAlgorithm } from './content/examples';
import { createEmptyAlgorithm } from './state/useAlgorithm';
import './App.css';

type Theme = Preferences['theme'];

/** Views available in the bottom drawer. */
type DrawerView = 'natural' | 'pseudocode' | 'code' | 'flowchart';

const DRAWER_TABS: DrawerView[] = ['natural', 'pseudocode', 'code', 'flowchart'];

function drawerTabLabel(d: Dictionary, id: DrawerView): string {
  if (id === 'natural') return d.tabs.natural;
  if (id === 'pseudocode') return d.tabs.pseudocode;
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
 * Layout: the canvas is the constant, and the three surrounding panels are
 * each independently hideable and drag-resizable.
 *
 * - left rail: the statement palette
 * - right rail: the robot, always present so a student can run at any moment
 * - bottom drawer: the language views and the flowchart
 *
 * Sizes persist per panel, so the workspace a student arranges is the one they
 * come back to.
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

  // The store writes on a debounce, so the list refreshes just after it.
  useEffect(() => {
    const timer = setTimeout(() => setLibraryRevision((n) => n + 1), 700);
    return () => clearTimeout(timer);
  }, [algorithm]);

  const execution = useExecution(algorithm.body);
  const [openConcept, setOpenConcept] = useState<ConceptId | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>('statements');
  /** Bumped on save so the library list picks up name and size changes. */
  const [libraryRevision, setLibraryRevision] = useState(0);

  const [paletteOpen, setPaletteOpen] = useState(true);
  const [robotOpen, setRobotOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerView, setDrawerView] = useState<DrawerView>('natural');

  const paletteSize = useResizable({
    initial: 244,
    min: 180,
    max: 420,
    axis: 'x',
    from: 'start',
    storageKey: 'tobot.size.palette',
  });
  const robotSize = useResizable({
    initial: 330,
    min: 260,
    max: 520,
    axis: 'x',
    from: 'end',
    storageKey: 'tobot.size.robot',
  });
  const drawerSize = useResizable({
    initial: 300,
    min: 140,
    max: 640,
    axis: 'y',
    from: 'end',
    storageKey: 'tobot.size.drawer',
  });

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
   * matching block on the canvas.
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

  /** Starts a blank algorithm and leaves the library open behind it. */
  const createNew = useCallback(() => {
    load(createEmptyAlgorithm(d.app.untitled));
  }, [load, d.app.untitled]);

  /** The header's Run reveals the robot if it was hidden, then starts. */
  const startRun = useCallback(() => {
    setRobotOpen(true);
    execution.play();
  }, [execution]);

  const activeNodeId = execution.state.currentNodeId;
  const erroredNodeId = execution.state.error?.nodeId ?? null;

  const gridStyle = {
    '--palette-size': `${paletteSize.size}px`,
    '--robot-size': `${robotSize.size}px`,
    '--drawer-size': `${drawerSize.size}px`,
  } as React.CSSProperties;

  return (
    <div
      className="app"
      style={gridStyle}
      data-palette={paletteOpen ? 'open' : 'closed'}
      data-robot={robotOpen ? 'open' : 'closed'}
      data-drawer={drawerOpen ? 'open' : 'closed'}
    >
      <header className="app__header">
        <h1 className="app__brand">
          <BrandMark />
          <span className="app__name">{d.app.name}</span>
        </h1>

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

          {/* Panel toggles, grouped so their state reads at a glance. */}
          <div className="app__toggles">
            <button
              type="button"
              className="app__toggle"
              data-active={paletteOpen || undefined}
              onClick={() => setPaletteOpen((open) => !open)}
              title={d.panels.palette}
              aria-label={d.panels.palette}
              aria-pressed={paletteOpen}
            >
              ◧
            </button>
            <button
              type="button"
              className="app__toggle"
              data-active={drawerOpen || undefined}
              onClick={() => setDrawerOpen((open) => !open)}
              title={d.panels.drawer}
              aria-label={d.panels.drawer}
              aria-pressed={drawerOpen}
            >
              ◒
            </button>
            <button
              type="button"
              className="app__toggle"
              data-active={robotOpen || undefined}
              onClick={() => setRobotOpen((open) => !open)}
              title={d.panels.robot}
              aria-label={d.panels.robot}
              aria-pressed={robotOpen}
            >
              ◨
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
        {paletteOpen && (
          <aside className="app__palette">
            <Sidebar
              view={sidebarView}
              onViewChange={setSidebarView}
              onAdd={appendStatement}
              revision={libraryRevision}
              currentId={algorithm.id}
              onOpen={load}
              onCreate={createNew}
            />
            <ResizeHandle resizable={paletteSize} edge="right" label={d.panels.resize} />
          </aside>
        )}

        <div className="app__center">
          <div className="app__canvas">
            <Editor
              algorithm={algorithm}
              callbacks={callbacks}
              activeNodeId={activeNodeId}
              erroredNodeId={erroredNodeId}
            />
          </div>

          {/* Bottom drawer: the code and diagram views. */}
          <section className="app__drawer" aria-label={d.panels.drawer}>
            {drawerOpen && (
              <ResizeHandle resizable={drawerSize} edge="top" label={d.panels.resize} />
            )}

            <div className="app__drawer-tabs" role="tablist">
              {DRAWER_TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  className="app__drawer-tab"
                  data-selected={drawerOpen && drawerView === id ? true : undefined}
                  aria-selected={drawerOpen && drawerView === id}
                  onClick={() => {
                    // Clicking the open tab again collapses the drawer.
                    if (drawerOpen && drawerView === id) setDrawerOpen(false);
                    else {
                      setDrawerView(id);
                      setDrawerOpen(true);
                    }
                  }}
                >
                  {drawerTabLabel(d, id)}
                </button>
              ))}
              <button
                type="button"
                className="app__icon-button app__drawer-collapse"
                onClick={() => setDrawerOpen((open) => !open)}
                title={drawerOpen ? d.palette.collapse : d.palette.expand}
                aria-label={drawerOpen ? d.palette.collapse : d.palette.expand}
              >
                {drawerOpen ? '▾' : '▴'}
              </button>
            </div>

            {drawerOpen && (
              <div className="app__drawer-body">
                {/* Both stay mounted: the flowchart's SVG must exist for export. */}
                <div
                  className="app__drawer-pane"
                  data-hidden={drawerView === 'flowchart' || undefined}
                >
                  <CodePanel
                    algorithm={algorithm}
                    view={drawerView === 'flowchart' ? 'natural' : drawerView}
                    activeNodeId={activeNodeId}
                    erroredNodeId={erroredNodeId}
                    onSelectNode={setSelectedNode}
                    onExport={() => setShowExport(true)}
                  />
                </div>
                <div
                  className="app__drawer-pane"
                  data-hidden={drawerView !== 'flowchart' || undefined}
                >
                  <Flowchart
                    program={algorithm.body}
                    activeNodeId={activeNodeId}
                    erroredNodeId={erroredNodeId}
                    onSelectNode={setSelectedNode}
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        {robotOpen && (
          <aside className="app__robot">
            <ResizeHandle resizable={robotSize} edge="left" label={d.panels.resize} />
            <RunPanel execution={execution} onSelectNode={setSelectedNode} />
          </aside>
        )}
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
