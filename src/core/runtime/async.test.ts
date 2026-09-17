import { describe, expect, it } from 'vitest';

import { createStatement, literal, variable } from '../ast/factory';
import type { Expression, Statement } from '../ast/types';
import { Interpreter } from './interpreter';

function execute(body: Statement[]) {
  const machine = new Interpreter(body);
  let state = machine.getState();
  let guard = 0;
  while (state.status !== 'finished' && state.status !== 'error') {
    if (guard++ > 5000) throw new Error('program did not terminate');
    state = machine.step();
  }
  return state;
}

const spoken = (body: Statement[]): string[] =>
  execute(body)
    .output.filter((entry) => entry.kind === 'say')
    .map((entry) => entry.text);

const say = (text: string): Statement =>
  ({ ...createStatement('say'), value: literal(text, 'text') }) as Statement;

const sayValue = (value: Expression): Statement =>
  ({ ...createStatement('say'), value }) as Statement;

const fn = (name: string, body: Statement[], isAsync = false, params: string[] = []): Statement =>
  ({
    ...createStatement('function'),
    name,
    isAsync,
    params: params.map((param) => ({ name: param, type: 'number' as const })),
    body,
  }) as Statement;

const callStatement = (name: string, args: Expression[] = []): Statement =>
  ({ ...createStatement('call'), name, args }) as Statement;

/**
 * Asynchronous work in Tobot is not real concurrency: the interpreter holds
 * no timers and reads no clock. "Meanwhile" is counted in steps, which is the
 * unit the student already watches — and being counted rather than timed is
 * what keeps a run reproducible, and stepping backwards honest.
 */
describe('asynchronous calls', () => {
  it('lets the program carry on instead of waiting', () => {
    const program = [
      fn('tarea', [say('dentro')], true),
      callStatement('tarea'),
      say('después'),
    ];
    /* Synchronously this would be dentro, después. Started as a task, the
       caller's next statement runs first and the task's follows a step
       later. */
    expect(spoken(program)).toEqual(['después', 'dentro']);
  });

  it('a plain call still waits', () => {
    const program = [fn('tarea', [say('dentro')]), callStatement('tarea'), say('después')];
    expect(spoken(program)).toEqual(['dentro', 'después']);
  });

  it('finishes the task even when the program ends first', () => {
    const program = [
      fn('tarea', [say('uno'), say('dos'), say('tres')], true),
      callStatement('tarea'),
    ];
    expect(spoken(program)).toEqual(['uno', 'dos', 'tres']);
  });

  it('runs two tasks side by side rather than one after the other', () => {
    const program = [
      fn('a', [say('a1'), say('a2'), say('a3')], true),
      fn('b', [say('b1'), say('b2'), say('b3')], true),
      callStatement('a'),
      callStatement('b'),
    ];
    /*
      Not strictly alternating: `b` is started a step after `a`, so it stays a
      step behind for the whole run. What matters is that neither waits for
      the other to finish — `b` speaks before `a` is done, which is the only
      thing "side by side" can mean when the clock is counted in steps.
    */
    const heard = spoken(program);
    expect(heard).toHaveLength(6);
    expect(heard.indexOf('b1')).toBeLessThan(heard.indexOf('a3'));
    expect(heard.indexOf('a1')).toBeLessThan(heard.indexOf('b1'));
  });

  it('reads its arguments when it is called, not when it first runs', () => {
    const program: Statement[] = [
      { ...createStatement('declare'), name: 'n', value: literal(1, 'number') } as Statement,
      fn('mostrar', [sayValue(variable('x'))], true, ['x']),
      callStatement('mostrar', [variable('n')]),
      { ...createStatement('assign'), name: 'n', value: literal(99, 'number') } as Statement,
    ];
    expect(spoken(program)).toEqual(['1']);
  });

  it('keeps its own variables, separate from the program', () => {
    const program: Statement[] = [
      { ...createStatement('declare'), name: 'n', value: literal(1, 'number') } as Statement,
      fn('tarea', [sayValue(variable('n'))], true, ['n']),
      callStatement('tarea', [literal(42, 'number')]),
      sayValue(variable('n')),
    ];
    expect(spoken(program)).toEqual(['1', '42']);
  });

  it('stops a loop that starts tasks without end', () => {
    const loop = {
      ...createStatement('while'),
      condition: literal(true, 'boolean'),
      body: [callStatement('tarea')],
    } as Statement;
    const program = [fn('tarea', [say('x')], true), loop];
    expect(execute(program).status).toBe('error');
  });

  /* The whole reason the scheduler counts steps: a run has to be repeatable
     both ways. */
  it('steps back over a task and reproduces the same output', () => {
    const program = [
      fn('tarea', [say('uno'), say('dos')], true),
      callStatement('tarea'),
      say('medio'),
    ];
    const machine = new Interpreter(program);
    for (let i = 0; i < 4; i++) machine.step();
    const before = machine.getState().output.map((entry) => entry.text);
    machine.stepBack();
    machine.step();
    expect(machine.getState().output.map((entry) => entry.text)).toEqual(before);
  });

  it('a reset clears work still in flight', () => {
    const program = [fn('tarea', [say('uno'), say('dos')], true), callStatement('tarea')];
    const machine = new Interpreter(program);
    machine.step();
    machine.step();
    machine.reset();
    expect(machine.getState().output).toHaveLength(0);
    expect(machine.getState().status).not.toBe('finished');
  });
});
