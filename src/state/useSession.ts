import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from './supabase';

export interface SessionController {
  /** `null` while loading, then the session or `null` when signed out. */
  session: Session | null;
  loading: boolean;
  /** The signed-in student's email, for the interface. */
  email: string | null;
  signOut: () => Promise<void>;
}

/**
 * Tracks who is signed in.
 *
 * When Supabase is not configured this settles immediately as signed out, so
 * the app runs on localStorage without any account machinery appearing.
 */
export function useSession(): SessionController {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });

    // Fires on sign-in, sign-out and token refresh, including in another tab.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    // A full reload is the simplest way to be sure nothing from the previous
    // student's session is still held in memory.
    window.location.reload();
  }, []);

  return {
    session,
    loading,
    email: session?.user.email ?? null,
    signOut,
  };
}
