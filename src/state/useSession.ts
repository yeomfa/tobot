import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from './supabase';

export interface Profile {
  firstName: string;
  lastName: string;
}

export interface SessionController {
  /** `null` while loading, then the session or `null` when signed out. */
  session: Session | null;
  loading: boolean;
  /** The signed-in student's email, for the interface. */
  email: string | null;
  /** Their name, once the profile row has loaded. */
  profile: Profile | null;
  /** Full name when known, otherwise the part of the email before the @. */
  displayName: string | null;
  /** One or two letters for the avatar. */
  initials: string | null;
  /** Saves a changed name and reflects it immediately. */
  updateProfile: (next: Profile) => Promise<void>;
  signOut: () => Promise<void>;
}

/** Falls back to the email's local part so there is always something to show. */
export function nameFrom(profile: Profile | null, email: string | null): string | null {
  const full = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';
  if (full) return full;
  return email ? (email.split('@')[0] ?? null) : null;
}

/**
 * Initials for the avatar: first letter of each of the first two words, so
 * "Juan David Pérez" reads as "JP" rather than "JD".
 */
export function initialsFrom(profile: Profile | null, email: string | null): string | null {
  const parts = [profile?.firstName, profile?.lastName].filter((part): part is string =>
    Boolean(part?.trim()),
  );
  if (parts.length > 0) {
    return parts
      .slice(0, 2)
      .map((part) => [...part.trim()][0]?.toUpperCase() ?? '')
      .join('');
  }
  return email ? ([...email][0]?.toUpperCase() ?? null) : null;
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
  const [profile, setProfile] = useState<Profile | null>(null);

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

  // The profile is a separate row, fetched once the user is known. A failure
  // here is not worth blocking on: the interface falls back to the email.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;

    void supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setProfile({
          firstName: (data.first_name as string | null) ?? '',
          lastName: (data.last_name as string | null) ?? '',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const updateProfile = useCallback(
    async (next: Profile) => {
      if (!supabase || !userId) return;
      // Upsert rather than update: an account created before this table
      // existed has no row yet.
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, first_name: next.firstName, last_name: next.lastName });
      if (error) throw error;
      setProfile(next);
    },
    [userId],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    // A full reload is the simplest way to be sure nothing from the previous
    // student's session is still held in memory.
    window.location.reload();
  }, []);

  const email = session?.user.email ?? null;

  return {
    session,
    loading,
    email,
    profile,
    displayName: nameFrom(profile, email),
    initials: initialsFrom(profile, email),
    updateProfile,
    signOut,
  };
}
