import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completeFromList,
  insertCompletionText,
  snippetCompletion,
} from '@codemirror/autocomplete';
import type {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  redoDepth,
  undo,
  undoDepth,
} from '@codemirror/commands';
import {
  javascript,
  javascriptLanguage,
  localCompletionSource,
  snippets,
} from '@codemirror/lang-javascript';
import { linter, lintGutter } from '@codemirror/lint';
import { openSearchPanel, search, searchKeymap } from '@codemirror/search';
import type { Diagnostic } from '@codemirror/lint';
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
  syntaxTree,
} from '@codemirror/language';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
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
import { Decoration, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { memo, useEffect, useRef } from 'react';

import type { ConceptId } from '../content/concepts';
import type { Language } from '../i18n/types';
import { useTranslation } from '../i18n/context';
import { categoryClass, categoryFor } from '../core/code/categories';
import { findProblems } from '../core/code/diagnostics';
import { findEntry, VOCABULARY } from '../core/code/vocabulary';
import type { VocabularyEntry } from '../core/code/vocabulary';
import { formatSource } from '../core/code/format';
import type { FormatOutcome } from '../core/code/format';
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

/**
 * Paints the code by topic, the way the palette paints the blocks.
 *
 * `statementMeta.ts` makes category the thing that drives colour everywhere —
 * the palette, the blocks, the flowchart, the concept cards — so that a loop is
 * recognisable by its hue before its keyword is read. Written code was the only
 * surface that did not, which is why it looked like somebody else's editor.
 *
 * Decorations rather than a highlight style: Lezer's tags cannot tell a
 * conditional keyword from a loop keyword — both are `controlKeyword` — but the
 * tree knows the node's own name, and that is enough. Nothing in the document
 * changes; this only adds classes to ranges that are already on screen.
 */
const categories = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.paint(view);
    }

    update(update: ViewUpdate) {
      /* The tree too, not only the document. Lezer parses incrementally and
         finishes *after* the keystroke, so painting only on a document change
         coloured against a half-built tree and never came back to correct it. */
      if (
        update.docChanged ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = this.paint(update.view);
      }
    }

    paint(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();

      /* Only what is on screen. A thousand-line file would otherwise be walked
         on every keystroke to colour text nobody is looking at. */
      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            // Leaves only: a parent spans its children, and marking both would
            // paint the whole statement in its keyword's colour.
            if (node.node.firstChild) return;
            const text = view.state.doc.sliceString(node.from, node.to);
            const category = categoryFor(node.name, text);
            if (category) {
              builder.add(node.from, node.to, Decoration.mark({ class: categoryClass(category) }));
            }
          },
        });
      }

      return builder.finish();
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

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

  /*
    The tooltips: the completion menu and the hover card.

    Here and not in the stylesheet. CodeMirror's base theme scopes its rules
    under a generated class, which outranks a plain stylesheet selector — so the
    menu kept the stock blue selection and the stock glyph icons, and every row
    kept `overflow-x: hidden`, which turns the other axis into a scrollbar of its
    own. Rules in the editor's theme are mounted above the base theme and win.
  */
  '.cm-tooltip': {
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-raised)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete': { padding: 'var(--space-1)' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    minWidth: '240px',
    maxWidth: 'min(420px, 80vw)',
    maxHeight: '16em',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: '5px var(--space-2)',
    lineHeight: '1.4',
    // Both axes: one hidden and one not gives every row its own scrollbar.
    overflow: 'hidden',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    color: 'var(--text-inverse)',
    backgroundColor: 'var(--accent)',
  },
  /* The entry's topic as a dot, in the hue its word takes in the text. A fixed
     size that does not flex, so it can never push the label out of the row. */
  '.cm-completionIcon': {
    flex: '0 0 auto',
    width: '7px',
    height: '7px',
    padding: '0',
    margin: '0',
    borderRadius: '999px',
    backgroundColor: 'var(--text-muted)',
    opacity: '1',
  },
  // `[class]` only to outrank the base theme's per-type glyphs (`ƒ`, `x`, `🔑`).
  '.cm-completionIcon[class]:after': { content: 'none' },
  '.cm-completionIcon-function, .cm-completionIcon-method': { backgroundColor: 'var(--code-hue-io)' },
  '.cm-completionIcon-variable, .cm-completionIcon-constant': {
    backgroundColor: 'var(--code-hue-variable)',
  },
  '.cm-completionIcon-keyword': { backgroundColor: 'var(--code-hue-conditional)' },
  '.cm-completionLabel': {
    flex: '1 1 auto',
    minWidth: '0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '.cm-completionMatchedText': { fontWeight: '700', textDecoration: 'none' },
  '.cm-completionDetail': {
    flex: '0 1 auto',
    minWidth: '0',
    margin: '0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--text-xs)',
    fontStyle: 'normal',
    color: 'var(--text-muted)',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionDetail': {
    color: 'color-mix(in srgb, var(--text-inverse) 75%, transparent)',
  },
  // The explanation beside the menu: the same card the hover shows.
  '.cm-tooltip.cm-completionInfo': { padding: '0', maxWidth: '340px' },
});

