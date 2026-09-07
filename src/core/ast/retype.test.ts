import { describe, expect, it } from 'vitest';

import { createStatement, literal, retypeDeclaration } from './factory';
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
