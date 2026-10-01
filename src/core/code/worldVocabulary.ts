import type { Language } from '../../i18n/types';
import { WORLD_FUNCTIONS } from '../world/registry';
import type { WorldDefinition } from '../world/types';
import type { VocabularyEntry } from './vocabulary';

/**
 * The world's functions, as the code editor explains them.
 *
 * Built from the registry and from this document's own world, so the example
 * on the hover card names a motor that is actually on the panel rather than a
 * placeholder — the line a student can copy is a line that runs.
 */
export function worldVocabulary(world: WorldDefinition, language: Language): VocabularyEntry[] {
  const firstOf = (role: 'input' | 'output'): string =>
    world.components.find((one) => one.role === role)?.id ?? world.components[0]?.id ?? '';

  return WORLD_FUNCTIONS.map((fn) => {
    const name = fn.names[language];
    const params = fn.params.map((param) => param.name[language]).join(', ');
    const argument =
      fn.params[0]?.kind === 'number' ? '1' : `"${firstOf(fn.effect === 'read' ? 'input' : 'output')}"`;
    const call = `${name}(${argument})`;
    return {
      name,
      signature: `${name}(${params})`,
      summary: fn.summary,
      example: {
        es: fn.returns ? `if (${call}) { … }` : `${call};`,
        en: fn.returns ? `if (${call}) { … }` : `${call};`,
      },
      insert: fn.params[0]?.kind === 'number' ? `${name}(#{})` : `${name}("#{}")`,
      origin: 'tobot',
      // Reading inputs and driving outputs is what input and output means.
      category: 'io',
      arduino: fn.arduino,
      note: {
        es: 'Existe en los escenarios de Tobot. En una placa real se escribe como la línea de Arduino.',
        en: 'It exists in Tobot\'s scenarios. On a real board it is written as the Arduino line.',
      },
    } satisfies VocabularyEntry;
  });
}
