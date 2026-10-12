import { describe, expect, it } from 'vitest';

import { formatSource } from './format';

describe('formatting a program', () => {
  it('lays out spacing, quotes and semicolons', async () => {
    const outcome = await formatSource("let x=1\nif(x>0){console.log('si')}", 0);
    expect(outcome).toEqual({
      ok: true,
      source: 'let x = 1;\nif (x > 0) {\n  console.log("si");\n}\n',
      cursor: 0,
    });
  });

  it('accepts the top-level await a question needs', async () => {
    const outcome = await formatSource('const n=Number(await prompt("¿Cuántos?"))', 0);
    expect(outcome.ok && outcome.source).toBe('const n = Number(await prompt("¿Cuántos?"));\n');
  });

  it('keeps the cursor beside the same code', async () => {
    const source = 'let  total=0';
    const outcome = await formatSource(source, source.indexOf('total'));
    expect(outcome.ok && outcome.source.slice(outcome.cursor, outcome.cursor + 5)).toBe('total');
  });

  it('names the line it cannot read', async () => {
    const outcome = await formatSource('let x = 1;\nconsole.log(;\n', 0);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.line).toBe(2);
  });
});
