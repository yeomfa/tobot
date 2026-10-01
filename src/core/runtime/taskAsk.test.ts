import { describe, expect, it } from 'vitest';

import { createId, literal, variable } from '../ast/factory';
import type { Statement } from '../ast/types';
import { runToEnd, spokenLines } from './headless';

/**
 * A question asked from inside an async function.
 *
 * Two faults met here. The answer was written after the task's scopes had been
 * swapped back out, so a variable the task created landed in the main program
 * instead — where the task could no longer see it. And answering the last
 * question ended the program by looking at the main stack alone, so a task with
 * work still to do was cut off before doing it.
 */
describe('a question asked by an async task', () => {
  const tarea: Statement = {
    id: createId(),
    kind: 'function',
    name: 'tarea',
    params: [],
    isAsync: true,
    body: [
      {
        id: createId(),
        kind: 'ask',
        prompt: literal('¿Nombre?', 'text'),
        target: 'respuesta',
        expect: 'text',
      },
      { id: createId(), kind: 'say', value: variable('respuesta') },
    ],
  };
  const program: Statement[] = [tarea, { id: createId(), kind: 'call', name: 'tarea', args: [] }];

  it('lets the task read the answer it asked for', () => {
    const state = runToEnd(program, ['Ana']);
    expect(state.status).toBe('finished');
    expect(spokenLines(state)).toEqual(['Ana']);
  });

  it('does not end the program while the task still has work', () => {
    // Before, this finished on the answer and the task's `say` never ran.
    const state = runToEnd(program, ['Ana']);
    expect(state.error).toBeNull();
    expect(spokenLines(state)).toContain('Ana');
  });
});
