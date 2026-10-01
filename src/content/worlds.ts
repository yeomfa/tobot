import type { WorldComponent, WorldDefinition } from '../core/world/types';
import type { Language } from '../i18n/types';

/**
 * The scenarios a teacher can start from.
 *
 * A template is a starting panel, not a fixed one: an author picks it and then
 * renames what is on it. Drawing a scenario from nothing is a later feature,
 * and offering half of one now would be worse than saying so.
 */
export type TemplateId = 'panel';

export const TEMPLATES: TemplateId[] = ['panel'];

export const templateNames: Record<TemplateId, Record<Language, string>> = {
  panel: { es: 'Tablero eléctrico', en: 'Electrical panel' },
};

const part = (
  id: string,
  role: WorldComponent['role'],
  skin: WorldComponent['skin'],
  label: string,
): WorldComponent => ({ id, role, skin, label });

/**
 * Names as a student types them: lower case, no accents, no spaces. "Lámpara"
 * is the label on the panel; `lampara` is what goes in the quotes. An accent a
 * keyboard has to reach for is a typo waiting to happen in the one place a typo
 * stops the program.
 */
const WORDS: Record<Language, Record<string, [string, string]>> = {
  es: {
    start: ['arranque', 'Arranque'],
    stop: ['paro', 'Paro'],
    sensor: ['sensor', 'Sensor'],
    motor: ['motor', 'Motor'],
    motor2: ['motor2', 'Motor 2'],
    lamp: ['lampara', 'Lámpara'],
    siren: ['sirena', 'Sirena'],
  },
  en: {
    start: ['start', 'Start'],
    stop: ['stop', 'Stop'],
    sensor: ['sensor', 'Sensor'],
    motor: ['motor', 'Motor'],
    motor2: ['motor2', 'Motor 2'],
    lamp: ['lamp', 'Lamp'],
    siren: ['siren', 'Siren'],
  },
};

/** One component's name in a language: what the program writes, what the panel says. */
export function word(language: Language, key: keyof (typeof WORDS)['es']): string {
  return WORDS[language][key][0];
}

function named(
  language: Language,
  key: keyof (typeof WORDS)['es'],
  role: WorldComponent['role'],
  skin: WorldComponent['skin'],
): WorldComponent {
  const [id, label] = WORDS[language][key];
  return part(id, role, skin, label);
}

/** The template's panel, in a language. */
export function templateWorld(template: TemplateId, language: Language): WorldDefinition {
  switch (template) {
    case 'panel':
      return {
        template,
        duration: 10,
        components: [
          named(language, 'start', 'input', 'pushbutton'),
          named(language, 'stop', 'input', 'pushbutton'),
          named(language, 'sensor', 'input', 'sensor'),
          named(language, 'motor', 'output', 'motor'),
          named(language, 'lamp', 'output', 'lamp'),
          named(language, 'siren', 'output', 'siren'),
        ],
      };
  }
}

/** A world with exactly these parts, for an exercise that needs no more. */
export function worldWith(
  language: Language,
  duration: number,
  parts: [keyof (typeof WORDS)['es'], WorldComponent['role'], WorldComponent['skin']][],
): WorldDefinition {
  return {
    template: 'panel',
    duration,
    components: parts.map(([key, role, skin]) => named(language, key, role, skin)),
  };
}

/**
 * A component's name made safe to type: what an author's label becomes in the
 * quotes. "Bomba de agua" → `bomba_de_agua`.
 */
export function idFromLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
