import type { Algorithm, BinaryOperator, Expression, Statement } from '../ast/types';
import { needsParentheses } from './precedence';
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

function expressionToPython(expression: Expression): string {
  switch (expression.kind) {
    case 'literal':
      if (expression.valueKind === 'text') return JSON.stringify(String(expression.value));
      if (expression.valueKind === 'boolean') return expression.value ? 'True' : 'False';
      return String(expression.value);
    case 'variable':
      return expression.name;
    case 'unary': {
      const operand = expressionToPython(expression.operand);
      const wrapped = expression.operand.kind === 'binary' ? `(${operand})` : operand;
      return expression.operator === '!' ? `not ${wrapped}` : `-${wrapped}`;
    }
    case 'binary': {
      const left = expressionToPython(expression.left);
      const right = expressionToPython(expression.right);
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

function emitStatements(statements: Statement[], indent: number): EmittedLine[] {
  // Python has no braces: an empty block still needs a `pass` to stay valid.
  if (statements.length === 0) return [{ nodeId: null, indent, text: 'pass' }];
  return statements.flatMap((statement) => emitStatement(statement, indent));
}

function emitStatement(statement: Statement, indent: number): EmittedLine[] {
  const id = statement.id;
  const line = (text: string): EmittedLine => ({ nodeId: id, indent, text });
  const closing = (text: string): EmittedLine => ({ nodeId: null, indent, text });
  const expr = expressionToPython;

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
      lines.push(...emitStatements(statement.then, indent + 1));
      for (const arm of statement.elseIfs ?? []) {
        lines.push(closing(`elif ${expr(arm.condition)}:`));
        lines.push(...emitStatements(arm.body, indent + 1));
      }
      if (statement.otherwise) {
        lines.push(closing('else:'));
        lines.push(...emitStatements(statement.otherwise, indent + 1));
      }
      return lines;
    }

    case 'while':
      return [
        line(`while ${expr(statement.condition)}:`),
        ...emitStatements(statement.body, indent + 1),
      ];

    case 'repeat': {
      const counter = `_paso_${statement.id.slice(2, 6)}`;
      return [
        line(`for ${counter} in range(${expr(statement.times)}):`),
        ...emitStatements(statement.body, indent + 1),
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
        ...emitStatements(statement.body, indent + 1),
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
    const lines = emitStatements(algorithm.body, 0);
    // A top-level `pass` is scaffolding for an empty program, not a statement.
    return algorithm.body.length === 0 ? [] : lines;
  },
};
