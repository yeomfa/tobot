import type { Skin } from '../../core/world/types';

/**
 * One component, drawn.
 *
 * Plain shapes in `currentColor` and CSS custom properties, with no gradients
 * and so no ids: ten lamps on one panel cannot collide the way the robot's
 * global gradient ids would. Every change of state is a `data-state` the
 * stylesheet answers, so the motion lives in CSS and stops for anyone who
 * asked for less of it.
 */
export function Part({ skin }: { skin: Skin }) {
  switch (skin) {
    case 'pushbutton':
      return (
        <svg viewBox="0 0 48 48" className="part" aria-hidden="true">
          <circle className="part__ring" cx="24" cy="24" r="19" />
          <circle className="part__cap" cx="24" cy="24" r="13" />
        </svg>
      );
    case 'switch':
      return (
        <svg viewBox="0 0 48 48" className="part" aria-hidden="true">
          <rect className="part__ring" x="9" y="16" width="30" height="16" rx="8" />
          <circle className="part__knob" cx="17" cy="24" r="6" />
        </svg>
      );
    case 'sensor':
      return (
        <svg viewBox="0 0 48 48" className="part" aria-hidden="true">
          <rect className="part__ring" x="8" y="17" width="12" height="14" rx="2" />
          <path className="part__wave" d="M25 18 q5 6 0 12" />
          <path className="part__wave" d="M31 14 q8 10 0 20" />
          <path className="part__wave" d="M37 10 q11 14 0 28" />
        </svg>
      );
    case 'lamp':
      return (
        <svg viewBox="0 0 48 48" className="part" aria-hidden="true">
          <circle className="part__bulb" cx="24" cy="20" r="13" />
          <rect className="part__ring" x="18" y="34" width="12" height="7" rx="2" />
          <path className="part__filament" d="M19 21 l3 -4 l2 4 l2 -4 l3 4" />
        </svg>
      );
    case 'motor':
      return (
        <svg viewBox="0 0 48 48" className="part" aria-hidden="true">
          <circle className="part__ring" cx="24" cy="24" r="19" />
          <g className="part__rotor">
            <path d="M24 24 L24 9" />
            <path d="M24 24 L37 31.5" />
            <path d="M24 24 L11 31.5" />
          </g>
          <circle className="part__hub" cx="24" cy="24" r="4" />
        </svg>
      );
    case 'siren':
      return (
        <svg viewBox="0 0 48 48" className="part" aria-hidden="true">
          <path className="part__dome" d="M12 34 v-8 a12 12 0 0 1 24 0 v8 z" />
          <rect className="part__ring" x="9" y="34" width="30" height="6" rx="2" />
        </svg>
      );
  }
}
