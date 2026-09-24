import type { Language } from '../../i18n/types';

/**
 * What the code editor knows how to talk about.
 *
 * Data rather than code on purpose. Everything the editor offers — the
 * completion list, the hover card, the signature shown while typing — reads
 * this one array, so teaching Tobot a new function is adding an entry and
 * touching nothing else. It is also what makes the editor answerable in two
 * languages: the explanation is a record keyed by language, exactly like the
 * examples and challenges already are.
 *
 * The set is deliberately small. A student meeting a code editor for the first
 * time is not helped by every method on `Array`; they are helped by the six
 * things their blocks already did, written the way JavaScript writes them.
 */
export interface VocabularyEntry {
  /** What the student types, and what completion matches against. */
  name: string;
  /** Shown as the heading of the hover card, arguments and all. */
  signature: string;
  /** One sentence: what it does, in the interface language. */
  summary: Record<Language, string>;
  /** A line worth reading, in the interface language where it contains words. */
  example: Record<Language, string>;
  /**
   * What completion inserts, when that differs from the name.
   *
   * `#{}` marks where the cursor lands. Writing it here rather than deriving
   * it from the signature keeps the awkward cases honest: `ask` has to carry
   * its own `await`, and a student who accepts the completion gets working
   * code rather than a promise printed as `[object Promise]`.
   */
  insert?: string;
  /**
   * Whether this exists in real JavaScript or only inside Tobot.
   *
   * Shown on the hover card, because the difference matters more here than
   * anywhere else in the app: the whole point of the code editor is that what
   * a student learns here survives leaving it. Anything marked `tobot` will
   * not, and saying so is the honest thing to do.
   */
  origin: 'javascript' | 'tobot';
}

export const VOCABULARY: VocabularyEntry[] = [
  {
    name: 'console.log',
    signature: 'console.log(valor)',
    origin: 'javascript',
    summary: {
      es: 'Muestra un valor en la consola. Es lo que hacía el bloque «decir».',
      en: 'Prints a value to the console. This is what the "say" block did.',
    },
    example: {
      es: 'console.log("Hola, " + nombre);',
      en: 'console.log("Hello, " + name);',
    },
    insert: 'console.log(#{})',
  },
  {
    name: 'prompt',
    signature: 'await prompt(pregunta)',
    origin: 'javascript',
    summary: {
      es: 'Pregunta algo y espera la respuesta, siempre como texto. En Tobot pregunta el robot; en una página cualquiera abre un cuadro de diálogo. Es el mismo «prompt» de siempre.',
      en: 'Asks something and waits for the answer, always as text. In Tobot the robot asks; on an ordinary page it opens a dialog. It is the same "prompt" as anywhere else.',
    },
    example: {
      es: 'const nombre = await prompt("¿Cómo te llamas?");',
      en: 'const name = await prompt("What is your name?");',
    },
    insert: 'await prompt(#{})',
  },
  {
    name: 'ask',
    signature: 'await ask(pregunta)',
    origin: 'tobot',
    summary: {
      es: 'Lo mismo que «prompt», con el nombre que usan los bloques. Escribe el que prefieras: en Tobot los dos preguntan igual.',
      en: 'The same as "prompt", under the name the blocks use. Write whichever you prefer: inside Tobot both ask the same way.',
    },
    example: {
      es: 'const edad = Number(await ask("¿Cuántos años tienes?"));',
      en: 'const age = Number(await ask("How old are you?"));',
    },
    insert: 'await ask(#{})',
  },
  {
    name: 'Number',
    signature: 'Number(texto)',
    origin: 'javascript',
    summary: {
      es: 'Convierte un texto en número. Lo que llega de «ask» siempre es texto, así que sumarlo sin convertirlo pega las cadenas en vez de sumar.',
      en: 'Turns text into a number. What comes back from "ask" is always text, so adding it without converting joins the strings instead of adding.',
    },
    example: {
      es: 'const edad = Number(await prompt("¿Cuántos años tienes?"));',
      en: 'const age = Number(await prompt("How old are you?"));',
    },
    insert: 'Number(#{})',
  },
  {
    name: 'String',
    signature: 'String(valor)',
    origin: 'javascript',
    summary: {
      es: 'Convierte cualquier valor en texto.',
      en: 'Turns any value into text.',
    },
    example: {
      es: 'console.log("Total: " + String(suma));',
      en: 'console.log("Total: " + String(total));',
    },
    insert: 'String(#{})',
  },
  {
    name: 'Boolean',
    signature: 'Boolean(valor)',
    origin: 'javascript',
    summary: {
      es: 'Convierte un valor en verdadero o falso.',
      en: 'Turns a value into true or false.',
    },
    example: {
      es: 'const hayCupo = Boolean(inscritos < 30);',
      en: 'const hasRoom = Boolean(enrolled < 30);',
    },
    insert: 'Boolean(#{})',
  },
  {
    name: 'Math.random',
    signature: 'Math.random()',
    origin: 'javascript',
    summary: {
      es: 'Da un número al azar entre 0 y 1, sin llegar nunca a 1.',
      en: 'Gives a random number between 0 and 1, never reaching 1.',
    },
    example: {
      es: 'const dado = Math.floor(Math.random() * 6) + 1;',
      en: 'const die = Math.floor(Math.random() * 6) + 1;',
    },
    insert: 'Math.random()',
  },
  {
    name: 'Math.floor',
    signature: 'Math.floor(numero)',
    origin: 'javascript',
    summary: {
      es: 'Quita los decimales hacia abajo: 4.9 se vuelve 4.',
      en: 'Drops the decimals downwards: 4.9 becomes 4.',
    },
    example: {
      es: 'const entero = Math.floor(7.8);',
      en: 'const whole = Math.floor(7.8);',
    },
    insert: 'Math.floor(#{})',
  },
];

/** Looked up by the hover card, which has a word and needs its entry. */
export function findEntry(name: string): VocabularyEntry | null {
  return VOCABULARY.find((entry) => entry.name === name) ?? null;
}

/**
 * The names the hover card can recognise, longest first.
 *
 * Longest first because `console.log` and `Math.floor` contain a dot, and the
 * word under the cursor is matched against this list: sorting the other way
 * would let a bare `Math` shadow `Math.floor` and explain the wrong thing.
 */
export const VOCABULARY_NAMES: string[] = VOCABULARY.map((entry) => entry.name).sort(
  (a, b) => b.length - a.length,
);
