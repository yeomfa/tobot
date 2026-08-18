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

        {/* Antenna. Drawn first so the head covers where it meets the shell. */}
        <g className="robot__antenna">
          <line
            x1="100"
            y1="34"
            x2="100"
            y2="20"
            stroke="var(--robot-outline)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle className="robot__antenna-tip" cx="100" cy="15" r="7" />
        </g>

        {/*
          The neck is drawn before the head and torso, so both overlap it
          rather than the other way round. Previously the neck started two
          pixels above the head's lower edge and its stroke cut across the jaw.
        */}
        <rect
          x="86"
          y="120"
          width="28"
          height="26"
          rx="6"
          fill="var(--robot-shell-bottom)"
          stroke="var(--robot-outline)"
          strokeWidth="3"
        />

        {/*
          Head. Same proportions as the app icon: a 22:17 rounded rect with the
          visor and two eyes, so the mark in the tab, the header and the robot
          on screen are recognisably one character.
        */}
        <rect
          x="38"
          y="32"
          width="124"
          height="98"
          rx="30"
          fill="url(#robot-shell)"
          stroke="var(--robot-outline)"
          strokeWidth="3"
        />

        {/* Ears, tucked behind the head's rounded corners. */}
        <rect
          x="24"
          y="66"
          width="14"
          height="30"
          rx="7"
          fill="var(--robot-shell-bottom)"
          stroke="var(--robot-outline)"
          strokeWidth="3"
        />
        <rect
          x="162"
          y="66"
          width="14"
          height="30"
          rx="7"
          fill="var(--robot-shell-bottom)"
          stroke="var(--robot-outline)"
          strokeWidth="3"
        />

        {/* Visor */}
        <rect x="54" y="50" width="92" height="60" rx="22" fill="url(#robot-visor)" />

        {/* Eyes: the blink is a CSS scale animation on the group. */}
        <g className="robot__eyes">
          <circle className="robot__eye robot__eye--left" cx="80" cy="76" r="9" />
          <circle className="robot__eye robot__eye--right" cx="120" cy="76" r="9" />
        </g>

        {/* Mouth swaps shape by mood; only one is visible at a time. */}
        <g className="robot__mouth">
          <path className="robot__mouth--neutral" d="M86 98 H114" strokeLinecap="round" />
          <path className="robot__mouth--smile" d="M84 94 Q100 106 116 94" fill="none" strokeLinecap="round" />
          <circle className="robot__mouth--speak" cx="100" cy="97" r="7" />
          <path className="robot__mouth--flat" d="M86 99 H114" strokeLinecap="round" />
        </g>

        {/* Torso */}
        <rect
          x="52"
          y="142"
          width="96"
          height="58"
          rx="22"
          fill="url(#robot-shell)"
          stroke="var(--robot-outline)"
          strokeWidth="3"
        />

        {/* Chest indicator: pulses while the program runs. */}
        <circle className="robot__core" cx="100" cy="171" r="13" />
        <circle className="robot__core-ring" cx="100" cy="171" r="13" />

        {/* Arms */}
        <rect className="robot__arm robot__arm--left" x="30" y="150" width="16" height="42" rx="8" />
        <rect className="robot__arm robot__arm--right" x="154" y="150" width="16" height="42" rx="8" />
      </svg>
    </div>
  );
});
