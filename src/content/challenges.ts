import { createId, literal, variable } from '../core/ast/factory';
import type { Algorithm, BinaryOperator, Expression, Statement } from '../core/ast/types';
import type { Language } from '../i18n/types';

function bin(operator: BinaryOperator, left: Expression, right: Expression): Expression {
  return { kind: 'binary', operator, left, right };
}

const n = (value: number): Expression => literal(value, 'number');
const s = (value: string): Expression => literal(value, 'text');
const note = (text: string): Statement => ({ id: createId(), kind: 'comment', text });

/**
 * Exercises, as opposed to the worked examples.
 *
 * Each ships partially built: the parts a student should supply are left out
 * and described by a comment in their place. That is exactly the shape an
 * instructor can hand out — and the same shape they can author themselves by
 * writing comments and exporting the JSON.
 */
export interface Challenge {
  id: string;
  topic: 'variables' | 'io' | 'conditionals' | 'loops';
  /** Rough order of difficulty within the set. */
  level: 1 | 2 | 3;
  title: Record<Language, string>;
  goal: Record<Language, string>;
  build: (language: Language) => Statement[];
}

const COPY: Record<Language, Record<string, string>> = {
  es: {
    askBase: 'Escribe la base del rectángulo:',
    todoHeight: 'TODO: pide también la altura y guárdala en «altura»',
    todoArea: 'TODO: calcula el área (base × altura) y muéstrala',
    askTemp: '¿Cuántos grados hace?',
    todoDecide: 'TODO: si hace 30 grados o más, di «Hace calor»; si no, di «Hace fresco»',
    todoSum: 'TODO: dentro del ciclo, suma i al total',
    showTotal: 'La suma es: ',
    askN: '¿Hasta qué número quieres sumar?',
    todoCount: 'TODO: repite mientras queden números y ve contando',
    goalArea: 'Completa el programa para calcular el área de un rectángulo.',
    goalTemp: 'Usa una condicional para responder según la temperatura.',
    goalSum: 'Suma todos los números del 1 al N usando un ciclo.',
    goalEven: 'Muestra solo los números pares del 1 al 20.',
    todoEven: 'TODO: dentro del ciclo, muestra i solo si es par (i módulo 2 = 0)',
  },
  en: {
    askBase: 'Type the width of the rectangle:',
    todoHeight: 'TODO: also ask for the height and store it in "altura"',
    todoArea: 'TODO: work out the area (width × height) and show it',
    askTemp: 'How many degrees is it?',
    todoDecide: 'TODO: if it is 30 degrees or more say "It is hot", otherwise say "It is cool"',
    todoSum: 'TODO: inside the loop, add i to the total',
    showTotal: 'The sum is: ',
    askN: 'Up to which number do you want to add?',
    todoCount: 'TODO: repeat while numbers remain and keep counting',
    goalArea: 'Complete the program to work out the area of a rectangle.',
    goalTemp: 'Use a conditional to answer based on the temperature.',
    goalSum: 'Add every number from 1 to N using a loop.',
    goalEven: 'Show only the even numbers from 1 to 20.',
    todoEven: 'TODO: inside the loop, show i only when it is even (i modulo 2 = 0)',
  },
};

export const challenges: Challenge[] = [
  {
    id: 'area',
    topic: 'variables',
    level: 1,
    title: { es: 'Área de un rectángulo', en: 'Area of a rectangle' },
    goal: { es: COPY.es.goalArea, en: COPY.en.goalArea },
    build: (language) => {
      const c = COPY[language];
      return [
        { id: createId(), kind: 'ask', prompt: s(c.askBase), target: 'base', expect: 'number' },
        note(c.todoHeight),
        note(c.todoArea),
      ];
    },
  },
  {
    id: 'temperature',
    topic: 'conditionals',
    level: 1,
    title: { es: '¿Hace calor?', en: 'Is it hot?' },
    goal: { es: COPY.es.goalTemp, en: COPY.en.goalTemp },
    build: (language) => {
      const c = COPY[language];
      return [
        { id: createId(), kind: 'ask', prompt: s(c.askTemp), target: 'grados', expect: 'number' },
        note(c.todoDecide),
      ];
    },
  },
  {
    id: 'sum-to-n',
    topic: 'loops',
    level: 2,
    title: { es: 'Suma del 1 al N', en: 'Sum from 1 to N' },
    goal: { es: COPY.es.goalSum, en: COPY.en.goalSum },
    build: (language) => {
      const c = COPY[language];
      return [
        { id: createId(), kind: 'ask', prompt: s(c.askN), target: 'limite', expect: 'number' },
        { id: createId(), kind: 'declare', name: 'total', valueKind: 'number', value: n(0) },
        {
          id: createId(),
          kind: 'forEach',
          variable: 'i',
          from: n(1),
          to: variable('limite'),
          step: n(1),
          body: [note(c.todoSum)],
        },
        { id: createId(), kind: 'say', value: bin('+', s(c.showTotal), variable('total')) },
      ];
    },
  },
  {
    id: 'evens',
    topic: 'loops',
    level: 3,
    title: { es: 'Solo los pares', en: 'Only the even ones' },
    goal: { es: COPY.es.goalEven, en: COPY.en.goalEven },
    build: (language) => {
      const c = COPY[language];
      return [
        {
          id: createId(),
          kind: 'forEach',
          variable: 'i',
          from: n(1),
          to: n(20),
          step: n(1),
          body: [note(c.todoEven)],
        },
      ];
    },
  },
];

export function algorithmFromChallenge(challenge: Challenge, language: Language): Algorithm {
  const now = new Date().toISOString();
  return {
    id: `alg_${createId().slice(2)}`,
    name: challenge.title[language],
    body: challenge.build(language),
    createdAt: now,
    updatedAt: now,
  };
}
