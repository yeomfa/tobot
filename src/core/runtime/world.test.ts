import { describe, expect, it } from 'vitest';

import { literal } from '../ast/factory';
import type { Expression, Statement } from '../ast/types';
import type { WorldDefinition } from '../world/types';
import { createWorld, valuesAt } from '../world/world';
import { runToEnd } from './headless';
import { Interpreter } from './interpreter';

const panel: WorldDefinition = {
  template: 'test',
  duration: 6,
  components: [
    { id: 'start', role: 'input', skin: 'pushbutton', label: 'Start' },
    { id: 'stop', role: 'input', skin: 'pushbutton', label: 'Stop' },
    { id: 'motor', role: 'output', skin: 'motor', label: 'Motor' },
  ],
};

const call = (name: string, args: Expression[]): Expression => ({ kind: 'call', name, args });
const say = (id: string, value: Expression): Statement => ({ id, kind: 'say', value }) as Statement;
const callStatement = (id: string, name: string, ...args: (string | number)[]): Statement =>
  ({ id, kind: 'call', name, args: args.map((arg) => literal(arg)) }) as Statement;

describe('a program acting on a world', () => {
  it('sets outputs and moves time, by either name', () => {
    const program = [
      callStatement('s1', 'encender', 'motor'),
      callStatement('s2', 'wait', 2),
      callStatement('s3', 'turnOff', 'motor'),
    ];
    const state = runToEnd(program, [], createWorld(panel));
    expect(state.status).toBe('finished');
    expect(state.world?.time).toBe(2);
    expect(valuesAt(state.world!, 1).motor).toBe(true);
    expect(state.world?.values.motor).toBe(false);
  });

  it('reads the scenario inside an expression', () => {
    const program = [say('s1', call('leer', [literal('start')]))];
    const state = runToEnd(program, [], createWorld(panel, { inputs: { start: true } }));
    expect(state.output.map((entry) => entry.text)).toEqual(['true']);
  });

  it('ends a control loop normally when the scenario ends', () => {
    // mientras verdadero: si leer(start) encender(motor); si leer(stop) apagar(motor); esperar(0.5)
    const program: Statement[] = [
      {
        id: 'w',
        kind: 'while',
        condition: literal(true),
        body: [
          { id: 'i1', kind: 'if', condition: call('leer', [literal('start')]), then: [callStatement('a', 'encender', 'motor')] },
          { id: 'i2', kind: 'if', condition: call('leer', [literal('stop')]), then: [callStatement('b', 'apagar', 'motor')] },
          callStatement('c', 'esperar', 0.5),
        ],
      } as Statement,
    ];
    const world = createWorld(panel, {
      timeline: [
        { at: 1, id: 'start', value: true },
        { at: 1.5, id: 'start', value: false },
        { at: 4, id: 'stop', value: true },
        { at: 4.5, id: 'stop', value: false },
      ],
    });
    const state = runToEnd(program, [], world);
    expect(state.status).toBe('finished');
    expect(state.error).toBeNull();
    expect(state.world?.ended).toBe(true);
    expect(valuesAt(state.world!, 0.5).motor).toBe(false);
    expect(valuesAt(state.world!, 3).motor).toBe(true);
    expect(valuesAt(state.world!, 5).motor).toBe(false);
  });

  it('reports a component that is not there, in the program’s words', () => {
    const state = runToEnd([callStatement('s1', 'encender', 'bomba')], [], createWorld(panel));
    expect(state.status).toBe('error');
    expect(state.error?.messageKey).toBe('errors.worldUnknown');
    expect(state.error?.vars?.name).toBe('bomba');
  });

  it('is an unknown function without a world, exactly as before', () => {
    const state = runToEnd([callStatement('s1', 'encender', 'motor')]);
    expect(state.error?.messageKey).toBe('errors.unknownFunction');
  });

  it('lets the student’s own function of the same name win, as code does', () => {
    const program: Statement[] = [
      { id: 'f', kind: 'function', name: 'encender', params: [{ name: 'x', type: 'text' }], body: [say('s', literal('mine'))] } as Statement,
      callStatement('c', 'encender', 'motor'),
    ];
    const state = runToEnd(program, [], createWorld(panel));
    expect(state.output.map((entry) => entry.text)).toEqual(['mine']);
    expect(state.world?.values.motor).toBe(false);
  });

  it('steps back through the world with everything else', () => {
    const machine = new Interpreter(
      [callStatement('s1', 'encender', 'motor'), callStatement('s2', 'esperar', 3)],
      { world: createWorld(panel) },
    );
    machine.step();
    let state = machine.step();
    expect(state.world?.time).toBe(3);
    state = machine.stepBack();
    expect(state.world?.time).toBe(0);
    expect(state.world?.values.motor).toBe(true);
    state = machine.stepBack();
    expect(state.world?.values.motor).toBe(false);
  });

  it('starts again from the same world', () => {
    const machine = new Interpreter([callStatement('s1', 'encender', 'motor')], {
      world: createWorld(panel),
    });
    machine.step();
    machine.reset();
    expect(machine.getState().world?.values.motor).toBe(false);
  });
});
