import type { Algorithm, Expression, Statement } from '../ast/types';
import { needsParentheses } from './precedence';
import type { EmittedLine, Emitter } from './types';

function quote(text: string): string {
  return JSON.stringify(text);
}

export function expressionToJs(expression: Expression): string {
  switch (expression.kind) {
    case 'literal':
      if (expression.valueKind === 'text') return quote(String(expression.value));
      return String(expression.value);
    case 'variable':
      return expression.name;
    case 'unary':
      return `${expression.operator}${wrapUnaryOperand(expression.operand)}`;
    case 'binary': {
      const left = expressionToJs(expression.left);
      const right = expressionToJs(expression.right);
      const leftText = needsParentheses(expression.operator, expression.left, false)
        ? `(${left})`
        : left;
      const rightText = needsParentheses(expression.operator, expression.right, true)
        ? `(${right})`
        : right;
      return `${leftText} ${expression.operator} ${rightText}`;
    }
  }
}

function wrapUnaryOperand(operand: Expression): string {
  const text = expressionToJs(operand);
  return operand.kind === 'binary' ? `(${text})` : text;
}

/** `ask` returns text; numbers and booleans need an explicit conversion. */
function coerceInput(raw: string, expect: 'number' | 'text' | 'boolean'): string {
  if (expect === 'number') return `Number(${raw})`;
  if (expect === 'boolean') return `${raw} === "true"`;
  return raw;
}

/**
 * Names already bound with `let`. The student model has no block scoping — a
 * variable simply exists once it is introduced — so emission tracks bindings
 * across the whole program and only writes `let` the first time a name appears.
 * Without this, asking into an existing variable emits a duplicate `let`, which
 * is a SyntaxError in real JavaScript.
 */
type Scope = Set<string>;

function bind(scope: Scope, name: string): string {
  if (scope.has(name)) return '';
  scope.add(name);
  return 'let ';
}

function emitStatements(statements: Statement[], indent: number, scope: Scope): EmittedLine[] {
  return statements.flatMap((statement) => emitStatement(statement, indent, scope));
}

function emitStatement(statement: Statement, indent: number, scope: Scope): EmittedLine[] {
  const id = statement.id;
  const line = (text: string, depth = indent): EmittedLine => ({ nodeId: id, indent: depth, text });
  const closing = (text: string, depth = indent): EmittedLine => ({
    nodeId: null,
    indent: depth,
    text,
  });

  switch (statement.kind) {
    case 'comment':
      // Every line needs its own marker, or the second line becomes code.
      return statement.text.split('\n').map((part) => line(`// ${part}`));

    case 'declare':
      return [
        line(`${bind(scope, statement.name)}${statement.name} = ${expressionToJs(statement.value)};`),
      ];

    case 'assign':
      return [line(`${statement.name} = ${expressionToJs(statement.value)};`)];

    case 'say':
      return [line(`console.log(${expressionToJs(statement.value)});`)];

    case 'ask': {
      const promptText = expressionToJs(statement.prompt);
      const raw = `prompt(${promptText})`;
      const keyword = bind(scope, statement.target);
      return [line(`${keyword}${statement.target} = ${coerceInput(raw, statement.expect)};`)];
    }

    case 'if': {
      const lines: EmittedLine[] = [line(`if (${expressionToJs(statement.condition)}) {`)];
      lines.push(...emitStatements(statement.then, indent + 1, scope));
      if (statement.otherwise) {
        lines.push(closing('} else {'));
        lines.push(...emitStatements(statement.otherwise, indent + 1, scope));
      }
      lines.push(closing('}'));
      return lines;
    }

    case 'while': {
      const lines: EmittedLine[] = [line(`while (${expressionToJs(statement.condition)}) {`)];
      lines.push(...emitStatements(statement.body, indent + 1, scope));
      lines.push(closing('}'));
      return lines;
    }

    case 'repeat': {
      // A dedicated counter name avoids colliding with student variables.
      const counter = `paso_${statement.id.slice(2, 6)}`;
      const lines: EmittedLine[] = [
        line(`for (let ${counter} = 0; ${counter} < ${expressionToJs(statement.times)}; ${counter}++) {`),
      ];
      lines.push(...emitStatements(statement.body, indent + 1, scope));
      lines.push(closing('}'));
      return lines;
    }

    case 'forEach': {
      const { variable, from, to, step } = statement;
      const stepText = expressionToJs(step);
      // A negative literal step counts down, so the comparison must flip.
      const goesDown = step.kind === 'literal' && Number(step.value) < 0;
      const comparison = goesDown ? '>=' : '<=';
      const increment =
        stepText === '1' ? `${variable}++` : `${variable} += ${stepText}`;
      // The loop header owns its binding, so it does not consume a program-level
      // one: a later `declare` of the same name still needs its own `let`.
      const lines: EmittedLine[] = [
        line(
          `for (let ${variable} = ${expressionToJs(from)}; ${variable} ${comparison} ${expressionToJs(to)}; ${increment}) {`,
        ),
      ];
      lines.push(...emitStatements(statement.body, indent + 1, scope));
      lines.push(closing('}'));
      return lines;
    }
  }
}

export const javascriptEmitter: Emitter = {
  id: 'javascript',
  label: 'JavaScript',
  syntax: 'javascript',
  extension: 'js',
  emit: (algorithm: Algorithm): EmittedLine[] => emitStatements(algorithm.body, 0, new Set()),
};
