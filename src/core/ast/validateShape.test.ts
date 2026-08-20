import { describe, expect, it } from 'vitest';

import { sanitizeStatements } from './validateShape';

const say = (id: string, text: string) => ({
  id,
  kind: 'say',
  value: { kind: 'literal', valueKind: 'text', value: text },
});

describe('sanitizing an algorithm from outside the app', () => {
  it('keeps a well-formed statement', () => {
    expect(sanitizeStatements([say('a', 'hola')])).toHaveLength(1);
  });

  it('drops a statement whose kind it does not know', () => {
    // An unknown kind would reach a switch with no case for it.
    const body = [say('a', 'hola'), { id: 'b', kind: 'exec', command: 'rm -rf /' }];
    expect(sanitizeStatements(body).map((s) => s.kind)).toEqual(['say']);
  });

  it('drops a statement with no id', () => {
    expect(sanitizeStatements([{ kind: 'say', value: null }])).toEqual([]);
  });

  it('rejects a variable name that is not an identifier', () => {
    const body = [
      {
        id: 'a',
        kind: 'declare',
        name: 'x); DROP TABLE algorithms;--',
        value: { kind: 'literal', valueKind: 'number', value: 1 },
        valueKind: 'number',
      },
    ];
    expect(sanitizeStatements(body)).toEqual([]);
  });

  it('rejects an operator that is not one of the known ones', () => {
    const body = [
      {
        id: 'a',
        kind: 'say',
        value: {
          kind: 'binary',
          operator: 'constructor',
          left: { kind: 'literal', valueKind: 'number', value: 1 },
          right: { kind: 'literal', valueKind: 'number', value: 2 },
        },
      },
    ];
    expect(sanitizeStatements(body)).toEqual([]);
  });

  it('rejects a literal holding an object rather than a value', () => {
    const body = [{ id: 'a', kind: 'say', value: { kind: 'literal', valueKind: 'text', value: {} } }];
    expect(sanitizeStatements(body)).toEqual([]);
  });

  it('keeps the good statements around a bad one', () => {
    const body = [say('a', 'uno'), { id: 'b', kind: 'nope' }, say('c', 'dos')];
    expect(sanitizeStatements(body).map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('sanitizes the inside of a branch too', () => {
    const body = [
      {
        id: 'if',
        kind: 'if',
        condition: { kind: 'literal', valueKind: 'boolean', value: true },
        then: [say('ok', 'sí'), { id: 'bad', kind: 'exec' }],
      },
    ];
    const [branch] = sanitizeStatements(body);
    expect(branch.kind).toBe('if');
    expect((branch as { then: unknown[] }).then).toHaveLength(1);
  });

  it('survives nesting deep enough to blow a recursive walk', () => {
    // A crafted payload should be refused, not crash the tab.
    let node: unknown = { kind: 'literal', valueKind: 'number', value: 1 };
    for (let i = 0; i < 5000; i += 1) {
      node = { kind: 'unary', operator: '-', operand: node };
    }
    expect(() => sanitizeStatements([{ id: 'a', kind: 'say', value: node }])).not.toThrow();
    expect(sanitizeStatements([{ id: 'a', kind: 'say', value: node }])).toEqual([]);
  });

  it('caps how many statements one payload can carry', () => {
    const many = Array.from({ length: 9000 }, (_, i) => say(`s${i}`, 'x'));
    expect(sanitizeStatements(many).length).toBeLessThanOrEqual(5000);
  });

  it('returns nothing for input that is not a list', () => {
    expect(sanitizeStatements(null)).toEqual([]);
    expect(sanitizeStatements('DROP TABLE algorithms')).toEqual([]);
    expect(sanitizeStatements({ length: 3 })).toEqual([]);
  });

  it('keeps text content verbatim, including things that look like code', () => {
    // The content of a message is data; it is never executed or interpolated,
    // and mangling it would corrupt a legitimate algorithm.
    const body = [say('a', "<script>alert('x')</script>")];
    const [statement] = sanitizeStatements(body);
    expect((statement as { value: { value: string } }).value.value).toBe(
      "<script>alert('x')</script>",
    );
  });
});
