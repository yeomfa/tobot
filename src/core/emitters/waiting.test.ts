import { describe, expect, it } from 'vitest';

import { createId, literal, variable } from '../ast/factory';
import type { Algorithm, Statement } from '../ast/types';
import { runToEnd, spokenLines } from '../runtime/headless';
import { emitters, renderLines } from './index';
import { functionsThatWait } from './waiting';

const ask = (target: string): Statement => ({
  id: createId(),
  kind: 'ask',
  prompt: literal('¿?', 'text'),
  target,
  expect: 'text',
});
const say = (name: string): Statement => ({ id: createId(), kind: 'say', value: variable(name) });
const call = (name: string): Statement => ({ id: createId(), kind: 'call', name, args: [] });
const fn = (name: string, body: Statement[], isAsync = false): Statement => ({
  id: createId(),
  kind: 'function',
  name,
  params: [],
  body,
  isAsync,
});

const wrap = (body: Statement[]): Algorithm => ({
  id: 't',
  name: 't',
  body,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('which functions wait for an answer', () => {
  it('finds a function that asks', () => {
    expect(functionsThatWait([fn('pedir', [ask('x')])])).toEqual(new Set(['pedir']));
  });

  // The caller has to wait for the callee, so it must be async as well.
  it('carries it to whoever calls one', () => {
    const program = [fn('pedir', [ask('x')]), fn('saludar', [call('pedir')]), fn('nada', [])];
    expect(functionsThatWait(program)).toEqual(new Set(['pedir', 'saludar']));
  });

  /*
    A function the student marked async runs "on its own while the program
    carries on". Awaiting its call would quietly turn it into an ordinary call
    and change what the program does.
  */
  it('leaves a student-marked async function alone', () => {
    expect(functionsThatWait([fn('tarea', [ask('x')], true)])).toEqual(new Set());
  });
});

/**
 * The bug this exists for: an `ask` inside a helper was emitted as `await`
 * inside a plain `function`, so "Abrir en JavaScript" handed over code that was
 * a SyntaxError the moment it ran.
 */
describe('emitting a function that asks', () => {
  const program = [
    fn('pedirNombre', [ask('nombre'), say('nombre')]),
    call('pedirNombre'),
  ];
  const source = renderLines(emitters.javascript.emit(wrap(program), { locale: 'es' }));

  it('writes it async and awaits its call', () => {
    expect(source).toContain('async function pedirNombre()');
    expect(source).toContain('await pedirNombre();');
  });

  it('produces code that actually runs, and says what the interpreter says', async () => {
    const logged: string[] = [];
    const run = new Function(
      'prompt',
      'console',
      `return (async () => {\n${source}\n})();`,
    ) as (prompt: unknown, console: unknown) => Promise<void>;

    await run(() => Promise.resolve('Ana'), { log: (value: unknown) => logged.push(String(value)) });
    expect(logged).toEqual(spokenLines(runToEnd(program, ['Ana'])));
  });
});
