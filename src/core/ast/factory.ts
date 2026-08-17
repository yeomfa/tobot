import type {
  AskStatement,
  AssignStatement,
  DeclareStatement,
  Expression,
  ForEachStatement,
  IfStatement,
  LiteralExpression,
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

type StatementKind = Statement['kind'];

/**
 * Builds a ready-to-edit statement. New statements are always valid so the
 * student never sees a broken program mid-edit.
 */
export function createStatement(kind: StatementKind, suggestedName = 'x'): Statement {
  const id = createId();
  switch (kind) {
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
