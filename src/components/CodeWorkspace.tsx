import {
  CopyIcon as CopyMark,
  DownloadSimpleIcon as Download,
  KeyboardIcon as Keys,
  MagnifyingGlassIcon as Find,
  PlayIcon as Play,
  StopIcon as Stop,
  TextAlignLeftIcon as Wrap,
  TextAaIcon as TextSize,
  BracketsCurlyIcon as Format,
} from '@phosphor-icons/react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { WorldState } from '../core/world/types';

import { VOCABULARY } from '../core/code/vocabulary';
import type { VocabularyEntry } from '../core/code/vocabulary';
import type { FormatOutcome } from '../core/code/format';
import type { CodeExecutionController } from '../state/useCodeExecution';
import { useTranslation } from '../i18n/context';
import type { CodeEditorHandle, CodeEditorReport } from './CodeEditor';
import type { Resizable } from '../state/useResizable';
import { Console } from './Console';
import { ResizeHandle } from './ResizeHandle';
import { Skeleton } from './Skeleton';
import { Robot } from './Robot';
import type { RobotMood } from './Robot';
import './CodeWorkspace.css';

/* CodeMirror is the largest thing this app can load, and only this screen
   needs it. Same arrangement as the auth client: fetched when it is opened,
   never before. */
const CodeEditor = lazy(async () => ({ default: (await import('./CodeEditor')).CodeEditor }));

const MIN_SIZE = 11;
const MAX_SIZE = 28;
/* Beside the panel sizes, which use the same idiom. */
const ZOOM_KEY = 'tobot.size.code';

interface CodeWorkspaceProps {
  source: string;
  onChange: (next: string) => void;
  execution: CodeExecutionController;
  /** Handed up so the header's undo and redo drive the editor's own history. */
  onEditorReady?: (handle: CodeEditorHandle) => void;
  onReport?: (report: CodeEditorReport) => void;
  /** Opens the concept drawer from the editor's hover card. */
  onConcept: (id: string) => void;
  /* The same rails the block workbench has, driven by the same hooks. They are
     built in `Workspace` regardless of document kind, so nothing new is created
     here — this screen just stopped ignoring them. */
  robotOpen: boolean;
  drawerOpen: boolean;
  robotSize: Resizable;
  drawerSize: Resizable;
  /** Someone else's work, open to be read and run but not changed. */
  readOnly?: boolean;
  /** What the work asks for, at the top of the rail. */
  brief?: ReactNode;
  /** The world a run starts from, when the document has one. */
  world?: WorldState | null;
  /** Its scene, drawn above the robot. */
  scene?: ReactNode;
  /** What the world adds to what can be written: its functions. */
  vocabulary?: VocabularyEntry[];
}

/**
 * The workbench for a code document.
 *
 * The same three parts as the block workbench — a surface to author on, the
 * robot that runs it, and the transcript underneath — with the two that cannot
 * follow left out. There is no flowchart and no step-by-step here, because
 * both are projections of a tree and this document has none; pretending
 * otherwise would mean parsing the text, which is the one thing this app was
 * built never to do.
 *
 * What does follow is everything that makes a run legible: `Console` and
 * `Robot` are rendered untouched, because the code runner reports itself in
 * the same shape the interpreter does.
 */
