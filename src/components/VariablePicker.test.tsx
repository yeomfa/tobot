import { describe, expect, it } from 'vitest';

import { createStatement, PLACEHOLDER_NAME } from '../core/ast/factory';
import { collectVariables } from '../core/ast/operations';

/*
  The list a VariablePicker offers, extracted so it can be checked without a
  DOM. The rule is easy to get wrong in either direction: hide a name the
  student typed and they cannot see what is broken; offer a name nobody wrote
  and the list claims a variable exists that does not.
*/
function optionsFor(value: string, variables: string[]): string[] {
  const dangling = value !== '' && !variables.includes(value);
  return [...(dangling ? [value] : []), ...variables];
}

describe('variable options', () => {
  it('offers nothing when nothing is declared', () => {
    expect(optionsFor('', [])).toEqual([]);
  });

  it('keeps a name the student typed that no longer exists', () => {
    expect(optionsFor('total', ['nota'])).toEqual(['total', 'nota']);
  });

  it('does not repeat a name that is in scope', () => {
    expect(optionsFor('nota', ['nombre', 'nota'])).toEqual(['nombre', 'nota']);
  });
});

describe('new statements declare nothing', () => {
  /*
    The reported bug: adding "crear variable" put an `x` in scope that nobody
    had written, so every other block then offered it — correctly, by then it
    really was a declared variable. Filtering it at the picker only hid half of
    that; the name was still in the code and in the natural-language view.
  */
  it('starts unnamed', () => {
    expect(PLACEHOLDER_NAME).toBe('');
  });

  it('puts no variable in scope until the student names one', () => {
    for (const kind of ['declare', 'ask', 'assign'] as const) {
      expect(collectVariables([createStatement(kind)])).toEqual([]);
    }
  });

  it('does put one in scope once it is named', () => {
    const declared = { ...createStatement('declare'), name: 'nota' };
    expect(collectVariables([declared])).toEqual(['nota']);
  });

  it('still gives a loop its counter', () => {
    // `forEach` genuinely creates a variable, so its default is a real name.
    expect(collectVariables([createStatement('forEach')])).toEqual(['i']);
  });
});
