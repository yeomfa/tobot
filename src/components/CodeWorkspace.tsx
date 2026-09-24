import {
  CopyIcon as CopyMark,
  DownloadSimpleIcon as Download,
  MagnifyingGlassIcon as Find,
  PlayIcon as Play,
  StopIcon as Stop,
  TextAlignLeftIcon as Wrap,
  TextAaIcon as TextSize,
  TextIndentIcon as Indent,
  TrashIcon as Trash,
} from '@phosphor-icons/react';
import { lazy, Suspense, useCallback, useRef, useState } from 'react';

import { VOCABULARY } from '../core/code/vocabulary';
import type { CodeExecutionController } from '../state/useCodeExecution';
import { useTranslation } from '../i18n/context';
import type { CodeEditorHandle, CodeEditorReport } from './CodeEditor';
import { Console } from './Console';
import { Robot } from './Robot';
import type { RobotMood } from './Robot';
import './CodeWorkspace.css';

/* CodeMirror is the largest thing this app can load, and only this screen
   needs it. Same arrangement as the auth client: fetched when it is opened,
   never before. */
const CodeEditor = lazy(async () => ({ default: (await import('./CodeEditor')).CodeEditor }));

const MIN_SIZE = 12;
const MAX_SIZE = 20;

interface CodeWorkspaceProps {
  source: string;
  onChange: (next: string) => void;
  execution: CodeExecutionController;
  /** Handed up so the header's undo and redo drive the editor's own history. */
  onEditorReady?: (handle: CodeEditorHandle) => void;
  onReport?: (report: CodeEditorReport) => void;
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
}: CodeWorkspaceProps) {
  const { d, t } = useTranslation();
  const [reply, setReply] = useState('');
  const [wrap, setWrap] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [copied, setCopied] = useState(false);
  const [where, setWhere] = useState<CodeEditorReport | null>(null);
  const handle = useRef<CodeEditorHandle | null>(null);

  const { state } = execution;
  const asking = state.status === 'awaitingInput';

  const ready = useCallback(
    (api: CodeEditorHandle) => {
      handle.current = api;
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

  /* The robot says the last thing that happened, which is the question while
     one is open and otherwise whatever was printed most recently. */
  const latest = state.output[state.output.length - 1];
  const message = asking ? state.pendingPrompt : (latest?.text ?? null);

  /* The robot has a face for each of these, and using them is most of what
     makes a run feel like something is happening rather than nothing. */
  const mood: RobotMood =
    state.status === 'error'
      ? 'error'
      : asking
        ? 'asking'
        : state.status === 'running'
          ? 'thinking'
          : state.status === 'finished'
            ? 'done'
            : 'idle';

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
            onClick={() => setFontSize(Math.max(MIN_SIZE, fontSize - 1))}
            disabled={fontSize <= MIN_SIZE}
            title={d.code.textSmaller}
            aria-label={d.code.textSmaller}
          >
            <TextSize weight="bold" className="codework__tool-small" />
          </button>
          <button
            type="button"
            className="codework__tool"
            onClick={() => setFontSize(Math.min(MAX_SIZE, fontSize + 1))}
            disabled={fontSize >= MAX_SIZE}
            title={d.code.textBigger}
            aria-label={d.code.textBigger}
          >
            <TextSize weight="bold" />
          </button>

          <button
            type="button"
            className="codework__tool"
            onClick={() => handle.current?.tidy()}
            title={d.code.tidy}
            aria-label={d.code.tidy}
          >
            <Indent weight="bold" />
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

        <div className="codework__editor">
          <Suspense fallback={<div className="codework__loading" />}>
            <CodeEditor
              value={source}
              onChange={onChange}
              wrap={wrap}
              fontSize={fontSize}
              onReady={ready}
              onReport={report}
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

        <div className="codework__console">
          <Console
            output={state.output}
            variables={state.variables}
            /* Nothing to select: a line of output came from text, not from a
               statement with an id. */
            onSelectNode={() => {}}
            onClear={execution.clear}
          />
        </div>
      </div>

      <aside className="codework__robot">
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
              onClick={() => execution.run(source)}
              disabled={source.trim() === ''}
            >
              <Play weight="fill" /> {d.code.run}
            </button>
          )}
          <button
            type="button"
            className="codework__tool"
            onClick={execution.clear}
            disabled={state.output.length === 0}
            title={d.code.clearConsole}
            aria-label={d.code.clearConsole}
          >
            <Trash weight="bold" />
          </button>
        </div>
        {state.status === 'running' && <p className="codework__running">{d.code.running}</p>}

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
        <div className="codework__reference">
          <h2>{d.code.reference}</h2>
          <ul>
            {VOCABULARY.map((entry) => (
              <li key={entry.name}>
                <code>{entry.name}</code>
                {entry.origin === 'tobot' && <span aria-hidden="true">·</span>}
              </li>
            ))}
          </ul>
          <p>{d.code.referenceHint}</p>
        </div>
      </aside>
    </div>
  );
}
