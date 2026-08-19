import type {
  AskStatement,
  CommentStatement,
  AssignStatement,
  DeclareStatement,
  Expression,
  ForEachStatement,
  IfStatement,
  LiteralExpression,
  LiteralKind,
  RepeatStatement,
  SayStatement,
  Statement,
  WhileStatement,
} from './types';

export function createId(): string {
  return `n_${Math.random().toString(36).slice(2, 10)}`;
}

export function literal(value: string | number | boolean, valueKind?: LiteralKind): LiteralExpression {
  const resolvedKind: LiteralKind =
    valueKind ??
    (typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'text');
  return { kind: 'literal', valueKind: resolvedKind, value };
}

export function variable(name: string): Expression {
  return { kind: 'variable', name };
}

/** Default expression for a freshly created slot of the given kind. */
export function emptyValue(kind: LiteralKind): LiteralExpression {
  if (kind === 'number') return literal(0, 'number');
  if (kind === 'boolean') return literal(true, 'boolean');
  return literal('', 'text');
}

/**
 * Re-reads an expression as another type, after the student changes the
 * declared type of a variable.
 *
 * Whatever they already typed is kept whenever it survives the move: "42"
 * becomes the number 42, and a number becomes its own digits back. Only a
 * value with no sensible reading is replaced, so changing the type by mistake
 * does not silently discard the work of typing a value in.
 *
 * Anything that is not a literal — a variable reference, a sum — is left
 * alone. Those carry no type of their own to rewrite, and validation is what
 * reports the mismatch.
 */
export function castExpression(expression: Expression, kind: LiteralKind): Expression {
  if (expression.kind !== 'literal') return expression;
  if (expression.valueKind === kind) return expression;

  const current = expression.value;

  if (kind === 'number') {
    const parsed = typeof current === 'boolean' ? NaN : Number(current);
    // An empty string parses as 0, which would look like an invented value.
    const usable = String(current).trim() !== '' && !Number.isNaN(parsed);
    return literal(usable ? parsed : 0, 'number');
  }

  if (kind === 'boolean') {
    if (typeof current === 'boolean') return literal(current, 'boolean');
    if (typeof current === 'number') return literal(current !== 0, 'boolean');
    const text = current.trim().toLowerCase();
    // Accepts what the interface itself shows in either language.
    if (['true', 'verdadero', 'si', 'sí', '1'].includes(text)) return literal(true, 'boolean');
    if (['false', 'falso', 'no', '0'].includes(text)) return literal(false, 'boolean');
    return emptyValue('boolean');
  }

  // Text can hold any of them, so this direction never loses anything.
  return literal(String(current), 'text');
}

type StatementKind = Statement['kind'];

/**
 * Builds a ready-to-edit statement. New statements are always valid so the
 * student never sees a broken program mid-edit.
 */
export function createStatement(kind: StatementKind, suggestedName = 'x'): Statement {
  const id = createId();
  switch (kind) {
    case 'comment':
      return { id, kind: 'comment', text: '' } satisfies CommentStatement;
    case 'declare':
      return {
        id,
        kind: 'declare',
        name: suggestedName,
        valueKind: 'number',
        value: literal(0, 'number'),
      } satisfies DeclareStatement;
    case 'assign':
      return {
        id,
        kind: 'assign',
        name: suggestedName,
        value: literal(0, 'number'),
      } satisfies AssignStatement;
    case 'say':
      return { id, kind: 'say', value: literal('', 'text') } satisfies SayStatement;
    case 'ask':
      return {
        id,
        kind: 'ask',
        prompt: literal('', 'text'),
        target: suggestedName,
        expect: 'text',
      } satisfies AskStatement;
    case 'if':
      return {
        id,
        kind: 'if',
        condition: literal(true, 'boolean'),
        then: [],
      } satisfies IfStatement;
    case 'while':
      return {
        id,
        kind: 'while',
        condition: literal(true, 'boolean'),
        body: [],
      } satisfies WhileStatement;
    case 'repeat':
      return {
        id,
        kind: 'repeat',
        times: literal(3, 'number'),
        body: [],
      } satisfies RepeatStatement;
    case 'forEach':
      return {
        id,
        kind: 'forEach',
        variable: 'i',
        from: literal(1, 'number'),
        to: literal(5, 'number'),
        step: literal(1, 'number'),
        body: [],
      } satisfies ForEachStatement;
  }
}