export function CodeWorkspace({
  source,
  onChange,
  execution,
  onEditorReady,
  onReport,
  onConcept,
  robotOpen,
  drawerOpen,
  robotSize,
  drawerSize,
  readOnly = false,
  brief,
  world = null,
  scene,
  vocabulary,
}: CodeWorkspaceProps) {
  const { d, t } = useTranslation();
  const [reply, setReply] = useState('');
  const [wrap, setWrap] = useState(true);
  /* Read back on mount. It reset to 14 every time the editor was closed, which
     for a student who needs larger type means setting it again on every visit. */
  const [fontSize, setFontSize] = useState(() => {
    try {
      const stored = Number(window.localStorage.getItem(ZOOM_KEY));
      return Number.isFinite(stored) && stored >= MIN_SIZE && stored <= MAX_SIZE ? stored : 15;
    } catch {
      return 15;
    }
  });

  const zoom = useCallback((next: number) => {
    const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, next));
    setFontSize(size);
    try {
      window.localStorage.setItem(ZOOM_KEY, String(size));
    } catch {
      // Private mode or a full quota; the size still applies for this visit.
    }
  }, []);
  const [copied, setCopied] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [where, setWhere] = useState<CodeEditorReport | null>(null);
  const handle = useRef<CodeEditorHandle | null>(null);
  /* State and not just the ref: the toolbar has to re-render when the editor
     finally arrives. Until then its buttons were enabled and did nothing. */
  const [editorReady, setEditorReady] = useState(false);
  /* Why the last format did nothing, until the next edit makes it stale. A
     program with a mistake in it cannot be laid out, and a button that silently
     does nothing is the one answer a student cannot act on. */
  const [formatFault, setFormatFault] = useState<{ line: number | null } | null>(null);
  const formatted = useCallback((outcome: FormatOutcome) => {
    setFormatFault(outcome.ok ? null : { line: outcome.line });
  }, []);
  useEffect(() => setFormatFault(null), [source]);

  const { state } = execution;
  const asking = state.status === 'awaitingInput';

  const ready = useCallback(
    (api: CodeEditorHandle) => {
      handle.current = api;
      setEditorReady(true);
      onEditorReady?.(api);
    },
    [onEditorReady],
  );

  const report = useCallback(
    (next: CodeEditorReport) => {
      setWhere(next);
      onReport?.(next);
    },
    [onReport],
  );

  /*
    What the robot says, decided the same way `RunPanel` decides it.

    The last *spoken* line, not the last entry of any kind — taking whatever
    came last meant that right after answering a question the robot repeated
    the student's own answer back at them. And a silent robot on arrival made
    the screen look broken before anything had run, so idle has a greeting here
    exactly as it does in the block workbench.
  */
  const lastSpoken = [...state.output].reverse().find((entry) => entry.kind === 'say');
  const lastFault = [...state.output].reverse().find((entry) => entry.kind === 'error');

  const message = (() => {
    if (state.status === 'error') return lastFault?.text ?? d.robot.error;
    if (asking) return state.pendingPrompt;
    if (state.status === 'idle') return d.robot.greeting;
    if (state.status === 'finished') return lastSpoken?.text ?? d.robot.done;
    return lastSpoken?.text ?? d.robot.thinking;
  })();

  /* `speaking` was unreachable, so the robot's mouth never moved on this
     screen while a program was printing. */
  const mood: RobotMood =
    state.status === 'error'
      ? 'error'
      : asking
        ? 'asking'
        : state.status === 'finished'
          ? 'done'
          : state.status === 'running'
            ? (state.output[state.output.length - 1]?.kind === 'say' ? 'speaking' : 'thinking')
            : 'idle';

  /* The strip under the robot, which the block workbench has and this did not:
     a program that finished, failed or is waiting said so nowhere. */
  const statusText = (() => {
    if (state.status === 'error') return d.robot.error;
    if (state.status === 'finished') return d.runtime.finished;
    if (asking) return d.runtime.waitingInput;
    if (state.status === 'running') return d.runtime.running;
    return d.robot.idle;
  })();

  const send = (event: React.FormEvent): void => {
    event.preventDefault();
    execution.answer(reply);
    setReply('');
  };

  const problems = where?.problems ?? 0;

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Denied permission or an insecure origin; nothing worth a message.
    }
  };

  /* Built and revoked around the click. A URL held for the life of the page
     pins the whole program in memory for a download that already happened. */
  const save = (): void => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tobot.js';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="codework">
      <div className="codework__main">
        {/* The controls that belong to the text rather than to the program.
            They live over the editor because that is what they act on, and
            because the header is already full of things that act on the
            document as a whole. */}
        <div className="codework__tools">
          <button
            type="button"
            className="codework__tool"
            onClick={() => handle.current?.find()}
            disabled={!editorReady}
            title={`${d.code.find} · ⌘F`}
            aria-label={d.code.find}
          >
            <Find weight="bold" />
          </button>
          <button
            type="button"
            className="codework__tool"
            data-active={wrap || undefined}
            onClick={() => setWrap(!wrap)}
            title={d.code.wrap}
            aria-label={d.code.wrap}
            aria-pressed={wrap}
          >
            <Wrap weight="bold" />
          </button>

          <span className="codework__tool-divider" aria-hidden="true" />

          <button
            type="button"
            className="codework__tool"
            onClick={() => zoom(fontSize - 1)}
            disabled={fontSize <= MIN_SIZE}
            title={d.code.textSmaller}
            aria-label={d.code.textSmaller}
          >
            <TextSize weight="bold" className="codework__tool-small" />
          </button>
          <button
            type="button"
            className="codework__tool"
            onClick={() => zoom(fontSize + 1)}
            disabled={fontSize >= MAX_SIZE}
            title={d.code.textBigger}
            aria-label={d.code.textBigger}
          >
            <TextSize weight="bold" />
          </button>

          <button
            type="button"
            className="codework__tool"
            onClick={() => void handle.current?.format().then(formatted)}
            disabled={!editorReady || readOnly}
            title={`${d.code.format} · Shift+Alt+F`}
            aria-label={d.code.format}
          >
            <Format weight="bold" />
          </button>

          <button
            type="button"
            className="codework__tool"
            data-active={showKeys || undefined}
            onClick={() => setShowKeys(!showKeys)}
            title={d.code.shortcuts}
            aria-label={d.code.shortcuts}
            aria-pressed={showKeys}
          >
            <Keys weight="bold" />
          </button>

          <span className="codework__tool-divider" aria-hidden="true" />

          {/* Taking the work out. The block workbench exports through a dialog
              that offers four languages; a code document is already written in
              one, so the two useful verbs are the clipboard and a file. */}
          <button
            type="button"
            className="codework__tool"
            onClick={() => void copy()}
            title={copied ? d.code.copied : d.code.copy}
            aria-label={d.code.copy}
            data-active={copied || undefined}
          >
            <CopyMark weight="bold" />
          </button>
          <button
            type="button"
            className="codework__tool"
            onClick={save}
            title={d.code.download}
            aria-label={d.code.download}
          >
            <Download weight="bold" />
          </button>
        </div>

        {/* None of these are guessable, and the two that matter most — running,
            and asking what you can use — are the ones a student needs on their
            first minute here. */}
        {showKeys && (
          <dl className="codework__keys">
            <dt>Ctrl/⌘ + Enter</dt>
            <dd>{d.code.shortcutRun}</dd>
            <dt>Ctrl/⌘ + {d.code.space}</dt>
            <dd>{d.code.shortcutComplete}</dd>
            <dt>Ctrl/⌘ + F</dt>
            <dd>{d.code.shortcutFind}</dd>
            <dt>Ctrl/⌘ + Z</dt>
            <dd>{d.code.shortcutUndo}</dd>
            <dt>Shift + Alt + F</dt>
            <dd>{d.code.format}</dd>
          </dl>
        )}

        <div className="codework__editor">
          {/* Shaped like code rather than an empty frame: a slow chunk should
              look like an editor arriving, not like a panel that failed. */}
          <Suspense
            fallback={
              <div className="codework__loading" aria-busy="true">
                <Skeleton lines={['45%', '70%', '30%', '60%', '25%']} />
              </div>
            }
          >
            <CodeEditor
              onRun={() => execution.run(source, world)}
              onConcept={onConcept}
              value={source}
              onChange={onChange}
              wrap={wrap}
              fontSize={fontSize}
              onReady={ready}
              onReport={report}
              readOnly={readOnly}
              vocabulary={vocabulary}
              onFormatted={formatted}
            />
          </Suspense>
        </div>

        {/* Where the cursor is and how much is wrong: the two things an editor
            is expected to say about itself, and the two this one could not. */}
        <div className="codework__status">
          <span>
            {where
              ? t('code.position', { line: where.line, column: where.column })
              : t('code.position', { line: 1, column: 1 })}
          </span>
          {formatFault !== null && (
            /* Pressing it leads to the line, like the warning count does. */
            <button
              type="button"
              className="codework__warning"
              role="status"
              onClick={() => formatFault.line && handle.current?.goToLine(formatFault.line)}
            >
              {formatFault.line
                ? t('code.formatFailedAt', { line: formatFault.line })
                : d.code.formatFailed}
            </button>
          )}
          {problems === 0 ? (
            <span>{d.code.noProblems}</span>
          ) : (
            /* A count that cannot be reached is a count worth little: pressing
               it puts the cursor on the line it is counting. */
            <button
              type="button"
              className="codework__warning"
              onClick={() =>
                where?.firstProblemLine && handle.current?.goToLine(where.firstProblemLine)
              }
              title={d.code.goToProblem}
            >
              {problems === 1 ? d.code.problemsOne : t('code.problems', { count: problems })}
            </button>
          )}
        </div>

        {drawerOpen && (
        <div className="codework__console">
          <ResizeHandle resizable={drawerSize} edge="top" label={d.panels.resize} />
          <Console
            output={state.output}
            variables={state.variables}
            /* Nothing to select: a line of output came from text, not from a
               statement with an id. */
            onSelectNode={() => {}}
            onClear={execution.clear}
          />
        </div>
        )}
      </div>

      {robotOpen && (
      <aside className="codework__robot" aria-label={d.a11y.robotStage}>
        <ResizeHandle resizable={robotSize} edge="left" label={d.panels.resize} />
        {brief}
        {scene}
        <Robot mood={mood} message={message} />

        {/*
          The run controls, beside the thing that runs.

          They were left to the header alone, on the reasoning that two buttons
          doing one job is one too many. That was wrong in practice: the robot
          is where a student looks when they want their program to go, and the
          header is a strip of small grey icons at the top of the window.
        */}
        <div className="codework__controls">
          {execution.isRunning ? (
            <button type="button" className="codework__stop" onClick={execution.stop}>
              <Stop weight="fill" /> {d.code.stop}
            </button>
          ) : (
            <button
              type="button"
              className="codework__run"
              onClick={() => execution.run(source, world)}
              disabled={source.trim() === ''}
            >
              <Play weight="fill" /> {d.code.run}
            </button>
          )}
          {/* Clearing lives on the console, which is the thing it empties — and
              it lived in both places, one of which terminated a running program
              without saying so. */}
        </div>
        <p className="codework__running" role="status">
          {statusText}
        </p>

        {asking && (
          <form className="codework__answer" onSubmit={send}>
            <input
              type="text"
              value={reply}
              autoFocus
              onChange={(event) => setReply(event.target.value)}
              aria-label={state.pendingPrompt ?? ''}
            />
            <button type="submit">{d.actions.send}</button>
          </form>
        )}

        {/*
          The palette's job, done the way a text surface can do it.

          A student facing an empty file does not know what is available, and
          in the block workbench that question is answered by a whole rail of
          them. Here it is a list of names — pressing one writes it, hovering
          one explains it — so the same question has the same kind of answer.
        */}
        {!readOnly && (
        <div className="codework__reference">
          <h2>{d.code.reference}</h2>
          <ul>
            {[...(vocabulary ?? []), ...VOCABULARY].map((entry) => (
              <li key={entry.name}>
                <button
                  type="button"
                  data-category={entry.category}
                  onClick={() => handle.current?.insert(entry.insert ?? entry.name)}
                  title={entry.signature}
                  disabled={!editorReady}
                >
                  {entry.name}
                </button>
              </li>
            ))}
          </ul>
          <p>{d.code.referenceHint}</p>
        </div>
        )}
      </aside>
      )}
    </div>
  );
}
