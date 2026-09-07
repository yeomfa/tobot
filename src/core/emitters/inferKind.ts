import type { Expression, LiteralKind, Statement } from '../ast/types';

/**
 * What a variable holds, as far as the declarations can say.
 *
 * `unknown` is a real answer, not a failure: a variable assigned in one branch
 * and not another, or one the student has not named yet, genuinely has no
 * single kind.
 */
export type Kind = LiteralKind | 'unknown';

export type VariableKinds = Map<string, Kind>;

/**
 * The kind an expression produces.
 *
 * Only as much inference as the emitters need — Python is the one language
 * here that will not concatenate a number onto a string, so it has to know
 * which operands are text before it writes the line.
 */
export function kindOf(expression: Expression, variables: VariableKinds): Kind {
  switch (expression.kind) {
    case 'literal':
      return expression.valueKind;
    case 'variable':
      return variables.get(expression.name) ?? 'unknown';
    case 'group':
      return kindOf(expression.inner, variables);
    case 'unary':
      // `!` yields a boolean; `-` yields a number. Neither can be text.
      return expression.operator === '!' ? 'boolean' : 'number';
    case 'binary': {
      const { operator } = expression;
      if (operator === '&&' || operator === '||') return 'boolean';
      if (
        operator === '==' || operator === '!=' ||
        operator === '<' || operator === '<=' ||
        operator === '>' || operator === '>='
      ) {
        return 'boolean';
      }
      if (operator !== '+') return 'number';

      /*
        `+` is the only ambiguous one, and it follows the interpreter: text on
        either side concatenates, so the result is text. Anything the emitter
        cannot pin down stays unknown, and the caller decides what to do about
        that — for Python, wrapping in `str()`, which is harmless on a string.
      */
      const left = kindOf(expression.left, variables);
      const right = kindOf(expression.right, variables);
      if (left === 'text' || right === 'text') return 'text';
      if (left === 'unknown' || right === 'unknown') return 'unknown';
      return 'number';
    }
  }
}

/**
 * Collects what each variable holds, in document order.
 *
 * Walks into bodies so a variable declared inside a loop is known to the
 * statements after it there. A name declared twice with different kinds
 * becomes `unknown` rather than taking the later one: at the point of use
 * either could be in scope, and guessing is what would produce broken code.
 */
export function collectVariableKinds(
  statements: Statement[],
  into: VariableKinds = new Map(),
): VariableKinds {
  const record = (name: string, kind: Kind): void => {
    if (!name) return;
    const existing = into.get(name);
    into.set(name, existing === undefined || existing === kind ? kind : 'unknown');
  };

  for (const statement of statements) {
    switch (statement.kind) {
      case 'declare':
        record(statement.name, statement.valueKind);
        break;
      case 'ask':
        record(statement.target, statement.expect);
        break;
      case 'forEach':
        // The counter of a numeric range is a number, always.
        record(statement.variable, 'number');
        collectVariableKinds(statement.body, into);
        break;
      case 'if':
        collectVariableKinds(statement.then, into);
        for (const arm of statement.elseIfs ?? []) collectVariableKinds(arm.body, into);
        if (statement.otherwise) collectVariableKinds(statement.otherwise, into);
        break;
      case 'while':
      case 'repeat':
        collectVariableKinds(statement.body, into);
        break;
      default:
    }
  }

  return into;
}
