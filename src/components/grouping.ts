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

/** Arms grouping on every expression long enough to use it. */
export function armGrouping(): void {
  document.dispatchEvent(new CustomEvent(GROUPING_ARMED));
}

/** Runs `arm` whenever grouping is armed from outside. Returns the unsubscribe. */
export function onGroupingArmed(arm: () => void): () => void {
  document.addEventListener(GROUPING_ARMED, arm);
  return () => document.removeEventListener(GROUPING_ARMED, arm);
}
