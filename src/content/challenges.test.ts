import { describe, expect, it } from 'vitest';

import { challenges } from './challenges';

/*
  The difficulty scale is anchored to prerequisites, not to the hardest
  challenge that happens to exist. These guard that anchoring, because the
  failure mode is silent: someone adds a hard challenge, calls it 5, and
  quietly makes every existing level mean something different.
*/
describe('challenge difficulty', () => {
  it('stays inside the five-point scale', () => {
    for (const challenge of challenges) {
      expect(challenge.level).toBeGreaterThanOrEqual(1);
      expect(challenge.level).toBeLessThanOrEqual(5);
    }
  });

  it('has somewhere to grow', () => {
    /*
      If every level is occupied, the scale has been used as a ranking of what
      exists rather than as a fixed measure — which is what made "print the
      even numbers" the hardest challenge in Tobot. Levels 4 and 5 need data
      structures, functions or an idea; nothing here teaches those yet.
    */
    const used = new Set(challenges.map((challenge) => challenge.level));
    expect(used.has(4) && used.has(5)).toBe(false);
  });

  it('starts someone at the beginning', () => {
    // A set whose easiest challenge is a 3 has nowhere for a beginner to land.
    expect(Math.min(...challenges.map((challenge) => challenge.level))).toBe(1);
  });
});
