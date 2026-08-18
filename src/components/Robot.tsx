import { memo } from 'react';

import './Robot.css';

export type RobotMood = 'idle' | 'thinking' | 'speaking' | 'asking' | 'done' | 'error';

interface RobotProps {
  mood: RobotMood;
  /** Current speech bubble text, or `null` when the robot is silent. */
  message: string | null;
}

/**
 * The robot is drawn as inline SVG rather than an image so its parts can be
 * animated and themed with CSS variables. Expressions are driven entirely by
 * `data-mood`, keeping the markup static and the animation declarative.
 */
export const Robot = memo(function Robot({ mood, message }: RobotProps) {
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
        viewBox="0 0 200 210"
        role="img"
        aria-label="Robot"
        aria-hidden={message !== null}
      >
        <defs>
          <linearGradient id="robot-shell" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--robot-shell-top)" />
            <stop offset="100%" stopColor="var(--robot-shell-bottom)" />
          </linearGradient>
          <linearGradient id="robot-visor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--robot-visor-top)" />
            <stop offset="100%" stopColor="var(--robot-visor-bottom)" />
          </linearGradient>
          <radialGradient id="robot-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="var(--robot-accent)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--robot-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient glow, brightening when the robot is active. */}
        <ellipse className="robot__glow" cx="100" cy="96" rx="86" ry="80" fill="url(#robot-glow)" />

        {/* Antenna */}
        <g className="robot__antenna">
          <line x1="100" y1="34" x2="100" y2="18" stroke="var(--robot-outline)" strokeWidth="4" strokeLinecap="round" />
          <circle className="robot__antenna-tip" cx="100" cy="14" r="7" />
        </g>

        {/* Head */}
        <rect
          x="38"
          y="32"
          width="124"
          height="98"
          rx="28"
          fill="url(#robot-shell)"
          stroke="var(--robot-outline)"
          strokeWidth="3"
        />

        {/* Visor */}
        <rect x="54" y="50" width="92" height="60" rx="20" fill="url(#robot-visor)" />

        {/* Eyes: the blink is a CSS scale animation on the group. */}
        <g className="robot__eyes">
          <circle className="robot__eye robot__eye--left" cx="80" cy="80" r="9" />
          <circle className="robot__eye robot__eye--right" cx="120" cy="80" r="9" />
        </g>

        {/* Mouth swaps shape by mood; only one is visible at a time. */}
        <g className="robot__mouth">
          <path className="robot__mouth--neutral" d="M86 102 H114" strokeLinecap="round" />
          <path className="robot__mouth--smile" d="M84 98 Q100 110 116 98" fill="none" strokeLinecap="round" />
          <circle className="robot__mouth--speak" cx="100" cy="101" r="7" />
          <path className="robot__mouth--flat" d="M86 103 H114" strokeLinecap="round" />
        </g>

        {/* Ears */}
        <rect x="26" y="66" width="14" height="30" rx="7" fill="var(--robot-shell-bottom)" stroke="var(--robot-outline)" strokeWidth="3" />
        <rect x="160" y="66" width="14" height="30" rx="7" fill="var(--robot-shell-bottom)" stroke="var(--robot-outline)" strokeWidth="3" />

        {/* Neck */}
        <rect x="88" y="128" width="24" height="14" fill="var(--robot-shell-bottom)" stroke="var(--robot-outline)" strokeWidth="3" />

        {/* Torso */}
        <rect
          x="52"
          y="140"
          width="96"
          height="58"
          rx="20"
          fill="url(#robot-shell)"
          stroke="var(--robot-outline)"
          strokeWidth="3"
        />

        {/* Chest indicator: pulses while the program runs. */}
        <circle className="robot__core" cx="100" cy="169" r="13" />
        <circle className="robot__core-ring" cx="100" cy="169" r="13" />

        {/* Arms */}
        <rect className="robot__arm robot__arm--left" x="30" y="146" width="16" height="42" rx="8" />
        <rect className="robot__arm robot__arm--right" x="154" y="146" width="16" height="42" rx="8" />
      </svg>
    </div>
  );
});
