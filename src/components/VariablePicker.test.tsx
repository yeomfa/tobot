import { describe, expect, it } from 'vitest';

import { PLACEHOLDER_NAME } from '../core/ast/factory';

/*
  The list a VariablePicker offers, extracted so it can be checked without a
  DOM. The rule it encodes is easy to get wrong in either direction: hide a
  name the student typed and they cannot see what is broken; offer the
  factory's placeholder and the list claims a variable exists that does not.
*/
function optionsFor(value: string, variables: string[], placeholder?: string): string[] {
  const chosen = value !== placeholder;
  const dangling = value !== '' && chosen && !variables.includes(value);
  return [...(dangling ? [value] : []), ...variables];
}

describe('variable options', () => {
  it('never offers the placeholder as a variable', () => {
    // The reported bug: a freshly dropped `cambiar` listed "x" as if it were
    // one, including when the algorithm had no variables at all.
    expect(optionsFor(PLACEHOLDER_NAME, [], PLACEHOLDER_NAME)).toEqual([]);
    expect(optionsFor(PLACEHOLDER_NAME, ['nota'], PLACEHOLDER_NAME)).toEqual(['nota']);
  });

  it('keeps a name the student chose that no longer exists', () => {
    // Renaming a variable elsewhere should not hide which reference broke.
    expect(optionsFor('total', ['nota'], PLACEHOLDER_NAME)).toEqual(['total', 'nota']);
  });

  it('does not repeat a name that is in scope', () => {
    expect(optionsFor('nota', ['nombre', 'nota'], PLACEHOLDER_NAME)).toEqual(['nombre', 'nota']);
  });

  it('offers only real variables when nothing is chosen yet', () => {
    expect(optionsFor('', ['a', 'b'], PLACEHOLDER_NAME)).toEqual(['a', 'b']);
  });

  it('treats a literal "x" the student picked as a real reference', () => {
    /*
      Only when it is genuinely in scope: a student may well declare `x`, and
      the placeholder check must not make their own variable disappear.
    */
    expect(optionsFor('x', ['x'], PLACEHOLDER_NAME)).toEqual(['x']);
  });
});
