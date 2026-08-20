import { describe, expect, it } from 'vitest';

import { highlight } from './highlight';

/** The text of every token marked as a variable. */
function variablesIn(text: string, names: string[]): string[] {
  return highlight(text, 'natural', names)
    .filter((token) => token.type === 'variable')
    .map((token) => token.text);
}

describe('variables in the natural language view', () => {
  it('marks a name where the prose uses it', () => {
    expect(variablesIn('El robot dice Hola más nombre.', ['nombre'])).toEqual(['nombre']);
  });

  it('marks every use on the line', () => {
    expect(variablesIn('Cambia el valor de total a total más 1.', ['total'])).toEqual([
      'total',
      'total',
    ]);
  });

  it('leaves the ordinary word alone when no variable is declared', () => {
    // "nota" is a Spanish word; only a declared name should be marked.
    expect(variablesIn('El robot pide la nota final.', [])).toEqual([]);
  });

  it('does not mark a name inside a quoted message', () => {
    // The message is text the robot says, not a reference to the variable.
    expect(variablesIn('El robot dice «Escribe tu nombre».', ['nombre'])).toEqual([]);
  });

  it('does not match a name embedded in a longer word', () => {
    expect(variablesIn('Guarda el total en totalGeneral.', ['total'])).toEqual(['total']);
  });

  it('prefers the longest name when one contains another', () => {
    expect(variablesIn('Suma totalGeneral y total.', ['total', 'totalGeneral'])).toEqual([
      'totalGeneral',
      'total',
    ]);
  });

  it('matches a name with accents as one word', () => {
    expect(variablesIn('Guarda la respuesta en año.', ['año'])).toEqual(['año']);
  });

  it('keeps the whole sentence intact across the tokens', () => {
    const text = 'El robot pregunta «¿Cuál es tu edad?» y guarda la respuesta en edad.';
    const rebuilt = highlight(text, 'natural', ['edad'])
      .map((token) => token.text)
      .join('');
    expect(rebuilt).toBe(text);
  });

  it('still marks the step number and the quoted message', () => {
    const types = highlight('1. El robot dice «Hola» a nombre.', 'natural', ['nombre']).map(
      (token) => token.type,
    );
    expect(types).toContain('number');
    expect(types).toContain('string');
    expect(types).toContain('variable');
  });
});
