/**
 * Static checks on written code, in the spirit of `ast/validate.ts`.
 *
 * There is exactly one for now, and it exists because of a decision made
 * elsewhere: asking is a promise here, so `Number(prompt("…"))` without
 * `await` quietly computes with the promise and prints `NaN`. Everywhere else
 * in this app a mistake is named on the thing that made it, and a silent `NaN`
 * is the opposite of that.
 *
 * A scanner rather than a walk of the syntax tree. The rule is lexical — a
 * word, and what sits in front of it — and the editor already pays for a
 * parser it can use the day a check actually needs one.
 */

export interface CodeProblem {
  from: number;
  to: number;
  /** A dictionary key, so this file stays out of the language business. */
  messageKey: string;
}

/** Names that hand back a promise and are therefore wrong without `await`. */
const ASKING = /\b(ask|prompt)\s*\(/g;

/** Where the line holding `offset` begins. */
function lineStart(text: string, offset: number): number {
  const broke = text.lastIndexOf('\n', offset - 1);
  return broke + 1;
}

/**
 * Whether the offset sits after a `//` on its own line.
 *
 * Only line comments, and only on the same line: a block comment spanning
 * lines would need the parser, and a false positive inside one is a marker on
 * text nobody runs — visible, harmless, and rare enough to be worth the
 * simplicity.
 */
function isCommented(text: string, offset: number): boolean {
  const start = lineStart(text, offset);
  const marker = text.slice(start, offset).indexOf('//');
  return marker !== -1;
}

/**
 * Whether the offset sits inside a string opened earlier on its line.
 *
 * Counted rather than parsed, and deliberately shallow: the word `prompt`
 * inside a message the student prints is not a call, and marking it would be
 * the kind of wrong that teaches distrust of the marks.
 */
function isQuoted(text: string, offset: number): boolean {
  const before = text.slice(lineStart(text, offset), offset);
  let open: string | null = null;

  for (let i = 0; i < before.length; i += 1) {
    const character = before[i];
    if (character === '\\') {
      i += 1;
      continue;
    }
    if (character !== '"' && character !== "'" && character !== '`') continue;
    if (open === null) open = character;
    else if (open === character) open = null;
  }

  return open !== null;
}

/**
 * An assignment where a comparison was meant.
 *
 * `if (nota = 5)` assigns and then reads the assignment's value, which is 5,
 * which is truthy — so the branch always runs and the variable is quietly
 * destroyed on the way. It is among the first mistakes anyone writing
 * conditions makes, it produces no error, and the program does something
 * plausible enough that the student looks everywhere else.
 */
function findAssignmentInCondition(text: string): CodeProblem[] {
  const problems: CodeProblem[] = [];
  const opener = /\b(if|while)\s*\(/g;

  let match = opener.exec(text);
  while (match !== null) {
    const from = opener.lastIndex;
    if (!isCommented(text, match.index) && !isQuoted(text, match.index)) {
      let depth = 1;
      for (let i = from; i < text.length && depth > 0; i += 1) {
        const character = text[i];
        if (character === '(') depth += 1;
        else if (character === ')') depth -= 1;
        else if (character === '=') {
          const before = text[i - 1] ?? '';
          const after = text[i + 1] ?? '';
          // Everything that is a comparison rather than an assignment.
          const comparison =
            after === '=' || before === '=' || before === '!' || before === '<' || before === '>';
          if (!comparison) {
            problems.push({ from: i, to: i + 1, messageKey: 'code.assignInCondition' });
            break;
          }
        }
      }
    }
    match = opener.exec(text);
  }

  return problems;
}

export function findProblems(text: string): CodeProblem[] {
  const problems: CodeProblem[] = [];
  ASKING.lastIndex = 0;

  let match = ASKING.exec(text);
  while (match !== null) {
    const at = match.index;
    const name = match[1] ?? '';

    const reachable =
      // `thing.prompt(…)` is somebody else's function with a familiar name.
      text[at - 1] !== '.' && !isCommented(text, at) && !isQuoted(text, at);

    if (reachable && !text.slice(0, at).trimEnd().endsWith('await')) {
      problems.push({ from: at, to: at + name.length, messageKey: 'code.missingAwait' });
    }

    match = ASKING.exec(text);
  }

  return [...problems, ...findAssignmentInCondition(text)].sort((a, b) => a.from - b.from);
}
