import {
  FunctionIcon as Function_,
  ArrowUUpLeftIcon as ArrowUUpLeft,
  ArrowRightIcon as ArrowRight,
  ListBulletsIcon as ListBullets,
  ListPlusIcon as ListPlus,
  ArrowsClockwiseIcon as ArrowsClockwise,
  ArrowsSplitIcon as ArrowsSplit,
  ChatCircleTextIcon as ChatCircleText,
  HashIcon as Hash,
  ListNumbersIcon as ListNumbers,
  NoteBlankIcon as NoteBlank,
  PencilSimpleIcon as PencilSimple,
  QuestionIcon as Question,
  RepeatIcon as Repeat,
  TagIcon as Tag,
  TextAaIcon as TextAa,
  ToggleLeftIcon as ToggleLeft,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

import type { Statement, ValueKind } from '../core/ast/types';

export type Category =
  | 'variables'
  | 'io'
  | 'conditionals'
  | 'loops'
  | 'lists'
  | 'functions'
  | 'notes';

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
  /* Lists get their own category rather than joining `variables`. A list is a
     new idea about *what* a value can be, not a new way to make one, and the
     colour is what tells a student that before they read the block. */
  listOp: 'lists',
  forEachItem: 'lists',
  /* Their own category, by the same reasoning lists got one: naming a piece of
     work and reusing it is a new idea, not another way to write a statement,
     and the colour says so before the block is read. */
  function: 'functions',
  return: 'functions',
  call: 'functions',
};

/** Order shown in the palette, grouped by category. */
export const paletteGroups: Array<{ category: Category; kinds: StatementKind[] }> = [
  { category: 'variables', kinds: ['declare', 'assign'] },
  { category: 'io', kinds: ['say', 'ask'] },
  { category: 'conditionals', kinds: ['if'] },
  { category: 'loops', kinds: ['repeat', 'forEach', 'while'] },
  { category: 'lists', kinds: ['listOp', 'forEachItem'] },
  { category: 'functions', kinds: ['function', 'call', 'return'] },
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
  listOp: ListBullets,
  forEachItem: ListPlus,
  function: Function_,
  /* The call points forwards into the function; the return points back out of
     it. Read together they say where control goes, which is the one thing
     about functions that a diagram usually has to explain. */
  call: ArrowRight,
  return: ArrowUUpLeft,
};

/**
 * One icon per data type, shared by the chip on a declaration and the menu on
 * a value so that "number" looks the same wherever a student meets it.
 */
export const typeIcon: Record<ValueKind, Icon> = {
  number: Hash,
  text: TextAa,
  boolean: ToggleLeft,
  list: ListBullets,
};

/**
 * One icon per category, for places that name a group rather than a single
 * statement — the canvas toolbar, and anything else that comes later.
 *
 * Each is the icon of the statement a student meets first in that group, so
 * the shortcut and the thing it opens carry the same mark: the tag that names
 * a variable, the speech bubble that says something, the fork that decides,
 * the arrow that goes round again.
 */
export const categoryIcon: Record<Category, Icon> = {
  variables: Tag,
  io: ChatCircleText,
  conditionals: ArrowsSplit,
  loops: ArrowsClockwise,
  lists: ListBullets,
  functions: Function_,
  notes: NoteBlank,
};