/**
 * Whether this position is inside a comment or a string.
 *
 * Asked of the parser rather than of the characters, because the parser is
 * already mounted and it is the only thing that actually knows. Both the
 * completion list and the hover card were offering themselves inside comments:
 * writing `// pide el nombre con prompt` opened the function list, and while
 * that list is open Enter accepts a completion instead of breaking the line —
 * so a student writing a comment got `console.log()` spliced into the middle
 * of their sentence.
 */
function inProse(state: EditorState, position: number): boolean {
  const node = syntaxTree(state).resolveInner(position, -1);
  for (let here: typeof node | null = node; here; here = here.parent) {
    if (/Comment|String/.test(here.name)) return true;
  }
  return false;
}

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
function entryFor(word: string, extra: VocabularyEntry[]): VocabularyEntry | null {
  const find = (name: string): VocabularyEntry | null =>
    findEntry(name) ?? extra.find((entry) => entry.name === name) ?? null;
  const direct = find(word);
  if (direct) return direct;
  // `console.log(` caught with the bracket, or `Math.floor` hovered on `floor`.
  const cleaned = word.replace(/\.$/, '');
  return find(cleaned);
}

function card(
  entry: VocabularyEntry,
  language: Language,
  onlyHere: string,
  more: string,
  arduino: string,
  onConcept?: (id: ConceptId) => void,
): HTMLElement {
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

  /* The bridge to real hardware: the same idea, as it is written on a board. */
  if (entry.arduino) {
    const line = document.createElement('p');
    line.className = 'codehint__arduino';
    line.append(`${arduino} `);
    const code = document.createElement('code');
    code.textContent = entry.arduino;
    line.append(code);
    root.append(line);
  }

  /* Said out loud rather than left to be discovered later: a student who
     learns `ask` here and types it into any other editor gets nothing. */
  if (entry.origin === 'tobot') {
    const badge = document.createElement('p');
    badge.className = 'codehint__badge';
    badge.textContent = entry.note?.[language] ?? onlyHere;
    root.append(badge);
  }

  /* The same door the block inspector offers. Explaining a function and then
     stopping is a dead end on the one surface where a student is most likely
     to want the idea behind it, not just the signature. */
  if (entry.concept && onConcept) {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'codehint__more';
    link.textContent = more;
    link.addEventListener('mousedown', (event) => {
      // `mousedown`, because the tooltip closes before a click completes.
      event.preventDefault();
      onConcept(entry.concept as ConceptId);
    });
    root.append(link);
  }

  return root;
}

/**
 * Formats what is in the editor, as one change.
 *
 * One transaction replacing the document, so a single Ctrl+Z puts the
 * student's own layout back; the cursor stays beside the code it was next to.
 * Nothing happens to a read-only document, or to one that changed while
 * Prettier was loading — that edit would otherwise be overwritten.
 */
