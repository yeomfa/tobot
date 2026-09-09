import { describe, expect, it } from 'vitest';

import { createStatement, literal } from './factory';
import type { Statement } from './types';
import { decodeStatements, encodeStatements } from './clipboard';

const say = (text: string): Statement =>
  ({ ...createStatement('say'), value: literal(text, 'text') }) as Statement;

/**
 * The clipboard carries text, and anything at all can be on it — so this reads
 * what arrives with the same suspicion as a file loaded from storage.
 */
describe('the statement clipboard', () => {
  it('carries a statement there and back', () => {
    const decoded = decodeStatements(encodeStatements([say('hola')]));
    expect(decoded).toHaveLength(1);
    expect(decoded?.[0].kind).toBe('say');
  });

  it('gives every pasted statement a fresh id', () => {
    const original = say('hola');
    const text = encodeStatements([original]);
    const first = decodeStatements(text);
    const second = decodeStatements(text);
    // Two pastes of one copy must not collide: the editor addresses blocks by
    // id, so sharing one would select and delete both at once.
    expect(first?.[0].id).not.toBe(original.id);
    expect(first?.[0].id).not.toBe(second?.[0].id);
  });

  it('renames the ids inside a block, not only the block itself', () => {
    const branch = createStatement('if') as Extract<Statement, { kind: 'if' }>;
    const withBody: Statement = { ...branch, then: [say('dentro')] };
    const decoded = decodeStatements(encodeStatements([withBody]));
    const inner = decoded?.[0].kind === 'if' ? decoded[0].then[0] : null;
    expect(inner?.id).toBeDefined();
    expect(inner?.id).not.toBe(withBody.kind === 'if' ? withBody.then[0].id : '');
  });

  it('ignores text that is not ours', () => {
    expect(decodeStatements('hola mundo')).toBeNull();
    expect(decodeStatements('')).toBeNull();
    expect(decodeStatements('{"kind":"something-else","statements":[]}')).toBeNull();
  });

  it('ignores malformed JSON without throwing', () => {
    expect(decodeStatements('{ not json')).toBeNull();
  });

  it('refuses a payload whose statements are not statements', () => {
    const hostile = JSON.stringify({
      kind: 'tobot/statements@1',
      statements: [{ kind: 'evil', id: 'x' }],
    });
    expect(decodeStatements(hostile)).toBeNull();
  });

  it('drops the bad ones and keeps the good, rather than failing entirely', () => {
    const mixed = JSON.stringify({
      kind: 'tobot/statements@1',
      statements: [{ kind: 'nonsense' }, say('bueno')],
    });
    const decoded = decodeStatements(mixed);
    expect(decoded).toHaveLength(1);
    expect(decoded?.[0].kind).toBe('say');
  });

  it('carries several statements in order', () => {
    const decoded = decodeStatements(encodeStatements([say('uno'), say('dos')]));
    expect(decoded).toHaveLength(2);
  });
});
