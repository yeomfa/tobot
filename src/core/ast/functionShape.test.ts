import { describe, expect, it } from 'vitest';

import { createStatement, literal } from './factory';
import { syncCallsTo } from './operations';
import type { Param, Statement } from './types';
import { sanitizeStatements } from './validateShape';

/** A save-and-reload round trip, which is also what the clipboard does. */
const reload = (body: Statement[]): Statement[] =>
  sanitizeStatements(JSON.parse(JSON.stringify(body)));

const fn = (name: string, params: Param[], body: Statement[] = []): Statement =>
  ({ ...createStatement('function'), name, params, body }) as Statement;

/**
 * Everything arriving from outside — storage, or the clipboard — passes the
 * shape gate, so a kind missing from it cannot be copied, cannot be pasted,
 * and does not survive a reload. Functions were missing, as `listOp` and
 * `forEachItem` were before them.
 */
describe('functions survive the shape gate', () => {
  it('keeps a function declaration', () => {
    const [kept] = reload([fn('doble', [{ name: 'n', type: 'number' }])]);
    expect(kept?.kind).toBe('function');
    expect(kept.kind === 'function' && kept.params).toEqual([{ name: 'n', type: 'number' }]);
  });

  it('keeps the asynchronous mark', () => {
    const source = { ...fn('tarea', []), isAsync: true } as Statement;
    const [kept] = reload([source]);
    expect(kept.kind === 'function' && kept.isAsync).toBe(true);
  });

  it('keeps a call, with its arguments', () => {
    const call = { ...createStatement('call'), name: 'doble', args: [literal(2, 'number')] } as Statement;
    const [kept] = reload([call]);
    expect(kept?.kind).toBe('call');
    expect(kept.kind === 'call' && kept.args).toHaveLength(1);
  });

  it('keeps a return, with and without a value', () => {
    const withValue = { ...createStatement('return'), value: literal(1, 'number') } as Statement;
    const bare = { ...createStatement('return'), value: undefined } as Statement;
    expect(reload([withValue])[0]?.kind).toBe('return');
    expect(reload([bare])[0]?.kind).toBe('return');
  });

  it('keeps a call used as a value inside another statement', () => {
    const say = {
      ...createStatement('say'),
      value: { kind: 'call', name: 'doble', args: [literal(2, 'number')] },
    } as Statement;
    expect(reload([say])).toHaveLength(1);
  });

  it('keeps a function with its body', () => {
    const body = [{ ...createStatement('say'), value: literal('hola', 'text') } as Statement];
    const [kept] = reload([fn('saludar', [], body)]);
    expect(kept.kind === 'function' && kept.body).toHaveLength(1);
  });

  it('still refuses a parameter list that is not one', () => {
    const broken = { ...fn('x', []), params: 'n' } as unknown as Statement;
    expect(reload([broken])).toHaveLength(0);
  });
});

/**
 * A signature is a promise the call sites are holding. Changing it used to
 * leave them with the old shape and no way back short of deleting the block.
 */
describe('calls follow their signature', () => {
  const call = (args: Statement extends never ? never : ReturnType<typeof literal>[]) =>
    ({ ...createStatement('call'), name: 'doble', args }) as Statement;

  it('re-reads a literal argument into the new type', () => {
    const program = [fn('doble', [{ name: 'n', type: 'number' }]), call([literal(7, 'number')])];
    const [, updated] = syncCallsTo(program, 'doble', [{ name: 'n', type: 'text' }]);
    const arg = updated.kind === 'call' ? updated.args[0] : null;
    expect(arg?.kind === 'literal' && arg.valueKind).toBe('text');
    expect(arg?.kind === 'literal' && arg.value).toBe('7');
  });

  it('adds a slot when a parameter is added', () => {
    const program = [fn('doble', []), call([])];
    const [, updated] = syncCallsTo(program, 'doble', [
      { name: 'a', type: 'number' },
      { name: 'b', type: 'text' },
    ]);
    expect(updated.kind === 'call' && updated.args).toHaveLength(2);
  });

  it('drops a slot when a parameter is removed', () => {
    const program = [
      fn('doble', [{ name: 'n', type: 'number' }]),
      call([literal(1, 'number')]),
    ];
    const [, updated] = syncCallsTo(program, 'doble', []);
    expect(updated.kind === 'call' && updated.args).toHaveLength(0);
  });

  it('leaves a built argument alone: it has no kind of its own', () => {
    const program = [
      fn('doble', [{ name: 'n', type: 'number' }]),
      { ...createStatement('call'), name: 'doble', args: [{ kind: 'variable', name: 'x' }] } as Statement,
    ];
    const [, updated] = syncCallsTo(program, 'doble', [{ name: 'n', type: 'text' }]);
    const arg = updated.kind === 'call' ? updated.args[0] : null;
    expect(arg?.kind).toBe('variable');
  });

  it('leaves calls to other functions alone', () => {
    const other = { ...createStatement('call'), name: 'otra', args: [literal(1, 'number')] } as Statement;
    const [updated] = syncCallsTo([other], 'doble', [{ name: 'n', type: 'text' }]);
    const arg = updated.kind === 'call' ? updated.args[0] : null;
    expect(arg?.kind === 'literal' && arg.valueKind).toBe('number');
  });

  it('reaches a call used as a value', () => {
    const say = {
      ...createStatement('say'),
      value: { kind: 'call', name: 'doble', args: [literal(7, 'number')] },
    } as Statement;
    const [updated] = syncCallsTo([say], 'doble', [{ name: 'n', type: 'text' }]);
    const value = updated.kind === 'say' ? updated.value : null;
    const arg = value?.kind === 'call' ? value.args[0] : null;
    expect(arg?.kind === 'literal' && arg.valueKind).toBe('text');
  });

  it('reaches a call nested in a loop body', () => {
    const inner = { ...createStatement('call'), name: 'doble', args: [literal(7, 'number')] } as Statement;
    const loop = { ...createStatement('repeat'), body: [inner] } as Statement;
    const [updated] = syncCallsTo([loop], 'doble', [{ name: 'n', type: 'text' }]);
    const nested = updated.kind === 'repeat' ? updated.body[0] : null;
    const arg = nested?.kind === 'call' ? nested.args[0] : null;
    expect(arg?.kind === 'literal' && arg.valueKind).toBe('text');
  });
});
