import { memo, useId } from 'react';

import './Robot.css';

export type RobotMood = 'idle' | 'thinking' | 'speaking' | 'asking' | 'done' | 'error';

interface RobotProps {
  mood: RobotMood;
  /** Current speech bubble text, or `null` when the robot is silent. */
  message: string | null;
}

/**
 * Tobot, drawn as inline SVG rather than an image so its parts can be animated
 * and themed with CSS. The same character as the illustrations: a wide white
 * head with a navy visor, cyan pill eyes, an antenna with an orange ball, and
 * an orange light on its chest.
 *
 * It has no mouth. Everything it feels is said with the eyes — pills, rounds,
 * happy arcs or flat lines, one set shown per mood — the antenna and the chest
 * light, all driven by `data-mood` so the markup stays static.
 */
export const Robot = memo(function Robot({ mood, message }: RobotProps) {
  // Several robots can share a page (the landing and the editor), so the glow
  // filter needs an id of its own.
  const glow = `robot-glow-${useId().replace(/:/g, '')}`;

  return (
    <div className="robot" data-mood={mood}>
      <div className="robot__bubble-slot">
        {message !== null && (
          <div className="robot__bubble" role="status" aria-live="polite">
            <span className="robot__bubble-text">{message}</span>
          </div>
        )}
      </div>

      <svg
        className="robot__body"
        viewBox="0 0 200 220"
        role="img"
        aria-label="Tobot"
        aria-hidden={message !== null}
      >
        <defs>
          <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        <ellipse className="robot__aura" cx="100" cy="104" rx="88" ry="84" />
        <ellipse className="robot__ground" cx="100" cy="210" rx="40" ry="5" />

        {/* Legs first, so the body covers where they join it. */}
        <rect className="robot__shade" x="80" y="184" width="16" height="22" rx="8" />
        <rect className="robot__shade" x="104" y="184" width="16" height="22" rx="8" />
        <rect className="robot__shell" x="80" y="180" width="16" height="22" rx="8" />
        <rect className="robot__shell" x="104" y="180" width="16" height="22" rx="8" />

        <g className="robot__arm robot__arm--left">
          <ellipse className="robot__shade" cx="55" cy="159" rx="9" ry="22" transform="rotate(18 55 159)" />
          <ellipse className="robot__shell" cx="57" cy="155" rx="8.5" ry="21" transform="rotate(18 57 155)" />
        </g>
        <g className="robot__arm robot__arm--right">
          <ellipse className="robot__shade" cx="145" cy="159" rx="9" ry="22" transform="rotate(-18 145 159)" />
          <ellipse className="robot__shell" cx="143" cy="155" rx="8.5" ry="21" transform="rotate(-18 143 155)" />
        </g>

        {/* The body: an egg, shaded along its lower side. */}
        <path className="robot__shell" d="M70 134q0-10 30-10t30 10l2 32q0 24-32 24t-32-24z" />
        <path className="robot__shade" d="M68 166q0 24 32 24t32-24q-10 16-32 16t-32-16z" />
        <ellipse className="robot__collar" cx="100" cy="127" rx="26" ry="6" />

        {/* Chest light: pulses while the program runs. */}
        <circle className="robot__core-ring" cx="100" cy="152" r="11" />
        <circle className="robot__core" cx="100" cy="152" r="11" />
        <circle className="robot__shine" cx="96" cy="148" r="3.5" />

        <g className="robot__head">
          <g className="robot__antenna">
            <line className="robot__stalk" x1="100" y1="36" x2="100" y2="20" />
            <circle className="robot__antenna-tip" cx="100" cy="14" r="9" />
            <circle className="robot__shine" cx="97" cy="11" r="3" />
          </g>
          <ellipse className="robot__shade" cx="100" cy="36" rx="14" ry="5" />

          <rect className="robot__shade" x="32" y="40" width="136" height="86" rx="42" />
          <rect className="robot__shell" x="32" y="34" width="136" height="86" rx="42" />
          <rect className="robot__visor" x="48" y="50" width="104" height="58" rx="29" />

          {/* One set of eyes per mood; the rest are hidden. */}
          <g className="robot__eyes">
            <g className="robot__eyes-pill">
              <g className="robot__eye-glow" filter={`url(#${glow})`}>
                <rect x="80" y="67" width="11" height="24" rx="5.5" />
                <rect x="109" y="67" width="11" height="24" rx="5.5" />
              </g>
              <rect className="robot__eye" x="80" y="67" width="11" height="24" rx="5.5" />
              <rect className="robot__eye" x="109" y="67" width="11" height="24" rx="5.5" />
            </g>
            <g className="robot__eyes-round">
              <circle className="robot__eye" cx="85.5" cy="79" r="9" />
              <circle className="robot__eye" cx="114.5" cy="79" r="9" />
            </g>
            <path className="robot__eyes-happy" d="M78 85q7.5-13 15 0M107 85q7.5-13 15 0" />
            <path className="robot__eyes-flat" d="M79 81h13M108 81h13" />
          </g>
        </g>
      </svg>
    </div>
  );
});
