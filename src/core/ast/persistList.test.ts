import { describe, expect, it } from 'vitest';

import { createStatement, literal } from './factory';
import type { Expression, Statement } from './types';
import { sanitizeStatements } from './validateShape';

/** A save-and-reload round trip, which is what storage does to an algorithm. */
const reload = (body: Statement[]): Statement[] =>
  sanitizeStatements(JSON.parse(JSON.stringify(body)));

const declareList = (): Statement =>
  ({
    ...createStatement('declare'),
    name: 'notas',
    valueKind: 'list',
    value: { kind: 'list', items: [literal(1, 'number')] } as Expression,
  }) as Statement;

/**
 * Reloading must not change what a variable is.
 *
 * A declaration saved as a list came back as text: 'list' was not among the
 * kinds this validator accepted, so it fell to the default — leaving a chip
 * reading "texto" over a value that was still list-shaped, which the emitters
 * and the interpreter cannot make sense of.
 */
describe('a declaration survives a reload', () => {
  it('keeps `list` as its kind', () => {
    const [reloaded] = reload([declareList()]);
    expect(reloaded.kind === 'declare' && reloaded.valueKind).toBe('list');
  });

  it('keeps the list value with it, so the two still agree', () => {
    const [reloaded] = reload([declareList()]);
    expect(reloaded.kind === 'declare' && reloaded.value.kind).toBe('list');
  });

  it('still keeps the three scalar kinds', () => {
    for (const kind of ['number', 'text', 'boolean'] as const) {
      const declaration = {
        ...createStatement('declare'),
        name: 'x',
        valueKind: kind,
        value: literal(0, kind === 'number' ? 'number' : kind),
      } as Statement;
      const [reloaded] = reload([declaration]);
      expect(reloaded.kind === 'declare' && reloaded.valueKind).toBe(kind);
    }
  });

  it('still refuses a kind that does not exist', () => {
    const broken = { ...createStatement('declare'), name: 'x', valueKind: 'evil', value: literal(0, 'number') };
    const [reloaded] = reload([broken as unknown as Statement]);
    expect(reloaded.kind === 'declare' && reloaded.valueKind).toBe('text');
  });

  it('does not let `preguntar` store a list, whose answer is typed text', () => {
    // The keyboard cannot produce a list, so `ask` keeps the scalar kinds only.
    const asking = { ...createStatement('ask'), target: 'x', expect: 'list', prompt: literal('?', 'text') };
    const [reloaded] = reload([asking as unknown as Statement]);
    expect(reloaded.kind === 'ask' && reloaded.expect).toBe('text');
  });

  it('keeps a list nested inside a loop body', () => {
    const loop = { ...createStatement('repeat'), body: [declareList()] } as Statement;
    const [reloaded] = reload([loop]);
    const inner = reloaded.kind === 'repeat' ? reloaded.body[0] : null;
    expect(inner?.kind === 'declare' && inner.valueKind).toBe('list');
  });
});
