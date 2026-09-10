/**
 * The channel that arms grouping from outside a block.
 *
 * Grouping is a tool rather than a property of one part, so it is offered by
 * the canvas menu — which opens on bare canvas and has no expression to aim
 * at. Arming every chain long enough to use it, and letting the student drag
 * over the one they meant, is what makes that possible without asking them to
 * pick a target first.
 *
 * An event rather than a prop threaded down from the app: the alternative was
 * passing a token through Editor, StatementBlock and every nesting level of
 * ExpressionEditor to reach a piece of state that is otherwise entirely local
 * to the expression that owns it.
 *
 * In its own file so neither side imports the other: the menu needs to arm,
 * the editors need to listen, and neither has any other business with the
 * other's module.
 */
const GROUPING_ARMED = 'tobot:group';
const GROUPING_ENDED = 'tobot:group-end';

/** Arms grouping on every expression long enough to use it. */
export function armGrouping(): void {
  document.dispatchEvent(new CustomEvent(GROUPING_ARMED));
}

/** Runs `arm` whenever grouping is armed from outside. Returns the unsubscribe. */
export function onGroupingArmed(arm: () => void): () => void {
  document.addEventListener(GROUPING_ARMED, arm);
  return () => document.removeEventListener(GROUPING_ARMED, arm);
}

/**
 * Ends the mode everywhere, once one expression has grouped.
 *
 * Arming is broadcast, so a single tool press lights up every chain on the
 * canvas — but only the expression the student actually dragged across knows
 * that the gesture is over. Without a matching broadcast the others stay
 * armed: still tinted, still shivering, and now inert, because the body flag
 * they depended on was removed by the one that finished.
 *
 * Symmetric to `armGrouping` for that reason: what one press turns on, one
 * release turns off.
 */
export function endGrouping(): void {
  document.dispatchEvent(new CustomEvent(GROUPING_ENDED));
}

/** Runs `end` when grouping finishes anywhere. Returns the unsubscribe. */
export function onGroupingEnded(end: () => void): () => void {
  document.addEventListener(GROUPING_ENDED, end);
  return () => document.removeEventListener(GROUPING_ENDED, end);
}
