import './Spot.css';

export type SpotName = 'library' | 'editor' | 'console' | 'flowchart' | 'search';

/**
 * A statement block's outline: the notch on top and the tab underneath that
 * the editor's blocks snap together with, and the mark's body is drawn from.
 */
function block(x: number, y: number, w: number, h: number, r = 4): string {
  return [
    `M${x + r} ${y}H${x + 8}l3 4h8l3-4H${x + w - r}`,
    `Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `H${x + 22}l-3 4h-8l-3-4H${x + r}`,
    `Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`,
  ].join('');
}

function Art({ name }: { name: SpotName }) {
  switch (name) {
    // An open folder with nothing in it but the outline of a first block.
    case 'library':
      return (
        <>
          <path className="spot__dashed" d={block(52, 14, 56, 16)} />
          <path className="spot__back" d="M30 44h34l8 8h58v48H30z" />
          <path className="spot__front" d="M26 60h108l-8 46H34z" />
          <circle className="spot__spark" cx="122" cy="22" r="3" />
        </>
      );

    // A block hovering over the slot it belongs in.
    case 'editor':
      return (
        <>
          <path className="spot__dashed" d={block(46, 66, 72, 20)} />
          <path className="spot__block" data-hue="io" d={block(40, 22, 72, 20)} transform="rotate(-6 76 32)" />
          <path className="spot__line" d="M62 52v6M76 50v8M90 52v6" />
          <circle className="spot__spark" cx="126" cy="24" r="3" />
        </>
      );

    // A terminal waiting at its prompt.
    case 'console':
      return (
        <>
          <rect className="spot__back" x="22" y="18" width="116" height="84" rx="8" />
          <path className="spot__bar" d="M22 26a8 8 0 0 1 8-8h100a8 8 0 0 1 8 8v8H22z" />
          <circle className="spot__dot" cx="32" cy="26" r="2.5" />
          <circle className="spot__dot" cx="41" cy="26" r="2.5" />
          <circle className="spot__dot" cx="50" cy="26" r="2.5" />
          <path className="spot__prompt" d="M36 56l8 6-8 6" />
          <rect className="spot__cursor" x="52" y="58" width="12" height="4" rx="2" />
          <path className="spot__faint" d="M36 82h48M36 92h30" />
        </>
      );

    // The start of a diagram, and the rest of it still in pencil.
    case 'flowchart':
      return (
        <>
          <path className="spot__dashed-line" d="M80 30v14M80 66v12" />
          <rect className="spot__block" data-hue="io" x="56" y="12" width="48" height="18" rx="9" />
          <rect className="spot__dashed" x="52" y="44" width="56" height="22" rx="4" />
          <path className="spot__dashed" d="M80 78l20 12-20 12-20-12z" />
          <circle className="spot__spark" cx="128" cy="24" r="3" />
        </>
      );

    // A lens over blocks that are not the one being looked for.
    case 'search':
      return (
        <>
          <path className="spot__dashed" d={block(26, 30, 64, 18)} />
          <path className="spot__dashed" d={block(26, 58, 48, 18)} />
          <circle className="spot__lens" cx="98" cy="62" r="22" />
          <path className="spot__handle" d="M114 78l16 16" />
          <path className="spot__faint" d="M90 56a10 10 0 0 1 10-8" />
        </>
      );
  }
}

/**
 * A small drawing for an empty place: a list with nothing in it, a canvas
 * before the first block, a search that found nothing.
 *
 * Drawn here rather than generated, and in the theme's own colours, so it is
 * as crisp as the interface around it and right in light and dark alike.
 * Decorative: the sentence beside it is what says what happened.
 */
export function Spot({ name, className }: { name: SpotName; className?: string }) {
  return (
    <svg
      className={className ? `spot ${className}` : 'spot'}
      viewBox="0 0 160 120"
      aria-hidden="true"
      focusable="false"
    >
      <Art name={name} />
    </svg>
  );
}
