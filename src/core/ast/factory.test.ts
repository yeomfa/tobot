import { describe, expect, it } from 'vitest';

import { castExpression, literal, variable } from './factory';

/**
 * Changing a variable's declared type has to carry the value across with it.
 * Before this, the input kept editing the old type, so choosing "number"
 * looked like it did nothing at all.
 */
describe('castExpression', () => {
  it('reads digits typed as text as a real number', () => {
    expect(castExpression(literal('42', 'text'), 'number')).toEqual(literal(42, 'number'));
  });

  it('keeps decimals and negatives', () => {
    expect(castExpression(literal('-3.5', 'text'), 'number')).toEqual(literal(-3.5, 'number'));
  });

  it('falls back to zero for text that is not a number', () => {
    expect(castExpression(literal('hola', 'text'), 'number')).toEqual(literal(0, 'number'));
  });

  it('does not invent a zero for an empty field', () => {
    // Number('') is 0, which would look like a value the student never typed.
    expect(castExpression(literal('', 'text'), 'number')).toEqual(literal(0, 'number'));
  });

  it('turns any value into its own text', () => {
    expect(castExpression(literal(42, 'number'), 'text')).toEqual(literal('42', 'text'));
    expect(castExpression(literal(true, 'boolean'), 'text')).toEqual(literal('true', 'text'));
  });

  it('recognises the words the interface itself displays', () => {
    expect(castExpression(literal('verdadero', 'text'), 'boolean')).toEqual(
      literal(true, 'boolean'),
    );
    expect(castExpression(literal('false', 'text'), 'boolean')).toEqual(literal(false, 'boolean'));
    expect(castExpression(literal('Sí', 'text'), 'boolean')).toEqual(literal(true, 'boolean'));
  });

  it('reads zero as false and anything else as true', () => {
    expect(castExpression(literal(0, 'number'), 'boolean')).toEqual(literal(false, 'boolean'));
    expect(castExpression(literal(7, 'number'), 'boolean')).toEqual(literal(true, 'boolean'));
  });

  it('leaves a value alone when the type has not changed', () => {
    const original = literal('hola', 'text');
    expect(castExpression(original, 'text')).toBe(original);
  });

  it('leaves expressions that are not literals untouched', () => {
    // A variable reference has no type of its own to rewrite; validation is
    // what reports a mismatch there.
    const reference = variable('edad');
    expect(castExpression(reference, 'number')).toBe(reference);
  });
});
