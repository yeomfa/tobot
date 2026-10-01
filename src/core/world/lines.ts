import type { Language } from '../../i18n/types';
import type { TimelineEvent } from './types';

/*
 * Moments in a scenario, written one per line: `1 arranque sí`.
 *
 * How an author writes "start is pressed at second 1" or "the motor is on at
 * second 4" without a timeline editor. Three words, the order a sentence would
 * use, and either language's yes and no — so a case written in Spanish still
 * reads back after switching to English.
 */

const YES = new Set(['si', 'sí', 'yes', 'on', '1', 'true', 'verdadero', 'encendido', 'activo', 'active']);
const NO = new Set(['no', 'off', '0', 'false', 'falso', 'apagado', 'inactivo', 'inactive']);

export interface ParsedLines {
  events: TimelineEvent[];
  /** Lines that could not be read, as written, so the author can be shown them. */
  bad: string[];
}

export function parseMoments(text: string): ParsedLines {
  const events: TimelineEvent[] = [];
  const bad: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const [time, id, word, ...rest] = line.split(/\s+/);
    const at = Number((time ?? '').replace(',', '.'));
    const said = (word ?? '').toLowerCase();
    const value = YES.has(said) ? true : NO.has(said) ? false : null;
    if (rest.length > 0 || !Number.isFinite(at) || at < 0 || !id || value === null) {
      bad.push(line);
      continue;
    }
    events.push({ at, id: id.replace(/^["'«]|["'»]$/g, ''), value });
  }
  return { events: events.sort((a, b) => a.at - b.at), bad };
}

export function writeMoments(events: TimelineEvent[], language: Language): string {
  const yes = language === 'es' ? 'sí' : 'yes';
  return events.map((event) => `${event.at} ${event.id} ${event.value ? yes : 'no'}`).join('\n');
}
