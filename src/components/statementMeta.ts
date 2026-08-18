import {
  ArrowsClockwise,
  ArrowsSplit,
  ChatCircleText,
  ListNumbers,
  NoteBlank,
  PencilSimple,
  Question,
  Repeat,
  Tag,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

import type { Statement } from '../core/ast/types';

export type Category = 'variables' | 'io' | 'conditionals' | 'loops' | 'notes';

export type StatementKind = Statement['kind'];

/**
 * Category assignment drives colour everywhere: the palette, the blocks, the
 * flowchart shapes and the concept cards. A student should be able to recognise
 * a loop by its hue before they can read the keyword.
 */
export const statementCategory: Record<StatementKind, Category> = {
  comment: 'notes',
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
  { category: 'notes', kinds: ['comment'] },
];

/**
 * Phosphor icon per statement kind. They are imported individually rather than
 * from the package barrel so only these eight ship in the bundle.
 *
 * The choices are literal about what each statement does: a tag names a value,
 * a speech bubble means the robot talks, a diamond-ish split means a decision.
 */
export const statementIcon: Record<StatementKind, Icon> = {
  comment: NoteBlank,
  declare: Tag,
  assign: PencilSimple,
  say: ChatCircleText,
  ask: Question,
  if: ArrowsSplit,
  while: ArrowsClockwise,
  repeat: Repeat,
  forEach: ListNumbers,
};
