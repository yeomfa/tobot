import { describe, expect, it } from 'vitest';

import { categoryClass, categoryFor } from './categories';

/**
 * The block editor's promise, kept in text: a loop should be recognisable by
 * its hue before the keyword is read.
 */
describe('which topic a piece of code belongs to', () => {
  it('reads a conditional as a conditional', () => {
    expect(categoryFor('if', 'if')).toBe('conditionals');
    expect(categoryFor('else', 'else')).toBe('conditionals');
  });

  it('reads both loops the same way, however they are spelled', () => {
    expect(categoryFor('while', 'while')).toBe('loops');
    expect(categoryFor('for', 'for')).toBe('loops');
  });

  it('reads a declaration as a variable', () => {
    expect(categoryFor('const', 'const')).toBe('variables');
    expect(categoryFor('let', 'let')).toBe('variables');
  });

  it('reads saying and asking as input and output', () => {
    expect(categoryFor('PropertyName', 'log')).toBe('io');
    expect(categoryFor('VariableName', 'prompt')).toBe('io');
    expect(categoryFor('VariableName', 'ask')).toBe('io');
  });

  /*
    A student's own function has no topic. Giving it one would colour it at
    random, which is worse than leaving it plain — the colours only mean
    something while they mean one thing.
  */
  it('leaves a name it does not teach uncoloured', () => {
    expect(categoryFor('VariableName', 'calcularArea')).toBeNull();
    expect(categoryFor('VariableName', 'total')).toBeNull();
  });

  it('prefers the keyword reading when a node is one', () => {
    expect(categoryFor('function', 'function')).toBe('functions');
  });

  it('names a class per category', () => {
    expect(categoryClass('loops')).toBe('cm-cat-loops');
  });
});
