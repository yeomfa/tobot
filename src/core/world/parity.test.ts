import { describe, expect, it } from 'vitest';

import { literal } from '../ast/factory';
import type { Algorithm, Expression, Statement } from '../ast/types';
import { runSource } from '../code/runSource';
import { emitters, renderLines } from '../emitters';
import { runToEnd } from '../runtime/headless';
import type { TimelineEvent, WorldDefinition } from './types';
import type { WorldSetup } from './world';
import { createWorld } from './world';

/*
 * The property the whole engine rests on.
 *
 * A program built in blocks runs in the interpreter; the same program as code
 * runs in the worker. If the two ever leave the world in different states, the
 * student has two programs that look the same and do different things — and a
 * mark that depends on which editor they used. So: every program here runs
 * both ways, under every setup, and the worlds must be identical.
 */

const panel: WorldDefinition = {
  template: 'test',
  duration: 8,
  components: [
    { id: 'start', role: 'input', skin: 'pushbutton', label: 'Start' },
    { id: 'stop', role: 'input', skin: 'pushbutton', label: 'Stop' },
    { id: 'motor', role: 'output', skin: 'motor', label: 'Motor' },
    { id: 'motor2', role: 'output', skin: 'motor', label: 'Motor 2' },
    { id: 'lamp', role: 'output', skin: 'lamp', label: 'Lamp' },
  ],
};

const call = (name: string, args: Expression[]): Expression => ({ kind: 'call', name, args });
const run = (id: string, name: string, ...args: (string | number)[]): Statement =>
  ({ id, kind: 'call', name, args: args.map((arg) => literal(arg)) }) as Statement;
const when = (id: string, condition: Expression, then: Statement[], otherwise?: Statement[]): Statement =>
  ({ id, kind: 'if', condition, then, otherwise }) as Statement;
const forever = (id: string, body: Statement[]): Statement =>
  ({ id, kind: 'while', condition: literal(true), body }) as Statement;

const programs: Record<string, Statement[]> = {
  lamp: [run('a', 'turnOn', 'lamp')],
  sequence: [run('a', 'turnOn', 'motor'), run('b', 'wait', 3), run('c', 'turnOn', 'motor2')],
  latch: [
    forever('w', [
      when('i1', call('read', [literal('start')]), [run('a', 'turnOn', 'motor')]),
      when('i2', call('read', [literal('stop')]), [run('b', 'turnOff', 'motor')]),
      run('c', 'wait', 0.25),
    ]),
  ],
  mirror: [
    forever('w', [
      when('i', call('read', [literal('start')]), [run('a', 'turnOn', 'lamp')], [run('b', 'turnOff', 'lamp')]),
      run('c', 'wait', 0.5),
    ]),
  ],
  blink: [
    { id: 'r', kind: 'repeat', times: literal(4), body: [run('a', 'turnOn', 'lamp'), run('b', 'wait', 0.5), run('c', 'turnOff', 'lamp'), run('d', 'wait', 0.5)] } as Statement,
  ],
  says: [
    { id: 's', kind: 'say', value: call('read', [literal('start')]) } as Statement,
    run('a', 'wait', 1),
    { id: 't', kind: 'say', value: call('read', [literal('start')]) } as Statement,
  ],
};

const press = (at: number, id: string, length = 0.5): TimelineEvent[] => [
  { at, id, value: true },
  { at: at + length, id, value: false },
];

const setups: Record<string, WorldSetup> = {
  quiet: {},
  held: { inputs: { start: true } },
  startThenStop: { timeline: [...press(1, 'start'), ...press(5, 'stop')] },
  bounce: { timeline: [...press(0.3, 'start', 0.1), ...press(2, 'stop', 0.2), ...press(3.1, 'start', 1)] },
};

async function bothWays(body: Statement[], setup: WorldSetup, language: 'es' | 'en') {
  const algorithm: Algorithm = { id: 'alg_p', name: 'p', body, createdAt: '', updatedAt: '', world: panel };
  const blocks = runToEnd(body, [], createWorld(panel, setup));

  const source = renderLines(emitters.javascript.emit(algorithm, { locale: language }));
  const said: string[] = [];
  const code = await runSource(
    source,
    { say: (text) => said.push(text), ask: async () => '' },
    createWorld(panel, setup),
  );
  return { blocks, code, said, source };
}

describe('blocks and code leave the same world', () => {
  for (const [name, body] of Object.entries(programs)) {
    for (const [setupName, setup] of Object.entries(setups)) {
      for (const language of ['es', 'en'] as const) {
        it(`${name}, ${setupName}, ${language}`, async () => {
          const { blocks, code, said, source } = await bothWays(body, setup, language);
          expect(blocks.status, source).toBe('finished');
          expect(code.status, source).toBe('done');
          expect(code.world?.log).toEqual(blocks.world?.log);
          expect(code.world?.values).toEqual(blocks.world?.values);
          expect(code.world?.time).toEqual(blocks.world?.time);
          expect(said).toEqual(blocks.output.filter((entry) => entry.kind === 'say').map((entry) => entry.text));
        });
      }
    }
  }

  it('reports a world mistake in code with the key blocks use', async () => {
    const code = await runSource('encender("bomba");', { say: () => {}, ask: async () => '' }, createWorld(panel));
    expect(code.status).toBe('error');
    if (code.status === 'error') {
      expect(code.key).toBe('errors.worldUnknown');
      expect(code.line).toBe(1);
    }
  });

  it('puts nothing new in scope without a world', async () => {
    const said: string[] = [];
    const code = await runSource('console.log(typeof encender);', { say: (text) => said.push(text), ask: async () => '' });
    expect(code.status).toBe('done');
    expect(said).toEqual(['undefined']);
  });
});
