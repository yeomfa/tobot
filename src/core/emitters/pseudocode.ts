import type { Algorithm, BinaryOperator, Expression, Statement } from '../ast/types';
import type { Language } from '../../i18n/types';
import { needsParentheses } from './precedence';
import type { EmittedLine, Emitter, EmitterContext } from './types';

/**
 * Pseudocode keywords follow the interface language: a Spanish-speaking student
 * reads `SI … ENTONCES`, an English-speaking one reads `IF … THEN`. The shape of
 * the code is identical, which is the point — only the words change.
 */
export interface Keywords {
  declare: string;
  assign: string;
  say: string;
  ask: string;
  saveIn: string;
  if: string;
  then: string;
  else: string;
  endIf: string;
  while: string;
  do: string;
  endWhile: string;
  repeat: string;
  times: string;
  endRepeat: string;
  for: string;
  from: string;
  to: string;
  step: string;
  endFor: string;
  start: string;
  end: string;
  and: string;
  or: string;
  not: string;
  true: string;
  false: string;
}

/** Exported so the flowchart can label shapes with the same vocabulary. */
export const pseudocodeKeywords: Record<Language, Keywords> = {
  es: {
    declare: 'VARIABLE',
    assign: 'ASIGNAR',
    say: 'MOSTRAR',
    ask: 'LEER',
    saveIn: 'EN',
    if: 'SI',
    then: 'ENTONCES',
    else: 'SI NO',
    endIf: 'FIN SI',
    while: 'MIENTRAS',
    do: 'HACER',
    endWhile: 'FIN MIENTRAS',
    repeat: 'REPETIR',
    times: 'VECES',
    endRepeat: 'FIN REPETIR',
    for: 'PARA',
    from: 'DESDE',
    to: 'HASTA',
    step: 'CON PASO',
    endFor: 'FIN PARA',
    start: 'INICIO',
    end: 'FIN',
    and: 'Y',
    or: 'O',
    not: 'NO',
    true: 'VERDADERO',
    false: 'FALSO',
  },
  en: {
    declare: 'VARIABLE',
    assign: 'SET',
    say: 'DISPLAY',
    ask: 'READ',
    saveIn: 'INTO',
    if: 'IF',
    then: 'THEN',
    else: 'ELSE',
    endIf: 'END IF',
    while: 'WHILE',
    do: 'DO',
    endWhile: 'END WHILE',
    repeat: 'REPEAT',
    times: 'TIMES',
    endRepeat: 'END REPEAT',
    for: 'FOR',
    from: 'FROM',
    to: 'TO',
    step: 'STEP',
    endFor: 'END FOR',
    start: 'START',
    end: 'END',
    and: 'AND',
    or: 'OR',
    not: 'NOT',
    true: 'TRUE',
    false: 'FALSE',
  },
};

/** Pseudocode prefers words over symbols for logic, and `=` for equality. */
function operatorText(operator: BinaryOperator, keywords: Keywords): string {
  switch (operator) {
    case '&&':
      return keywords.and;
    case '||':
      return keywords.or;
    case '==':
      return '=';
    case '!=':
      return '≠';
    case '<=':
      return '≤';
    case '>=':
      return '≥';
    default:
      return operator;
  }
}

export function expressionToPseudocode(expression: Expression, keywords: Keywords): string {
  switch (expression.kind) {
    case 'literal':
      if (expression.valueKind === 'text') return `"${String(expression.value)}"`;
      if (expression.valueKind === 'boolean') {
        return expression.value ? keywords.true : keywords.false;
      }
      return String(expression.value);
    case 'variable':
      return expression.name;
    case 'unary': {
      const operand = expressionToPseudocode(expression.operand, keywords);
      if (expression.operator === '!') {
        return `${keywords.not} ${expression.operand.kind === 'binary' ? `(${operand})` : operand}`;
      }
      return `-${expression.operand.kind === 'binary' ? `(${operand})` : operand}`;
    }
    case 'binary': {
      const left = expressionToPseudocode(expression.left, keywords);
      const right = expressionToPseudocode(expression.right, keywords);
      const leftText = needsParentheses(expression.operator, expression.left, false)
        ? `(${left})`
        : left;
      const rightText = needsParentheses(expression.operator, expression.right, true)
        ? `(${right})`
        : right;
      return `${leftText} ${operatorText(expression.operator, keywords)} ${rightText}`;
    }
  }
}

function emitStatements(statements: Statement[], indent: number, kw: Keywords): EmittedLine[] {
  return statements.flatMap((statement) => emitStatement(statement, indent, kw));
}

function emitStatement(statement: Statement, indent: number, kw: Keywords): EmittedLine[] {
  const id = statement.id;
  const line = (text: string, depth = indent): EmittedLine => ({ nodeId: id, indent: depth, text });
  const closing = (text: string, depth = indent): EmittedLine => ({
    nodeId: null,
    indent: depth,
    text,
  });
  const expr = (expression: Expression): string => expressionToPseudocode(expression, kw);

  switch (statement.kind) {
    case 'comment':
      return [line(`// ${statement.text}`)];

    case 'declare':
      return [line(`${kw.declare} ${statement.name} ← ${expr(statement.value)}`)];

    case 'assign':
      return [line(`${statement.name} ← ${expr(statement.value)}`)];

    case 'say':
      return [line(`${kw.say} ${expr(statement.value)}`)];

    case 'ask':
      return [line(`${kw.ask} ${expr(statement.prompt)} ${kw.saveIn} ${statement.target}`)];

    case 'if': {
      const lines: EmittedLine[] = [line(`${kw.if} ${expr(statement.condition)} ${kw.then}`)];
      lines.push(...emitStatements(statement.then, indent + 1, kw));
      if (statement.otherwise) {
        lines.push(closing(kw.else));
        lines.push(...emitStatements(statement.otherwise, indent + 1, kw));
      }
      lines.push(closing(kw.endIf));
      return lines;
    }

    case 'while': {
      const lines: EmittedLine[] = [
        line(`${kw.while} ${expr(statement.condition)} ${kw.do}`),
        ...emitStatements(statement.body, indent + 1, kw),
        closing(kw.endWhile),
      ];
      return lines;
    }

    case 'repeat':
      return [
        line(`${kw.repeat} ${expr(statement.times)} ${kw.times}`),
        ...emitStatements(statement.body, indent + 1, kw),
        closing(kw.endRepeat),
      ];

    case 'forEach': {
      const stepText = expr(statement.step);
      const header =
        stepText === '1'
          ? `${kw.for} ${statement.variable} ${kw.from} ${expr(statement.from)} ${kw.to} ${expr(statement.to)}`
          : `${kw.for} ${statement.variable} ${kw.from} ${expr(statement.from)} ${kw.to} ${expr(statement.to)} ${kw.step} ${stepText}`;
      return [
        line(header),
        ...emitStatements(statement.body, indent + 1, kw),
        closing(kw.endFor),
      ];
    }
  }
}

export const pseudocodeEmitter: Emitter = {
  id: 'pseudocode',
  label: 'Pseudocode',
  syntax: 'pseudocode',
  extension: 'txt',
  emit: (algorithm: Algorithm, context: EmitterContext): EmittedLine[] => {
    const kw = pseudocodeKeywords[context.locale];
    return [
      { nodeId: null, indent: 0, text: kw.start },
      ...emitStatements(algorithm.body, 1, kw),
      { nodeId: null, indent: 0, text: kw.end },
    ];
  },
};
