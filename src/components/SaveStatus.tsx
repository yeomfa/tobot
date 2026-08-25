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
 *
 * Once there *is* an account it stays put, including at rest. An indicator
 * that comes and goes asks to be watched — it is the appearing that carries
 * the meaning, so missing it means missing the message. One that is always
 * there can be glanced at instead, which is what someone wondering "did that
 * save?" actually does. It also stops the header reflowing every time a save
 * finishes.
 *
 * `idle` and `saved` say the same word for that reason: between them nothing
 * changed about where the work is, only how recently it got there.
 */
export function SaveStatus({ state }: { state: SaveState }) {
  const { d } = useTranslation();

  return (
    <span
      className="save-status"
      data-state={state}
      role="status"
      /* Announced only when it goes wrong: a screen reader interrupting to say
         "saved" after every pause in typing is noise. */
      aria-live={state === 'error' ? 'assertive' : 'off'}
    >
      {state === 'saving' ? (
        <SpinnerGap weight="bold" />
      ) : state === 'error' ? (
        <CloudSlash weight="fill" />
      ) : (
        <CheckCircle weight="fill" />
      )}
      {d.save[state]}
    </span>
  );
}
