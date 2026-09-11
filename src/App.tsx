import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import {
  ArrowClockwiseIcon as ArrowClockwise,
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  CaretDownIcon as CaretDown,
  SquaresFourIcon as SquaresFour,
  TreeStructureIcon as TreeStructure,
  CaretUpIcon as CaretUp,
  PlayIcon as Play,
  SidebarSimpleIcon as SidebarSimple,
  TranslateIcon as Translate,
  MoonIcon as Moon,
  SunIcon as Sun,
  BookOpenTextIcon as BookOpenText,
  HouseIcon as House,
  CompassIcon as Compass,
  DesktopIcon as Desktop,
  ExportIcon as Export,
} from '@phosphor-icons/react';

import type { NodeId, Statement } from './core/ast/types';
import type { Location as SlotLocation } from './core/ast/operations';
import { findLocation, findStatement } from './core/ast/operations';
import { decodeStatements, encodeStatements } from './core/ast/clipboard';
import type { ConceptId } from './content/concepts';
import { ConceptDrawer } from './components/ConceptDrawer';
import { DEFAULT_SECTION, ROUTES, sectionPath } from './routes';

/*
  The three screens load on demand.

  Each one is a whole page that most visits never reach: someone reading the
  landing has no use for the editor's palette, interpreter and flowchart
  layout, and someone already signed in never loads the sign-in form. Bundled
  together they were downloaded by everyone regardless, which on a slow
  connection is time spent fetching pages that will not be opened.

  The editor stays in the main bundle. It is the one screen that has to be
  instant — it is where the work happens, and it is what `/app` links open
  straight into.
*/
const Landing = lazy(async () => ({ default: (await import('./components/Landing')).Landing }));
const Home = lazy(async () => ({ default: (await import('./components/Home')).Home }));
const SignIn = lazy(async () => ({ default: (await import('./components/SignIn')).SignIn }));
import { CanvasMenu } from './components/CanvasMenu';
import { CanvasToolbar } from './components/CanvasToolbar';
import { CodePanel } from './components/CodePanel';
import { Console } from './components/Console';
import { Editor } from './components/Editor';
import { ExportDialog } from './components/ExportDialog';
import { Flowchart } from './components/Flowchart';
import { Palette } from './components/Palette';
import { SettingsMenu } from './components/SettingsMenu';
import { Tour } from './components/Tour';
import { ResizeHandle } from './components/ResizeHandle';
import { RunPanel } from './components/RunPanel';
import { SaveStatus } from './components/SaveStatus';
import type { BlockCallbacks } from './components/StatementBlock';
import { I18nProvider, useTranslation } from './i18n/context';
import { DEFAULT_LANGUAGE, isLanguage, languageNames, LANGUAGES } from './i18n';
import type { Dictionary, Language } from './i18n';
import { createAlgorithmStore, createPreferenceStore } from './state/storage';
import type { Preferences } from './state/storage';
import { useAlgorithm } from './state/useAlgorithm';
import { useExecution } from './state/useExecution';
import { useSession } from './state/useSession';
import { isSupabaseConfigured } from './state/supabase';
import { useResizable } from './state/useResizable';
import { useSelection } from './state/useSelection';
import { welcomeAlgorithm } from './content/examples';
import { createEmptyAlgorithm } from './state/useAlgorithm';
import { BrandMark } from './components/BrandMark';
import './App.css';

type Theme = Preferences['theme'];

/** Views available in the bottom drawer. */
type DrawerView = 'natural' | 'pseudocode' | 'code' | 'console';

const DRAWER_TABS: DrawerView[] = ['natural', 'pseudocode', 'code', 'console'];

/**
 * The canvas shows one of two views of the same algorithm.
 *
 * The diagram used to be a fifth tab in the bottom drawer, which is a wide,
 * short strip — and a flowchart grows downwards. It rendered at 120x180 inside
 * a 926x212 slot, a thumbnail too small to read. Here it inherits the full
 * height of the canvas, and since it is the same algorithm drawn differently,
 * competing for the same space is the honest arrangement.
 */
type CanvasView = 'blocks' | 'flowchart';

