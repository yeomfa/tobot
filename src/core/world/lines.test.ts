import { describe, expect, it } from 'vitest';

import { parseMoments, writeMoments } from './lines';

describe('moments written as lines', () => {
  it('reads time, name and value, in either language', () => {
    expect(parseMoments('1 arranque sí\n1.5 arranque no\n4 motor on\n\n6,5 paro yes')).toEqual({
      events: [
        { at: 1, id: 'arranque', value: true },
        { at: 1.5, id: 'arranque', value: false },
        { at: 4, id: 'motor', value: true },
        { at: 6.5, id: 'paro', value: true },
      ],
      bad: [],
    });
  });

  it('keeps what it cannot read, to show the author', () => {
    expect(parseMoments('pronto motor sí\n2 motor quizá\n3 motor sí ya').bad).toEqual([
      'pronto motor sí',
      '2 motor quizá',
      '3 motor sí ya',
    ]);
  });

  it('accepts a quoted name, as it appears in the program', () => {
    expect(parseMoments('2 "motor" sí').events).toEqual([{ at: 2, id: 'motor', value: true }]);
  });

  it('writes back what it reads', () => {
    const text = '1 arranque sí\n2 arranque no';
    expect(writeMoments(parseMoments(text).events, 'es')).toBe(text);
  });
});
