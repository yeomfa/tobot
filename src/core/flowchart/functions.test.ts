import { describe, expect, it } from 'vitest';

import { createStatement, literal } from '../ast/factory';
import type { Statement } from '../ast/types';
import { es } from '../../i18n/es';
import type { Dictionary } from '../../i18n/es';
import { createFlowLabels } from './labels';
import { layoutProgram, layoutProgramStacked } from './layout';

const labels = createFlowLabels(es as Dictionary, 'es');

const say = (text: string): Statement =>
  ({ ...createStatement('say'), value: literal(text, 'text') }) as Statement;

const fn = (name: string, params: string[], body: Statement[]): Statement =>
  ({
    ...createStatement('function'),
    name,
    params: params.map((param) => ({ name: param, type: 'number' as const })),
    body,
  }) as Statement;

const callStatement = (name: string): Statement =>
  ({ ...createStatement('call'), name, args: [] }) as Statement;

/**
 * A function is a second entry point: it begins when it is called and ends
 * when it returns. Drawing it inline in the main flow says it happens where
 * it is written, which is not true of any function ever written.
 */
describe('a function gets its own diagram', () => {
  const program: Statement[] = [
    fn('saludar', ['nombre'], [say('hola')]),
    callStatement('saludar'),
  ];

  it('separates the function from the main program', () => {
    const parts = layoutProgram(program, labels);
    expect(parts.functions).toHaveLength(1);
    expect(parts.functions[0].name).toBe('saludar');
  });

  it('keeps the function out of the main flow', () => {
    const parts = layoutProgram(program, labels);
    /* The definition is lifted, so the main chart holds the call and the two
       terminals — and no box for a block that does nothing when reached. */
    const texts = parts.main.nodes.map((node) => node.text);
    expect(texts.some((text) => /FUNCIÓN/.test(text))).toBe(false);
  });

  it('gives each diagram its own start and end', () => {
    const parts = layoutProgram(program, labels);
    const terminals = (nodes: { shape: string }[]) =>
      nodes.filter((node) => node.shape === 'terminal').length;
    expect(terminals(parts.main.nodes)).toBeGreaterThanOrEqual(2);
    expect(terminals(parts.functions[0].layout.nodes)).toBeGreaterThanOrEqual(2);
  });

  it('draws the call as a subprocess, not an ordinary step', () => {
    const parts = layoutProgram(program, labels);
    expect(parts.main.nodes.some((node) => node.shape === 'subprocess')).toBe(true);
  });

  it('lifts a function declared inside a branch', () => {
    const branch = {
      ...createStatement('if'),
      then: [fn('interna', [], [say('x')])],
    } as Statement;
    expect(layoutProgram([branch], labels).functions).toHaveLength(1);
  });
});

describe('stacked into one drawing', () => {
  const program: Statement[] = [
    fn('saludar', ['nombre'], [say('hola')]),
    callStatement('saludar'),
  ];

  it('is taller than the main program alone', () => {
    const stacked = layoutProgramStacked(program, labels);
    const main = layoutProgram(program, labels).main;
    expect(stacked.height).toBeGreaterThan(main.height);
  });

  it('captions each function with its signature', () => {
    const stacked = layoutProgramStacked(program, labels);
    expect(stacked.nodes.some((node) => node.text === 'saludar(nombre)')).toBe(true);
  });

  it('keeps every node inside the reported bounds', () => {
    const stacked = layoutProgramStacked(program, labels);
    for (const node of stacked.nodes) {
      expect(node.y + node.height).toBeLessThanOrEqual(stacked.height);
      expect(node.x + node.width).toBeLessThanOrEqual(stacked.width + 1);
    }
  });

  it('does not overlap the function with the main program', () => {
    const stacked = layoutProgramStacked(program, labels);
    const main = layoutProgram(program, labels).main;
    const below = stacked.nodes.filter((node) => node.y >= main.height);
    expect(below.length).toBeGreaterThan(0);
  });

  it('is unchanged for a program with no functions', () => {
    const plain = [say('hola')];
    const stacked = layoutProgramStacked(plain, labels);
    const direct = layoutProgram(plain, labels).main;
    expect(stacked.height).toBe(direct.height);
    expect(stacked.nodes).toHaveLength(direct.nodes.length);
  });
});
