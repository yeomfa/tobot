/**
 * Minimal, dependency-free tokenizer.
 *
 * It only needs to colour the small language the emitters produce, so a regex
 * scanner is enough — pulling in a full highlighter would add far more weight
 * than this earns. Natural language is deliberately left unstyled apart from
 * its quoted values and step numbers.
 */

export type TokenType = 'plain' | 'keyword' | 'string' | 'number' | 'name' | 'operator' | 'comment';

export interface Token {
  type: TokenType;
  text: string;
}

const JS_KEYWORDS = new Set([
  'let',
  'const',
  'var',
  'if',
  'else',
  'while',
  'for',
  'function',
  'return',
  'true',
  'false',
  'null',
  'undefined',
  'console',
  'prompt',
  'Number',
  'String',
  'Boolean',
]);

const PY_KEYWORDS = new Set([
  'if',
  'else',
  'elif',
  'while',
  'for',
  'in',
  'range',
  'def',
  'return',
  'True',
  'False',
  'None',
  'print',
  'input',
  'float',
  'int',
  'str',
  'pass',
  'and',
  'or',
  'not',
]);

/** Pseudocode keywords in both locales, matched case-sensitively (all caps). */
const PSEUDO_KEYWORDS = new Set([
  'INICIO', 'FIN', 'VARIABLE', 'ASIGNAR', 'MOSTRAR', 'LEER', 'EN',
  'SI', 'ENTONCES', 'SI NO', 'FIN SI', 'MIENTRAS', 'HACER', 'FIN MIENTRAS',
  'REPETIR', 'VECES', 'FIN REPETIR', 'PARA', 'DESDE', 'HASTA', 'CON PASO', 'FIN PARA',
  'VERDADERO', 'FALSO', 'Y', 'O', 'NO',
  'START', 'END', 'SET', 'DISPLAY', 'READ', 'INTO',
  'IF', 'THEN', 'ELSE', 'END IF', 'WHILE', 'DO', 'END WHILE',
  'REPEAT', 'TIMES', 'END REPEAT', 'FOR', 'FROM', 'TO', 'STEP', 'END FOR',
  'TRUE', 'FALSE', 'AND', 'OR', 'NOT',
]);

function keywordsFor(syntax: string): Set<string> {
  if (syntax === 'javascript') return JS_KEYWORDS;
  if (syntax === 'python') return PY_KEYWORDS;
  if (syntax === 'pseudocode') return PSEUDO_KEYWORDS;
  return new Set();
}

/**
 * Scans one line. Multi-word pseudocode keywords ("FIN SI") are handled by
 * checking the two-word lookahead before falling back to single words.
 */
export function highlight(text: string, syntax: string): Token[] {
  if (syntax === 'natural') return highlightNatural(text);

  const keywords = keywordsFor(syntax);
  const tokens: Token[] = [];
  let index = 0;

  const push = (type: TokenType, value: string): void => {
    if (!value) return;
    const previous = tokens[tokens.length - 1];
    // Merge adjacent plain runs to keep the DOM small.
    if (previous && previous.type === type && type === 'plain') previous.text += value;
    else tokens.push({ type, text: value });
  };

  while (index < text.length) {
    const char = text[index];

    // Strings
    if (char === '"' || char === "'") {
      let end = index + 1;
      while (end < text.length && text[end] !== char) {
        if (text[end] === '\\') end += 1;
        end += 1;
      }
      push('string', text.slice(index, Math.min(end + 1, text.length)));
      index = end + 1;
      continue;
    }

    // Comments
    if (char === '/' && text[index + 1] === '/') {
      push('comment', text.slice(index));
      break;
    }
    if (char === '#' && syntax === 'python') {
      push('comment', text.slice(index));
      break;
    }

    // Numbers
    if (/[0-9]/.test(char)) {
      let end = index;
      while (end < text.length && /[0-9._]/.test(text[end])) end += 1;
      push('number', text.slice(index, end));
      index = end;
      continue;
    }

    // Identifiers and keywords
    if (/[A-Za-zÀ-ÿ_]/.test(char)) {
      let end = index;
      while (end < text.length && /[A-Za-zÀ-ÿ0-9_]/.test(text[end])) end += 1;
      const word = text.slice(index, end);

      // Two-word pseudocode keyword, e.g. "FIN SI".
      const spaceAfter = text[end] === ' ';
      if (spaceAfter && keywords.size > 0) {
        let secondEnd = end + 1;
        while (secondEnd < text.length && /[A-Za-zÀ-ÿ0-9_]/.test(text[secondEnd])) secondEnd += 1;
        const pair = text.slice(index, secondEnd);
        if (keywords.has(pair)) {
          push('keyword', pair);
          index = secondEnd;
          continue;
        }
      }

      push(keywords.has(word) ? 'keyword' : 'name', word);
      index = end;
      continue;
    }

    // Operators and punctuation
    if (/[+\-*/%<>=!&|←≠≤≥]/.test(char)) {
      let end = index;
      while (end < text.length && /[+\-*/%<>=!&|←≠≤≥]/.test(text[end])) end += 1;
      push('operator', text.slice(index, end));
      index = end;
      continue;
    }

    push('plain', char);
    index += 1;
  }

  return tokens;
}

/** Natural language only marks its step number and quoted values. */
function highlightNatural(text: string): Token[] {
  const tokens: Token[] = [];
  const stepMatch = /^(\d+(?:[.b]\d*)*\.)\s/.exec(text);
  let rest = text;

  if (stepMatch) {
    tokens.push({ type: 'number', text: stepMatch[1] });
    tokens.push({ type: 'plain', text: ' ' });
    rest = text.slice(stepMatch[0].length);
  }

  // Quoted values use guillemets in Spanish and curly quotes in English.
  const parts = rest.split(/(«[^»]*»|"[^"]*")/g);
  for (const part of parts) {
    if (!part) continue;
    const quoted = part.startsWith('«') || part.startsWith('"');
    tokens.push({ type: quoted ? 'string' : 'plain', text: part });
  }

  return tokens;
}