function drawerTabLabel(d: Dictionary, id: DrawerView): string {
  if (id === 'natural') return d.tabs.natural;
  if (id === 'pseudocode') return d.tabs.pseudocode;
  if (id === 'code') return d.tabs.code;
  return d.tabs.console;
}

const preferenceStore = createPreferenceStore();

/**
 * Captured at module load, before any effect can write the flag back. Reading
 * it from state instead always saw `true`, because the effect that records the
 * visit runs before the workbench mounts.
 */
const IS_FIRST_VISIT = preferenceStore.read()?.visited !== true;

function initialPreferences(): Preferences {
  const stored = preferenceStore.read();
  return {
    language: isLanguage(stored?.language) ? stored.language : DEFAULT_LANGUAGE,
    theme: stored?.theme === 'dark' || stored?.theme === 'light' ? stored.theme : 'system',
    activeAlgorithmId: stored?.activeAlgorithmId ?? null,
    visited: stored?.visited ?? false,
  };
}

/** Set once a student chooses to work without an account on this browser. */
const SKIP_AUTH_KEY = 'tobot.skipAuth';

/**
 * The routing shell.
 *
 * Preferences and the session live here rather than inside a route, because
 * the theme, the language and who is signed in outlive any one screen. Each
 * route below is an address a student can bookmark, reload or send to someone
 * else; the app used to hold all of this in a state variable, so a reload
 * always landed on the same page and the back button did nothing.
 */
/** Sends the visitor to sign in, remembering where they were headed. */
function RedirectToLogin({
  to,
  remember,
}: {
  to: string;
  remember: React.MutableRefObject<string | null>;
}) {
  remember.current = to;
  return <Navigate to={ROUTES.login} replace />;
}

export default function App() {
  const navigate = useNavigate();
  /* Where to land once the gate is satisfied, whether by signing in or by
     choosing to work without an account. */
  const redirectAfterAuth = useRef<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(initialPreferences);
  const language = preferences.language as Language;
  const auth = useSession();
  const [skippedAuth, setSkippedAuth] = useState(
    () => window.localStorage.getItem(SKIP_AUTH_KEY) === 'true',
  );

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

  // Without Supabase configured there is no account layer at all, and the app
  // runs on localStorage exactly as before.
  const needsAuth = isSupabaseConfigured && !auth.session && !skippedAuth;

  if (isSupabaseConfigured && auth.loading) {
    return (
      <I18nProvider language={language}>
        <div className="app app--loading" />
      </I18nProvider>
    );
  }

  const skipAuth = (): void => {
    window.localStorage.setItem(SKIP_AUTH_KEY, 'true');
    setSkippedAuth(true);
  };

  /*
   * Reopens the gate for someone working locally who decides to sign in.
   *
   * Both halves matter, and only clearing storage was the bug: `skippedAuth`
   * stayed true in React, so `/login` evaluated `needsAuth` as false and
   * redirected straight back, which looked like a button that did nothing.
   * The state is what the routes read; storage is only what survives a reload.
   */
  const reopenAuth = (): void => {
    window.localStorage.removeItem(SKIP_AUTH_KEY);
    setSkippedAuth(false);
    // Back to the library once they are in, not to a fixed page.
    redirectAfterAuth.current = ROUTES.library;
  };

  return (
    <I18nProvider language={language}>
      {/* The same blank surface the session check already shows, so a slow
          connection sees one continuous loading state rather than a flash of
          one placeholder replaced by another. */}
      <Suspense fallback={<div className="app app--loading" />}>
        <Routes>
          <Route
            path={ROUTES.landing}
            element={
              <Landing
                language={language}
                onLanguageChange={(next) =>
                  setPreferences((current) => ({ ...current, language: next }))
                }
                theme={preferences.theme}
                onThemeChange={(next) => setPreferences((current) => ({ ...current, theme: next }))}
                onTry={() => {
                  /* Straight in without the gate: a visitor who has to sign in
                     before seeing anything mostly leaves, and the account is
                     offered once there is work worth keeping.

                     To the library rather than the editor, so the first thing
                     they meet is the examples and their own work — dropping
                     someone into an empty canvas asks them to invent a problem
                     before they have seen one solved. */
                  skipAuth();
                  navigate(ROUTES.library);
                }}
              />
            }
          />
          <Route
            path={ROUTES.login}
            element={
              // Someone already signed in has no business on the sign-in page.
              needsAuth ? (
                <SignIn onSkip={skipAuth} />
              ) : (
                // Back to wherever the gate interrupted them, not to a fixed
                // page: someone sent to sign in from the editor wants the
                // editor, not the library.
                <Navigate to={redirectAfterAuth.current ?? ROUTES.library} replace />
              )
            }
          />
          {/*
            The library's sections are addresses, not state. `/library` on its
            own carries no information about what you are looking at, so it
            redirects to the default section rather than rendering one — that
            way every view of the library has a URL that names it.
          */}
          <Route
            path={ROUTES.library}
            element={<Navigate to={sectionPath(DEFAULT_SECTION)} replace />}
          />
          <Route
            path={`${ROUTES.library}/:section`}
            element={
              needsAuth ? (
                <RedirectToLogin to={ROUTES.library} remember={redirectAfterAuth} />
              ) : (
                <Workspace
                  preferences={preferences}
                  setPreferences={setPreferences}
                  auth={auth}
                  onSignOut={() => void auth.signOut()}
                  onSignIn={reopenAuth}
                />
              )
            }
          />
          <Route
            path={ROUTES.editor}
            element={
              needsAuth ? (
                <RedirectToLogin to={ROUTES.editor} remember={redirectAfterAuth} />
              ) : (
                <Workspace
                  preferences={preferences}
                  setPreferences={setPreferences}
                  auth={auth}
                  onSignOut={() => void auth.signOut()}
                  onSignIn={reopenAuth}
                />
              )
            }
          />
          {/* An unknown address is a typo, not an error worth a page. */}
          <Route path="*" element={<Navigate to={ROUTES.landing} replace />} />
        </Routes>
      </Suspense>
    </I18nProvider>
  );
}

