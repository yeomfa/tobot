import { Illustration } from './Illustration';

export type SpotName = 'library' | 'editor' | 'console' | 'flowchart' | 'search';

/**
 * A small picture for an empty place: a list with nothing in it, a canvas
 * before the first block, a search that found nothing.
 *
 * Objects only, without Tobot: the robot is kept for the places that need a
 * character, and an interface with him in every corner felt crowded.
 */
export function Spot({ name, className }: { name: SpotName; className?: string }) {
  return <Illustration name={`spot-${name}`} className={className} />;
}
