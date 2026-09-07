import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { welcomeAlgorithm } from '../src/content/examples';
import { createId, literal, variable } from '../src/core/ast/factory';
import type { Algorithm, Expression, Statement } from '../src/core/ast/types';
import { pythonEmitter } from '../src/core/emitters/python';
import { renderLines } from '../src/core/emitters/types';
import { Interpreter } from '../src/core/runtime/interpreter';

/**
 * Runs Tobot's generated Python under a real interpreter.
 *
 * Every other emitter test asserts on the text produced, which will happily
 * pass against a program Python refuses to run — and that is exactly the shape
 * of the bug this guards: `print("Cuenta atrás: " + i)` reads perfectly well
 * and raises `TypeError: can only concatenate str (not "int") to str`.
 *
 * It lives here rather than beside the emitter because `src/core` imports
 * neither the DOM nor Node — that is what lets it be reasoned about and run
 * anywhere — and spawning a subprocess from a test in there would quietly end
 * that. Node's own types are available outside `src`.
 *
 * Skipped where no interpreter is installed: Python is not a dependency of
 * this project, and a missing one is not a failing build.
 */
const hasPython = (() => {
  try {
    execFileSync('python3', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

function emit(locale: 'es' | 'en'): string {
  return renderLines(pythonEmitter.emit(welcomeAlgorithm(locale), { locale }), '    ');
}

describe('the Python Tobot generates', () => {
  it('wraps a number joined onto text, which Python will not concatenate', () => {
    expect(emit('es')).toContain('str(i)');
  });

  it('leaves a text variable alone, since it is already a string', () => {
    expect(emit('es')).toContain('print("Hola, " + nombre)');
  });

  for (const locale of ['es', 'en'] as const) {
    it.skipIf(!hasPython)(`runs to completion in ${locale}`, () => {
      const file = join(mkdtempSync(join(tmpdir(), 'tobot-py-')), 'welcome.py');
      writeFileSync(file, `${emit(locale)}\n`);
      // Two answers, for the two `input()` calls the welcome algorithm makes.
      const out = execFileSync('python3', [file], { input: 'Ana\n4.5\n', encoding: 'utf8' });
      expect(out.length).toBeGreaterThan(0);
    });
  }

  it.skipIf(!hasPython)('prints the countdown, which is where it used to die', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'tobot-py-')), 'welcome.py');
    writeFileSync(file, `${emit('es')}\n`);
    const out = execFileSync('python3', [file], { input: 'Ana\n4.5\n', encoding: 'utf8' });
    expect(out).toContain('Hola, Ana');
    expect(out).toContain('Cuenta atrás: 3');
  });
});

/*
  Lists, run for real and compared against the robot.

  Two languages disagree about lists in ways that read fine on the page:
  Python's `sort` raises `TypeError` on a mixed list where the robot falls back
  to text, and `del` versus `splice` differ at the edges. Executing both and
  comparing is the only check that notices.
*/
const id = (): string => createId();
const num = (n: number): Expression => literal(n, 'number');
const text = (t: string): Expression => literal(t, 'text');
const listOf = (...items: Expression[]): Expression => ({ kind: 'list', items });
const declare = (name: string, value: Expression): Statement =>
  ({ id: id(), kind: 'declare', name, valueKind: 'number', value }) as Statement;
const say = (value: Expression): Statement => ({ id: id(), kind: 'say', value }) as Statement;

function wrap(body: Statement[]): Algorithm {
  return { id: 'a', name: 'test', body, createdAt: '', updatedAt: '' };
}

/** What the robot says. */
function spoken(body: Statement[]): string[] {
  const machine = new Interpreter(body);
  let state = machine.getState();
  let guard = 0;
  while (state.status !== 'finished' && state.status !== 'error') {
    if (guard++ > 5000) throw new Error('program did not terminate');
    state = machine.step();
  }
  if (state.status === 'error') throw new Error(state.error?.messageKey ?? 'unknown');
  return state.output.filter((entry) => entry.kind === 'say').map((entry) => entry.text);
}

/** What python3 prints, normalised to the way the robot writes a list. */
function fromPython(body: Statement[]): string[] {
  const code = renderLines(pythonEmitter.emit(wrap(body), { locale: 'es' }), '    ');
  const file = join(mkdtempSync(join(tmpdir(), 'tobot-py-')), 'program.py');
  writeFileSync(file, `${code}\n`);
  const out = execFileSync('python3', [file], { encoding: 'utf8' });
  return out
    .trim()
    .split('\n')
    .filter((entry) => entry.length > 0)
    // Python prints `['ana', 'pera']`; the robot says `[ana, pera]`.
    .map((entry) => entry.replace(/'/g, ''));
}

describe.skipIf(!hasPython)('lists: the robot and the emitted Python agree', () => {
  const op = (operation: string, name: string, extra: Record<string, unknown> = {}): Statement =>
    ({ id: id(), kind: 'listOp', operation, name, ...extra }) as Statement;

  const cases: Array<[string, Statement[]]> = [
    ['a literal list', [declare('n', listOf(num(1), num(2), num(3))), say(variable('n'))]],
    [
      'an element by position',
      [declare('n', listOf(num(10), num(20))), say({ kind: 'index', list: variable('n'), index: num(1) })],
    ],
    [
      'how many it holds',
      [declare('n', listOf(num(1), num(2), num(3))), say({ kind: 'length', list: variable('n') })],
    ],
    [
      'writing one element',
      [
        declare('n', listOf(num(1), num(2))),
        { id: id(), kind: 'assign', name: 'n', index: num(0), value: num(9) } as Statement,
        say(variable('n')),
      ],
    ],
    [
      'appending',
      [declare('n', listOf(num(1))), op('append', 'n', { value: num(2) }), say(variable('n'))],
    ],
    [
      'inserting',
      [
        declare('n', listOf(num(1), num(3))),
        op('insert', 'n', { value: num(2), index: num(1) }),
        say(variable('n')),
      ],
    ],
    [
      'removing',
      [
        declare('n', listOf(num(1), num(2), num(3))),
        op('removeAt', 'n', { index: num(1) }),
        say(variable('n')),
      ],
    ],
    [
      'sorting numbers',
      [declare('n', listOf(num(10), num(2), num(33))), op('sort', 'n'), say(variable('n'))],
    ],
    [
      'sorting largest first',
      [
        declare('n', listOf(num(2), num(10), num(33))),
        op('sort', 'n', { descending: true }),
        say(variable('n')),
      ],
    ],
    [
      'sorting text',
      [
        declare('n', listOf(text('pera'), text('ana'), text('uva'))),
        op('sort', 'n'),
        say(variable('n')),
      ],
    ],
    [
      'reversing',
      [declare('n', listOf(num(1), num(2), num(3))), op('reverse', 'n'), say(variable('n'))],
    ],
    [
      'visiting every element',
      [
        declare('n', listOf(num(1), num(2), num(3))),
        {
          id: id(), kind: 'forEachItem', variable: 'x', list: variable('n'),
          body: [say(variable('x'))],
        } as Statement,
      ],
    ],
    [
      'a list joined onto text, which Python will not concatenate',
      [
        declare('n', listOf(num(1), num(2))),
        say({ kind: 'binary', operator: '+', left: text('Notas: '), right: variable('n') }),
      ],
    ],
  ];

  for (const [label, body] of cases) {
    it(label, () => {
      expect(fromPython(body)).toEqual(spoken(body));
    });
  }
});
