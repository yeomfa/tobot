import { describe, expect, it } from 'vitest';

import { createStatement, literal } from './factory';
import type { Statement } from './types';
import { insertStatements, removeStatements } from './operations';

const say = (text: string): Statement =>
  ({ ...createStatement('say'), value: literal(text, 'text') }) as Statement;
const text = (s: Statement): string =>
  s.kind === 'say' && s.value.kind === 'literal' ? String(s.value.value) : s.kind;

/**
 * Pasting and deleting act on a group, and each must be one edit: undo should
 * take back the whole paste, not its last third.
 */
describe('inserting several at once', () => {
  it('puts them in order at the given index', () => {
    const body = [say('a'), say('d')];
    const next = insertStatements(body, [say('b'), say('c')], {
      parentId: null,
      slot: null,
      index: 1,
    });
    expect(next.map(text)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('appends when the index is past the end', () => {
    const body = [say('a')];
    const next = insertStatements(body, [say('b')], { parentId: null, slot: null, index: 99 });
    expect(next.map(text)).toEqual(['a', 'b']);
  });

  it('inserts into a loop body', () => {
    const inner = say('dentro');
    const loop = { ...createStatement('repeat'), body: [inner] } as Statement;
    const next = insertStatements([loop], [say('nuevo')], {
      parentId: loop.id,
      slot: 'body',
      index: 0,
    });
    const body = next[0].kind === 'repeat' ? next[0].body : [];
    expect(body.map(text)).toEqual(['nuevo', 'dentro']);
  });
});

describe('removing several at once', () => {
  it('removes them all and keeps the rest in order', () => {
    const [a, b, c, d] = [say('a'), say('b'), say('c'), say('d')];
    expect(removeStatements([a, b, c, d], [b.id, d.id]).map(text)).toEqual(['a', 'c']);
  });

  it('reaches inside a loop', () => {
    const inner = say('dentro');
    const loop = { ...createStatement('repeat'), body: [inner, say('otro')] } as Statement;
    const next = removeStatements([loop], [inner.id]);
    const body = next[0].kind === 'repeat' ? next[0].body : [];
    expect(body.map(text)).toEqual(['otro']);
  });

  it('reaches inside an else-if arm', () => {
    const inner = say('dentro');
    const branch = createStatement('if') as Extract<Statement, { kind: 'if' }>;
    const withArm: Statement = {
      ...branch,
      elseIfs: [{ id: 'arm', condition: literal(true, 'boolean'), body: [inner, say('otro')] }],
    };
    const next = removeStatements([withArm], [inner.id]);
    const arm = next[0].kind === 'if' ? next[0].elseIfs?.[0] : null;
    expect(arm?.body.map(text)).toEqual(['otro']);
  });

  it('removing a parent takes its children with it', () => {
    const inner = say('dentro');
    const loop = { ...createStatement('repeat'), body: [inner] } as Statement;
    expect(removeStatements([loop, say('fuera')], [loop.id]).map(text)).toEqual(['fuera']);
  });

  it('ignores ids that are not there', () => {
    const a = say('a');
    expect(removeStatements([a], ['missing']).map(text)).toEqual(['a']);
  });
});
