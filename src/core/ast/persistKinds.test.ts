import { describe, expect, it } from 'vitest';

import { createStatement, PLACEHOLDER_NAME } from './factory';
import type { Statement } from './types';
import { sanitizeStatements } from './validateShape';

/** A save-and-reload round trip, which is what storage does to an algorithm. */
const reload = (body: Statement[]): Statement[] =>
  sanitizeStatements(JSON.parse(JSON.stringify(body)));

/**
 * Every kind a student can put on the canvas.
 *
 * Written out rather than derived, deliberately: a list built from the type
 * would grow by itself when a twelfth kind is added, and this test would go on
 * passing without ever covering it. Spelled out, adding a kind breaks the
 * count below and someone has to come here and say what happens to it.
 */
const ALL_KINDS = [
  'comment',
  'declare',
  'assign',
  'say',
  'ask',
  'if',
  'while',
  'repeat',
  'forEach',
  'listOp',
  'forEachItem',
] as const;

/**
 * Reloading must not lose a block.
 *
 * `listOp` and `forEachItem` had no case in the shape validator, so both fell
 * to its `default` and were dropped: a `para cada elemento` vanished on
 * reload, and so did every `cambiar lista`. The student's work disappeared
 * with no message, which is the worst way for a gate to fail.
 */
describe('every kind of statement survives a reload', () => {
  it('covers all eleven kinds', () => {
    expect(ALL_KINDS).toHaveLength(11);
  });

  for (const kind of ALL_KINDS) {
    it(`keeps a \`${kind}\``, () => {
      const [reloaded] = reload([createStatement(kind)]);
      expect(reloaded?.kind).toBe(kind);
    });
  }

  it('keeps a whole algorithm of them together', () => {
    const body = ALL_KINDS.map((kind) => createStatement(kind));
    expect(reload(body).map((statement) => statement.kind)).toEqual([...ALL_KINDS]);
  });

  it('keeps what a list operation carries', () => {
    const [reloaded] = reload([createStatement('listOp')]);
    expect(reloaded.kind === 'listOp' && reloaded.operation).toBe('append');
    expect(reloaded.kind === 'listOp' && reloaded.value?.kind).toBe('literal');
  });

  it('keeps the list a `para cada` walks, and its body', () => {
    const source = createStatement('forEachItem');
    const withBody = { ...source, body: [createStatement('say')] } as Statement;
    const [reloaded] = reload([withBody]);
    expect(reloaded.kind === 'forEachItem' && reloaded.list.kind).toBe('variable');
    expect(reloaded.kind === 'forEachItem' && reloaded.body).toHaveLength(1);
  });

  it('refuses a list operation whose operation is not one of the five', () => {
    const broken = { ...createStatement('listOp'), operation: 'destroy' } as unknown as Statement;
    expect(reload([broken])).toHaveLength(0);
  });
});

/**
 * A block with no name yet is unfinished, not malformed.
 *
 * `PLACEHOLDER_NAME` is the empty string: a block dropped on the canvas has no
 * name until the student types one. The structural gate rejected that, so an
 * unnamed block could not be copied, could not be pasted, and did not survive
 * a reload — the work vanished for the one reason that is never the student's
 * fault, namely not having finished yet.
 *
 * Whether the name is *usable* is `validate.ts`'s question, and it still
 * reports an empty one as an error the student can see and fix.
 */
describe('a block with no name yet is kept', () => {
  const NAMED_KINDS = ['declare', 'assign', 'ask', 'forEach', 'listOp', 'forEachItem'] as const;

  for (const kind of NAMED_KINDS) {
    it(`keeps an unnamed \`${kind}\``, () => {
      const source = createStatement(kind);
      /* Every one of these carries its name under a different key. */
      const unnamed = {
        ...source,
        ...('name' in source ? { name: PLACEHOLDER_NAME } : {}),
        ...('target' in source ? { target: PLACEHOLDER_NAME } : {}),
        ...('variable' in source ? { variable: PLACEHOLDER_NAME } : {}),
      } as Statement;
      expect(reload([unnamed])).toHaveLength(1);
    });
  }

  it('still refuses a name that is not a name at all', () => {
    const broken = { ...createStatement('declare'), name: '1nombre con espacios' } as Statement;
    expect(reload([broken])).toHaveLength(0);
  });

  it('still refuses a name that is not a string', () => {
    const broken = { ...createStatement('declare'), name: 42 } as unknown as Statement;
    expect(reload([broken])).toHaveLength(0);
  });
});
