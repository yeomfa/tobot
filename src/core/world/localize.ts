import type { Algorithm, Expression, Statement } from '../ast/types';
import type { Language } from '../../i18n/types';
import { worldFunction } from './registry';

/** Every call's name, rewritten; everything else, including ids, kept. */
function renameCalls(statements: Statement[], rename: (name: string) => string): Statement[] {
  const inExpression = (expression: Expression): Expression => {
    switch (expression.kind) {
      case 'call':
        return { ...expression, name: rename(expression.name), args: expression.args.map(inExpression) };
      case 'binary':
        return { ...expression, left: inExpression(expression.left), right: inExpression(expression.right) };
      case 'unary':
        return { ...expression, operand: inExpression(expression.operand) };
      case 'group':
        return { ...expression, inner: inExpression(expression.inner) };
      case 'list':
        return { ...expression, items: expression.items.map(inExpression) };
      case 'index':
        return { ...expression, list: inExpression(expression.list), index: inExpression(expression.index) };
      case 'length':
        return { ...expression, list: inExpression(expression.list) };
      default:
        return expression;
    }
  };
  const maybe = (expression: Expression | undefined) => (expression ? inExpression(expression) : expression);

  const walk = (list: Statement[]): Statement[] =>
    list.map((statement): Statement => {
      switch (statement.kind) {
        case 'call':
          return { ...statement, name: rename(statement.name), args: statement.args.map(inExpression) };
        case 'declare':
          return { ...statement, value: inExpression(statement.value) };
        case 'assign':
          return { ...statement, value: inExpression(statement.value), index: maybe(statement.index) };
        case 'say':
          return { ...statement, value: inExpression(statement.value) };
        case 'return':
          return { ...statement, value: maybe(statement.value) };
        case 'ask':
          return { ...statement, prompt: inExpression(statement.prompt) };
        case 'if':
          return {
            ...statement,
            condition: inExpression(statement.condition),
            then: walk(statement.then),
            elseIfs: statement.elseIfs?.map((arm) => ({
              ...arm,
              condition: inExpression(arm.condition),
              body: walk(arm.body),
            })),
            otherwise: statement.otherwise ? walk(statement.otherwise) : statement.otherwise,
          };
        case 'while':
          return { ...statement, condition: inExpression(statement.condition), body: walk(statement.body) };
        case 'repeat':
          return { ...statement, times: inExpression(statement.times), body: walk(statement.body) };
        case 'forEach':
          return {
            ...statement,
            from: inExpression(statement.from),
            to: inExpression(statement.to),
            step: inExpression(statement.step),
            body: walk(statement.body),
          };
        case 'forEachItem':
          return { ...statement, list: inExpression(statement.list), body: walk(statement.body) };
        case 'function':
          return { ...statement, body: walk(statement.body) };
        case 'listOp':
          return { ...statement, value: maybe(statement.value), index: maybe(statement.index) };
        default:
          return statement;
      }
    });

  return walk(statements);
}

/**
 * The program as a student of this language reads it.
 *
 * The tree stores a world call by its stable id, `turnOn`, so one program reads
 * the same in either language; every view then shows `encender` to a Spanish
 * class and `turnOn` to an English one, as pseudocode already does with its
 * keywords. Only for a program with a world: without one, a function of the
 * student's that happens to be called `wait` is theirs, and is left alone.
 */
export function localizeWorldCalls(algorithm: Algorithm, language: Language): Algorithm {
  if (!algorithm.world) return algorithm;
  return {
    ...algorithm,
    body: renameCalls(algorithm.body, (name) => worldFunction(name)?.names[language] ?? name),
  };
}
