import type { Algorithm, BinaryOperator, Expression, Statement } from '../ast/types';
import type { Language } from '../../i18n/types';
import type { EmittedLine, Emitter, EmitterContext } from './types';

/**
 * Prose rendering of the algorithm — the bridge between "what I want to do" and
 * code. Steps are numbered per nesting level (1, 2, 2.1, 2.2) so a student can
 * point at a sentence and find the matching line in the other two tabs.
 */
interface Phrases {
  declare: (name: string, value: string) => string;
  assign: (name: string, value: string) => string;
  say: (value: string) => string;
  ask: (prompt: string, target: string) => string;
  if: (condition: string) => string;
  else: string;
  elseIf: (condition: string) => string;
  endIf: string;
  while: (condition: string) => string;
  endWhile: string;
  repeat: (times: string) => string;
  endRepeat: string;
  for: (variable: string, from: string, to: string, step: string) => string;
  endFor: string;
  list: (items: string[]) => string;
  index: (list: string, index: string) => string;
  length: (list: string) => string;
  assignAt: (name: string, index: string, value: string) => string;
  append: (name: string, value: string) => string;
  insert: (name: string, value: string, index: string) => string;
  removeAt: (name: string, index: string) => string;
  sort: (name: string, descending: boolean) => string;
  reverse: (name: string) => string;
  forEachItem: (variable: string, list: string) => string;
  endForEachItem: string;
  operators: Record<BinaryOperator, string>;
  not: (operand: string) => string;
  negative: (operand: string) => string;
  true: string;
  false: string;
  emptyText: string;
}

