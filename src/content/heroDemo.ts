import { literal, variable } from '../core/ast/factory';
import type { Algorithm, Statement } from '../core/ast/types';
import type { Language } from '../i18n/types';

const COPY: Record<Language, Record<string, string>> = {
  es: {
    title: 'Demostración',
    name: 'Ana',
    greeting: 'Hola, ',
    success: '¡Lo lograste!',
  },
  en: {
    title: 'Demo',
    name: 'Ana',
    greeting: 'Hello, ',
    success: 'You did it!',
  },
};

/**
 * The algorithm the landing page builds and runs by itself.
 *
 * Two constraints shape it, both discovered rather than assumed:
 *
 * 1. **No `ask`.** The interpreter halts on one, waiting for input that a
 *    demo with nobody at the keyboard will never supply — it would hang on
 *    the first statement, forever. The name arrives as a literal instead.
 *
 * 2. **Fixed ids, and stable identity per language.** `useExecution` throws
 *    away its interpreter whenever the program's identity changes, so an
 *    algorithm rebuilt on every render restarts the run on every render.
 *    Callers must memoise on `language`; `createId()` is avoided so the
 *    statements themselves stay comparable.
 *
 * Seven statements across all four categories — variable, output, loop,
 * conditional — with one level of nesting, so the blocks, the four language
 * views and the flowchart all have something worth showing. It terminates
 * after about twelve interpreter steps.
 */
export function heroAlgorithm(language: Language): Algorithm {
  const copy = COPY[language];
  const timestamp = '2025-01-01T00:00:00.000Z';

  const body: Statement[] = [
    {
      id: 'hero-1',
      kind: 'declare',
      name: 'nombre',
      value: literal(copy.name, 'text'),
      valueKind: 'text',
    },
    {
      id: 'hero-2',
      kind: 'say',
      value: {
        kind: 'binary',
        operator: '+',
        left: literal(copy.greeting, 'text'),
        right: variable('nombre'),
      },
    },
    {
      id: 'hero-3',
      kind: 'declare',
      name: 'puntos',
      value: literal(0, 'number'),
      valueKind: 'number',
    },
    {
      id: 'hero-4',
      kind: 'forEach',
      variable: 'i',
      from: literal(1, 'number'),
      to: literal(3, 'number'),
      step: literal(1, 'number'),
      body: [
        {
          id: 'hero-5',
          kind: 'assign',
          name: 'puntos',
          value: {
            kind: 'binary',
            operator: '+',
            left: variable('puntos'),
            right: variable('i'),
          },
        },
      ],
    },
    {
      id: 'hero-6',
      kind: 'if',
      condition: {
        kind: 'binary',
        operator: '>=',
        left: variable('puntos'),
        right: literal(5, 'number'),
      },
      then: [{ id: 'hero-7', kind: 'say', value: literal(copy.success, 'text') }],
    },
  ];

  return {
    id: 'alg_hero_demo',
    name: copy.title,
    body,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
