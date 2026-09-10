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

describe('ask re-prompting', () => {
  it('does not flag asking into a variable that already exists', () => {
    // Re-prompting inside a loop is the normal shape of "keep asking until…".
    const problems = validate([
      {
        id: createId(),
        kind: 'ask',
        prompt: literal('?', 'text'),
        target: 'intento',
        expect: 'number',
      },
      {
        id: createId(),
        kind: 'while',
        condition: bin('!=', variable('intento'), literal(7, 'number')),
        body: [
          {
            id: createId(),
            kind: 'ask',
            prompt: literal('?', 'text'),
            target: 'intento',
            expect: 'number',
          },
        ],
      },
    ]);
    expect(problems.map((problem) => problem.messageKey)).toEqual([]);
  });
});

/**
 * The declared type and the value it holds can disagree.
 *
 * Changing a declaration's type re-reads a plain literal, but an expression
 * built out of several parts is deliberately left alone — rewriting it would
 * discard what the student assembled. So a variable can end up labelled
 * "texto" while holding a sum of numbers. It runs, and all four views agree
 * with each other; only the label is wrong, and nothing used to say so.
 *
 * The half that matters most here is the silence: a warning that fires when it
 * should not teaches the student to ignore the badge, which costs more than
 * this gains.
 */
describe('a declared type that disagrees with its value', () => {
  const declare = (valueKind: 'number' | 'text' | 'boolean' | 'list', value: Expression): Statement => ({
    id: createId(),
    kind: 'declare',
    name: 'total',
    valueKind,
    value,
  });

  const sum = bin('+', bin('+', literal(1, 'number'), literal(2, 'number')), literal(3, 'number'));

  it('warns when a sum of numbers sits under a text type', () => {
    expect(keys([declare('text', sum)])).toContain('kindMismatch');
  });

  it('says nothing when the type matches', () => {
    expect(keys([declare('number', sum)])).not.toContain('kindMismatch');
  });

  it('says nothing about joined text under a text type', () => {
    const joined = bin('+', literal('hola ', 'text'), literal('mundo', 'text'));
    expect(keys([declare('text', joined)])).not.toContain('kindMismatch');
  });

  it('warns when joined text sits under a number type', () => {
    const joined = bin('+', literal('hola ', 'text'), literal('mundo', 'text'));
    expect(keys([declare('number', joined)])).toContain('kindMismatch');
  });

  it('warns when a comparison sits under a number type', () => {
    expect(keys([declare('number', bin('>', literal(2, 'number'), literal(1, 'number')))])).toContain(
      'kindMismatch',
    );
  });

  it('says nothing about a comparison under a boolean type', () => {
    expect(
      keys([declare('boolean', bin('>', literal(2, 'number'), literal(1, 'number')))]),
    ).not.toContain('kindMismatch');
  });

  /* The uncertain cases. A variable carries no type this walk can see, so
     anything involving one has to stay quiet rather than guess. */
  it('says nothing when a variable is involved', () => {
    const program: Statement[] = [
      { id: createId(), kind: 'declare', name: 'n', valueKind: 'number', value: literal(1, 'number') },
      declare('text', bin('+', variable('n'), literal(1, 'number'))),
    ];
    expect(keys(program)).not.toContain('kindMismatch');
  });

  it('says nothing about a bare variable', () => {
    const program: Statement[] = [
      { id: createId(), kind: 'declare', name: 'n', valueKind: 'number', value: literal(1, 'number') },
      declare('text', variable('n')),
    ];
    expect(keys(program)).not.toContain('kindMismatch');
  });

  it('warns when a list sits under a text type', () => {
    expect(keys([declare('text', { kind: 'list', items: [literal(1, 'number')] })])).toContain(
      'kindMismatch',
    );
  });

  it('says nothing about a list under a list type', () => {
    expect(
      keys([declare('list', { kind: 'list', items: [literal(1, 'number')] })]),
    ).not.toContain('kindMismatch');
  });

  it('leaves the program runnable: it is a warning, never an error', () => {
    const problems = validate([declare('text', sum)]);
    const mismatch = problems.filter((problem) => problem.messageKey === 'kindMismatch');
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0]?.severity).toBe('warning');
  });
});
