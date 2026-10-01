import { describe, expect, it } from 'vitest';

import type { WorldDefinition } from '../world/types';
import { literal } from './factory';
import type { Expression, Statement } from './types';
import { validate } from './validate';

const world: WorldDefinition = {
  template: 'test',
  duration: 10,
  components: [
    { id: 'start', role: 'input', skin: 'pushbutton', label: 'Start' },
    { id: 'motor', role: 'output', skin: 'motor', label: 'Motor' },
  ],
};

const call = (name: string, args: Expression[]): Expression => ({ kind: 'call', name, args });
const run = (id: string, name: string, ...args: (string | number)[]): Statement =>
  ({ id, kind: 'call', name, args: args.map((arg) => literal(arg)) }) as Statement;
const keys = (program: Statement[], withWorld = true) =>
  validate(program, { world: withWorld ? world : null }).map((problem) => problem.messageKey);

describe('validation with a world', () => {
  it('accepts world calls only when there is a world', () => {
    expect(keys([run('a', 'encender', 'motor')])).toEqual([]);
    expect(keys([run('a', 'encender', 'motor')], false)).toEqual(['unknownFunction']);
  });

  it('names a component that is not in the scenario', () => {
    expect(keys([run('a', 'encender', 'bomba')])).toEqual(['worldUnknown']);
  });

  it('refuses to switch an input', () => {
    expect(keys([run('a', 'turnOn', 'start')])).toEqual(['worldNotOutput']);
  });

  it('counts arguments', () => {
    expect(keys([run('a', 'esperar')])).toEqual(['wrongArgumentCount']);
  });

  it('checks calls inside expressions too', () => {
    const program = [{ id: 's', kind: 'say', value: call('leer', [literal('nada')]) } as Statement];
    expect(keys(program)).toEqual(['worldUnknown']);
  });

  it('treats a loop that waits as one that ends', () => {
    const loop = (body: Statement[]): Statement[] => [
      { id: 'w', kind: 'while', condition: literal(true), body } as Statement,
    ];
    expect(keys(loop([run('a', 'encender', 'motor'), run('b', 'esperar', 1)]))).toEqual([]);
    expect(keys(loop([run('a', 'encender', 'motor')]))).toEqual(['endlessLoop']);
  });

  it('follows a wait into the student’s own function', () => {
    const program: Statement[] = [
      { id: 'f', kind: 'function', name: 'pausa', params: [], body: [run('x', 'esperar', 1)] } as Statement,
      { id: 'w', kind: 'while', condition: literal(true), body: [run('c', 'pausa')] } as Statement,
    ];
    expect(keys(program)).toEqual([]);
  });

  it('reports a function named like a world function', () => {
    const program: Statement[] = [
      { id: 'f', kind: 'function', name: 'encender', params: [], body: [run('x', 'esperar', 1)] } as Statement,
    ];
    expect(keys(program)).toContain('worldReserved');
    expect(keys(program, false)).not.toContain('worldReserved');
  });
});
