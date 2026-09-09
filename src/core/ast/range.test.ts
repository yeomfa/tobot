import { describe, expect, it } from 'vitest';

import { createStatement, literal } from './factory';
import type { Statement } from './types';
import { rangeBetween } from './operations';

const say = (text: string): Statement =>
  ({ ...createStatement('say'), value: literal(text, 'text') }) as Statement;

/**
 * Shift-clicking extends a selection, and "between" only means something among
 * siblings — a block inside a loop and one after it have no range between them
 * that could be copied or deleted as a unit.
 */
describe('rangeBetween', () => {
  it('returns just the one when anchor and focus are the same', () => {
    const a = say('a');
    expect(rangeBetween([a], a.id, a.id)).toEqual([a.id]);
  });

  it('covers the statements between two siblings', () => {
    const [a, b, c, d] = [say('a'), say('b'), say('c'), say('d')];
    expect(rangeBetween([a, b, c, d], a.id, c.id)).toEqual([a.id, b.id, c.id]);
  });

  it('reads the same range backwards', () => {
    const [a, b, c] = [say('a'), say('b'), say('c')];
    expect(rangeBetween([a, b, c], c.id, a.id)).toEqual([a.id, b.id, c.id]);
  });

  it('works inside a loop body', () => {
    const [a, b] = [say('a'), say('b')];
    const loop = { ...createStatement('repeat'), body: [a, b] } as Statement;
    expect(rangeBetween([loop], a.id, b.id)).toEqual([a.id, b.id]);
  });

  it('works inside an else-if arm, which is a parent of its own', () => {
    const [a, b] = [say('a'), say('b')];
    const branch = createStatement('if') as Extract<Statement, { kind: 'if' }>;
    const withArm: Statement = {
      ...branch,
      elseIfs: [{ id: 'arm', condition: literal(true, 'boolean'), body: [a, b] }],
    };
    expect(rangeBetween([withArm], a.id, b.id)).toEqual([a.id, b.id]);
  });

  it('refuses to span two different parents, selecting only the second', () => {
    // A block inside a loop and one after it: there is no list containing both.
    const inside = say('dentro');
    const after = say('después');
    const loop = { ...createStatement('repeat'), body: [inside] } as Statement;
    expect(rangeBetween([loop, after], inside.id, after.id)).toEqual([after.id]);
  });

  it('refuses to span two branches of the same `if`', () => {
    const [then, other] = [say('sí'), say('no')];
    const branch = createStatement('if') as Extract<Statement, { kind: 'if' }>;
    const both: Statement = { ...branch, then: [then], otherwise: [other] };
    expect(rangeBetween([both], then.id, other.id)).toEqual([other.id]);
  });

  it('falls back to the focus when a statement is not found', () => {
    const a = say('a');
    expect(rangeBetween([a], 'missing', a.id)).toEqual([a.id]);
  });
});
