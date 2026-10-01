import { describe, expect, it } from 'vitest';

import { literal } from '../ast/factory';
import type { Algorithm, Expression, Statement } from '../ast/types';
import { emitters, renderLines } from '.';

const call = (name: string, args: Expression[]): Expression => ({ kind: 'call', name, args });
const program: Statement[] = [
  { id: 'a', kind: 'call', name: 'turnOn', args: [literal('motor')] } as Statement,
  { id: 'b', kind: 'call', name: 'wait', args: [literal(3)] } as Statement,
  {
    id: 'c',
    kind: 'if',
    condition: call('read', [literal('stop')]),
    then: [{ id: 'd', kind: 'call', name: 'turnOff', args: [literal('motor')] } as Statement],
  } as Statement,
];

const algorithm = (world: boolean): Algorithm => ({
  id: 'alg_test',
  name: 'Test',
  body: program,
  createdAt: '',
  updatedAt: '',
  world: world
    ? {
        template: 'test',
        duration: 10,
        components: [
          { id: 'stop', role: 'input', skin: 'pushbutton', label: 'Stop' },
          { id: 'motor', role: 'output', skin: 'motor', label: 'Motor' },
        ],
      }
    : undefined,
});

const text = (target: keyof typeof emitters, locale: 'es' | 'en', world = true) =>
  renderLines(emitters[target].emit(algorithm(world), { locale }));

describe('world calls in every view', () => {
  it('are named in the interface language in code', () => {
    expect(text('javascript', 'es')).toContain('encender("motor");');
    expect(text('javascript', 'es')).toContain('if (leer("stop")) {');
    expect(text('javascript', 'en')).toContain('turnOn("motor");');
    expect(text('python', 'es')).toContain('esperar(3)');
  });

  it('read as instructions in pseudocode, without CALL', () => {
    expect(text('pseudocode', 'es')).toContain('encender("motor")');
    expect(text('pseudocode', 'es')).not.toContain('LLAMAR encender');
  });

  it('read as what they do in prose', () => {
    const prose = text('natural', 'es');
    expect(prose).toContain('Enciende «motor».');
    expect(prose).toContain('Espera 3 segundos.');
    expect(prose).toContain('«stop» está activo');
    expect(text('natural', 'en')).toContain('Switch «motor» on.');
  });

  it('are left exactly as written without a world', () => {
    expect(text('javascript', 'es', false)).toContain('turnOn("motor");');
    expect(text('natural', 'es', false)).toContain('Haz la tarea «turnOn»');
  });
});
