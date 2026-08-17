import { createId, literal, variable } from '../core/ast/factory';
import type { Algorithm, BinaryOperator, Expression, Statement } from '../core/ast/types';
import type { Language } from '../i18n/types';

function bin(operator: BinaryOperator, left: Expression, right: Expression): Expression {
  return { kind: 'binary', operator, left, right };
}

const n = (value: number): Expression => literal(value, 'number');
const s = (value: string): Expression => literal(value, 'text');

/**
 * Worked examples, one per topic.
 *
 * Each is a problem a first-year student would actually be set, solved with
 * only the statements in the palette — so opening one and reading its three
 * language views is itself a lesson.
 */
export interface Example {
  id: string;
  /** Concept this example belongs to, for grouping. */
  topic: 'variables' | 'io' | 'conditionals' | 'loops';
  title: Record<Language, string>;
  summary: Record<Language, string>;
  build: (language: Language) => Statement[];
}

const COPY: Record<Language, Record<string, string>> = {
  es: {
    askName: '¿Cómo te llamas?',
    hello: 'Hola, ',
    askA: 'Escribe el primer número:',
    askB: 'Escribe el segundo número:',
    sumIs: 'La suma es: ',
    avgIs: 'El promedio es: ',
    askGrade: '¿Cuál fue tu nota?',
    passed: 'Aprobaste',
    failed: 'Reprobaste',
    askAge: '¿Cuántos años tienes?',
    adult: 'Eres mayor de edad',
    minor: 'Eres menor de edad',
    askTable: '¿De qué número quieres la tabla?',
    times: ' x ',
    equals: ' = ',
    askSecret: 'Adivina el número (1 a 10):',
    tooLow: 'Muy bajo, intenta otra vez',
    tooHigh: 'Muy alto, intenta otra vez',
    correct: '¡Correcto!',
    attempts: 'Intentos usados: ',
    counting: 'Contando: ',
    done: 'Listo',
  },
  en: {
    askName: 'What is your name?',
    hello: 'Hello, ',
    askA: 'Type the first number:',
    askB: 'Type the second number:',
    sumIs: 'The sum is: ',
    avgIs: 'The average is: ',
    askGrade: 'What was your grade?',
    passed: 'You passed',
    failed: 'You did not pass',
    askAge: 'How old are you?',
    adult: 'You are an adult',
    minor: 'You are a minor',
    askTable: 'Which times table do you want?',
    times: ' x ',
    equals: ' = ',
    askSecret: 'Guess the number (1 to 10):',
    tooLow: 'Too low, try again',
    tooHigh: 'Too high, try again',
    correct: 'Correct!',
    attempts: 'Attempts used: ',
    counting: 'Counting: ',
    done: 'Done',
  },
};

