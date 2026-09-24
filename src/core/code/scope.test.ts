import { describe, expect, it } from 'vitest';

import { topLevelNames } from './scope';

describe('finding what a program declares at its top level', () => {
  it('reads the three ways of declaring', () => {
    expect(topLevelNames('const a = 1;\nlet b = 2;\nvar c = 3;')).toEqual(['a', 'b', 'c']);
  });

  it('counts a function as a name, because it is one', () => {
    expect(topLevelNames('function saludar(nombre) {}')).toEqual(['saludar']);
  });

  /*
    The point of tracking depth. A name inside a loop or a function is gone by
    the time anything asks for it, and reporting it would describe a scope the
    student is not standing in.
  */
  it('ignores what is declared inside a block', () => {
    expect(topLevelNames('const total = 0;\nfor (let i = 0; i < 3; i++) {\n  const x = i;\n}')).toEqual(
      ['total'],
    );
  });

  it('ignores a parameter, which belongs to its function', () => {
    expect(topLevelNames('function f(a, b) { const inner = 1; }\nconst fuera = 2;')).toEqual([
      'f',
      'fuera',
    ]);
  });

  it('is not fooled by a declaration inside a string', () => {
    expect(topLevelNames('console.log("const trampa = 1");\nconst real = 2;')).toEqual(['real']);
  });

  it('is not fooled by one inside a comment', () => {
    expect(topLevelNames('// const viejo = 1;\nconst nuevo = 2;')).toEqual(['nuevo']);
    expect(topLevelNames('/* const a = 1;\n   let b = 2; */\nconst c = 3;')).toEqual(['c']);
  });

  it('does not see a keyword buried in a longer word', () => {
    expect(topLevelNames('const constante = 1;')).toEqual(['constante']);
    expect(topLevelNames('miconst x = 1;')).toEqual([]);
  });

  it('reports each name once even when reassigned', () => {
    expect(topLevelNames('let x = 1;\nx = 2;\nlet x2 = 3;')).toEqual(['x', 'x2']);
  });

  it('has nothing to say about a program that declares nothing', () => {
    expect(topLevelNames('console.log("hola");')).toEqual([]);
  });
});
