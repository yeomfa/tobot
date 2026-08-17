import { createId, literal, variable } from '../core/ast/factory';
import type { Algorithm, BinaryOperator, Expression, Statement } from '../core/ast/types';
import type { Language } from '../i18n/types';

function binary(operator: BinaryOperator, left: Expression, right: Expression): Expression {
  return { kind: 'binary', operator, left, right };
}

const COPY: Record<Language, Record<string, string>> = {
  es: {
    title: 'Saludo y nota',
    askName: '¿Cómo te llamas?',
    greeting: 'Hola, ',
    askGrade: '¿Cuál fue tu nota?',
    passed: '¡Felicitaciones, aprobaste!',
    failed: 'Sigue practicando, casi lo logras.',
    countdown: 'Cuenta atrás: ',
  },
  en: {
    title: 'Greeting and grade',
    askName: 'What is your name?',
    greeting: 'Hello, ',
    askGrade: 'What was your grade?',
    passed: 'Congratulations, you passed!',
    failed: 'Keep practising, you are close.',
    countdown: 'Countdown: ',
  },
};

/**
 * The algorithm a student sees on first load.
 *
 * It deliberately touches all five topics — a variable, output, input, a
 * conditional and a loop — so the three language tabs and the flowchart all
 * have something meaningful to show before anything is typed.
 */
export function welcomeAlgorithm(language: Language): Algorithm {
  const copy = COPY[language];
  const now = new Date().toISOString();

  const body: Statement[] = [
    {
      id: createId(),
      kind: 'ask',
      prompt: literal(copy.askName, 'text'),
      target: 'nombre',
      expect: 'text',
    },
    {
      id: createId(),
      kind: 'say',
      value: binary('+', literal(copy.greeting, 'text'), variable('nombre')),
    },
    {
      id: createId(),
      kind: 'ask',
      prompt: literal(copy.askGrade, 'text'),
      target: 'nota',
      expect: 'number',
    },
    {
      id: createId(),
      kind: 'if',
      condition: binary('>=', variable('nota'), literal(3, 'number')),
      then: [{ id: createId(), kind: 'say', value: literal(copy.passed, 'text') }],
      otherwise: [{ id: createId(), kind: 'say', value: literal(copy.failed, 'text') }],
    },
    {
      id: createId(),
      kind: 'forEach',
      variable: 'i',
      from: literal(3, 'number'),
      to: literal(1, 'number'),
      step: literal(-1, 'number'),
      body: [
        {
          id: createId(),
          kind: 'say',
          value: binary('+', literal(copy.countdown, 'text'), variable('i')),
        },
      ],
    },
  ];

  return {
    id: `alg_${createId().slice(2)}`,
    name: copy.title,
    body,
    createdAt: now,
    updatedAt: now,
  };
}
