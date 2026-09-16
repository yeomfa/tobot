import type {
  ForEachItemStatement,
  FunctionStatement,
  ReturnStatement,
  CallStatement,
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
    /* A function starts with one parameter rather than none: the empty case
       is reachable by removing it, and a signature with nowhere to type is a
       dead end of the kind an empty list of items used to be. */
    case 'function':
      return {
        id,
        kind: 'function',
        name: suggestedName,
        params: [''],
        body: [],
      } satisfies FunctionStatement;
    case 'return':
      return { id, kind: 'return', value: literal(0, 'number') } satisfies ReturnStatement;
    case 'call':
      return { id, kind: 'call', name: suggestedName, args: [] } satisfies CallStatement;
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
  return retypeDeclarationDeep(current, valueKind).value;
}

/**
 * Whether casting a literal to `kind` and back would return what it started
 * as. When it would not, content is being discarded.
 *
 * A round trip rather than a table of rules: the cast already knows how to
 * read every value, so asking it twice is both shorter and impossible to get
 * out of step with. `1` survives becoming `"1"`; `"hola"` becomes `0` and can
 * never come back, and that is the case worth telling the student about.
 */
function castLoses(expression: LiteralExpression, kind: LiteralKind): boolean {
  if (expression.valueKind === kind) return false;
  const there = castExpression(expression, kind);
  if (there.kind !== 'literal') return false;
  const back = castExpression(there, expression.valueKind);
  return !(back.kind === 'literal' && back.value === expression.value);
}

/**
 * Re-typing a declaration, all the way down, and whether anything was lost.
 *
 * The shallow version only re-read the root. That worked while the value was
 * a single literal — the root *is* the field — and did nothing at all once the
 * student had built `1 + 2 + 3`, because a `binary` is not a literal and
 * `castExpression` passes those through untouched. So the chip changed, the
 * three fields stayed numeric, and there was no way out: a part cannot offer
 * its own type inside a declaration (the slot's type is fixed), and the last
 * part of a chain cannot be removed. The type was unreachable and the value
 * was unremovable.
 *
 * Going deep is what makes the behaviour stop depending on how many parts
 * there happen to be. Names and structures are still left alone: a variable
 * carries no type of its own to rewrite.
 *
 * `lostContent` is reported rather than prevented. `1` becoming `"1"` is
 * exact and reversible, and warning about it would be the noise that teaches
 * a student to ignore the badge; `"hola"` becoming `0` destroys what they
 * typed, and that is worth a word.
 */
export function retypeDeclarationDeep(
  current: Expression,
  valueKind: ValueKind,
): { value: Expression; lostContent: boolean } {
  /* A list has no literal form to cast into, so switching to it starts one —
     with an item, since an empty pair of brackets offers nothing to click. */
  if (valueKind === 'list') {
    return {
      value: { kind: 'list', items: [literal(0, 'number')] },
      /* Only says something was thrown away when there was something there:
         replacing a freshly-created `0` is not a loss worth a warning. */
      lostContent: current.kind !== 'literal' || String(current.value).trim() !== '',
    };
  }

  let lost = false;
  const walk = (expression: Expression): Expression => {
    switch (expression.kind) {
      case 'literal':
        if (castLoses(expression, valueKind)) lost = true;
        return castExpression(expression, valueKind);
      /* Built rather than typed, and with no literal form to cast into. The
         whole thing is replaced, which is a loss whatever it held. */
      case 'list':
      case 'index':
      case 'length':
        lost = true;
        return emptyValue(valueKind);
      case 'group':
        return { ...expression, inner: walk(expression.inner) };
      case 'binary':
        return { ...expression, left: walk(expression.left), right: walk(expression.right) };
      case 'unary':
        return { ...expression, operand: walk(expression.operand) };
      /* A variable's type belongs to its declaration, not to this use of it. */
      default:
        return expression;
    }
  };

  return { value: walk(current), lostContent: lost };
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
