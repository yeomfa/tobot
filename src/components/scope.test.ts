import { describe, expect, it } from 'vitest';

/**
 * The dropdown inside a loop body puts the loop counter first.
 *
 * This is the ordering the block applies when it hands `variables` down to its
 * body: whatever the program declared, the name the loop introduced leads,
 * because inside a loop that is what a student reaches for. Nesting composes,
 * since each loop promotes its own counter as the tree is walked.
 */
function promote(counter: string, variables: string[]): string[] {
  return [counter, ...variables.filter((name) => name !== counter)];
}

describe('variables offered inside a loop', () => {
  const program = ['total', 'nombre', 'i'];

  it('puts the loop counter first, not wherever it was declared', () => {
    expect(promote('i', program)).toEqual(['i', 'total', 'nombre']);
  });

  it('does not list the counter twice', () => {
    expect(promote('i', program).filter((name) => name === 'i')).toHaveLength(1);
  });

  it('keeps the remaining names in document order', () => {
    expect(promote('i', program).slice(1)).toEqual(['total', 'nombre']);
  });

  it('offers the innermost counter first when loops nest', () => {
    // The outer loop promotes `i`, then the inner one promotes `j` on top.
    const outer = promote('i', [...program, 'j']);
    expect(promote('j', outer)).toEqual(['j', 'i', 'total', 'nombre']);
  });

  it('still offers a counter that was never declared elsewhere', () => {
    expect(promote('k', ['total'])).toEqual(['k', 'total']);
  });
});
