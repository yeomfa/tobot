import { createId, literal, variable } from '../core/ast/factory';
import type { Algorithm, BinaryOperator, Expression, Statement } from '../core/ast/types';
import type { Case } from '../core/classroom/grade';
import type { WorldDefinition } from '../core/world/types';
import type { Language } from '../i18n/types';
import { word, worldWith } from './worlds';

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
 * instructor can hand out, and the same shape they can author themselves by
 * writing comments and exporting the JSON.
 */
export interface Challenge {
  id: string;
  topic: 'variables' | 'io' | 'conditionals' | 'loops';
  /**
   * How much a student needs to know to attempt this, on a fixed five-point
   * scale — not a ranking within the current set.
   *
   * The distinction matters because the set is going to grow. A scale of
   * three, assigned relative to what existed, made "print the even numbers"
   * the hardest challenge in Tobot; the day a recursion or async challenge
   * arrives, every existing level would have to shift down to make room, and
   * a challenge a student already saw as hard would silently become easy.
   *
   * Anchored to prerequisites instead, a level never moves:
   *
   * 1 — one concept, nothing combined. First contact.
   * 2 — two concepts together, or one used with a twist.
   * 3 — needs a plan before writing: several parts that must fit.
   * 4 — needs data structures or functions, not just statements.
   * 5 — needs an idea, not only technique: recursion, async, algorithms
   *     whose approach is the actual difficulty.
   *
   * Levels 4 and 5 have nothing in them yet. That is the point: they are the
   * room this scale leaves for what Tobot has not taught yet.
   */
  level: 1 | 2 | 3 | 4 | 5;
  title: Record<Language, string>;
  goal: Record<Language, string>;
  build: (language: Language) => Statement[];
  /** The scenario it is played in, for an exercise about the world. */
  world?: (language: Language) => WorldDefinition;
  /**
   * How it is checked. Public, unlike a classroom's: a built-in challenge is
   * practice, and a student who reads the cases has read the specification.
   */
  cases?: (language: Language) => Case[];
}

/** A world call, stored by its stable id: the views name it in each language. */
const act = (name: string, ...args: Expression[]): Statement => ({
  id: createId(),
  kind: 'call',
  name,
  args,
});
const pressed = (at: number, id: string, length = 1) => [
  { at, id, value: true },
  { at: at + length, id, value: false },
];

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
    goalLamp:
      'Prende la lámpara del tablero. En bloques: «llamar» → «encender» y escribe «lampara». En código: encender("lampara");',
    todoLamp: 'TODO: enciende la lámpara',
    goalLatch:
      'Al pulsar «arranque», el motor se enciende y sigue encendido aunque sueltes el botón. Al pulsar «paro», se apaga. El ciclo repite la revisión cada medio segundo.',
    todoStart: 'TODO: si leer("arranque") está activo, enciende el motor',
    todoStop: 'TODO: si leer("paro") está activo, apaga el motor',
    goalSequence:
      'Arranca «motor» y, tres segundos después, «motor2». Así se arrancan dos motores grandes sin que la corriente de arranque de ambos llegue a la vez.',
    todoSequence: 'TODO: espera 3 segundos y enciende motor2',
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
    goalLamp:
      'Light the lamp on the panel. In blocks: "call" → "turnOn" and type "lamp". In code: turnOn("lamp");',
    todoLamp: 'TODO: switch the lamp on',
    goalLatch:
      'Pressing "start" switches the motor on, and it stays on after the button is released. Pressing "stop" switches it off. The loop checks again every half second.',
    todoStart: 'TODO: if read("start") is active, switch the motor on',
    todoStop: 'TODO: if read("stop") is active, switch the motor off',
    goalSequence:
      'Start "motor" and, three seconds later, "motor2". This is how two large motors are started without both drawing their starting current at once.',
    todoSequence: 'TODO: wait 3 seconds and switch motor2 on',
  },
};

export const challenges: Challenge[] = [
  {
    id: 'area',
    topic: 'variables',
    // one concept: declare, compute, print
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
    // a conditional over a value the student asked for: two things at once
    level: 2,
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
    // a loop with an accumulator — standard shape, taught directly
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
    // a loop plus a condition inside it: needs a plan before writing
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
  /*
   * Electromechanics: the first exercises played in a scenario, and the first
   * guided ones. Each is built from the same two primitives every domain uses,
   * so the panel here is the conveyor or the gas alarm of another class.
   */
  {
    id: 'lamp',
    topic: 'io',
    level: 1,
    title: { es: 'Enciende la lámpara', en: 'Light the lamp' },
    goal: { es: COPY.es.goalLamp, en: COPY.en.goalLamp },
    build: (language) => [note(COPY[language].todoLamp)],
    world: (language) => worldWith(language, 5, [['lamp', 'output', 'lamp']]),
    cases: (language) => [
      { answers: [], expect: [], expectWorld: [{ at: 5, id: word(language, 'lamp'), value: true }] },
    ],
  },
  {
    id: 'latch',
    topic: 'loops',
    // a loop, two conditions and the idea of state held between readings
    level: 3,
    title: { es: 'Arranque y paro', en: 'Start and stop' },
    goal: { es: COPY.es.goalLatch, en: COPY.en.goalLatch },
    build: (language) => {
      const c = COPY[language];
      return [
        {
          id: createId(),
          kind: 'while',
          condition: literal(true, 'boolean'),
          body: [note(c.todoStart), note(c.todoStop), act('wait', n(0.5))],
        },
      ];
    },
    world: (language) =>
      worldWith(language, 10, [
        ['start', 'input', 'pushbutton'],
        ['stop', 'input', 'pushbutton'],
        ['motor', 'output', 'motor'],
      ]),
    cases: (language) => {
      const start = word(language, 'start');
      const stop = word(language, 'stop');
      const motor = word(language, 'motor');
      return [
        {
          answers: [],
          expect: [],
          timeline: [...pressed(1, start), ...pressed(6, stop)],
          expectWorld: [
            { at: 0.5, id: motor, value: false },
            // Still on long after the button was let go: that is the latch.
            { at: 4, id: motor, value: true },
            { at: 8, id: motor, value: false },
          ],
        },
        {
          answers: [],
          expect: [],
          expectWorld: [{ at: 9, id: motor, value: false }],
        },
      ];
    },
  },
  {
    id: 'sequence',
    topic: 'io',
    level: 2,
    title: { es: 'Arranque en secuencia', en: 'Sequenced start' },
    goal: { es: COPY.es.goalSequence, en: COPY.en.goalSequence },
    build: (language) => [
      act('turnOn', s(word(language, 'motor'))),
      note(COPY[language].todoSequence),
    ],
    world: (language) =>
      worldWith(language, 6, [
        ['motor', 'output', 'motor'],
        ['motor2', 'output', 'motor'],
      ]),
    cases: (language) => {
      const motor = word(language, 'motor');
      const motor2 = word(language, 'motor2');
      return [
        {
          answers: [],
          expect: [],
          expectWorld: [
            { at: 1, id: motor, value: true },
            { at: 2, id: motor2, value: false },
            { at: 4, id: motor2, value: true },
          ],
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
    world: challenge.world?.(language),
    createdAt: now,
    updatedAt: now,
  };
}