const PHRASES: Record<Language, Phrases> = {
  es: {
    declare: (name, value) => `Crea una variable llamada ${name} y guarda en ella ${value}.`,
    assign: (name, value) => `Cambia el valor de ${name} a ${value}.`,
    say: (value) => `El robot dice ${value}.`,
    ask: (prompt, target) => `El robot pregunta ${prompt} y guarda la respuesta en ${target}.`,
    if: (condition) => `Si ${condition}, entonces:`,
    else: 'En caso contrario:',
    elseIf: (condition) => `Si no, si ${condition}, entonces:`,
    endIf: 'Aquí termina la decisión.',
    while: (condition) => `Mientras ${condition}, repite lo siguiente:`,
    endWhile: 'Aquí termina el ciclo.',
    repeat: (times) => `Repite ${times} veces lo siguiente:`,
    endRepeat: 'Aquí termina la repetición.',
    for: (variable, from, to, step) =>
      step === '1'
        ? `Para cada valor de ${variable} desde ${from} hasta ${to}, repite lo siguiente:`
        : `Para cada valor de ${variable} desde ${from} hasta ${to}, avanzando de ${step} en ${step}, repite lo siguiente:`,
    endFor: 'Aquí termina el recorrido.',
    list: (items) =>
      items.length === 0 ? 'una lista vacía' : `una lista con ${items.join(', ')}`,
    /* Positions are spoken from one, not from zero: "el elemento 0" is a
       programmer's habit, and the prose view exists for students who do not
       have it yet. Every other view still shows the real index. */
    index: (list, index) => `el elemento en la posición ${index} de ${list}`,
    length: (list) => `cuántos elementos tiene ${list}`,
    assignAt: (name, index, value) =>
      `Cambia el elemento en la posición ${index} de ${name} a ${value}.`,
    append: (name, value) => `Agrega ${value} al final de ${name}.`,
    insert: (name, value, index) => `Inserta ${value} en la posición ${index} de ${name}.`,
    removeAt: (name, index) => `Quita el elemento en la posición ${index} de ${name}.`,
    sort: (name, descending) =>
      descending ? `Ordena ${name} de mayor a menor.` : `Ordena ${name} de menor a mayor.`,
    reverse: (name) => `Invierte el orden de ${name}.`,
    forEachItem: (variable, list) =>
      `Para cada ${variable} en ${list}, repite lo siguiente:`,
    /* Not "el recorrido", which the counted loop above already says — two
       different endings reading identically is exactly what the prose view
       exists to prevent. */
    endForEachItem: 'Aquí termina el recorrido de la lista.',
    operators: {
      '+': 'más',
      '-': 'menos',
      '*': 'por',
      '/': 'dividido entre',
      '%': 'módulo',
      '==': 'es igual a',
      '!=': 'es distinto de',
      '<': 'es menor que',
      '<=': 'es menor o igual que',
      '>': 'es mayor que',
      '>=': 'es mayor o igual que',
      '&&': 'y',
      '||': 'o',
    },
    not: (operand) => `no se cumple que ${operand}`,
    negative: (operand) => `el negativo de ${operand}`,
    true: 'verdadero',
    false: 'falso',
    emptyText: 'un texto vacío',
  },
  en: {
    declare: (name, value) => `Create a variable called ${name} and store ${value} in it.`,
    assign: (name, value) => `Change the value of ${name} to ${value}.`,
    say: (value) => `The robot says ${value}.`,
    ask: (prompt, target) => `The robot asks ${prompt} and stores the answer in ${target}.`,
    if: (condition) => `If ${condition}, then:`,
    else: 'Otherwise:',
    elseIf: (condition) => `Otherwise, if ${condition}, then:`,
    endIf: 'The decision ends here.',
    while: (condition) => `While ${condition}, repeat the following:`,
    endWhile: 'The loop ends here.',
    repeat: (times) => `Repeat the following ${times} times:`,
    endRepeat: 'The repetition ends here.',
    for: (variable, from, to, step) =>
      step === '1'
        ? `For each value of ${variable} from ${from} to ${to}, repeat the following:`
        : `For each value of ${variable} from ${from} to ${to}, stepping by ${step}, repeat the following:`,
    endFor: 'The traversal ends here.',
    list: (items) => (items.length === 0 ? 'an empty list' : `a list with ${items.join(', ')}`),
    index: (list, index) => `the item at position ${index} of ${list}`,
    length: (list) => `how many items ${list} has`,
    assignAt: (name, index, value) => `Change the item at position ${index} of ${name} to ${value}.`,
    append: (name, value) => `Add ${value} to the end of ${name}.`,
    insert: (name, value, index) => `Insert ${value} at position ${index} of ${name}.`,
    removeAt: (name, index) => `Remove the item at position ${index} of ${name}.`,
    sort: (name, descending) =>
      descending ? `Sort ${name} from largest to smallest.` : `Sort ${name} from smallest to largest.`,
    reverse: (name) => `Reverse the order of ${name}.`,
    forEachItem: (variable, list) => `For each ${variable} in ${list}, repeat the following:`,
    endForEachItem: 'The walk through the list ends here.',
    operators: {
      '+': 'plus',
      '-': 'minus',
      '*': 'times',
      '/': 'divided by',
      '%': 'modulo',
      '==': 'is equal to',
      '!=': 'is different from',
      '<': 'is less than',
      '<=': 'is less than or equal to',
      '>': 'is greater than',
      '>=': 'is greater than or equal to',
      '&&': 'and',
      '||': 'or',
    },
    not: (operand) => `it is not the case that ${operand}`,
    negative: (operand) => `the negative of ${operand}`,
    true: 'true',
    false: 'false',
    emptyText: 'an empty text',
  },
};

function expressionToNatural(expression: Expression, phrases: Phrases): string {
  switch (expression.kind) {
    case 'literal':
      if (expression.valueKind === 'text') {
        const text = String(expression.value);
        return text.length === 0 ? phrases.emptyText : `«${text}»`;
      }
      if (expression.valueKind === 'boolean') {
        return expression.value ? phrases.true : phrases.false;
      }
      return String(expression.value);
    case 'variable':
      return expression.name;
    case 'group':
      /* Spoken as a unit — "(a más b)" — because that is what the student
         said it was. The brackets read naturally here: they are how anyone
         writes "these together" on paper. */
      return `(${expressionToNatural(expression.inner, phrases)})`;
    case 'unary':
      return expression.operator === '!'
        ? phrases.not(expressionToNatural(expression.operand, phrases))
        : phrases.negative(expressionToNatural(expression.operand, phrases));
    case 'list':
      return phrases.list(expression.items.map((item) => expressionToNatural(item, phrases)));
    case 'index':
      return phrases.index(
        expressionToNatural(expression.list, phrases),
        expressionToNatural(expression.index, phrases),
      );
    case 'length':
      return phrases.length(expressionToNatural(expression.list, phrases));
    case 'binary': {
      const left = expressionToNatural(expression.left, phrases);
      const right = expressionToNatural(expression.right, phrases);
      const word = phrases.operators[expression.operator];
      // Nested logic reads ambiguously as prose, so group it explicitly.
      const needsGrouping =
        (expression.operator === '&&' || expression.operator === '||') &&
        (expression.left.kind === 'binary' || expression.right.kind === 'binary');
      return needsGrouping ? `(${left}) ${word} (${right})` : `${left} ${word} ${right}`;
    }
  }
}

