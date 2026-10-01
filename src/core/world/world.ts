import type { TimelineEvent, WorldChange, WorldDefinition, WorldState } from './types';
import { WorldFault } from './types';

/**
 * How a run sets the scenario up: which inputs start pressed, and what the
 * scenario does by itself while the program runs.
 *
 * A marking case is exactly this — "start is pressed at second 1, stop at
 * second 5" — which is how control logic is tested on real equipment.
 */
export interface WorldSetup {
  inputs?: Record<string, boolean>;
  timeline?: TimelineEvent[];
}

/** The world before anything has happened. */
export function createWorld(definition: WorldDefinition, setup: WorldSetup = {}): WorldState {
  const initial: Record<string, boolean> = {};
  for (const component of definition.components) {
    const override = component.role === 'input' ? setup.inputs?.[component.id] : undefined;
    initial[component.id] = override ?? component.initial ?? false;
  }
  const pending = [...(setup.timeline ?? [])]
    .filter((event) => initial[event.id] !== undefined)
    .sort((a, b) => a.at - b.at);

  /* Events at zero happen before the first line runs, so a case can say
     "start held down from the beginning" without a special field for it. */
  return applyDue({
    definition,
    time: 0,
    values: initial,
    initial,
    pending,
    log: [],
    ended: false,
  });
}

/** Applies every scenario event whose moment has come. */
function applyDue(state: WorldState): WorldState {
  let { values, pending, log } = state;
  while (pending.length > 0 && pending[0].at <= state.time) {
    const [event, ...rest] = pending;
    pending = rest;
    if (values[event.id] !== event.value) {
      values = { ...values, [event.id]: event.value };
      log = [...log, { time: Math.max(event.at, 0), id: event.id, value: event.value }];
    }
  }
  return values === state.values && pending === state.pending
    ? state
    : { ...state, values, pending, log };
}

export function component(state: WorldState, id: unknown) {
  const name = typeof id === 'string' ? id : String(id);
  const found = state.definition.components.find((one) => one.id === name);
  if (!found) {
    throw new WorldFault('errors.worldUnknown', {
      name,
      known: state.definition.components.map((one) => one.id).join(', '),
    });
  }
  return found;
}

/** Sets an output. Setting it to what it already is changes nothing. */
export function setOutput(state: WorldState, id: unknown, value: boolean): WorldState {
  const target = component(state, id);
  if (target.role !== 'output') {
    throw new WorldFault('errors.worldNotOutput', { name: target.id });
  }
  if (state.values[target.id] === value) return state;
  const change: WorldChange = { time: state.time, id: target.id, value };
  return {
    ...state,
    values: { ...state.values, [target.id]: value },
    log: [...state.log, change],
  };
}

/**
 * Moves world time on, letting the scenario act as it goes.
 *
 * The only thing that advances time, by design. Time counted in interpreter
 * steps would make the same program run differently in blocks and in code;
 * wall-clock time would make it run differently on a slow laptop. Time that
 * only moves when the program says so is the same everywhere, every run.
 */
export function advance(state: WorldState, seconds: unknown): WorldState {
  const amount = typeof seconds === 'number' ? seconds : Number(seconds);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new WorldFault('errors.worldWait', { value: String(seconds) });
  }
  const end = state.definition.duration;
  const time = Math.min(state.time + amount, end);
  const moved = applyDue({ ...state, time });
  return time >= end ? { ...moved, ended: true } : moved;
}

/**
 * Every component's value at a past moment of a finished run.
 *
 * Rebuilt from the log rather than recorded per moment: a latch is marked by
 * asking "was the motor on at second 3, and off at second 7", and the log
 * already holds the answer to every such question.
 */
export function valuesAt(state: WorldState, time: number): Record<string, boolean> {
  const values = { ...state.initial };
  for (const change of state.log) {
    if (change.time > time) break;
    values[change.id] = change.value;
  }
  return values;
}
