/**
 * A small deterministic generator.
 *
 * `Math.random` would rearrange a decoration on every render, which is a form
 * of motion nobody asked for. A seed makes each arrangement stable for the life
 * of the page and different from its neighbours.
 */
export function shuffled(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}
