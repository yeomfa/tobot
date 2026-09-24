import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, snippetCompletion } from '@codemirror/autocomplete';
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentSelection,
  indentWithTab,
  redo,
  redoDepth,
  undo,
  undoDepth,
} from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { linter, lintGutter } from '@codemirror/lint';
import { openSearchPanel, search, searchKeymap } from '@codemirror/search';
import type { Diagnostic } from '@codemirror/lint';
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  hoverTooltip,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { memo, useEffect, useRef } from 'react';

import type { Language } from '../i18n/types';
import { useTranslation } from '../i18n/context';
import { findProblems } from '../core/code/diagnostics';
import { findEntry, VOCABULARY } from '../core/code/vocabulary';
import './CodeEditor.css';

/**
 * Colours taken from the same tokens the read-only code view uses.
 *
 * CodeMirror injects its styles into the document, and a CSS custom property
 * resolves against wherever the element ends up — so writing `var(--code-…)`
 * here means the editor follows the app between light and dark without this
 * file knowing either palette, and without a second definition of the same
 * colours drifting from the first.
 */
const highlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.modifier], color: 'var(--code-keyword)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--code-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.propertyName], color: 'var(--code-name)' },
  { tag: [tags.variableName, tags.definition(tags.variableName)], color: 'var(--code-text)' },
  { tag: [tags.operator, tags.punctuation, tags.bracket], color: 'var(--code-muted)' },
]);

const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: 'var(--text-sm)',
    color: 'var(--code-text)',
    backgroundColor: 'var(--code-bg)',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    padding: 'var(--space-3) 0',
  },
  '.cm-gutters': {
    color: 'var(--code-muted)',
    backgroundColor: 'var(--code-bg)',
    border: 'none',
  },
  '.cm-activeLine': { backgroundColor: 'var(--code-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--code-active)', color: 'var(--code-text)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--accent-soft)',
  },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.7' },
});

/** The word under the cursor, dots included, so `Math.floor` reads as one. */
function wordAt(text: string, offset: number): { from: number; to: number; word: string } | null {
  const isPart = (character: string): boolean => /[\w.$]/.test(character);
  if (offset > 0 && !isPart(text[offset] ?? '') && !isPart(text[offset - 1] ?? '')) return null;

  let from = offset;
  let to = offset;
  while (from > 0 && isPart(text[from - 1] ?? '')) from -= 1;
  while (to < text.length && isPart(text[to] ?? '')) to += 1;
  const word = text.slice(from, to);
  return word ? { from, to, word } : null;
}

/**
 * What the hover card explains.
 *
 * A dotted word is tried whole and then from its start, so hovering the `log`
 * of `console.log` still finds the entry: a student pointing at a word does
 * not know which half of it the lookup table happens to be keyed on.
 */
function entryFor(word: string): ReturnType<typeof findEntry> {
  const direct = findEntry(word);
  if (direct) return direct;
  // `console.log(` caught with the bracket, or `Math.floor` hovered on `floor`.
  const cleaned = word.replace(/\.$/, '');
  return findEntry(cleaned);
}

function card(entry: NonNullable<ReturnType<typeof findEntry>>, language: Language, onlyHere: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'codehint';

  const signature = document.createElement('code');
  signature.className = 'codehint__signature';
  signature.textContent = entry.signature;
  root.append(signature);

  const summary = document.createElement('p');
  summary.className = 'codehint__summary';
  summary.textContent = entry.summary[language];
  root.append(summary);

  const example = document.createElement('code');
  example.className = 'codehint__example';
  example.textContent = entry.example[language];
  root.append(example);

  /* Said out loud rather than left to be discovered later: a student who
     learns `ask` here and types it into any other editor gets nothing. */
  if (entry.origin === 'tobot') {
    const badge = document.createElement('p');
    badge.className = 'codehint__badge';
    badge.textContent = onlyHere;
    root.append(badge);
  }

  return root;
}

