import { describe, expect, it } from 'vitest';

import { findProblems } from './diagnostics';

/**
 * Asking is a promise on this surface, so the missing `await` is the one
 * mistake that costs nothing to make and says nothing when made: the program
 * runs, prints `NaN`, and blames the student's arithmetic.
 */
describe('spotting a question nobody waited for', () => {
  it('marks a bare call', () => {
    expect(findProblems('const nombre = prompt("¿Cómo te llamas?");')).toEqual([
      { from: 15, to: 21, messageKey: 'code.missingAwait' },
    ]);
  });

  it('marks both names, since both hand back a promise', () => {
    expect(findProblems('ask("a");\nprompt("b");').map((problem) => problem.messageKey)).toEqual([
      'code.missingAwait',
      'code.missingAwait',
    ]);
  });

  it('says nothing when the answer was waited for', () => {
    expect(findProblems('const nombre = await prompt("¿Cómo te llamas?");')).toEqual([]);
    expect(findProblems('const edad = Number(await ask("¿Edad?"));')).toEqual([]);
  });

  it('leaves alone a method that happens to share the name', () => {
    expect(findProblems('formulario.prompt("hola");')).toEqual([]);
  });

  it('does not mark what is only being said', () => {
    expect(findProblems('console.log("usa prompt( para preguntar");')).toEqual([]);
  });

  it('does not mark a line that was commented out', () => {
    expect(findProblems('// const x = prompt("luego");')).toEqual([]);
  });

  it('still marks a call that comes after a finished string', () => {
    expect(findProblems('console.log("hola"); const x = prompt("¿y tú?");')).toHaveLength(1);
  });

  // The counter remembers which quote opened, so an apostrophe inside double
  // quotes is text rather than the start of a string. Without that, every call
  // after an English contraction would go unmarked.
  it('is not fooled by an apostrophe inside a double-quoted string', () => {
    expect(findProblems(`console.log("it's fine"); const x = prompt("name");`)).toHaveLength(1);
  });

  it('does stay quiet inside a string that is still open', () => {
    expect(findProblems(`const aviso = 'escribe prompt( para preguntar`)).toHaveLength(0);
  });
});

/**
 * The other mistake that says nothing.
 *
 * `if (nota = 5)` assigns, reads back 5, and takes the branch every time — and
 * destroys the variable on the way. No error, and a program that does
 * something plausible enough to send the student looking anywhere else.
 */
describe('spotting an assignment where a comparison was meant', () => {
  it('marks it in an if', () => {
    const [problem] = findProblems('if (nota = 5) { console.log("hola"); }');
    expect(problem?.messageKey).toBe('code.assignInCondition');
  });

  it('marks it in a while', () => {
    expect(findProblems('while (x = 3) {}')).toHaveLength(1);
  });

  it('leaves every real comparison alone', () => {
    expect(findProblems('if (nota == 5) {}')).toEqual([]);
    expect(findProblems('if (nota === 5) {}')).toEqual([]);
    expect(findProblems('if (nota != 5) {}')).toEqual([]);
    expect(findProblems('if (nota !== 5) {}')).toEqual([]);
    expect(findProblems('if (nota >= 5) {}')).toEqual([]);
    expect(findProblems('if (nota <= 5) {}')).toEqual([]);
  });

  it('does not reach past the condition into the body', () => {
    expect(findProblems('if (a === 1) { const b = 2; }')).toEqual([]);
  });

  it('leaves alone an assignment in a counted loop, which is meant', () => {
    expect(findProblems('for (let i = 0; i < 3; i++) {}')).toEqual([]);
  });
});

/**
 * Marks on correct code are worse than missing marks.
 *
 * A student who is told their working program is wrong learns to stop reading
 * the marks, and then the one real warning goes unread too.
 */
describe('not marking code that is right', () => {
  it('leaves an equals sign inside a string alone', () => {
    expect(findProblems('if (respuesta === "si=no") {}')).toEqual([]);
  });

  it('does not read a callback arrow as an assignment', () => {
    expect(findProblems('if (nombres.some((n) => n === "ana")) {}')).toEqual([]);
  });

  // Mid-edit, with a bracket deleted, the walk used to run to the end of the
  // file and blame the first assignment it met down there.
  it('stops at the body rather than walking the rest of the file', () => {
    expect(findProblems('if (a === 1 {\n  const total = 2;\n}')).toEqual([]);
  });

  it('still marks the real thing when a string is nearby', () => {
    expect(findProblems('if (nota = 5) { console.log("a=b"); }')).toHaveLength(1);
  });
});