export const examples: Example[] = [
  {
    id: 'greeting',
    topic: 'io',
    title: { es: 'Saludo personalizado', en: 'Personalised greeting' },
    summary: {
      es: 'Pide un nombre y saluda usándolo.',
      en: 'Ask for a name and greet using it.',
    },
    build: (language) => {
      const c = COPY[language];
      return [
        { id: createId(), kind: 'ask', prompt: s(c.askName), target: 'nombre', expect: 'text' },
        { id: createId(), kind: 'say', value: bin('+', s(c.hello), variable('nombre')) },
      ];
    },
  },
  {
    id: 'average',
    topic: 'variables',
    title: { es: 'Promedio de dos números', en: 'Average of two numbers' },
    summary: {
      es: 'Suma dos números y divide para obtener el promedio.',
      en: 'Add two numbers and divide to get the average.',
    },
    build: (language) => {
      const c = COPY[language];
      return [
        { id: createId(), kind: 'ask', prompt: s(c.askA), target: 'a', expect: 'number' },
        { id: createId(), kind: 'ask', prompt: s(c.askB), target: 'b', expect: 'number' },
        {
          id: createId(),
          kind: 'declare',
          name: 'suma',
          valueKind: 'number',
          value: bin('+', variable('a'), variable('b')),
        },
        { id: createId(), kind: 'say', value: bin('+', s(c.sumIs), variable('suma')) },
        {
          id: createId(),
          kind: 'say',
          value: bin('+', s(c.avgIs), bin('/', variable('suma'), n(2))),
        },
      ];
    },
  },
  {
    id: 'grade',
    topic: 'conditionals',
    title: { es: '¿Aprobó o reprobó?', en: 'Pass or fail?' },
    summary: {
      es: 'Decide según la nota usando si… entonces.',
      en: 'Decide based on the grade using if… then.',
    },
    build: (language) => {
      const c = COPY[language];
      return [
        { id: createId(), kind: 'ask', prompt: s(c.askGrade), target: 'nota', expect: 'number' },
        {
          id: createId(),
          kind: 'if',
          condition: bin('>=', variable('nota'), n(3)),
          then: [{ id: createId(), kind: 'say', value: s(c.passed) }],
          otherwise: [{ id: createId(), kind: 'say', value: s(c.failed) }],
        },
      ];
    },
  },
  {
    id: 'adult',
    topic: 'conditionals',
    title: { es: 'Mayor o menor de edad', en: 'Adult or minor' },
    summary: {
      es: 'Compara la edad con 18 y responde en consecuencia.',
      en: 'Compare the age with 18 and answer accordingly.',
    },
    build: (language) => {
      const c = COPY[language];
      return [
        { id: createId(), kind: 'ask', prompt: s(c.askAge), target: 'edad', expect: 'number' },
        {
          id: createId(),
          kind: 'if',
          condition: bin('>=', variable('edad'), n(18)),
          then: [{ id: createId(), kind: 'say', value: s(c.adult) }],
          otherwise: [{ id: createId(), kind: 'say', value: s(c.minor) }],
        },
      ];
    },
  },
  {
    id: 'times-table',
    topic: 'loops',
    title: { es: 'Tabla de multiplicar', en: 'Times table' },
    summary: {
      es: 'Recorre del 1 al 10 mostrando cada producto.',
      en: 'Count from 1 to 10 showing each product.',
    },
    build: (language) => {
      const c = COPY[language];
      return [
        { id: createId(), kind: 'ask', prompt: s(c.askTable), target: 'tabla', expect: 'number' },
        {
          id: createId(),
          kind: 'forEach',
          variable: 'i',
          from: n(1),
          to: n(10),
          step: n(1),
          body: [
            {
              id: createId(),
              kind: 'say',
              value: bin(
                '+',
                bin(
                  '+',
                  bin('+', bin('+', variable('tabla'), s(c.times)), variable('i')),
                  s(c.equals),
                ),
                bin('*', variable('tabla'), variable('i')),
              ),
            },
          ],
        },
      ];
    },
  },
  {
    id: 'countdown',
    topic: 'loops',
    title: { es: 'Cuenta regresiva', en: 'Countdown' },
    summary: {
      es: 'Usa mientras y una variable que va bajando.',
      en: 'Use while with a variable that keeps decreasing.',
    },
    build: (language) => {
      const c = COPY[language];
      return [
        { id: createId(), kind: 'declare', name: 'n', valueKind: 'number', value: n(5) },
        {
          id: createId(),
          kind: 'while',
          condition: bin('>', variable('n'), n(0)),
          body: [
            { id: createId(), kind: 'say', value: bin('+', s(c.counting), variable('n')) },
            {
              id: createId(),
              kind: 'assign',
              name: 'n',
              value: bin('-', variable('n'), n(1)),
            },
          ],
        },
        { id: createId(), kind: 'say', value: s(c.done) },
      ];
    },
  },
  {
    id: 'guess',
    topic: 'loops',
    title: { es: 'Adivina el número', en: 'Guess the number' },
    summary: {
      es: 'Repite hasta acertar, combinando ciclo y condicionales.',
      en: 'Repeat until correct, combining a loop and conditionals.',
    },
    build: (language) => {
      const c = COPY[language];
      return [
        { id: createId(), kind: 'declare', name: 'secreto', valueKind: 'number', value: n(7) },
        { id: createId(), kind: 'declare', name: 'intento', valueKind: 'number', value: n(0) },
        { id: createId(), kind: 'declare', name: 'intentos', valueKind: 'number', value: n(0) },
        {
          id: createId(),
          kind: 'while',
          condition: bin('!=', variable('intento'), variable('secreto')),
          body: [
            {
              id: createId(),
              kind: 'ask',
              prompt: s(c.askSecret),
              target: 'intento',
              expect: 'number',
            },
            {
              id: createId(),
              kind: 'assign',
              name: 'intentos',
              value: bin('+', variable('intentos'), n(1)),
            },
            {
              id: createId(),
              kind: 'if',
              condition: bin('<', variable('intento'), variable('secreto')),
              then: [{ id: createId(), kind: 'say', value: s(c.tooLow) }],
              otherwise: [
                {
                  id: createId(),
                  kind: 'if',
                  condition: bin('>', variable('intento'), variable('secreto')),
                  then: [{ id: createId(), kind: 'say', value: s(c.tooHigh) }],
                  otherwise: [{ id: createId(), kind: 'say', value: s(c.correct) }],
                },
              ],
            },
          ],
        },
        { id: createId(), kind: 'say', value: bin('+', s(c.attempts), variable('intentos')) },
      ];
    },
  },
];

/** Builds a fresh algorithm from an example, with new ids each time. */
export function algorithmFromExample(example: Example, language: Language): Algorithm {
  const now = new Date().toISOString();
  return {
    id: `alg_${createId().slice(2)}`,
    name: example.title[language],
    body: example.build(language),
    createdAt: now,
    updatedAt: now,
  };
}