/**
 * What the surrounding app can ask of a running editor.
 *
 * Handed out rather than reached for: the header's undo button belongs to the
 * header, but the history it undoes belongs to CodeMirror, and the two have to
 * meet somewhere. This is that seam, and it is deliberately four verbs rather
 * than the view itself — nothing outside this file should be dispatching
 * transactions.
 */
export interface CodeEditorHandle {
  undo: () => void;
  redo: () => void;
  find: () => void;
  focus: () => void;
  /** Re-indents the whole program by the language's own rules. */
  tidy: () => void;
  /** Puts the cursor on a line and scrolls it into view. */
  goToLine: (line: number) => void;
}

/** Where the cursor is, and how much is wrong, for the status line. */
export interface CodeEditorReport {
  line: number;
  column: number;
  canUndo: boolean;
  canRedo: boolean;
  problems: number;
  /** Where the first one is, so the status line can lead there. */
  firstProblemLine: number | null;
}

interface CodeEditorProps {
  value: string;
  onChange: (next: string) => void;
  /** Soft-wrapped by default; a long line is a scroll nobody asked for. */
  wrap?: boolean;
  fontSize?: number;
  /** Called once, with the verbs the app needs. */
  onReady?: (handle: CodeEditorHandle) => void;
  /** Called on every change of cursor, history depth or problem count. */
  onReport?: (report: CodeEditorReport) => void;
  /**
   * Behaviour layered on without this component knowing what it is.
   *
   * It lives in its own compartment, which is CodeMirror's mechanism for
   * swapping part of a configuration on a running editor. That is the seam
   * the guided exercises will arrive through — locked regions, gaps to fill,
   * a highlighted line the instructor is talking about — and having it here
   * from the start is the difference between adding those later and rewriting
   * this then.
   */
  extensions?: Extension[];
}

/**
 * The code surface.
 *
 * CodeMirror rather than a textarea because of what the editor has to do
 * beyond holding text: explain a function under the pointer, offer the six
 * things a student can call, and eventually hand parts of itself over to an
 * exercise. It is loaded as its own chunk, like the auth client, so a visitor
 * who never opens it never pays for it.
 */
