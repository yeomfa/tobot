import type { Statement } from '../core/ast/types';

export type Category = 'variables' | 'io' | 'conditionals' | 'loops';

export type StatementKind = Statement['kind'];

/**
 * Category assignment drives colour everywhere: the palette, the blocks, the
 * flowchart shapes and the concept cards. A student should be able to recognise
 * a loop by its hue before they can read the keyword.
 */
export const statementCategory: Record<StatementKind, Category> = {
  declare: 'variables',
  assign: 'variables',
  say: 'io',
  ask: 'io',
  if: 'conditionals',
  while: 'loops',
  repeat: 'loops',
  forEach: 'loops',
};

/** Order shown in the palette, grouped by category. */
export const paletteGroups: Array<{ category: Category; kinds: StatementKind[] }> = [
  { category: 'variables', kinds: ['declare', 'assign'] },
  { category: 'io', kinds: ['say', 'ask'] },
  { category: 'conditionals', kinds: ['if'] },
  { category: 'loops', kinds: ['repeat', 'forEach', 'while'] },
];

/** Single-glyph icons keep the palette compact and language-neutral. */
export const statementIcon: Record<StatementKind, string> = {
  declare: '▢',
  assign: '⇢',
  say: '◗',
  ask: '?',
  if: '◇',
  while: '↻',
  repeat: '⟳',
  forEach: '⇥',
};
