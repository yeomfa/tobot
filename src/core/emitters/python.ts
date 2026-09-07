import type { Algorithm, BinaryOperator, Expression, Statement } from '../ast/types';
import { needsParentheses } from './precedence';
import { collectVariableKinds, kindOf } from './inferKind';
import type { VariableKinds } from './inferKind';
import type { EmittedLine, Emitter } from './types';

/**
 * Second real target language. It exists to prove the emitter seam: supporting
 * Python required this file and one registry entry, with no change to the AST,
 * the editor or the interpreter.
 */

const OPERATORS: Partial<Record<BinaryOperator, string>> = {
  '&&': 'and',
  '||': 'or',
};

/**
 * Renders an operand of `+` inside a concatenation, converting when it must.
 *
 * Python is the one target here that refuses to add a number to a string, so
 * `"Tu nota: " + nota` raised `TypeError: can only concatenate str (not
 * "float") to str` — code the student could read on screen and could not run.
 * The interpreter's rule is that text on either side concatenates, so the
 * emitter follows it and converts the other side rather than changing what the
 * program means.
 *
 * `str()` is applied to what is not already known to be text, `unknown`
 * included: it is harmless on a string, and a wrong guess the other way
 * produces the exact error this exists to prevent.
 */
function concatOperand(expression: Expression, variables: VariableKinds): string {
  const text = expressionToPython(expression, variables);
  if (kindOf(expression, variables) === 'text') return text;
  // Already parenthesised by `str(...)`, so precedence needs nothing more.
  return `str(${expression.kind === 'group' ? expressionToPython(expression.inner, variables) : text})`;
}

function expressionToPython(expression: Expression, variables: VariableKinds): string {
  switch (expression.kind) {
    case 'literal':
      if (expression.valueKind === 'text') return JSON.stringify(String(expression.value));
      if (expression.valueKind === 'boolean') return expression.value ? 'True' : 'False';
      return String(expression.value);
    case 'variable':
      return expression.name;
    case 'group':
      return `(${expressionToPython(expression.inner, variables)})`;
    case 'unary': {
      const operand = expressionToPython(expression.operand, variables);
      const wrapped = expression.operand.kind === 'binary' ? `(${operand})` : operand;
      return expression.operator === '!' ? `not ${wrapped}` : `-${wrapped}`;
    }
    case 'binary': {
      /*
        A `+` whose result is text is a concatenation, and every operand of it
        has to be a string before Python will join them.
      */
      if (expression.operator === '+' && kindOf(expression, variables) === 'text') {
        return `${concatOperand(expression.left, variables)} + ${concatOperand(expression.right, variables)}`;
      }
      const left = expressionToPython(expression.left, variables);
      const right = expressionToPython(expression.right, variables);
      const leftText = needsParentheses(expression.operator, expression.left, false) ? `(${left})` : left;
      const rightText = needsParentheses(expression.operator, expression.right, true) ? `(${right})` : right;
      const operator = OPERATORS[expression.operator] ?? expression.operator;
      return `${leftText} ${operator} ${rightText}`;
    }
  }
}

function coerceInput(raw: string, expect: 'number' | 'text' | 'boolean'): string {
  if (expect === 'number') return `float(${raw})`;
  if (expect === 'boolean') return `${raw} == "true"`;
  return raw;
}

function emitStatements(statements: Statement[], indent: number, variables: VariableKinds): EmittedLine[] {
  // Python has no braces: an empty block still needs a `pass` to stay valid.
  if (statements.length === 0) return [{ nodeId: null, indent, text: 'pass' }];
  return statements.flatMap((statement) => emitStatement(statement, indent, variables));
}

function emitStatement(statement: Statement, indent: number, variables: VariableKinds): EmittedLine[] {
  const id = statement.id;
  const line = (text: string): EmittedLine => ({ nodeId: id, indent, text });
  const closing = (text: string): EmittedLine => ({ nodeId: null, indent, text });
  // Bound to this program's variable kinds, so every call site below reads as
  // `expr(x)` and still knows what each name holds.
  const expr = (expression: Expression): string => expressionToPython(expression, variables);

  switch (statement.kind) {
    case 'comment':
      return statement.text.split('\n').map((part) => line(`# ${part}`));

    case 'declare':
    case 'assign':
      return [line(`${statement.name} = ${expr(statement.value)}`)];

    case 'say':
      return [line(`print(${expr(statement.value)})`)];

    case 'ask':
      return [line(`${statement.target} = ${coerceInput(`input(${expr(statement.prompt)})`, statement.expect)}`)];

    case 'if': {
      const lines: EmittedLine[] = [line(`if ${expr(statement.condition)}:`)];
      lines.push(...emitStatements(statement.then, indent + 1, variables));
      for (const arm of statement.elseIfs ?? []) {
        lines.push(closing(`elif ${expr(arm.condition)}:`));
        lines.push(...emitStatements(arm.body, indent + 1, variables));
      }
      if (statement.otherwise) {
        lines.push(closing('else:'));
        lines.push(...emitStatements(statement.otherwise, indent + 1, variables));
      }
      return lines;
    }

    case 'while':
      return [
        line(`while ${expr(statement.condition)}:`),
        ...emitStatements(statement.body, indent + 1, variables),
      ];

    case 'repeat': {
      const counter = `_paso_${statement.id.slice(2, 6)}`;
      return [
        line(`for ${counter} in range(${expr(statement.times)}):`),
        ...emitStatements(statement.body, indent + 1, variables),
      ];
    }

    case 'forEach': {
      const { variable, from, to, step } = statement;
      const stepText = expr(step);
      const goesDown = step.kind === 'literal' && Number(step.value) < 0;
      // `range` excludes its endpoint; shift it so `to` is inclusive.
      const bound = goesDown ? `${expr(to)} - 1` : `${expr(to)} + 1`;
      const args = stepText === '1' ? `${expr(from)}, ${bound}` : `${expr(from)}, ${bound}, ${stepText}`;
      return [
        line(`for ${variable} in range(${args}):`),
        ...emitStatements(statement.body, indent + 1, variables),
      ];
    }
  }
}

export const pythonEmitter: Emitter = {
  id: 'python',
  label: 'Python',
  syntax: 'python',
  extension: 'py',
  emit: (algorithm: Algorithm): EmittedLine[] => {
    const lines = emitStatements(algorithm.body, 0, collectVariableKinds(algorithm.body));
    // A top-level `pass` is scaffolding for an empty program, not a statement.
    return algorithm.body.length === 0 ? [] : lines;
  },
};
