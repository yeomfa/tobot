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
  elseIf: string;
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
  forEach: string;
  in: string;
  endForEach: string;
  append: string;
  insert: string;
  at: string;
  removeAt: string;
  sort: string;
  ascending: string;
  descending: string;
  reverse: string;
  length: string;
  /** A function's header, its close, and the two ways it is used. */
  function: string;
  endFunction: string;
  returns: string;
  call: string;
  async: string;
  /** Type names, for a signature that says what it takes. */
  types: Record<'number' | 'text' | 'boolean' | 'list', string>;
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
    elseIf: 'SI NO, SI',
    endIf: 'FIN SI',
    while: 'MIENTRAS',
    do: 'HACER',
    endWhile: 'FIN MIENTRAS',
    repeat: 'REPETIR',
    times: 'VECES',
    endRepeat: 'FIN REPETIR',
    for: 'PARA',
    forEach: 'PARA CADA',
    in: 'EN',
    endForEach: 'FIN PARA CADA',
    append: 'AGREGAR',
    insert: 'INSERTAR',
    at: 'EN LA POSICIÓN',
    removeAt: 'QUITAR DE',
    sort: 'ORDENAR',
    ascending: 'ASCENDENTE',
    descending: 'DESCENDENTE',
    reverse: 'INVERTIR',
    length: 'LARGO DE',
    from: 'DESDE',
    to: 'HASTA',
    step: 'CON PASO',
    endFor: 'FIN PARA',
    function: 'FUNCIÓN',
    endFunction: 'FIN FUNCIÓN',
    returns: 'DEVOLVER',
    call: 'LLAMAR',
    async: 'ASÍNCRONA',
    types: { number: 'NÚMERO', text: 'TEXTO', boolean: 'LÓGICO', list: 'LISTA' },
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
    elseIf: 'ELSE IF',
    endIf: 'END IF',
    while: 'WHILE',
    do: 'DO',
    endWhile: 'END WHILE',
    repeat: 'REPEAT',
    times: 'TIMES',
    endRepeat: 'END REPEAT',
    for: 'FOR',
    forEach: 'FOR EACH',
    in: 'IN',
    endForEach: 'END FOR EACH',
    append: 'APPEND',
    insert: 'INSERT',
    at: 'AT',
    removeAt: 'REMOVE FROM',
    sort: 'SORT',
    ascending: 'ASCENDING',
    descending: 'DESCENDING',
    reverse: 'REVERSE',
    length: 'LENGTH OF',
    from: 'FROM',
    to: 'TO',
    step: 'STEP',
    endFor: 'END FOR',
    start: 'START',
    function: 'FUNCTION',
    endFunction: 'END FUNCTION',
    returns: 'RETURN',
    call: 'CALL',
    async: 'ASYNCHRONOUS',
    types: { number: 'NUMBER', text: 'TEXT', boolean: 'BOOLEAN', list: 'LIST' },
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
  if (expression.kind === 'call') {
    const args = expression.args.map((arg) => expressionToPseudocode(arg, keywords)).join(', ');
    return `${expression.name || '?'}(${args})`;
  }
  switch (expression.kind) {
    case 'literal':
      if (expression.valueKind === 'text') return `"${String(expression.value)}"`;
      if (expression.valueKind === 'boolean') {
        return expression.value ? keywords.true : keywords.false;
      }
      return String(expression.value);
    case 'variable':
      return expression.name;
    case 'group':
      return `(${expressionToPseudocode(expression.inner, keywords)})`;
    case 'list':
      return `[${expression.items.map((item) => expressionToPseudocode(item, keywords)).join(', ')}]`;
    case 'index':
      return `${expressionToPseudocode(expression.list, keywords)}[${expressionToPseudocode(expression.index, keywords)}]`;
    case 'length':
      return `${keywords.length} ${expressionToPseudocode(expression.list, keywords)}`;
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
      return statement.text.split('\n').map((part) => line(`// ${part}`));

    case 'declare':
      return [line(`${kw.declare} ${statement.name} ← ${expr(statement.value)}`)];

    case 'assign': {
      const target = statement.index
        ? `${statement.name}[${expr(statement.index)}]`
        : statement.name;
      return [line(`${target} ← ${expr(statement.value)}`)];
    }

    case 'listOp': {
      const value = statement.value ? expr(statement.value) : '';
      const at = statement.index ? expr(statement.index) : '';
      switch (statement.operation) {
        case 'append':
          return [line(`${kw.append} ${value} ${kw.to} ${statement.name}`)];
        case 'insert':
          return [line(`${kw.insert} ${value} ${kw.at} ${at} ${kw.to} ${statement.name}`)];
        case 'removeAt':
          return [line(`${kw.removeAt} ${statement.name} ${kw.at} ${at}`)];
        case 'sort':
          return [
            line(
              `${kw.sort} ${statement.name} ${statement.descending ? kw.descending : kw.ascending}`,
            ),
          ];
        case 'reverse':
          return [line(`${kw.reverse} ${statement.name}`)];
      }
      return [];
    }

    case 'forEachItem':
      return [
        line(`${kw.forEach} ${statement.variable} ${kw.in} ${expr(statement.list)} ${kw.do}`),
        ...emitStatements(statement.body, indent + 1, kw),
        line(kw.endForEach),
      ];

    case 'function': {
      /* The type goes with the name here: pseudocode is where a student reads
         the shape of a program, and a signature that says what it takes is
         part of that shape. */
      const params = statement.params
        .filter((param) => param.name)
        .map((param) => `${param.name}: ${kw.types[param.type]}`)
        .join(', ');
      /* The marker goes after the header rather than before the keyword, so
         every function still starts with the same word and the eye finds
         them down the left edge. */
      const marker = statement.isAsync ? ` (${kw.async})` : '';
      return [
        line(`${kw.function} ${statement.name || '?'}(${params})${marker}`),
        ...emitStatements(statement.body, indent + 1, kw),
        line(kw.endFunction),
      ];
    }

    case 'return':
      return [line(statement.value ? `${kw.returns} ${expr(statement.value)}` : kw.returns)];

    case 'call':
      return [
        line(
          `${kw.call} ${statement.name || '?'}(${statement.args.map((arg) => expr(arg)).join(', ')})`,
        ),
      ];

    case 'say':
      return [line(`${kw.say} ${expr(statement.value)}`)];

    case 'ask':
      return [line(`${kw.ask} ${expr(statement.prompt)} ${kw.saveIn} ${statement.target}`)];

    case 'if': {
      const lines: EmittedLine[] = [line(`${kw.if} ${expr(statement.condition)} ${kw.then}`)];
      lines.push(...emitStatements(statement.then, indent + 1, kw));
      for (const arm of statement.elseIfs ?? []) {
        lines.push(closing(`${kw.elseIf} ${expr(arm.condition)} ${kw.then}`));
        lines.push(...emitStatements(arm.body, indent + 1, kw));
      }
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
