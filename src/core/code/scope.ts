/**
 * The names a program declares at its top level.
 *
 * Used to report variables back while the program runs, which the block
 * interpreter does for free and a text program cannot: its `const` and `let`
 * live inside the function the runner wraps it in, where nothing outside can
 * see them. Knowing what to ask for is what makes asking possible.
 *
 * Only the top level, and deliberately. A name declared inside a loop or a
 * function does not exist once that block ends, so reporting it would mean
 * reading a variable that is gone — and the panel would be describing a scope
 * the student is not in.
 *
 * A scanner rather than the syntax tree. The question is lexical and the
 * answer is used to build one line of generated code; a parse would be more
 * exact about destructuring, which this deliberately does not offer.
 */
export function topLevelNames(source: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  let depth = 0;
  let quote: string | null = null;
  let comment: 'line' | 'block' | null = null;

  const keyword = /\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/y;

  for (let i = 0; i < source.length; i += 1) {
    const character = source[i] ?? '';
    const next = source[i + 1] ?? '';

    if (comment === 'line') {
      if (character === '\n') comment = null;
      continue;
    }
    if (comment === 'block') {
      if (character === '*' && next === '/') {
        comment = null;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (character === '\\') i += 1;
      else if (character === quote) quote = null;
      continue;
    }

    if (character === '/' && next === '/') {
      comment = 'line';
      i += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      comment = 'block';
      i += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{' || character === '(' || character === '[') {
      depth += 1;
      continue;
    }
    if (character === '}' || character === ')' || character === ']') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth !== 0) continue;

    /* Anchored at this position, so `const` only counts where a statement can
       begin — not inside a longer word like `myconst`. */
    if (i > 0 && /[\w$]/.test(source[i - 1] ?? '')) continue;
    keyword.lastIndex = i;
    const found = keyword.exec(source);
    if (!found) continue;

    const name = found[1];
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
    i = keyword.lastIndex - 1;
  }

  return names;
}