interface WorkspaceProps {
  preferences: Preferences;
  setPreferences: React.Dispatch<React.SetStateAction<Preferences>>;
  auth: ReturnType<typeof useSession>;
  onSignOut: () => void;
  /** Reopens the gate: owned by App, because App is what the routes read. */
  onSignIn: () => void;
}

/** The editor and its library: everything behind the sign-in gate. */
function Workspace({
  preferences,
  setPreferences,
  auth,
  onSignOut,
  onSignIn,
}: WorkspaceProps) {
  const language = preferences.language as Language;

  return (
    <I18nProvider language={language}>
      <Workbench
        email={auth.email}
        displayName={auth.displayName}
        initials={auth.initials}
        onSignOut={onSignOut}
        onSignIn={onSignIn}
        firstVisit={IS_FIRST_VISIT}
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
  /** Signed-in student's email, or `null` when working locally. */
  email: string | null;
  /** Their name, falling back to the email's local part. */
  displayName: string | null;
  /** One or two letters for the avatar. */
  initials: string | null;
  onSignOut: () => void;
  onSignIn: () => void;
  /** True until the student has opened the app once. */
  firstVisit: boolean;
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
function Workbench({
  email,
  displayName,
  initials,
  onSignOut,
  onSignIn,
  firstVisit,
  theme,
  onThemeChange,
  onLanguageChange,
}: WorkbenchProps) {
  const { d, language } = useTranslation();

  /**
   * A newcomer starts with the welcome example; anyone returning starts blank
   * and has their own work loaded below. Seeding the example on every mount
   * meant deleting it never stuck — it was recreated and re-saved next load.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(
    () => (firstVisit ? welcomeAlgorithm(language) : createEmptyAlgorithm(d.app.untitled)),
    [],
  );
  const controller = useAlgorithm(initial, d.app.untitled);
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
  const selection = useSelection(algorithm.body);
  const [showExport, setShowExport] = useState(false);
  /*
   * Which screen shows is the URL's job now, not a piece of state: `/app` is
   * the editor and `/mis-algoritmos` the library. Every screen has an address
   * a student can bookmark, reload or share, and the back button walks them.
   */
  const location = useLocation();
  const navigate = useNavigate();
  const screen: 'home' | 'editor' = location.pathname === ROUTES.editor ? 'editor' : 'home';
  const setScreen = useCallback(
    (next: 'home' | 'editor') => {
      navigate(next === 'editor' ? ROUTES.editor : ROUTES.library);
    },
    [navigate],
  );
  /** Bumped on save so the library list picks up name and size changes. */
  const [libraryRevision, setLibraryRevision] = useState(0);

  /*
   * The canvas starts alone with the robot.
   *
   * All three panels open meant an editor that was mostly panels, and the
   * palette in particular was permanent furniture for something used a few
   * times per algorithm. Instructions come from the toolbar on the canvas
   * now, so the panel is a place to browse rather than the only way in.
   *
   * The robot stays: it is what runs the program and answers back, and
   * without it the app opens mute.
   */
  /*
    Whether the name outgrew the field, which decides the fade at its edge.
    Measured rather than guessed: only the browser knows whether this name,
    in this font, at this window size, ran past the cap. Watched with a
    `ResizeObserver` so a window resize is caught too, not just a rename.
  */
  const titleWrap = useRef<HTMLSpanElement>(null);
  const [titleClipped, setTitleClipped] = useState(false);

  useEffect(() => {
    const wrap = titleWrap.current;
    if (!wrap) return;

    const measure = (): void => {
      const input = wrap.querySelector('input');
      if (input) setTitleClipped(input.scrollWidth > input.clientWidth + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [algorithm.name]);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [robotOpen, setRobotOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>('natural');
  const [canvasView, setCanvasView] = useState<CanvasView>('blocks');
  // The tour opens itself on a first visit and can be replayed from the header.
  const [tourOpen, setTourOpen] = useState(false);
  /**
   * The tour points at the editor's own regions, so it waits until the student
   * actually opens the editor. Starting it over the landing view highlighted
   * elements that were not on screen.
   */
  const tourPending = useRef(firstVisit);

  /**
   * Records the visit, written straight through the store because the write
   * effect above runs before this one on the first render.
   *
   * It lives here rather than in `App`, which also mounts behind the sign-in
   * screen: marking the visit there meant a student who signed in counted as
   * "returning" before ever reaching the editor, so the tour never ran.
   */
  useEffect(() => {
    const stored = preferenceStore.read();
    if (stored?.visited) return;
    preferenceStore.write({
      language: stored?.language ?? DEFAULT_LANGUAGE,
      theme: stored?.theme ?? 'system',
      activeAlgorithmId: stored?.activeAlgorithmId ?? null,
      visited: true,
    });
  }, []);

  useEffect(() => {
    if (screen !== 'editor' || !tourPending.current) return;
    // A ref rather than state: StrictMode mounts twice, and clearing a state
    // flag on the first pass left nothing for the second to act on, so the
    // tour never opened.
    tourPending.current = false;
    // A beat, so the editor has painted before the spotlight measures it.
    const timer = setTimeout(() => setTourOpen(true), 240);
    return () => clearTimeout(timer);
  }, [screen]);

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

  /**
   * Where a pasted block should land.
   *
   * The drop zone under the pointer when there is one, so pasting goes where
   * the student is looking — and below the selection otherwise, which is what
   * happens when the paste comes from the keyboard and the mouse is nowhere
   * near the canvas. Without that fallback, Ctrl+V with the pointer outside
   * would have nowhere to put anything.
   */
  const pasteLocation = useCallback((): SlotLocation => {
    const stack = document.elementsFromPoint(pointer.current.x, pointer.current.y);

    /* A drop zone, when the pointer happens to be on one. */
    const zone = stack.find((element) => element.classList.contains('drop-zone')) as
      | HTMLElement
      | undefined;
    if (zone?.dataset.parentId !== undefined) {
      return {
        parentId: zone.dataset.parentId || null,
        slot: (zone.dataset.slot as SlotLocation['slot']) || null,
        index: Number(zone.dataset.index ?? 0),
      };
    }

    /*
      Otherwise, below the block the pointer is over.

      Zones are thin strips between blocks, so aiming at one is a few pixels of
      luck — the pointer is almost always over a block instead, and pasting
      then fell back to the selection, which is nowhere near where the student
      was pointing. The innermost block is the one meant: pointing inside a
      loop should paste inside it.
    */
    const hovered = stack.find((element) => element.classList.contains('statement-block')) as
      | HTMLElement
      | undefined;
    const hoveredAt = hovered?.dataset.nodeId
      ? findLocation(algorithm.body, hovered.dataset.nodeId)
      : null;
    if (hoveredAt) return { ...hoveredAt, index: hoveredAt.index + 1 };

    /* And with the pointer off the canvas — a paste from the keyboard — below
       whatever is selected, or at the end. */
    const last = selection.ids[selection.ids.length - 1];
    const below = last ? findLocation(algorithm.body, last) : null;
    if (below) return { ...below, index: below.index + 1 };
    return { parentId: null, slot: null, index: algorithm.body.length };
  }, [algorithm.body, selection.ids]);

  const copySelection = useCallback(async (): Promise<Statement[]> => {
    const picked = selection.ids
      .map((id) => findStatement(algorithm.body, id))
      .filter((statement): statement is Statement => statement !== null);
    if (picked.length > 0) await navigator.clipboard.writeText(encodeStatements(picked));
    return picked;
  }, [algorithm.body, selection.ids]);

  const cutSelection = useCallback(async () => {
    const picked = await copySelection();
    if (picked.length === 0) return;
    controller.removeMany(selection.ids);
    selection.clear();
  }, [controller, copySelection, selection]);

  const pasteFromClipboard = useCallback(async () => {
    const text = await navigator.clipboard.readText().catch(() => '');
    const statements = decodeStatements(text);
    if (!statements) return;
    controller.addMany(statements, pasteLocation());
    selection.set(statements.map((statement) => statement.id));
  }, [controller, pasteLocation, selection]);

  /* Where the pointer last was, so a paste can land under it. Read from a ref
     rather than state: it changes constantly and nothing renders from it. */
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      pointer.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      /* Inside a field these belong to the text being typed: Ctrl+C there must
         copy the characters, not the block around them. */
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) controller.redo();
        else controller.undo();
        return;
      }
      if (key === 'c' && selection.ids.length > 0) {
        event.preventDefault();
        void copySelection();
        return;
      }
      if (key === 'x' && selection.ids.length > 0) {
        event.preventDefault();
        void cutSelection();
        return;
      }
      if (key === 'v') {
        event.preventDefault();
        void pasteFromClipboard();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controller, selection, copySelection, cutSelection, pasteFromClipboard]);

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
    /* `data-flash`, not `data-selected`: this is a moment's highlight for a
       block the student clicked in the console or the diagram, and the
       selection is a state they control. Sharing the attribute meant the flash
       cleared a real selection 1.4 seconds later. */
    element.setAttribute('data-flash', 'true');
    const timer = setTimeout(() => element.removeAttribute('data-flash'), 1400);
    return () => clearTimeout(timer);
  }, [selectedNode]);

  /*
    Blocks whose last type change discarded something.

    Tied to the body it was recorded against, rather than cleared by a timer
    or an effect. Any further edit — including the undo the message suggests —
    produces a different body, and the notice stops applying on its own. An
    effect watching the body would have fired on the re-type itself and erased
    the notice before it was ever seen.
  */
  const [retypeLoss, setRetypeLoss] = useState<{ nodeId: NodeId; wasBody: Statement[] } | null>(
    null,
  );
  const onRetypeLoss = useCallback(
    (nodeId: NodeId) => {
      /*
        The body as it still is here, which is the one *before* the change.

        `update` dispatches to a reducer, so at this point React has not
        produced the new state yet: reading the algorithm now gives the value
        the student is replacing, not the converted one. Recording that is the
        reliable half — on the next render it will have become the previous
        body, and that is what identifies this exact edit.
      */
      setRetypeLoss({ nodeId, wasBody: controller.algorithm.body });
    },
    [controller.algorithm],
  );
  const retypeLosses = useMemo<ReadonlySet<NodeId>>(
    () =>
      /* Shown only while the last edit is still the one that lost content.
         Any further edit — or the undo the message suggests — pushes a
         different body onto the history and the notice stops applying. */
      retypeLoss && controller.previousBody === retypeLoss.wasBody
        ? new Set([retypeLoss.nodeId])
        : new Set<NodeId>(),
    [retypeLoss, controller.previousBody],
  );

  const callbacks = useMemo<BlockCallbacks>(
    () => ({
      update: controller.update,
      remove: controller.remove,
      add: controller.add,
      move: controller.move,
      rename: controller.renameVariable,
      onSelect: selection.select,
      isSelected: selection.has,
      onSelectMany: selection.selectMany,
      duplicate: controller.duplicate,
      onExplain: showConcept,
      onRetypeLoss,
    }),
    [
      onRetypeLoss,
      controller.update,
      controller.remove,
      controller.add,
      controller.move,
      controller.renameVariable,
      controller.duplicate,
      showConcept,
      /* `has` closes over the current selection, so leaving it out froze the
         object at the first render: blocks kept asking a stale function
         whether they were selected, and it always said no. */
      selection.select,
      selection.has,
      selection.selectMany,
    ],
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
    setScreen('editor');
  }, [load, d.app.untitled, setScreen]);

  /** Opening anything from the landing view moves to the editor with it. */
  const openAlgorithm = useCallback(
    (next: Parameters<typeof load>[0]) => {
      load(next);
      setScreen('editor');
    },
    [load, setScreen],
  );

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
      {screen === 'editor' && (
      <header className="app__header">
        {/* The mark doubles as the way home, which is where a logo usually
            leads and saves reaching for the house button. */}
        <h1 className="app__brand">
          <button
            type="button"
            className="app__brand-button"
            onClick={() => setScreen('home')}
            title={d.home.goHome}
          >
            <BrandMark size={26} className="app__mark" />
            <span className="app__name">{d.app.name}</span>
          </button>
        </h1>

        {/*
          The field takes the width of the name inside it, so the save state
          sits beside the title rather than across a gap of empty box.

          An input cannot size itself to its content, so the width comes from
          a mirror: a span holding the same text, in the same font, that the
          input is stretched over. It carries the placeholder when the name is
          empty, so a blank title still has somewhere to be typed.
        */}
        <span className="app__doc-title-wrap" ref={titleWrap} data-clipped={titleClipped}>
          <span className="app__doc-title-mirror" aria-hidden="true">
            {algorithm.name || d.app.untitled}
          </span>
          <input
            className="app__doc-title"
            /* An input carries a default `size` of 20 characters, which the
               grid honours as a minimum and which pinned short names to a
               fixed width. Set to 1, the mirror alone decides. */
            size={1}
            value={algorithm.name}
            onChange={(event) => controller.setName(event.target.value)}
            aria-label={d.actions.rename}
            placeholder={d.app.untitled}
            /* Readable on hover too, for a name long enough to be clipped —
               otherwise checking which document this is means clicking into
               it, and clicking into a name is how names get edited by
               accident. */
            title={algorithm.name || undefined}
            /*
              A click lands the caret mid-word and leaves the field scrolled
              to that point, so a clipped name opens showing its middle — the
              start lost, the end still out of view. Scrolling back to zero
              means the name reads from the beginning the moment it is wide
              enough to read at all.

              Only on the way in: once someone is typing, moving their view is
              the last thing they want.
            */
            onFocus={(event) => {
              event.currentTarget.scrollLeft = 0;
            }}
          />
        </span>

        {/* Beside the name it belongs to, rather than in the actions cluster:
            it is a fact about this document, not something to press. */}
        <SaveStatus state={controller.saveState} />

        <div className="app__header-actions">
          {/* Inside the editor this always means "go home"; the landing view
              has its own way back. */}
          <button
            type="button"
            className="app__icon-button"
            onClick={() => setScreen('home')}
            title={d.home.goHome}
            aria-label={d.home.goHome}
          >
            <House />
          </button>

          <span className="app__divider" aria-hidden="true" />

          <div className="app__history">
            <button
              type="button"
              className="app__icon-button"
              onClick={controller.undo}
              disabled={!controller.canUndo}
              title={`${d.actions.undo} · ⌘Z`}
              aria-label={d.actions.undo}
            >
              <ArrowCounterClockwise weight="bold" />
            </button>
            <button
              type="button"
              className="app__icon-button"
              onClick={controller.redo}
              disabled={!controller.canRedo}
              title={`${d.actions.redo} · ⇧⌘Z`}
              aria-label={d.actions.redo}
            >
              <ArrowClockwise weight="bold" />
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
              <SidebarSimple weight={paletteOpen ? 'fill' : 'regular'} />
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
              {/* The same sidebar mark rotated to point down, so all three toggles
                  read as one family aimed at their own panel. */}
              <SidebarSimple
                weight={drawerOpen ? 'fill' : 'regular'}
                style={{ transform: 'rotate(-90deg)' }}
              />
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
              {/* Mirrored so the icon points at the rail it controls. */}
              <SidebarSimple
                weight={robotOpen ? 'fill' : 'regular'}
                style={{ transform: 'scaleX(-1)' }}
              />
            </button>
          </div>

          <span className="app__divider" aria-hidden="true" />

          <button
            type="button"
            className="app__icon-button"
            onClick={() => setTourOpen(true)}
            title={d.tour.replay}
            aria-label={d.tour.replay}
          >
            <Compass />
          </button>
          <button
            type="button"
            className="app__icon-button"
            onClick={() => setOpenConcept('variables')}
            title={d.concepts.title}
            aria-label={d.concepts.title}
          >
            <BookOpenText />
          </button>
          <button
            type="button"
            className="app__icon-button"
            onClick={() => setShowExport(true)}
            title={d.actions.export}
            aria-label={d.actions.export}
          >
            <Export />
          </button>

          <span className="app__divider" aria-hidden="true" />

          {/* Language and theme are peers, so they share one control shape: an
              icon with the native select laid transparently over it. */}
          <span className="app__settings">
            <SettingsMenu
              value={language}
              options={LANGUAGES.map((code) => ({ value: code, label: languageNames[code] }))}
              onChange={onLanguageChange}
              trigger={Translate}
              label={d.settings.language}
            />
            <SettingsMenu
              value={theme}
              options={[
                { value: 'system' as Theme, label: d.settings.themeSystem, icon: Desktop },
                { value: 'light' as Theme, label: d.settings.themeLight, icon: Sun },
                { value: 'dark' as Theme, label: d.settings.themeDark, icon: Moon },
              ]}
              onChange={onThemeChange}
              trigger={theme === 'dark' ? Moon : theme === 'light' ? Sun : Desktop}
              label={d.settings.theme}
            />
          </span>

          {/* Who is working, at the end of the bar where an account belongs.
              Only when signed in: locally there is no one to name. */}
          {displayName && (
            <>
              <span className="app__divider" aria-hidden="true" />
              <span className="app__user" title={email ?? displayName}>
                <span className="app__user-avatar" aria-hidden="true">
                  {initials ?? '?'}
                </span>
                <span className="app__user-name">{displayName}</span>
              </span>
            </>
          )}

          <button type="button" className="app__run" onClick={startRun}>
            <Play weight="fill" /> {d.actions.run}
          </button>
        </div>
      </header>
      )}

      {screen === 'home' ? (
        <main className="app__main app__main--home">
          <Home
            revision={libraryRevision}
            language={language}
            theme={theme}
            onLanguageChange={onLanguageChange}
            onThemeChange={onThemeChange}
            onOpen={openAlgorithm}
            onCreate={createNew}
            onOpenConcept={setOpenConcept}
              currentName={algorithm.name}
            onBackToEditor={() => setScreen('editor')}
            email={email}
            displayName={displayName}
            initials={initials}
            onSignOut={onSignOut}
            onSignIn={onSignIn}
          />
        </main>
      ) : (
      <main className="app__main">
        {paletteOpen && (
          <aside className="app__palette">
            <Palette onAdd={appendStatement} />
            <ResizeHandle resizable={paletteSize} edge="right" label={d.panels.resize} />
          </aside>
        )}

        <div className="app__center">
          <div className="app__canvas-tabs" role="tablist" aria-label={d.panels.canvas}>
            {(['blocks', 'flowchart'] as CanvasView[]).map((view) => (
              <button
                key={view}
                type="button"
                role="tab"
                className="app__canvas-tab"
                aria-selected={canvasView === view}
                data-active={canvasView === view || undefined}
                onClick={() => setCanvasView(view)}
              >
                {view === 'blocks' ? <SquaresFour weight="bold" /> : <TreeStructure weight="bold" />}
                {view === 'blocks' ? d.tabs.blocks : d.tabs.flowchart}
              </button>
            ))}
          </div>

          <div className="app__canvas" data-view={canvasView}>
            {/*
              Both stay mounted. The editor keeps its scroll position while the
              diagram is up, and the diagram's SVG has to exist in the DOM for
              the export to find it.
            */}
            <div className="app__canvas-pane" data-visible={canvasView === 'blocks' || undefined}>
              {/* Right-clicking a block reaches its own actions. The icons on
                  the block do the same, but they are small, three of them, and
                  only there while the pointer is over the row. */}
              <CanvasMenu
                body={algorithm.body}
                /* Deleting acts on the selection, which right-clicking has
                   just made sure includes the block under the pointer. */
                onRemove={() => {
                  controller.removeMany(selection.ids);
                  selection.clear();
                }}
                onExplain={showConcept}
                selectedCount={selection.ids.length}
                onSelect={(id) => {
                  /* Right-clicking inside an existing selection keeps it —
                     otherwise selecting three blocks and right-clicking one of
                     them would silently drop the other two before the menu's
                     actions ran on them. */
                  if (!selection.has(id)) selection.select(id, false);
                }}
                clipboard={{
                  copy: () => void copySelection(),
                  cut: () => void cutSelection(),
                  paste: () => void pasteFromClipboard(),
                  hasSelection: selection.ids.length > 0,
                }}
              >
                <Editor
                  algorithm={algorithm}
                  callbacks={callbacks}
                  activeNodeId={activeNodeId}
                  erroredNodeId={erroredNodeId}
                  retypeLosses={retypeLosses}
                />
              </CanvasMenu>
              {/* On the canvas rather than in a panel, so closing the palette
                  no longer leaves the editor with no way to add anything. */}
              <CanvasToolbar onAdd={appendStatement} />
            </div>
            <div
              className="app__canvas-pane"
              data-visible={canvasView === 'flowchart' || undefined}
            >
              <Flowchart
                program={algorithm.body}
                activeNodeId={activeNodeId}
                erroredNodeId={erroredNodeId}
                onSelectNode={setSelectedNode}
              />
            </div>
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
                {drawerOpen ? <CaretDown weight="bold" /> : <CaretUp weight="bold" />}
              </button>
            </div>

            {drawerOpen && (
              <div className="app__drawer-body">
                {/* Both stay mounted so switching tabs keeps scroll position. */}
                <div
                  className="app__drawer-pane"
                  data-hidden={drawerView === 'console' || undefined}
                >
                  <CodePanel
                    algorithm={algorithm}
                    view={drawerView === 'console' ? 'natural' : drawerView}
                    activeNodeId={activeNodeId}
                    erroredNodeId={erroredNodeId}
                    onSelectNode={setSelectedNode}
                    onExport={() => setShowExport(true)}
                  />
                </div>
                <div
                  className="app__drawer-pane"
                  data-hidden={drawerView !== 'console' || undefined}
                >
                  <Console
                    output={execution.state.output}
                    variables={execution.state.variables}
                    onSelectNode={setSelectedNode}
                    onClear={execution.stop}
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        {robotOpen && (
          <aside className="app__robot">
            <ResizeHandle resizable={robotSize} edge="left" label={d.panels.resize} />
            <RunPanel execution={execution} />
          </aside>
        )}
      </main>
      )}

      <Tour open={tourOpen} onClose={() => setTourOpen(false)} />

      <ConceptDrawer
        conceptId={openConcept}
        onClose={() => setOpenConcept(null)}
        onNavigate={setOpenConcept}
      />

      {showExport && <ExportDialog algorithm={algorithm} onClose={() => setShowExport(false)} />}
    </div>
  );
}

