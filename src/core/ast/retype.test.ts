import { describe, expect, it } from 'vitest';

import { createStatement, literal, retypeDeclaration, retypeDeclarationDeep } from './factory';
import type { Expression, Statement, ValueKind } from './types';

/**
 * Changing a declaration's type must change what it holds.
 *
 * The chip and the value are two views of one fact, and they were able to
 * disagree: a declaration switched away from `lista` kept a list-shaped value
 * under a chip reading "texto" — a state the emitters and the interpreter have
 * no way to make sense of.
 *
 * This mirrors the transition the block performs, so the rule lives somewhere
 * a test can reach rather than only inside a click handler.
 */
const retype = retypeDeclaration;

const declare = (valueKind: ValueKind, value: Expression): Statement =>
  ({ ...createStatement('declare'), name: 'x', valueKind, value }) as Statement;

describe('switching a declaration between types', () => {
  it('replaces a list when the type becomes text', () => {
    const list: Expression = { kind: 'list', items: [literal(1, 'number'), literal(2, 'number')] };
    const next = retype(list, 'text');
    expect(next.kind).toBe('literal');
    expect(next).not.toHaveProperty('items');
  });

  it('replaces a list when the type becomes number', () => {
    const list: Expression = { kind: 'list', items: [literal(1, 'number')] };
    expect(retype(list, 'number').kind).toBe('literal');
  });

  it('replaces an index, which is also built rather than typed', () => {
    const at: Expression = {
      kind: 'index',
      list: { kind: 'variable', name: 'notas' },
      index: literal(0, 'number'),
    };
    expect(retype(at, 'text').kind).toBe('literal');
  });

  it('starts a list with one item, so there is something to click', () => {
    const next = retype(literal('hola', 'text'), 'list');
    expect(next.kind).toBe('list');
    expect(next.kind === 'list' && next.items).toHaveLength(1);
  });

  it('keeps an ordinary literal, casting it to the new kind', () => {
    const next = retype(literal('42', 'text'), 'number');
    expect(next.kind).toBe('literal');
    expect(next.kind === 'literal' && next.valueKind).toBe('number');
  });

  it('never leaves the declared kind and the value disagreeing', () => {
    // The property the bug violated, over every pair of kinds.
    const kinds: ValueKind[] = ['number', 'text', 'boolean', 'list'];
    for (const from of kinds) {
      for (const to of kinds) {
        const start: Expression =
          from === 'list' ? { kind: 'list', items: [literal(0, 'number')] } : literal(0, from);
        const value = retype(start, to);
        const statement = declare(to, value);
        const holdsList = value.kind === 'list';
        expect(
          holdsList,
          `declaring ${to} after ${from} produced ${value.kind}`,
        ).toBe(statement.kind === 'declare' && statement.valueKind === 'list');
      }
    }
  });
});

/**
 * Re-typing has to reach every field, not just the root one.
 *
 * The shallow version re-read only the outermost node. That is the field
 * itself while the value is one literal, and nothing at all once the student
 * has built `1 + 2 + 3`: a `binary` is not a literal, so the cast passed it
 * through and the three numeric fields stayed numeric under a chip reading
 * "texto". There was no way out either — a part inside a declaration cannot
 * offer its own type, and the last part of a chain cannot be removed.
 */
describe('re-typing reaches every part of the value', () => {
  const sum: Expression = {
    kind: 'binary',
    operator: '+',
    left: { kind: 'binary', operator: '+', left: literal(1, 'number'), right: literal(2, 'number') },
    right: literal(3, 'number'),
  };

  /** Every literal in the tree, in order, for checking what survived. */
  const literals = (expression: Expression): Expression[] => {
    if (expression.kind === 'literal') return [expression];
    if (expression.kind === 'binary') return [...literals(expression.left), ...literals(expression.right)];
    if (expression.kind === 'group') return literals(expression.inner);
    if (expression.kind === 'unary') return literals(expression.operand);
    return [];
  };

  it('converts every operand of a chain, not only the first', () => {
    const { value } = retypeDeclarationDeep(sum, 'text');
    const parts = literals(value);
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(part.kind === 'literal' && part.valueKind).toBe('text');
    }
  });

  it('keeps what each field held: 1 + 2 + 3 becomes "1" + "2" + "3"', () => {
    const { value } = retypeDeclarationDeep(sum, 'text');
    expect(literals(value).map((part) => (part.kind === 'literal' ? part.value : null))).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  it('says nothing was lost, because numbers survive becoming text', () => {
    expect(retypeDeclarationDeep(sum, 'text').lostContent).toBe(false);
  });

  it('reports the loss when text cannot become a number', () => {
    const joined: Expression = {
      kind: 'binary',
      operator: '+',
      left: literal('hola', 'text'),
      right: literal('mundo', 'text'),
    };
    const { value, lostContent } = retypeDeclarationDeep(joined, 'number');
    expect(lostContent).toBe(true);
    expect(literals(value).map((part) => (part.kind === 'literal' ? part.value : null))).toEqual([0, 0]);
  });

  it('reports no loss for text that reads as a number', () => {
    const joined: Expression = {
      kind: 'binary',
      operator: '+',
      left: literal('42', 'text'),
      right: literal('7', 'text'),
    };
    expect(retypeDeclarationDeep(joined, 'number').lostContent).toBe(false);
  });

  it('leaves a variable alone: its type belongs to its declaration', () => {
    const withVariable: Expression = {
      kind: 'binary',
      operator: '+',
      left: { kind: 'variable', name: 'n' },
      right: literal(1, 'number'),
    };
    const { value } = retypeDeclarationDeep(withVariable, 'text');
    expect(value.kind === 'binary' && value.left.kind).toBe('variable');
  });

  it('still agrees with the shallow entry point for a lone literal', () => {
    expect(retypeDeclaration(literal(5, 'number'), 'text')).toEqual(literal('5', 'text'));
  });

  it('reaches inside a group as well', () => {
    const grouped: Expression = {
      kind: 'binary',
      operator: '+',
      left: { kind: 'group', inner: { kind: 'binary', operator: '+', left: literal(1, 'number'), right: literal(2, 'number') } },
      right: literal(3, 'number'),
    };
    const { value } = retypeDeclarationDeep(grouped, 'text');
    for (const part of literals(value)) {
      expect(part.kind === 'literal' && part.valueKind).toBe('text');
    }
  });
});
