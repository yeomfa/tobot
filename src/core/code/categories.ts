import type { Category } from '../../components/statementMeta';

/**
 * Which topic a piece of written code belongs to.
 *
 * The block editor colours by category and says why: *"A student should be able
 * to recognise a loop by its hue before they can read the keyword."* Text is
 * the one surface that never did, so a student who learned that loops are
 * purple met JavaScript where everything was the same colour and had to start
 * again.
 *
 * Keyed by the names Lezer gives the nodes of a JavaScript parse. Keywords come
 * through under their own spelling, which is what makes this a table rather
 * than a tree walk.
 */
export const KEYWORD_CATEGORY: Record<string, Category> = {
  if: 'conditionals',
  else: 'conditionals',
  switch: 'conditionals',
  case: 'conditionals',
  while: 'loops',
  for: 'loops',
  do: 'loops',
  of: 'loops',
  break: 'loops',
  continue: 'loops',
  const: 'variables',
  let: 'variables',
  var: 'variables',
  function: 'functions',
  return: 'functions',
  async: 'functions',
  await: 'functions',
};

/**
 * The same question asked of a name being called.
 *
 * Only the vocabulary Tobot teaches: a student's own function has no topic, and
 * guessing one would colour it at random. Anything unlisted keeps the ordinary
 * code colour, which is the honest answer for "this is yours, not ours".
 */
export const NAME_CATEGORY: Record<string, Category> = {
  log: 'io',
  prompt: 'io',
  ask: 'io',
  Number: 'variables',
  String: 'variables',
  Boolean: 'variables',
  random: 'functions',
  floor: 'functions',
  length: 'lists',
  push: 'lists',
  pop: 'lists',
};

/** The CSS class that paints a category on the code surface. */
export function categoryClass(category: Category): string {
  return `cm-cat-${category}`;
}

/** What to paint a node of this name, or nothing if it has no topic. */
export function categoryFor(nodeName: string, text: string): Category | null {
  return KEYWORD_CATEGORY[nodeName] ?? NAME_CATEGORY[text] ?? null;
}
