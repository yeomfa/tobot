import { describe, expect, it } from 'vitest';

import { createId, literal, variable } from './factory';
import type { BinaryOperator, Expression, Statement } from './types';
import { validate } from './validate';

function bin(operator: BinaryOperator, left: Expression, right: Expression): Expression {
  return { kind: 'binary', operator, left, right };
}

const keys = (program: Statement[]): string[] =>
  validate(program).map((problem) => problem.messageKey);

describe('validate', () => {
  it('accepts a correct program', () => {
    expect(
      keys([
        {
          id: createId(),
          kind: 'declare',
          name: 'n',
          valueKind: 'number',
          value: literal(3, 'number'),
        },
        { id: createId(), kind: 'say', value: variable('n') },
      ]),
    ).toEqual([]);
  });

  it('flags a variable used before it exists', () => {
    expect(keys([{ id: createId(), kind: 'say', value: variable('fantasma') }])).toContain(
      'undefinedVariable',
    );
  });

  it('flags assigning to a variable that was never created', () => {
    expect(
      keys([{ id: createId(), kind: 'assign', name: 'x', value: literal(1, 'number') }]),
    ).toContain('assignBeforeDeclare');
  });

  it('warns when a name is declared twice', () => {
    const problems = validate([
      { id: createId(), kind: 'declare', name: 'x', valueKind: 'number', value: literal(1, 'number') },
      { id: createId(), kind: 'declare', name: 'x', valueKind: 'number', value: literal(2, 'number') },
    ]);
    const duplicate = problems.find((problem) => problem.messageKey === 'duplicateName');
    expect(duplicate).toBeDefined();
    expect(duplicate?.severity).toBe('warning');
    expect(duplicate?.vars).toEqual({ name: 'x' });
  });

  it('rejects reserved words as names', () => {
    expect(
      keys([
        {
          id: createId(),
          kind: 'declare',
          name: 'class',
          valueKind: 'number',
          value: literal(1, 'number'),
        },
      ]),
    ).toContain('reservedName');
  });

  it('rejects names that are not valid identifiers', () => {
    expect(
      keys([
        {
          id: createId(),
          kind: 'declare',
          name: '2cosas',
          valueKind: 'number',
          value: literal(1, 'number'),
        },
      ]),
    ).toContain('invalidName');
  });

  it('warns about a say with nothing to say', () => {
    expect(keys([{ id: createId(), kind: 'say', value: literal('', 'text') }])).toContain(
      'emptySay',
    );
  });

  it('warns when a while loop cannot make progress', () => {
    // The condition reads `n`, but nothing in the body ever changes it.
    expect(
      keys([
        {
          id: createId(),
          kind: 'declare',
          name: 'n',
          valueKind: 'number',
          value: literal(5, 'number'),
        },
        {
          id: createId(),
          kind: 'while',
          condition: bin('>', variable('n'), literal(0, 'number')),
          body: [{ id: createId(), kind: 'say', value: literal('hola', 'text') }],
        },
      ]),
    ).toContain('endlessLoop');
  });

  it('accepts a while loop whose body updates the condition', () => {
    expect(
      keys([
        {
          id: createId(),
          kind: 'declare',
          name: 'n',
          valueKind: 'number',
          value: literal(5, 'number'),
        },
        {
          id: createId(),
          kind: 'while',
          condition: bin('>', variable('n'), literal(0, 'number')),
          body: [
            {
              id: createId(),
              kind: 'assign',
              name: 'n',
              value: bin('-', variable('n'), literal(1, 'number')),
            },
          ],
        },
      ]),
    ).toEqual([]);
  });

  it('warns about a range that runs backwards', () => {
    expect(
      keys([
        {
          id: createId(),
          kind: 'forEach',
          variable: 'i',
          from: literal(10, 'number'),
          to: literal(1, 'number'),
          step: literal(1, 'number'),
          body: [{ id: createId(), kind: 'say', value: variable('i') }],
        },
      ]),
    ).toContain('rangeNeverRuns');
  });

  it('rejects a zero step', () => {
    expect(
      keys([
        {
          id: createId(),
          kind: 'forEach',
          variable: 'i',
          from: literal(1, 'number'),
          to: literal(5, 'number'),
          step: literal(0, 'number'),
          body: [{ id: createId(), kind: 'say', value: variable('i') }],
        },
      ]),
    ).toContain('zeroStep');
  });

  it('exposes the loop variable to the body', () => {
    expect(
      keys([
        {
          id: createId(),
          kind: 'forEach',
          variable: 'i',
          from: literal(1, 'number'),
          to: literal(3, 'number'),
          step: literal(1, 'number'),
          body: [{ id: createId(), kind: 'say', value: variable('i') }],
        },
      ]),
    ).toEqual([]);
  });

  it('sees variables declared inside a branch', () => {
    // `ask` inside the branch introduces `edad`; using it afterwards is fine.
    expect(
      keys([
        {
          id: createId(),
          kind: 'if',
          condition: literal(true, 'boolean'),
          then: [
            {
              id: createId(),
              kind: 'ask',
              prompt: literal('?', 'text'),
              target: 'edad',
              expect: 'number',
            },
          ],
        },
        { id: createId(), kind: 'say', value: variable('edad') },
      ]),
    ).toEqual([]);
  });

  it('points each problem at the statement it belongs to', () => {
    const badId = createId();
    const problems = validate([
      { id: createId(), kind: 'say', value: literal('ok', 'text') },
      { id: badId, kind: 'say', value: variable('fantasma') },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0].nodeId).toBe(badId);
  });
});
