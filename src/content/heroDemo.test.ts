import { describe, expect, it } from 'vitest';

import { Interpreter } from '../core/runtime/interpreter';
import type { Statement } from '../core/ast/types';
import { heroAlgorithm } from './heroDemo';

function walk(statements: Statement[]): Statement[] {
  return statements.flatMap((statement) => {
    if (statement.kind === 'if') {
      return [statement, ...walk(statement.then), ...walk(statement.otherwise ?? [])];
    }
    if ('body' in statement) {
      return [statement, ...walk((statement as { body: Statement[] }).body)];
    }
    return [statement];
  });
}

describe('the landing page demo algorithm', () => {
  it('contains no `ask`, which would hang a run with nobody at the keyboard', () => {
    // The interpreter stops at `awaitingInput` and waits. On the landing page
    // nothing ever answers, so a single `ask` freezes the demo permanently.
    const kinds = walk(heroAlgorithm('es').body).map((statement) => statement.kind);
    expect(kinds).not.toContain('ask');
  });

  it('runs to completion on its own', () => {
    const machine = new Interpreter(heroAlgorithm('es').body);

    // Generously more steps than the ~12 it needs, so a genuine hang shows up
    // as a failure here rather than as a stuck page in front of a visitor.
    let state = machine.getState();
    for (let step = 0; step < 200 && state.status !== 'finished'; step += 1) {
      state = machine.step();
    }

    expect(state.status).toBe('finished');
    expect(state.error).toBeNull();
  });

  it('says both of its messages', () => {
    const machine = new Interpreter(heroAlgorithm('es').body);
    let state = machine.getState();
    while (state.status !== 'finished') state = machine.step();

    const spoken = state.output.map((entry) => entry.text);
    expect(spoken).toContain('Hola, Ana');
    // 1 + 2 + 3 = 6, which clears the threshold of 5.
    expect(spoken).toContain('¡Lo lograste!');
  });

  it('speaks the language of whoever is reading', () => {
    const machine = new Interpreter(heroAlgorithm('en').body);
    let state = machine.getState();
    while (state.status !== 'finished') state = machine.step();

    expect(state.output.map((entry) => entry.text)).toContain('Hello, Ana');
  });

  it('keeps the same identity across calls for one language', () => {
    // `useExecution` discards its interpreter when the program's identity
    // changes, so unstable ids would restart the demo on every render.
    const first = heroAlgorithm('es');
    const second = heroAlgorithm('es');
    expect(first.body.map((s) => s.id)).toEqual(second.body.map((s) => s.id));
  });

  it('touches all four statement categories', () => {
    const kinds = new Set(walk(heroAlgorithm('es').body).map((statement) => statement.kind));
    expect(kinds).toContain('declare');
    expect(kinds).toContain('say');
    expect(kinds).toContain('forEach');
    expect(kinds).toContain('if');
  });
});
