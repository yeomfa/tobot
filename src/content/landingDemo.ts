import type { PreviewBlock } from '../components/landing/BlockPreview';
import type { Language } from '../i18n/types';

/**
 * One step of a demonstration: which block is running and what the robot says
 * while it does.
 */
export interface DemoStep {
  /** Block id to light up, or `null` for a beat with nothing highlighted. */
  activeId: string | null;
  says: string | null;
}

export interface Demo {
  blocks: PreviewBlock[];
  steps: DemoStep[];
}

const COPY = {
  es: {
    declare: 'variable',
    say: 'decir',
    assign: 'cambiar',
    forEach: 'desde',
    if: 'si',
    to: 'hasta',
    step: 'de a',
    then: 'entonces',
    do: 'hacer',
    text: 'texto',
    number: 'número',
    // Variable names are content too: an English page showing `nombre` reads
    // as a translation someone forgot to finish.
    nameVar: 'nombre',
    pointsVar: 'puntos',
    counter: 'i',
    ana: 'Ana',
    hello: 'Hola, ',
    win: '¡Lo lograste!',
    saysHello: 'Guardo tu nombre para saludarte.',
    saysGreet: 'Hola, Ana 👋',
    saysCount: 'Cuento: 1, 2, 3…',
    saysCheck: '6 es mayor que 5, así que…',
    saysWin: '¡Lo lograste!',
  },
  en: {
    declare: 'variable',
    say: 'say',
    assign: 'change',
    forEach: 'from',
    if: 'if',
    to: 'to',
    step: 'by',
    then: 'then',
    do: 'do',
    text: 'text',
    number: 'number',
    nameVar: 'name',
    pointsVar: 'points',
    counter: 'i',
    ana: 'Ana',
    hello: 'Hello, ',
    win: 'You did it!',
    saysHello: 'I keep your name so I can greet you.',
    saysGreet: 'Hello, Ana 👋',
    saysCount: 'Counting: 1, 2, 3…',
    saysCheck: '6 is more than 5, so…',
    saysWin: 'You did it!',
  },
} as const satisfies Record<Language, Record<string, string>>;

/**
 * The hero's demonstration: short enough to watch twice.
 *
 * Three blocks rather than seven. The hero has one job — show what a block is
 * and that the robot runs it — and a seven-statement program spends most of
 * its time on parts nobody reads before scrolling.
 */
export function heroDemo(language: Language): Demo {
  const t = COPY[language];

  return {
    blocks: [
      {
        id: 'h1',
        kind: 'declare',
        tokens: [
          { kind: 'word', text: t.declare },
          { kind: 'name', text: t.nameVar },
          { kind: 'muted', text: '=' },
          { kind: 'value', text: `"${t.ana}"` },
          { kind: 'chip', text: t.text, type: 'text' },
        ],
      },
      {
        id: 'h2',
        kind: 'say',
        tokens: [
          { kind: 'word', text: t.say },
          { kind: 'value', text: `"${t.hello}"` },
          { kind: 'muted', text: '+' },
          { kind: 'name', text: t.nameVar },
        ],
      },
    ],
    steps: [
      { activeId: null, says: null },
      { activeId: 'h1', says: t.saysHello },
      { activeId: 'h2', says: t.saysGreet },
      { activeId: null, says: t.saysGreet },
    ],
  };
}

/**
 * The showcase's demonstration: a loop and a branch, so the flowchart and the
 * code views have a shape worth looking at.
 */
export function showcaseDemo(language: Language): Demo {
  const t = COPY[language];

  return {
    blocks: [
      {
        id: 's1',
        kind: 'declare',
        tokens: [
          { kind: 'word', text: t.declare },
          { kind: 'name', text: t.pointsVar },
          { kind: 'muted', text: '=' },
          { kind: 'value', text: '0', type: 'number' },
          { kind: 'chip', text: t.number, type: 'number' },
        ],
      },
      {
        id: 's2',
        kind: 'forEach',
        childLabel: t.do,
        tokens: [
          { kind: 'word', text: t.forEach },
          { kind: 'name', text: t.counter },
          { kind: 'muted', text: '=' },
          { kind: 'value', text: '1', type: 'number' },
          { kind: 'muted', text: t.to },
          { kind: 'value', text: '3', type: 'number' },
        ],
        children: [
          {
            id: 's3',
            kind: 'assign',
            tokens: [
              { kind: 'word', text: t.assign },
              { kind: 'name', text: t.pointsVar },
              { kind: 'muted', text: '=' },
              { kind: 'name', text: t.pointsVar },
              { kind: 'muted', text: '+' },
              { kind: 'name', text: t.counter },
            ],
          },
        ],
      },
      {
        id: 's4',
        kind: 'if',
        childLabel: t.then,
        tokens: [
          { kind: 'word', text: t.if },
          { kind: 'name', text: t.pointsVar },
          { kind: 'muted', text: '≥' },
          { kind: 'value', text: '5', type: 'number' },
        ],
        children: [
          {
            id: 's5',
            kind: 'say',
            tokens: [
              { kind: 'word', text: t.say },
              { kind: 'value', text: `"${t.win}"` },
            ],
          },
        ],
      },
    ],
    steps: [
      { activeId: 's1', says: null },
      { activeId: 's2', says: t.saysCount },
      { activeId: 's3', says: t.saysCount },
      { activeId: 's4', says: t.saysCheck },
      { activeId: 's5', says: t.saysWin },
    ],
  };
}
