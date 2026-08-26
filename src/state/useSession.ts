import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { hasStoredSession } from './storage';
import { getSupabase, isSupabaseConfigured } from './supabase';

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
  /*
    Only wait on a session that might exist. Supabase stores it in
    localStorage, so a visitor with nothing there has never signed in on this
    browser and there is nothing to restore — settling immediately means the
    landing page renders without first downloading an auth client to be told
    what the absence of a key already said.
  */
  const [loading, setLoading] = useState(isSupabaseConfigured && hasStoredSession());
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    // Nothing stored means nobody to restore; the client stays undownloaded
    // until a sign-in actually needs it.
    if (!hasStoredSession()) return;

    const pending = getSupabase();
    if (!pending) return;

    let cancelled = false;
    /* The subscription does not exist yet when this effect returns, so the
       cleanup cannot close over it directly. It is parked here and called if
       it arrives; if the effect was already torn down, the listener is
       unsubscribed the moment it is created. */
    let unsubscribe: (() => void) | null = null;

    void pending.then((supabase) => {
      if (cancelled) return;

      void supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setLoading(false);
      });

      // Fires on sign-in, sign-out and token refresh, including in another tab.
      const { data } = supabase.auth.onAuthStateChange((_event, next) => {
        if (cancelled) return;
        setSession(next);
        setLoading(false);
      });

      unsubscribe = () => data.subscription.unsubscribe();
      if (cancelled) unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  // The profile is a separate row, fetched once the user is known. A failure
  // here is not worth blocking on: the interface falls back to the email.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    /* `userId` first: asking for the client before checking whether there is
       a user downloads it for every visitor, which is the whole thing this
       is trying to avoid. */
    if (!userId) {
      setProfile(null);
      return;
    }

    const pending = getSupabase();
    if (!pending) return;

    let cancelled = false;

    void pending.then((supabase) =>
      supabase
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
        }),
    );

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const updateProfile = useCallback(
    async (next: Profile) => {
      const supabase = await getSupabase();
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
    const supabase = await getSupabase();
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
