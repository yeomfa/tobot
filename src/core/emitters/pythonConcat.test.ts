import { describe, expect, it } from 'vitest';

import { createStatement, literal, variable } from '../ast/factory';
import type { Algorithm, Statement } from '../ast/types';
import { pythonEmitter } from './python';
import { renderLines } from './types';

function program(...body: Statement[]): Algorithm {
  return { id: 'a', name: 'test', body, createdAt: '', updatedAt: '' };
}

function emit(...body: Statement[]): string {
  // Python is the one target whose output does not depend on the locale, so
  // the context is only here to satisfy the shared emitter signature.
  return renderLines(pythonEmitter.emit(program(...body), { locale: 'es' }), '    ');
}

const declare = (name: string, kind: 'number' | 'text' | 'boolean', value: Statement['id'] extends never ? never : ReturnType<typeof literal>): Statement =>
  ({ ...createStatement('declare'), name, valueKind: kind, value }) as Statement;

/**
 * Python will not add a number to a string, so a concatenation the student can
 * read on screen used to be code they could not run: `print("Nota: " + nota)`
 * raises `TypeError: can only concatenate str (not "float") to str`.
 */
describe('python string concatenation', () => {
  it('wraps a number variable in str() when concatenated with text', () => {
    const code = emit(
      declare('nota', 'number', literal(4, 'number')),
      { ...createStatement('say'), value: { kind: 'binary', operator: '+', left: literal('Nota: ', 'text'), right: variable('nota') } } as Statement,
    );
    expect(code).toContain('print("Nota: " + str(nota))');
  });

  it('leaves a text variable alone — it is already a string', () => {
    const code = emit(
      declare('nombre', 'text', literal('Ana', 'text')),
      { ...createStatement('say'), value: { kind: 'binary', operator: '+', left: literal('Hola, ', 'text'), right: variable('nombre') } } as Statement,
    );
    expect(code).toContain('print("Hola, " + nombre)');
    expect(code).not.toContain('str(nombre)');
  });

  it('does not touch arithmetic between two numbers', () => {
    const code = emit(
      declare('a', 'number', literal(1, 'number')),
      declare('b', 'number', literal(2, 'number')),
      { ...createStatement('say'), value: { kind: 'binary', operator: '+', left: variable('a'), right: variable('b') } } as Statement,
    );
    expect(code).toContain('print(a + b)');
    expect(code).not.toContain('str(');
  });

  it('converts a number that is added on the left of text', () => {
    const code = emit(
      declare('n', 'number', literal(3, 'number')),
      { ...createStatement('say'), value: { kind: 'binary', operator: '+', left: variable('n'), right: literal(' puntos', 'text') } } as Statement,
    );
    expect(code).toContain('print(str(n) + " puntos")');
  });

  it('handles a three-part chain, converting only what needs it', () => {
    const chain = {
      kind: 'binary' as const,
      operator: '+' as const,
      left: { kind: 'binary' as const, operator: '+' as const, left: literal('Hola ', 'text'), right: variable('nombre') },
      right: variable('edad'),
    };
    const code = emit(
      declare('nombre', 'text', literal('Ana', 'text')),
      declare('edad', 'number', literal(20, 'number')),
      { ...createStatement('say'), value: chain } as Statement,
    );
    expect(code).toContain('print("Hola " + nombre + str(edad))');
  });

  it('converts an arithmetic subexpression joined onto text', () => {
    // `"Total: " + (a * b)` — the product is a number and needs converting as
    // one unit, not operand by operand.
    const code = emit(
      declare('a', 'number', literal(2, 'number')),
      declare('b', 'number', literal(3, 'number')),
      {
        ...createStatement('say'),
        value: {
          kind: 'binary', operator: '+',
          left: literal('Total: ', 'text'),
          right: { kind: 'binary', operator: '*', left: variable('a'), right: variable('b') },
        },
      } as Statement,
    );
    expect(code).toContain('print("Total: " + str(a * b))');
  });

  it('converts a variable that came from `preguntar` as a number', () => {
    const code = emit(
      { ...createStatement('ask'), target: 'edad', expect: 'number', prompt: literal('¿Edad?', 'text') } as Statement,
      { ...createStatement('say'), value: { kind: 'binary', operator: '+', left: literal('Tienes ', 'text'), right: variable('edad') } } as Statement,
    );
    expect(code).toContain('str(edad)');
  });

  it('converts a loop counter, which is always a number', () => {
    const loop = {
      ...createStatement('forEach'),
      variable: 'i',
      from: literal(1, 'number'),
      to: literal(3, 'number'),
      step: literal(1, 'number'),
      body: [
        { ...createStatement('say'), value: { kind: 'binary', operator: '+', left: literal('Vuelta ', 'text'), right: variable('i') } } as Statement,
      ],
    } as Statement;
    expect(emit(loop)).toContain('print("Vuelta " + str(i))');
  });

  it('converts an unknown variable rather than risk the error', () => {
    // Never declared: `str()` is harmless on a string and is the only choice
    // that cannot raise.
    const code = emit(
      { ...createStatement('say'), value: { kind: 'binary', operator: '+', left: literal('x: ', 'text'), right: variable('x') } } as Statement,
    );
    expect(code).toContain('str(x)');
  });

  it('keeps a group readable rather than double-wrapping it', () => {
    const code = emit(
      declare('a', 'number', literal(1, 'number')),
      {
        ...createStatement('say'),
        value: {
          kind: 'binary', operator: '+',
          left: literal('v: ', 'text'),
          right: { kind: 'group', inner: { kind: 'binary', operator: '+', left: variable('a'), right: literal(1, 'number') } },
        },
      } as Statement,
    );
    expect(code).toContain('str(a + 1)');
    expect(code).not.toContain('str((');
  });
});
