import type { WorldExpectation } from '../classroom/grade';
import type { Skin, TimelineEvent, WorldComponent, WorldDefinition } from './types';

/*
 * Worlds and their checks, read back from storage or from another browser.
 *
 * The same standard the tree is held to: input, not state. A component with
 * no name, a duration that is not a number, an event for a part that does not
 * exist — each is dropped here rather than discovered by the interpreter.
 */

const SKINS: Skin[] = ['pushbutton', 'switch', 'sensor', 'lamp', 'motor', 'siren'];
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function reviveWorld(value: unknown): WorldDefinition | undefined {
  const raw = record(value);
  if (!raw || !Array.isArray(raw.components)) return undefined;

  const seen = new Set<string>();
  const components: WorldComponent[] = [];
  for (const entry of raw.components) {
    const part = record(entry);
    if (!part || typeof part.id !== 'string' || part.id === '' || seen.has(part.id)) continue;
    if (part.role !== 'input' && part.role !== 'output') continue;
    const skin = SKINS.includes(part.skin as Skin) ? (part.skin as Skin) : part.role === 'input' ? 'pushbutton' : 'lamp';
    seen.add(part.id);
    components.push({
      id: part.id,
      role: part.role,
      skin,
      label: typeof part.label === 'string' ? part.label : part.id,
      ...(typeof part.initial === 'boolean' ? { initial: part.initial } : {}),
    });
  }
  if (components.length === 0) return undefined;

  return {
    template: typeof raw.template === 'string' ? raw.template : 'panel',
    duration: finite(raw.duration) && raw.duration > 0 ? Math.min(raw.duration, 600) : 10,
    components,
  };
}

export function reviveTimeline(value: unknown): TimelineEvent[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((entry) => {
    const event = record(entry);
    if (!event || !finite(event.at) || typeof event.id !== 'string' || typeof event.value !== 'boolean') return [];
    return [{ at: event.at, id: event.id, value: event.value }];
  });
}

export function reviveExpectations(value: unknown): WorldExpectation[] | undefined {
  const events = reviveTimeline(value);
  return events?.map(({ at, id, value: on }) => ({ at, id, value: on }));
}

export function reviveInputs(value: unknown): Record<string, boolean> | undefined {
  const raw = record(value);
  if (!raw) return undefined;
  const inputs: Record<string, boolean> = {};
  for (const [id, on] of Object.entries(raw)) if (typeof on === 'boolean') inputs[id] = on;
  return inputs;
}