async function formatIn(view: EditorView): Promise<FormatOutcome> {
  const before = view.state.doc.toString();
  if (view.state.readOnly) return { ok: true, source: before, cursor: view.state.selection.main.head };
  const outcome = await formatSource(before, view.state.selection.main.head);
  if (!outcome.ok || view.state.doc.toString() !== before || outcome.source === before) return outcome;
  view.dispatch({
    changes: { from: 0, to: before.length, insert: outcome.source },
    selection: { anchor: Math.min(outcome.cursor, outcome.source.length) },
    userEvent: 'format',
    scrollIntoView: true,
  });
  view.focus();
  return outcome;
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
  /** Formats the whole program with Prettier, and says how it went. */
  format: () => Promise<FormatOutcome>;
  /** Puts the cursor on a line and scrolls it into view. */
  goToLine: (line: number) => void;
  /** Writes a snippet where the cursor is. */
  insert: (text: string) => void;
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
  /** Ctrl+Enter: the shortcut every editor has and the one used most while
      learning, because a beginner runs their program every two lines. */
  onRun?: () => void;
  /** Opens the concept drawer, as the block inspector does. */
  onConcept?: (id: ConceptId) => void;
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
  /** Shown, run and read, but not changed: a teacher looking at a student's work. */
  readOnly?: boolean;
  /** Told how a format from the keyboard went; the button hears it from `format`. */
  onFormatted?: (outcome: FormatOutcome) => void;
  /** More to offer and explain than the built-in six: the world's functions. */
  vocabulary?: VocabularyEntry[];
}

