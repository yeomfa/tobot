import { describe, expect, it } from 'vitest';

import { createId, literal, variable } from './ast/factory';
import type { Algorithm, BinaryOperator, Expression, Statement } from './ast/types';
import { emitters, renderLines } from './emitters';
import { runToEnd } from './runtime/headless';
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

/* Runs a program to completion, feeding `answers` to each `ask` in order.
   It lives in `runtime/headless.ts` now, because marking a classroom's work
   needs the same driver and one copy is easier to keep honest than two. */
const run = runToEnd;

/**
 * Executes emitted JavaScript in a sandbox, capturing console output.
 *
 * Wrapped in an async function, and awaited, because that is how the emitted
 * program actually runs: asking waits, so `ask` emits `await prompt(...)` and
 * the whole program needs a context that allows it. The worker that runs a
 * code document wraps it exactly this way, so this harness is now checking the
 * arrangement it ships in rather than a simpler one it does not.
 */
async function runEmittedJs(body: Statement[], answers: string[] = []): Promise<string[]> {
  const source = renderLines(emitters.javascript.emit(wrap(body), { locale: 'es' }));
  const logged: string[] = [];
  const pending = [...answers];
  const sandbox = new Function(
    'prompt',
    'console',
    `return (async () => {\n${source}\n})();`,
  ) as (prompt: unknown, console: unknown) => Promise<void>;

  await sandbox(
    () => Promise.resolve(pending.shift() ?? ''),
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
    expect(() =>
      new Function('prompt', 'console', `return (async () => {\n${source}\n})();`),
    ).not.toThrow();
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

  it('produces identical output for the same answers', async () => {
    const interpreted = spoken(run(program, ['4.5']));
    const executed = await runEmittedJs(program, ['4.5']);
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

describe('comments', () => {
  const withComment: Statement[] = [
    { id: createId(), kind: 'comment', text: 'Pide la altura' },
    { id: createId(), kind: 'say', value: literal('hola', 'text') },
  ];

  it('runs as a no-op without affecting output', () => {
    const state = run(withComment);
    expect(state.status).toBe('finished');
    expect(spoken(state)).toEqual(['hola']);
  });

  it('emits a comment in every target language', () => {
    const algorithm = wrap(withComment);
    expect(renderLines(emitters.javascript.emit(algorithm, { locale: 'es' }))).toContain(
      '// Pide la altura',
    );
    expect(renderLines(emitters.python.emit(algorithm, { locale: 'es' }))).toContain(
      '# Pide la altura',
    );
    expect(renderLines(emitters.pseudocode.emit(algorithm, { locale: 'es' }))).toContain(
      '// Pide la altura',
    );
  });

  it('keeps emitted JavaScript valid', async () => {
    // A comment must not break the program it annotates.
    expect(await runEmittedJs(withComment)).toEqual(['hola']);
  });
});

describe('multi-line comments', () => {
  const multi: Statement[] = [
    { id: createId(), kind: 'comment', text: 'Primera línea\nSegunda línea' },
    { id: createId(), kind: 'say', value: literal('ok', 'text') },
  ];

  it('marks every line so the code stays valid', async () => {
    const js = renderLines(emitters.javascript.emit(wrap(multi), { locale: 'es' }));
    expect(js).toContain('// Primera línea');
    expect(js).toContain('// Segunda línea');
    // A bare second line would be a syntax error.
    expect(() =>
      new Function('prompt', 'console', `return (async () => {\n${js}\n})();`),
    ).not.toThrow();
    expect(await runEmittedJs(multi)).toEqual(['ok']);
  });

  it('uses one comment marker across every view', () => {
    // Natural language used an em dash, which read as a stray character
    // beside the // the other views show.
    const natural = renderLines(emitters.natural.emit(wrap(multi), { locale: 'es' }));
    expect(natural).toContain('// Primera línea');
    expect(natural).not.toContain('—');
  });

  it('marks every line in Python too', () => {
    const py = renderLines(emitters.python.emit(wrap(multi), { locale: 'es' }));
    expect(py).toContain('# Primera línea');
    expect(py).toContain('# Segunda línea');
  });
});
