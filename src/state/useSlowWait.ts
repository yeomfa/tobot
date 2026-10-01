import { useEffect, useState } from 'react';

/**
 * How long a wait may last before it is worth mentioning.
 *
 * A local read resolves in a microtask, so saying "loading" immediately painted
 * a skeleton and took it away on the next frame — a flicker carrying no
 * information. Long enough that a local read never reaches it; short enough
 * that a slow network is never a blank pause with nothing to explain it.
 */
const GRACE_MS = 250;

/** Whether a wait has gone on long enough to show anything at all. */
export function useSlowWait(waiting: boolean): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  return slow;
}