function emitStatements(statements: Statement[], indent: number, prefix: string, phrases: Phrases): EmittedLine[] {
  return statements.flatMap((statement, index) =>
    emitStatement(statement, indent, prefix ? `${prefix}.${index + 1}` : String(index + 1), phrases),
  );
}

function emitStatement(
  statement: Statement,
  indent: number,
  number: string,
  phrases: Phrases,
): EmittedLine[] {
  const id = statement.id;
  const line = (text: string): EmittedLine => ({
    nodeId: id,
    indent,
    text: `${number}. ${text}`,
  });
  const closing = (text: string): EmittedLine => ({ nodeId: null, indent, text });
  const expr = (expression: Expression): string => expressionToNatural(expression, phrases);

  switch (statement.kind) {
    case 'comment':
      // A note reads as a note, not as a numbered step of the algorithm.
      // Prefixed with the same marker the other languages use for comments,
      // so a student sees one convention across all four views.
      return statement.text
        .split('\n')
        .map((part) => ({ nodeId: id, indent, text: `// ${part}` }));

    case 'declare':
      return [line(phrases.declare(statement.name, expr(statement.value)))];
    case 'assign':
      return [
        line(
          statement.index
            ? phrases.assignAt(statement.name, expr(statement.index), expr(statement.value))
            : phrases.assign(statement.name, expr(statement.value)),
        ),
      ];

    case 'listOp': {
      const value = statement.value ? expr(statement.value) : '';
      const at = statement.index ? expr(statement.index) : '';
      switch (statement.operation) {
        case 'append':
          return [line(phrases.append(statement.name, value))];
        case 'insert':
          return [line(phrases.insert(statement.name, value, at))];
        case 'removeAt':
          return [line(phrases.removeAt(statement.name, at))];
        case 'sort':
          return [line(phrases.sort(statement.name, statement.descending === true))];
        case 'reverse':
          return [line(phrases.reverse(statement.name))];
      }
      return [];
    }

    case 'forEachItem':
      return [
        line(phrases.forEachItem(statement.variable, expr(statement.list))),
        ...emitStatements(statement.body, indent + 1, number, phrases),
        closing(phrases.endForEachItem),
      ];
    case 'say':
      return [line(phrases.say(expr(statement.value)))];
    case 'ask':
      return [line(phrases.ask(expr(statement.prompt), statement.target))];
    case 'if': {
      const lines: EmittedLine[] = [line(phrases.if(expr(statement.condition)))];
      lines.push(...emitStatements(statement.then, indent + 1, number, phrases));
      statement.elseIfs?.forEach((arm, index) => {
        lines.push(closing(phrases.elseIf(expr(arm.condition))));
        lines.push(...emitStatements(arm.body, indent + 1, `${number}.${index + 2}`, phrases));
      });
      if (statement.otherwise) {
        lines.push(closing(phrases.else));
        lines.push(...emitStatements(statement.otherwise, indent + 1, `${number}b`, phrases));
      }
      lines.push(closing(phrases.endIf));
      return lines;
    }
    case 'while':
      return [
        line(phrases.while(expr(statement.condition))),
        ...emitStatements(statement.body, indent + 1, number, phrases),
        closing(phrases.endWhile),
      ];
    case 'repeat':
      return [
        line(phrases.repeat(expr(statement.times))),
        ...emitStatements(statement.body, indent + 1, number, phrases),
        closing(phrases.endRepeat),
      ];
    case 'forEach':
      return [
        line(
          phrases.for(
            statement.variable,
            expr(statement.from),
            expr(statement.to),
            expr(statement.step),
          ),
        ),
        ...emitStatements(statement.body, indent + 1, number, phrases),
        closing(phrases.endFor),
      ];
  }
}

export const naturalEmitter: Emitter = {
  id: 'natural',
  label: 'Natural',
  syntax: 'natural',
  extension: 'txt',
  emit: (algorithm: Algorithm, context: EmitterContext): EmittedLine[] =>
    emitStatements(algorithm.body, 0, '', PHRASES[context.locale]),
};
