import type { Algorithm, Expression, Statement } from '../ast/types';
import { needsParentheses } from './precedence';
import type { EmittedLine, Emitter } from './types';

function quote(text: string): string {
  return JSON.stringify(text);
}

/** `nombre(a, b)` — shared by the call statement and the call expression. */
function callToJs(name: string, args: Expression[]): string {
  return `${name || 'sinNombre'}(${args.map((arg) => expressionToJs(arg)).join(', ')})`;
}

export function expressionToJs(expression: Expression): string {
  switch (expression.kind) {
    case 'literal':
      if (expression.valueKind === 'text') return quote(String(expression.value));
      return String(expression.value);
    case 'variable':
      return expression.name;
    case 'group':
      /* Always bracketed, even where precedence would not require it: the
         student asked for this grouping, so the code shows it. */
      return `(${expressionToJs(expression.inner)})`;
    case 'unary':
      return `${expression.operator}${wrapUnaryOperand(expression.operand)}`;
    case 'list':
      return `[${expression.items.map(expressionToJs).join(', ')}]`;
    case 'index':
      return `${expressionToJs(expression.list)}[${expressionToJs(expression.index)}]`;
    case 'length':
      return `${expressionToJs(expression.list)}.length`;
    case 'call':
      return callToJs(expression.name, expression.args);
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

    case 'assign': {
      // With an index it writes one element; the optional field is invisible to
      // the compiler, so every emitter has to remember it by hand.
      const target = statement.index
        ? `${statement.name}[${expressionToJs(statement.index)}]`
        : statement.name;
      return [line(`${target} = ${expressionToJs(statement.value)};`)];
    }

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
      /* `else if` on one line rather than a nested block, which is both what
         JavaScript writes and what the blocks now show. */
      for (const arm of statement.elseIfs ?? []) {
        lines.push(closing(`} else if (${expressionToJs(arm.condition)}) {`));
        lines.push(...emitStatements(arm.body, indent + 1, scope));
      }
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

    case 'forEachItem': {
      /* `const` in the header, so the loop owns its binding and a later
         `declare` of the same name still gets its own `let` — the same rule
         the counted loop above follows. */
      const lines: EmittedLine[] = [
        line(`for (const ${statement.variable} of ${expressionToJs(statement.list)}) {`),
        ...emitStatements(statement.body, indent + 1, scope),
        closing('}'),
      ];
      return lines;
    }

    case 'function': {
      /* `async` only where the student asked for it, so an ordinary function
         reads exactly like the one they will write in class. */
      const keyword = statement.isAsync ? 'async function' : 'function';
      return [
        line(`${keyword} ${statement.name || 'sinNombre'}(${statement.params.filter(Boolean).join(', ')}) {`),
        ...emitStatements(statement.body, indent + 1, scope),
        closing('}'),
      ];
    }

    case 'return':
      return [line(statement.value ? `return ${expressionToJs(statement.value)};` : 'return;')];

    case 'call':
      return [line(`${callToJs(statement.name, statement.args)};`)];

    case 'listOp': {
      const { name, operation } = statement;
      const value = statement.value ? expressionToJs(statement.value) : "''";
      const at = statement.index ? expressionToJs(statement.index) : null;
      switch (operation) {
        case 'append':
          return [line(`${name}.push(${value});`)];
        case 'insert':
          return [line(`${name}.splice(${at ?? `${name}.length`}, 0, ${value});`)];
        case 'removeAt':
          return [line(`${name}.splice(${at ?? `${name}.length - 1`}, 1);`)];
        case 'reverse':
          return [line(`${name}.reverse();`)];
        case 'sort':
          /* Spelled out rather than a bare `.sort()`, which compares values as
             text and puts 10 before 2 — the first thing a student notices and
             the hardest to explain. The emitted code has to behave the way the
             robot did, or the two views disagree. */
          return [
            line(
              statement.descending
                ? `${name}.sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? b - a : String(b).localeCompare(String(a))));`
                : `${name}.sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))));`,
            ),
          ];
      }
      return [];
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