/** The layered compartment's contents: what the caller asked for, plus the lock. */
function layer(extensions: Extension[] | undefined, readOnly: boolean): Extension[] {
  return [...(extensions ?? []), readOnly ? EditorState.readOnly.of(true) : []];
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
  onRun,
  onConcept,
  extensions,
  readOnly = false,
  vocabulary,
  onFormatted,
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
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const onFormattedRef = useRef(onFormatted);
  onFormattedRef.current = onFormatted;
  const onConceptRef = useRef(onConcept);
  onConceptRef.current = onConcept;
  const moreRef = useRef(d.actions.learnMore);
  moreRef.current = d.actions.learnMore;
  const arduinoRef = useRef(d.code.arduino);
  arduinoRef.current = d.code.arduino;
  /* In a ref like the rest, so a document gaining a world does not rebuild the
     editor and lose its history. */
  const extraRef = useRef<VocabularyEntry[]>(vocabulary ?? []);
  extraRef.current = vocabulary ?? [];
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

    /*
      Tobot's own functions, offered *alongside* what the language already
      knows rather than instead of it.

      This used to be handed to `autocompletion({ override })`, and `override`
      replaces every source — including `localCompletionSource`, which is
      precisely "the names this program declares". It shipped in the box and
      one word switched it off, so a student who wrote `const total = 0` was
      never offered `total` again.
    */
    const vocabularySource = (context: CompletionContext): CompletionResult | null => {
      if (inProse(context.state, context.pos)) return null;

      const before = context.matchBefore(/[\w.$]*/);
      if (!before || (before.from === before.to && !context.explicit)) return null;

      return {
        from: before.from,
        options: [...VOCABULARY, ...extraRef.current].map((entry) =>
          snippetCompletion(entry.insert ?? entry.name, {
            label: entry.name,
            detail: entry.signature,
            type: 'function',
            info: () =>
              card(
                entry,
                languageRef.current,
                onlyHereRef.current,
                moreRef.current,
                arduinoRef.current,
                onConceptRef.current,
              ),
          }),
        ),
      };
    };

    /* The language's own two sources, guarded the same way. A student writing
       a comment should be offered nothing at all, whoever the offer comes
       from. */
    const inCode =
      (source: CompletionSource): CompletionSource =>
      (context) =>
        inProse(context.state, context.pos) ? null : source(context);

    /* One registration per source, not one registration holding an array. The
       `autocomplete` language-data value is a single source *or* a list of
       ready-made completions, so handing it a list of functions made CodeMirror
       read `.label` off each function and throw — which took the whole list
       down, including the names this was meant to add. */
    const languageCompletion = [
      javascriptLanguage.data.of({ autocomplete: vocabularySource }),
      javascriptLanguage.data.of({ autocomplete: inCode(localCompletionSource) }),
      // `if`, `for`, `function`: a student writing their first loop should be
      // offered its shape, not only its name.
      javascriptLanguage.data.of({ autocomplete: inCode(completeFromList(snippets)) }),
    ];

    const explain = hoverTooltip((editor, position) => {
      // Hovering `prompt` inside `// no olvides await antes de prompt` used to
      // open the full signature card, as though the word were a call.
      if (inProse(editor.state, position)) return null;

      const text = editor.state.doc.toString();
      const found = wordAt(text, position);
      if (!found) return null;
      const entry = entryFor(found.word, extraRef.current);
      if (!entry) return null;

      return {
        pos: found.from,
        end: found.to,
        above: true,
        create: () => ({
          dom: card(
            entry,
            languageRef.current,
            onlyHereRef.current,
            moreRef.current,
            arduinoRef.current,
            onConceptRef.current,
          ),
        }),
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
        categories,
        languageCompletion,
        autocompletion({ activateOnTyping: true }),
        explain,
        check,
        lintGutter(),
        search({ top: true }),
        theme,
        wrapping.current.of(wrap ? EditorView.lineWrapping : []),
        sizing.current.of(EditorView.theme({ '&': { fontSize: `${fontSize}px` } })),
        keymap.of([
          /* First in the array, because bindings are tried in order and
             `defaultKeymap` already claims Mod-Enter for "insert a blank
             line" — a command nobody reaches for and which silently ate the
             shortcut this screen needs most. */
          {
            key: 'Mod-Enter',
            run: () => {
              onRunRef.current?.();
              return true;
            },
          },
          /* The shortcut VS Code uses, so the habit carries over both ways. */
          {
            key: 'Shift-Alt-f',
            run: (view) => {
              void formatIn(view).then((outcome) => onFormattedRef.current?.(outcome));
              return true;
            },
          },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
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
        layered.current.of(layer(extensions, readOnly)),
      ],
    });

    const editor = new EditorView({ state, parent: host.current });
    view.current = editor;

    /* Reported once now, not only on the first edit. The bar read "Línea 1,
       columna 1 · Sin avisos" over a document the gutter was already marking. */
    const first = findProblems(editor.state.doc.toString());
    onReportRef.current?.({
      line: 1,
      column: 1,
      canUndo: false,
      canRedo: false,
      problems: first.length,
      firstProblemLine: first[0] ? editor.state.doc.lineAt(first[0].from).number : null,
    });

    onReady?.({
      undo: () => undo(editor),
      redo: () => redo(editor),
      find: () => {
        editor.focus();
        openSearchPanel(editor);
      },
      format: () => formatIn(editor),
      focus: () => editor.focus(),
      insert: (text: string) => {
        /* Through the snippet machinery rather than a raw change, so `#{}` in a
           vocabulary entry still lands the cursor inside the brackets — the
           same behaviour as accepting the completion. */
        const at = editor.state.selection.main;
        editor.dispatch(
          insertCompletionText(editor.state, text.replace(/#\{\}/g, ''), at.from, at.to),
        );
        editor.focus();
      },
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
    view.current?.dispatch({ effects: layered.current.reconfigure(layer(extensions, readOnly)) });
  }, [extensions, readOnly]);

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
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
      /* Opening another document is not an edit of this one. Without this the
         header's undo walked backwards out of the file on screen and into the
         text of the last one. */
      annotations: Transaction.addToHistory.of(false),
    });
  }, [value]);

  return <div className="codeeditor" ref={host} />;
});
