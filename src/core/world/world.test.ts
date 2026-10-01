import { describe, expect, it } from 'vitest';

import { callWorld, worldFunction, worldName } from './registry';
import type { WorldDefinition } from './types';
import { WorldFault } from './types';
import { advance, createWorld, valuesAt } from './world';

const panel: WorldDefinition = {
  template: 'test',
  duration: 10,
  components: [
    { id: 'start', role: 'input', skin: 'pushbutton', label: 'Start' },
    { id: 'motor', role: 'output', skin: 'motor', label: 'Motor' },
  ],
};

describe('the world', () => {
  it('starts with everything off unless told otherwise', () => {
    const world = createWorld(panel, { inputs: { start: true } });
    expect(world.values).toEqual({ start: true, motor: false });
    expect(world.time).toBe(0);
    expect(world.ended).toBe(false);
  });

  it('lets the program set outputs, and only outputs', () => {
    let world = createWorld(panel);
    world = callWorld(world, 'encender', ['motor']).state;
    expect(world.values.motor).toBe(true);
    expect(() => callWorld(world, 'turnOn', ['start'])).toThrow(WorldFault);
    expect(() => callWorld(world, 'turnOn', ['bomba'])).toThrow(WorldFault);
  });

  it('reads any component, in either language', () => {
    const world = createWorld(panel, { inputs: { start: true } });
    expect(callWorld(world, 'leer', ['start']).value).toBe(true);
    expect(callWorld(world, 'read', ['motor']).value).toBe(false);
  });

  it('moves time only when waited, and plays the scenario as it goes', () => {
    let world = createWorld(panel, {
      timeline: [
        { at: 1, id: 'start', value: true },
        { at: 1.5, id: 'start', value: false },
      ],
    });
    world = advance(world, 0.5);
    expect(world.values.start).toBe(false);
    world = advance(world, 0.5);
    expect(world.values.start).toBe(true);
    world = advance(world, 1);
    expect(world.values.start).toBe(false);
    expect(world.time).toBe(2);
  });

  it('applies events due at zero before the first line runs', () => {
    const world = createWorld(panel, { timeline: [{ at: 0, id: 'start', value: true }] });
    expect(world.values.start).toBe(true);
  });

  it('ends when the scenario does, and not before', () => {
    let world = createWorld(panel);
    world = advance(world, 9.5);
    expect(world.ended).toBe(false);
    world = advance(world, 5);
    expect(world.ended).toBe(true);
    expect(world.time).toBe(10);
  });

  it('refuses a wait that is not a duration', () => {
    const world = createWorld(panel);
    expect(() => advance(world, -1)).toThrow(WorldFault);
    expect(() => advance(world, 'pronto')).toThrow(WorldFault);
  });

  it('can say what was true at any past moment', () => {
    let world = createWorld(panel);
    world = advance(world, 2);
    world = callWorld(world, 'turnOn', ['motor']).state;
    world = advance(world, 3);
    world = callWorld(world, 'turnOff', ['motor']).state;
    expect(valuesAt(world, 1).motor).toBe(false);
    expect(valuesAt(world, 2).motor).toBe(true);
    expect(valuesAt(world, 4.9).motor).toBe(true);
    expect(valuesAt(world, 5).motor).toBe(false);
  });

  it('never changes a world in place', () => {
    const before = createWorld(panel);
    callWorld(before, 'turnOn', ['motor']);
    advance(before, 3);
    expect(before.values.motor).toBe(false);
    expect(before.time).toBe(0);
  });

  it('names each function in the interface language', () => {
    expect(worldName('turnOn', 'es')).toBe('encender');
    expect(worldName('turnOn', 'en')).toBe('turnOn');
    expect(worldFunction('esperar')?.id).toBe('wait');
    expect(worldFunction('decir')).toBeNull();
  });
});
