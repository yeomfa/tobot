import type { Language } from '../../i18n/types';
import type { WorldFunction, WorldState } from './types';
import { advance, component, setOutput } from './world';

/**
 * Everything a program can do to a world.
 *
 * Four functions, chosen because they are the four every control course starts
 * with: switch something on, switch it off, look at something, and wait. Each
 * maps onto one line of Arduino, shown on hover, so a student who learns them
 * here has learnt the shape of the real thing.
 *
 * Named in the interface's language, as pseudocode already is — a Spanish
 * class writes `encender("motor")` — and stored by their stable id, so the
 * same program reads in either language. Both runtimes accept every name.
 */
export const WORLD_FUNCTIONS: readonly WorldFunction[] = [
  {
    id: 'turnOn',
    names: { es: 'encender', en: 'turnOn' },
    params: [{ name: { es: 'nombre', en: 'name' }, kind: 'text' }],
    returns: null,
    effect: 'write',
    arduino: 'digitalWrite(pin, HIGH);',
    summary: {
      es: 'Enciende una salida: una lámpara, un motor, una alarma.',
      en: 'Switches an output on: a lamp, a motor, an alarm.',
    },
    apply: (state, [id]) => ({ state: setOutput(state, id, true) }),
  },
  {
    id: 'turnOff',
    names: { es: 'apagar', en: 'turnOff' },
    params: [{ name: { es: 'nombre', en: 'name' }, kind: 'text' }],
    returns: null,
    effect: 'write',
    arduino: 'digitalWrite(pin, LOW);',
    summary: {
      es: 'Apaga una salida.',
      en: 'Switches an output off.',
    },
    apply: (state, [id]) => ({ state: setOutput(state, id, false) }),
  },
  {
    id: 'read',
    names: { es: 'leer', en: 'read' },
    params: [{ name: { es: 'nombre', en: 'name' }, kind: 'text' }],
    returns: 'boolean',
    effect: 'read',
    arduino: 'digitalRead(pin)',
    summary: {
      es: 'Dice si algo está activo: un pulsador apretado, un sensor que detecta, un motor en marcha.',
      en: 'Says whether something is active: a button held, a sensor detecting, a motor running.',
    },
    apply: (state, [id]) => ({ state, value: state.values[component(state, id).id] }),
  },
  {
    id: 'wait',
    names: { es: 'esperar', en: 'wait' },
    params: [{ name: { es: 'segundos', en: 'seconds' }, kind: 'number' }],
    returns: null,
    effect: 'time',
    arduino: 'delay(ms);',
    summary: {
      es: 'Deja pasar el tiempo, en segundos. Mientras tanto, el escenario sigue su curso.',
      en: 'Lets time pass, in seconds. Meanwhile, the scenario carries on.',
    },
    apply: (state, [seconds]) => ({ state: advance(state, seconds) }),
  },
];

const BY_NAME = new Map<string, WorldFunction>();
for (const fn of WORLD_FUNCTIONS) {
  BY_NAME.set(fn.id, fn);
  for (const name of Object.values(fn.names)) BY_NAME.set(name, fn);
}

/** The world function a program means by this name, in any language. */
export function worldFunction(name: string): WorldFunction | null {
  return BY_NAME.get(name) ?? null;
}

/** Every name a program may use for a world function. */
export function worldNames(): string[] {
  return [...BY_NAME.keys()];
}

/** The name a student sees, in the interface's language. */
export function worldName(id: string, language: Language): string {
  return worldFunction(id)?.names[language] ?? id;
}

/** Runs one world function by any of its names. */
export function callWorld(
  state: WorldState,
  name: string,
  args: unknown[],
): { state: WorldState; value?: boolean } {
  const fn = worldFunction(name);
  if (!fn) throw new Error(`not a world function: ${name}`);
  return fn.apply(state, args);
}
