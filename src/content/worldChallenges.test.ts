import { describe, expect, it } from 'vitest';

import { createId, literal } from '../core/ast/factory';
import type { Expression, Statement } from '../core/ast/types';
import { gradeBlocks, judge } from '../core/classroom/grade';
import { runSource } from '../core/code/runSource';
import { emitters, renderLines } from '../core/emitters';
import { validate } from '../core/ast/validate';
import { createWorld } from '../core/world/world';
import { challenges } from './challenges';
import { word } from './worlds';

const call = (name: string, args: Expression[]): Expression => ({ kind: 'call', name, args });
const act = (name: string, ...args: (string | number)[]): Statement => ({
  id: createId(),
  kind: 'call',
  name,
  args: args.map((arg) => literal(arg)),
});

/** What a student who has understood each one would build. */
const solutions: Record<string, (language: 'es' | 'en') => Statement[]> = {
  lamp: (language) => [act('turnOn', word(language, 'lamp'))],
  latch: (language) => [
    {
      id: createId(),
      kind: 'while',
      condition: literal(true),
      body: [
        { id: createId(), kind: 'if', condition: call('read', [literal(word(language, 'start'))]), then: [act('turnOn', word(language, 'motor'))] },
        { id: createId(), kind: 'if', condition: call('read', [literal(word(language, 'stop'))]), then: [act('turnOff', word(language, 'motor'))] },
        act('wait', 0.5),
      ],
    } as Statement,
  ],
  sequence: (language) => [
    act('turnOn', word(language, 'motor')),
    act('wait', 3),
    act('turnOn', word(language, 'motor2')),
  ],
};

const scenarioChallenges = challenges.filter((challenge) => challenge.world);

describe('the electromechanics challenges', () => {
  it('are the three the pack promises', () => {
    expect(scenarioChallenges.map((challenge) => challenge.id)).toEqual(['lamp', 'latch', 'sequence']);
  });

  for (const challenge of scenarioChallenges) {
    for (const language of ['es', 'en'] as const) {
      const world = challenge.world!(language);
      const cases = challenge.cases!(language);
      const solution = solutions[challenge.id](language);

      it(`${challenge.id} (${language}): the solution passes in blocks`, () => {
        const mark = gradeBlocks(solution, cases, 10, world);
        expect(mark.results).toEqual(cases.map(() => ({ passed: true, got: [] })));
      });

      it(`${challenge.id} (${language}): the solution passes as code`, async () => {
        const source = renderLines(
          emitters.javascript.emit(
            { id: 'a', name: 'a', body: solution, createdAt: '', updatedAt: '', world },
            { locale: language },
          ),
        );
        for (const trial of cases) {
          const said: string[] = [];
          const outcome = await runSource(
            source,
            { say: (text) => said.push(text), ask: async () => '' },
            createWorld(world, { inputs: trial.inputs, timeline: trial.timeline }),
          );
          expect(judge(trial, said, outcome.status === 'done', outcome.world).passed, source).toBe(true);
        }
      });

      it(`${challenge.id} (${language}): the starting point does not`, () => {
        const mark = gradeBlocks(challenge.build(language), cases, 10, world);
        expect(mark.passed).toBeLessThan(cases.length);
      });

      it(`${challenge.id} (${language}): the solution validates cleanly`, () => {
        expect(validate(solution, { world })).toEqual([]);
      });
    }
  }
});
