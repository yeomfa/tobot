import { describe, expect, it } from 'vitest';

import { createStatement } from '../ast/factory';
import { literal } from '../ast/factory';
import type { Statement } from '../ast/types';
import { Interpreter } from './interpreter';

/** `decir <text>` — the simplest statement with a visible effect. */
function say(text: string): Statement {
  const statement = createStatement('say');
  return { ...statement, value: literal(text, 'text') } as Statement;
}

/** `variable <name> = <n>` */
function declare(name: string, value: number): Statement {
  const statement = createStatement('declare');
  return { ...statement, name, value: literal(value, 'number'), valueKind: 'number' } as Statement;
}

describe('stepping backwards', () => {
  it('has nowhere to go before the first step', () => {
    const machine = new Interpreter([say('hola')]);
    expect(machine.canStepBack()).toBe(false);
  });

  it('returns to the state before the last step', () => {
    const machine = new Interpreter([say('uno'), say('dos')]);
    machine.step();
    machine.step();
    expect(machine.getState().output).toHaveLength(2);

    machine.stepBack();
    expect(machine.getState().output).toHaveLength(1);
    expect(machine.getState().stepCount).toBe(1);
  });

  it('takes back the output the undone step printed', () => {
    // The console has to agree with the highlighted statement, or the two tell
    // the student different stories about where the program is.
    const machine = new Interpreter([say('uno'), say('dos')]);
    machine.step();
    machine.step();
    machine.stepBack();
    expect(machine.getState().output.map((entry) => entry.text)).toEqual(['uno']);
  });

  it('restores a variable to its earlier value', () => {
    const machine = new Interpreter([declare('x', 1), declare('y', 2)]);
    machine.step();
    machine.step();
    expect(machine.getState().variables).toHaveLength(2);

    machine.stepBack();
    const names = machine.getState().variables.map((entry) => entry.name);
    expect(names).toEqual(['x']);
  });

  it('walks all the way back to the start', () => {
    const machine = new Interpreter([say('uno'), say('dos'), say('tres')]);
    machine.step();
    machine.step();
    machine.step();
    while (machine.canStepBack()) machine.stepBack();

    expect(machine.getState().stepCount).toBe(0);
    expect(machine.getState().output).toEqual([]);
    expect(machine.canStepBack()).toBe(false);
  });

  it('is a no-op at the start rather than an error', () => {
    const machine = new Interpreter([say('hola')]);
    expect(() => machine.stepBack()).not.toThrow();
    expect(machine.getState().stepCount).toBe(0);
  });

  it('can step forward again after going back, reaching the same state', () => {
    const machine = new Interpreter([say('uno'), say('dos')]);
    machine.step();
    machine.step();
    const atEnd = machine.getState().output.map((entry) => entry.text);

    machine.stepBack();
    machine.step();
    expect(machine.getState().output.map((entry) => entry.text)).toEqual(atEnd);
  });

  it('forgets its history when the program is reset', () => {
    const machine = new Interpreter([say('uno')]);
    machine.step();
    expect(machine.canStepBack()).toBe(true);

    machine.reset();
    expect(machine.canStepBack()).toBe(false);
  });
});
