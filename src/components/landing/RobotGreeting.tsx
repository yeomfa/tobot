import { useEffect, useRef, useState } from 'react';

import { Robot } from '../Robot';
import type { RobotMood } from '../Robot';
import './RobotGreeting.css';

interface RobotGreetingProps {
  mood: RobotMood;
  message: string | null;
  /** Follows the pointer with its gaze. Only worth it where it is the focus. */
  follow?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * The robot, hosting the landing page.
 *
 * It is the app's own component with its own moods, not a new drawing, so the
 * character a student meets in the editor is the one that greeted them here.
 *
 * The gaze follows the pointer where `follow` is set. That is the whole of the
 * "cute": one small sign of life, in one place, rather than decoration
 * everywhere.
 */
export function RobotGreeting({ mood, message, follow = false, size = 'md' }: RobotGreetingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!follow) return;
    // A gaze that tracks the mouse is motion the visitor did not ask for.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onMove = (event: PointerEvent): void => {
      const box = ref.current?.getBoundingClientRect();
      if (!box) return;

      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      // Clamped to a couple of pixels: the eyes shift, the head does not turn.
      const limit = 2.5;
      const scale = Math.min(1, Math.hypot(dx, dy) / 400);
      const angle = Math.atan2(dy, dx);
      setGaze({ x: Math.cos(angle) * limit * scale, y: Math.sin(angle) * limit * scale });
    };

    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [follow]);

  return (
    <div
      className="robot-greeting"
      ref={ref}
      data-size={size}
      style={{ '--gaze-x': `${gaze.x}px`, '--gaze-y': `${gaze.y}px` } as React.CSSProperties}
    >
      <Robot mood={mood} message={message} />
    </div>
  );
}
