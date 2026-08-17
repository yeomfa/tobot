import { describe, expect, it } from 'vitest';

import { createId, literal, variable } from './ast/factory';
import type { Algorithm, BinaryOperator, Expression, Statement } from './ast/types';
import { emitters, renderLines } from './emitters';
import { Interpreter } from './runtime/interpreter';
import { MAX_STEPS } from './runtime/types';

function binary(operator: BinaryOperator, left: Expression, right: Expression): Expression {
  return { kind: 'binary', operator, left, right };
}

function wrap(body: Statement[]): Algorithm {
  return {
    id: 'test',
    name: 'Test',
    body,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/** Runs a program to completion, feeding `answers` to each `ask` in order. */
function run(body: Statement[], answers: string[] = []) {
  const machine = new Interpreter(body);
  let state = machine.getState();
  let pending = [...answers];
  let guard = 0;

  while (state.status !== 'finished' && state.status !== 'error') {
    if (guard++ > 5000) throw new Error('program did not terminate');
    if (state.status === 'awaitingInput') {
      state = machine.provideInput(pending.shift() ?? '');
      continue;
    }
    state = machine.step();
  }
  return state;
}

/** Executes emitted JavaScript in a sandbox, capturing console output. */
function runEmittedJs(body: Statement[], answers: string[] = []): string[] {
  const source = renderLines(emitters.javascript.emit(wrap(body), { locale: 'es' }));
  const logged: string[] = [];
  const pending = [...answers];
  const sandbox = new Function('prompt', 'console', source);
  sandbox(
    () => pending.shift() ?? '',
    { log: (value: unknown) => logged.push(String(value)) },
  );
  return logged;
}

const spoken = (state: ReturnType<typeof run>): string[] =>
  state.output.filter((entry) => entry.kind === 'say').map((entry) => entry.text);

describe('interpreter', () => {
  it('declares variables and says their value', () => {
    const state = run([
      { id: createId(), kind: 'declare', name: 'x', valueKind: 'number', value: literal(5, 'number') },
      { id: createId(), kind: 'say', value: variable('x') },
    ]);
    expect(state.status).toBe('finished');
    expect(spoken(state)).toEqual(['5']);
  });

  it('reports a helpful error for an undefined variable', () => {
    const state = run([{ id: createId(), kind: 'say', value: variable('fantasma') }]);
    expect(state.status).toBe('error');
    expect(state.error?.messageKey).toBe('errors.undefinedVariable');
    expect(state.error?.vars).toEqual({ name: 'fantasma' });
  });

  it('suspends on ask and resumes with a coerced answer', () => {
    const state = run(
      [
        {
          id: createId(),
          kind: 'ask',
          prompt: literal('edad?', 'text'),
          target: 'edad',
          expect: 'number',
        },
        {
          id: createId(),
          kind: 'say',
          value: binary('+', variable('edad'), literal(1, 'number')),
        },
      ],
      ['17'],
    );
    expect(spoken(state)).toEqual(['18']);
  });

  it('takes the otherwise branch when the condition is false', () => {
    const state = run([
      { id: createId(), kind: 'declare', name: 'n', valueKind: 'number', value: literal(2, 'number') },
      {
        id: createId(),
        kind: 'if',
        condition: binary('>=', variable('n'), literal(3, 'number')),
        then: [{ id: createId(), kind: 'say', value: literal('alto', 'text') }],
        otherwise: [{ id: createId(), kind: 'say', value: literal('bajo', 'text') }],
      },
    ]);
    expect(spoken(state)).toEqual(['bajo']);
  });

  it('runs a while loop until the condition turns false', () => {
    const state = run([
      { id: createId(), kind: 'declare', name: 'n', valueKind: 'number', value: literal(3, 'number') },
      {
        id: createId(),
        kind: 'while',
        condition: binary('>', variable('n'), literal(0, 'number')),
        body: [
          { id: createId(), kind: 'say', value: variable('n') },
          {
            id: createId(),
            kind: 'assign',
            name: 'n',
            value: binary('-', variable('n'), literal(1, 'number')),
          },
        ],
      },
    ]);
    expect(spoken(state)).toEqual(['3', '2', '1']);
  });

  it('stops a runaway loop instead of hanging', () => {
    // The guard must be the interpreter's own limit, not the harness's, so this
    // fails loudly if the safety net is ever removed.
    const machine = new Interpreter([
      {
        id: createId(),
        kind: 'while',
        condition: literal(true, 'boolean'),
        body: [{ id: createId(), kind: 'say', value: literal('x', 'text') }],
      },
    ]);
    let state = machine.getState();
    while (state.status !== 'error' && state.status !== 'finished') {
      state = machine.step();
    }
    expect(state.status).toBe('error');
    expect(state.error?.messageKey).toBe('errors.infiniteLoop');
    expect(state.stepCount).toBeLessThanOrEqual(MAX_STEPS);
  });

  it('counts down when forEach has a negative step', () => {
    const state = run([
      {
        id: createId(),
        kind: 'forEach',
        variable: 'i',
        from: literal(3, 'number'),
        to: literal(1, 'number'),
        step: literal(-1, 'number'),
        body: [{ id: createId(), kind: 'say', value: variable('i') }],
      },
    ]);
    expect(spoken(state)).toEqual(['3', '2', '1']);
  });

  it('rejects division by zero', () => {
    const state = run([
      {
        id: createId(),
        kind: 'say',
        value: binary('/', literal(1, 'number'), literal(0, 'number')),
      },
    ]);
    expect(state.error?.messageKey).toBe('errors.divisionByZero');
  });

  it('short-circuits && so the right side never runs', () => {
    // `fantasma` is undefined; if it were evaluated the program would error.
    const state = run([
      {
        id: createId(),
        kind: 'say',
        value: binary('&&', literal(false, 'boolean'), variable('fantasma')),
      },
    ]);
    expect(state.status).toBe('finished');
    expect(spoken(state)).toEqual(['false']);
  });
});

describe('javascript emitter', () => {
  it('declares a name once even when ask reuses it', () => {
    const body: Statement[] = [
      { id: createId(), kind: 'declare', name: 'nota', valueKind: 'number', value: literal(0, 'number') },
      {
        id: createId(),
        kind: 'ask',
        prompt: literal('nota?', 'text'),
        target: 'nota',
        expect: 'number',
      },
    ];
    const source = renderLines(emitters.javascript.emit(wrap(body), { locale: 'es' }));
    expect(source.match(/let nota/g)).toHaveLength(1);
    // Must be syntactically valid, which a duplicate `let` would not be.
    expect(() => new Function('prompt', 'console', source)).not.toThrow();
  });

  it('parenthesises only where precedence requires it', () => {
    const body: Statement[] = [
      {
        id: createId(),
        kind: 'say',
        // (1 + 2) * 3 needs parens; 1 + 2 * 3 does not.
        value: binary(
          '*',
          binary('+', literal(1, 'number'), literal(2, 'number')),
          literal(3, 'number'),
        ),
      },
    ];
    const source = renderLines(emitters.javascript.emit(wrap(body), { locale: 'es' }));
    expect(source).toContain('(1 + 2) * 3');
  });

  it('keeps parens on a right-hand subtraction', () => {
    const body: Statement[] = [
      {
        id: createId(),
        kind: 'say',
        value: binary(
          '-',
          literal(10, 'number'),
          binary('-', literal(4, 'number'), literal(1, 'number')),
        ),
      },
    ];
    const source = renderLines(emitters.javascript.emit(wrap(body), { locale: 'es' }));
    expect(source).toContain('10 - (4 - 1)');
  });
});

describe('emitted javascript matches the interpreter', () => {
  const program: Statement[] = [
    { id: createId(), kind: 'declare', name: 'nota', valueKind: 'number', value: literal(0, 'number') },
    {
      id: createId(),
      kind: 'ask',
      prompt: literal('nota?', 'text'),
      target: 'nota',
      expect: 'number',
    },
    {
      id: createId(),
      kind: 'if',
      condition: binary('>=', variable('nota'), literal(3, 'number')),
      then: [{ id: createId(), kind: 'say', value: literal('Aprobaste', 'text') }],
      otherwise: [{ id: createId(), kind: 'say', value: literal('Reprobaste', 'text') }],
    },
    {
      id: createId(),
      kind: 'forEach',
      variable: 'i',
      from: literal(1, 'number'),
      to: literal(3, 'number'),
      step: literal(1, 'number'),
      body: [
        {
          id: createId(),
          kind: 'say',
          value: binary('+', literal('Vuelta ', 'text'), variable('i')),
        },
      ],
    },
    {
      id: createId(),
      kind: 'while',
      condition: binary('>', variable('nota'), literal(0, 'number')),
      body: [
        {
          id: createId(),
          kind: 'assign',
          name: 'nota',
          value: binary('-', variable('nota'), literal(2, 'number')),
        },
        {
          id: createId(),
          kind: 'say',
          value: binary('+', literal('nota=', 'text'), variable('nota')),
        },
      ],
    },
  ];

  it('produces identical output for the same answers', () => {
    const interpreted = spoken(run(program, ['4.5']));
    const executed = runEmittedJs(program, ['4.5']);
    expect(executed).toEqual(interpreted);
    expect(interpreted).toEqual([
      'Aprobaste',
      'Vuelta 1',
      'Vuelta 2',
      'Vuelta 3',
      'nota=2.5',
      'nota=0.5',
      'nota=-1.5',
    ]);
  });
});

describe('pseudocode emitter', () => {
  it('follows the interface language', () => {
    const body: Statement[] = [
      {
        id: createId(),
        kind: 'if',
        condition: literal(true, 'boolean'),
        then: [{ id: createId(), kind: 'say', value: literal('hola', 'text') }],
      },
    ];
    const spanish = renderLines(emitters.pseudocode.emit(wrap(body), { locale: 'es' }));
    const english = renderLines(emitters.pseudocode.emit(wrap(body), { locale: 'en' }));
    expect(spanish).toContain('SI VERDADERO ENTONCES');
    expect(spanish).toContain('FIN SI');
    expect(english).toContain('IF TRUE THEN');
    expect(english).toContain('END IF');
  });
});

describe('python emitter', () => {
  it('makes the range endpoint inclusive', () => {
    const body: Statement[] = [
      {
        id: createId(),
        kind: 'forEach',
        variable: 'i',
        from: literal(1, 'number'),
        to: literal(3, 'number'),
        step: literal(1, 'number'),
        body: [{ id: createId(), kind: 'say', value: variable('i') }],
      },
    ];
    const source = renderLines(emitters.python.emit(wrap(body), { locale: 'es' }));
    expect(source).toContain('for i in range(1, 3 + 1):');
  });

  it('emits pass for an empty block so the code stays valid', () => {
    const body: Statement[] = [
      { id: createId(), kind: 'while', condition: literal(true, 'boolean'), body: [] },
    ];
    const source = renderLines(emitters.python.emit(wrap(body), { locale: 'es' }));
    expect(source).toContain('pass');
  });
});

describe('emitted lines map back to their statement', () => {
  it('tags each line with the node that produced it', () => {
    const sayId = createId();
    const body: Statement[] = [{ id: sayId, kind: 'say', value: literal('hola', 'text') }];
    for (const target of ['natural', 'pseudocode', 'javascript', 'python'] as const) {
      const lines = emitters[target].emit(wrap(body), { locale: 'es' });
      expect(lines.some((line) => line.nodeId === sayId)).toBe(true);
    }
  });
});
