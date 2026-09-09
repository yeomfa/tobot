import type {
  ForEachItemStatement,
  ListOpStatement,
  AskStatement,
  CommentStatement,
  AssignStatement,
  DeclareStatement,
  Expression,
  ForEachStatement,
  IfStatement,
  LiteralExpression,
  ValueKind,
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
 * The name a new statement carries until the student names it: none.
 *
 * It used to be `'x'`, which `collectVariables` then reported as a declared
 * variable — so dropping "crear variable" put an `x` in scope that nobody had
 * written, and every other block offered it. Filtering it out at the picker
 * only hid half of that: the name was still in the algorithm, still in the
 * generated code, still in the natural-language view.
 *
 * Empty says the true thing. Nothing is declared until the student declares it.
 */
export const PLACEHOLDER_NAME = '';

/**
 * Builds a ready-to-edit statement.
 *
 * Most kinds come out valid. `assign` cannot: it refers to a variable, and
 * whether one exists is not something this function knows — so it carries the
 * placeholder, and the editor shows an empty field until the student picks a
 * name that does exist.
 */
export function createStatement(
  kind: StatementKind,
  suggestedName = PLACEHOLDER_NAME,
): Statement {
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
    /* A new list starts with one element rather than none: an empty pair of
       brackets gives the student nothing to click on, and nothing to change
       into what they actually wanted. */
    case 'listOp':
      return {
        id,
        kind: 'listOp',
        operation: 'append',
        name: suggestedName,
        value: literal(0, 'number'),
      } satisfies ListOpStatement;
    case 'forEachItem':
      return {
        id,
        kind: 'forEachItem',
        variable: 'elemento',
        list: { kind: 'variable', name: suggestedName },
        body: [],
      } satisfies ForEachItemStatement;
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

/**
 * The value a declaration should hold after its type is changed.
 *
 * The type chip and the value are two views of one fact, and they were able to
 * disagree: switching away from `lista` left a list-shaped value under a chip
 * reading "texto", which the emitters and the interpreter cannot make sense
 * of. Kept here, beside the other AST constructors, so the rule is testable
 * rather than living only inside a click handler.
 */
export function retypeDeclaration(current: Expression, valueKind: ValueKind): Expression {
  /* A list has no literal form to cast into, so switching to it starts one —
     with an item, since an empty pair of brackets offers nothing to click. */
  if (valueKind === 'list') return { kind: 'list', items: [literal(0, 'number')] };

  /* Anything built rather than typed cannot be cast either, so it is replaced
     outright; an ordinary literal keeps its content and changes kind. */
  const castable: Expression =
    current.kind === 'list' || current.kind === 'index' || current.kind === 'length'
      ? literal(0, 'number')
      : current;
  return castExpression(castable, valueKind);
}

/**
 * A new list item, shaped like the one before it.
 *
 * Adding to a list of names produced a number field, so the student had to
 * change its type every single time — the list already says what it holds, and
 * the item that says it loudest is the last one they wrote. An empty list has
 * nothing to copy, so it starts with a number.
 */
export function nextItemLike(items: Expression[]): Expression {
  const last = items[items.length - 1];
  if (last?.kind === 'literal') return emptyValue(last.valueKind);
  /* A variable or a structure has no literal kind to copy; a number is the
     least surprising thing to hand back. */
  return literal(0, 'number');
}
