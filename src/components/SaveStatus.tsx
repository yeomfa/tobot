import {
  CheckCircleIcon as CheckCircle,
  CloudSlashIcon as CloudSlash,
  SpinnerGapIcon as SpinnerGap,
} from '@phosphor-icons/react';

import { useTranslation } from '../i18n/context';
import type { SaveState } from '../state/useAlgorithm';
import './SaveStatus.css';

/**
 * Whether the work has reached the server.
 *
 * Only appears with an account: local writes are synchronous and cannot fail,
 * so a badge would be reassuring the student about something never in doubt.
 * It says nothing at rest for the same reason — a permanent "saved" is
 * furniture people stop reading, and it is the moment of *change* that carries
 * the information.
 *
 * A failure stays on screen. The other two states are transient because they
 * describe something that finished; this one describes work that is still only
 * in this browser, which does not stop being true because time passed.
 */
export function SaveStatus({ state }: { state: SaveState }) {
  const { d } = useTranslation();

  if (state === 'idle') return null;

  return (
    <span
      className="save-status"
      data-state={state}
      role="status"
      /* Announced only when it goes wrong: a screen reader interrupting to say
         "saved" after every pause in typing is noise. */
      aria-live={state === 'error' ? 'assertive' : 'off'}
    >
      {state === 'saving' && <SpinnerGap weight="bold" />}
      {state === 'saved' && <CheckCircle weight="fill" />}
      {state === 'error' && <CloudSlash weight="fill" />}
      {d.save[state]}
    </span>
  );
}
