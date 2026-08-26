import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase client, created only when the project is configured.
 *
 * Both values are meant to be public: the key identifies the project, and every
 * rule about who may read or write lives in the database's row-level security
 * policies rather than in keeping this string secret.
 *
 * Supabase renamed this key in 2025. New projects issue a publishable key
 * (`sb_publishable_...`); older ones have the legacy `anon` JWT. They behave
 * identically here, so either is accepted and the older variable name is still
 * read as a fallback.
 *
 * When both are absent the app runs on localStorage, which keeps the
 * repository cloneable and the tests runnable without an account.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

export const isSupabaseConfigured = Boolean(url && publishableKey);

/*
 * The client, fetched the first time something asks for it.
 *
 * `@supabase/supabase-js` is around a third of the JavaScript this app ships,
 * and a visitor reading the landing page needs none of it. Imported normally
 * it was downloaded by everyone before anything appeared on screen; imported
 * dynamically it is fetched only once an account is actually in play.
 *
 * The promise is cached rather than the client, so concurrent callers during
 * startup share one download and one client instead of racing to create two.
 */
let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> | null {
  if (!isSupabaseConfigured) return null;

  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url as string, publishableKey as string, {
      auth: {
        // Students move between the lab and home, so the session should
        // survive a closed tab.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
  );

  return clientPromise;
}

/**
 * Whether Google sign-in should be offered.
 *
 * Configuring Google is a separate step in two consoles, so the button only
 * appears once it is switched on rather than failing when pressed.
 */
export const isGoogleEnabled =
  isSupabaseConfigured &&
  /*
    Compared loosely on purpose. This is typed by hand into a GitHub
    repository variable or a `.env` file, where `TRUE`, `True` and a stray
    trailing space are all things people write and all mean the same thing —
    and an exact `=== 'true'` turns any of them into a silently hidden button
    with nothing to explain why.
  */
  String(import.meta.env.VITE_SUPABASE_GOOGLE ?? '')
    .trim()
    .toLowerCase() === 'true';
