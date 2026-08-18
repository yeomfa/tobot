import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase client, created only when the project is configured.
 *
 * Both values are meant to be public: the anon key identifies the project, and
 * every rule about who may read or write lives in the database's row-level
 * security policies rather than in keeping this string secret.
 *
 * When they are absent the app runs exactly as before, on localStorage. That
 * keeps the repository cloneable and the tests runnable without an account.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        // Students move between the lab and home, so the session should
        // survive a closed tab.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Whether Google sign-in should be offered.
 *
 * Configuring Google is a separate step in two consoles, so the button only
 * appears once it is switched on rather than failing when pressed.
 */
export const isGoogleEnabled =
  isSupabaseConfigured && import.meta.env.VITE_SUPABASE_GOOGLE === 'true';