export const CodeEditor = memo(function CodeEditor({
  value,
  onChange,
  wrap = true,
  fontSize = 14,
  onReady,
  onReport,
  extensions,
}: CodeEditorProps) {
  const { d, language } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  /* Kept in refs and read inside the extensions, so changing the interface
     language re-explains the next hover instead of rebuilding the editor and
     throwing away the student's undo history with it. */
  const languageRef = useRef<Language>(language);
  languageRef.current = language;
  const onlyHereRef = useRef(d.code.onlyInTobot);
  onlyHereRef.current = d.code.onlyInTobot;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /* Keyed by what the rule reported, so a second rule is a second entry here
     and nothing else. The map is read inside the extension rather than closed
     over, so changing the interface language re-words the next check instead
     of rebuilding the editor. */
  const messagesRef = useRef<Record<string, string>>({});
  messagesRef.current = {
    'code.missingAwait': d.code.missingAwait,
    'code.assignInCondition': d.code.assignInCondition,
  };

  const layered = useRef(new Compartment());
  /* One compartment per thing the toolbar can change. CodeMirror swaps these
     in place, so turning on wrapping or growing the type keeps the cursor,
     the scroll position and the undo history exactly where they were. */
  const wrapping = useRef(new Compartment());
  const sizing = useRef(new Compartment());
  const onReportRef = useRef(onReport);
  onReportRef.current = onReport;

  useEffect(() => {
    if (!host.current) return;

    const complete = (context: CompletionContext): CompletionResult | null => {
      const before = context.matchBefore(/[\w.$]*/);
      if (!before || (before.from === before.to && !context.explicit)) return null;

      return {
        from: before.from,
        options: VOCABULARY.map((entry) =>
          snippetCompletion(entry.insert ?? entry.name, {
            label: entry.name,
            detail: entry.signature,
            type: 'function',
            info: () => card(entry, languageRef.current, onlyHereRef.current),
          }),
        ),
      };
    };

    const explain = hoverTooltip((editor, position) => {
      const text = editor.state.doc.toString();
      const found = wordAt(text, position);
      if (!found) return null;
      const entry = entryFor(found.word);
      if (!entry) return null;

      return {
        pos: found.from,
        end: found.to,
        above: true,
        create: () => ({ dom: card(entry, languageRef.current, onlyHereRef.current) }),
      };
    });

    /* The same standard the block editor holds itself to: a mistake is named
       on the thing that made it, while it is being made. */
    const check = linter((editor): Diagnostic[] =>
      findProblems(editor.state.doc.toString()).map((problem) => ({
        from: problem.from,
        to: problem.to,
        severity: 'warning',
        message: messagesRef.current[problem.messageKey] ?? problem.messageKey,
      })),
    );

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        javascript(),
        syntaxHighlighting(highlightStyle),
        autocompletion({ override: [complete], activateOnTyping: true }),
        explain,
        check,
        lintGutter(),
        search({ top: true }),
        theme,
        wrapping.current.of(wrap ? EditorView.lineWrapping : []),
        sizing.current.of(EditorView.theme({ '&': { fontSize: `${fontSize}px` } })),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());

          /* Reported on selection too, not only on edits: the status line is
             about where the cursor is, and moving it changes that without
             changing a character. */
          if (update.docChanged || update.selectionSet) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            const problems = findProblems(update.state.doc.toString());
            const first = problems[0];
            onReportRef.current?.({
              line: line.number,
              column: head - line.from + 1,
              canUndo: undoDepth(update.state) > 0,
              canRedo: redoDepth(update.state) > 0,
              problems: problems.length,
              firstProblemLine: first ? update.state.doc.lineAt(first.from).number : null,
            });
          }
        }),
        layered.current.of(extensions ?? []),
      ],
    });

    const editor = new EditorView({ state, parent: host.current });
    view.current = editor;

    onReady?.({
      undo: () => undo(editor),
      redo: () => redo(editor),
      find: () => {
        editor.focus();
        openSearchPanel(editor);
      },
      tidy: () => {
        /* Indentation only — not a formatter. A real one costs more than this
           whole editor does, and the thing a student's code actually needs is
           for the nesting to show. The selection is restored afterwards so the
           cursor does not end up at the end of the file. */
        const kept = editor.state.selection.main;
        editor.dispatch({ selection: { anchor: 0, head: editor.state.doc.length } });
        indentSelection(editor);
        const length = editor.state.doc.length;
        editor.dispatch({
          selection: { anchor: Math.min(kept.anchor, length), head: Math.min(kept.head, length) },
        });
        editor.focus();
      },
      focus: () => editor.focus(),
      goToLine: (line: number) => {
        // A line the program reported may no longer exist after an edit.
        const total = editor.state.doc.lines;
        const target = editor.state.doc.line(Math.min(Math.max(line, 1), total));
        editor.dispatch({
          selection: { anchor: target.from },
          effects: EditorView.scrollIntoView(target.from, { y: 'center' }),
        });
        editor.focus();
      },
    });
    return () => {
      editor.destroy();
      view.current = null;
    };
    // Built once. Everything that varies afterwards arrives through a
    // compartment or a ref, because recreating the editor would discard the
    // cursor, the scroll position and the undo history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swapping the layered extensions in place: the whole reason they have a
  // compartment of their own.
  useEffect(() => {
    view.current?.dispatch({ effects: layered.current.reconfigure(extensions ?? []) });
  }, [extensions]);

  useEffect(() => {
    view.current?.dispatch({
      effects: wrapping.current.reconfigure(wrap ? EditorView.lineWrapping : []),
    });
  }, [wrap]);

  useEffect(() => {
    view.current?.dispatch({
      effects: sizing.current.reconfigure(
        EditorView.theme({ '&': { fontSize: `${fontSize}px` } }),
      ),
    });
  }, [fontSize]);

  /* A value changed from outside — opening another file, or resetting an
     exercise — replaces the document. Guarded, or every keystroke would echo
     back through this and park the cursor at the start of the line. */
  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);

  return <div className="codeeditor" ref={host} />;
});
