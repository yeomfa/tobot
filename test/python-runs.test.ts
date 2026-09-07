import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { welcomeAlgorithm } from '../src/content/examples';
import { pythonEmitter } from '../src/core/emitters/python';
import { renderLines } from '../src/core/emitters/types';

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
