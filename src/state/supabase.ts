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

/*
 * Resolves with the client the first time anything creates one.
 *
 * `useSession` is what has to hold the `onAuthStateChange` subscription, but
 * it must not be what downloads the client — that would undo the whole point
 * of the lazy import above, since every visitor mounts the hook and almost
 * none of them sign in. So the hook waits here instead: when the sign-in form
 * asks for a client, the hook is handed the same one and starts listening.
 *
 * Without this the hook simply gave up when there was no session to restore,
 * and nothing was subscribed when the form created a client moments later. A
 * correct password then left the student looking at the form that had just
 * accepted it.
 *
 * A promise rather than a set of callbacks because it settles exactly once and
 * serves waiters that arrive after it just as well as before — which is the
 * only hard part here, and what a hand-rolled listener list gets wrong by
 * firing twice or not at all.
 */
let announceClient!: (client: SupabaseClient) => void;
const firstClient = new Promise<SupabaseClient>((resolve) => {
  announceClient = resolve;
});

/**
 * Waits for a client without asking for one to be created.
 *
 * For code that needs to know about a session if there is one, but has no
 * business making a visitor download an auth client to find out.
 */
export function whenSupabaseClient(): Promise<SupabaseClient> {
  return firstClient;
}

export function getSupabase(): Promise<SupabaseClient> | null {
  if (!isSupabaseConfigured) return null;

  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => {
    const client = createClient(url as string, publishableKey as string, {
      auth: {
        // Students move between the lab and home, so the session should
        // survive a closed tab.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    // Hands the waiting session hook its client. A no-op on every call after
    // the first, because a promise resolves once.
    announceClient(client);
    return client;
  });

  return clientPromise;
}

/**
 * Whether these two parts of an address are an auth provider sending someone
 * back.
 *
 * Pure, and handed the strings rather than reading `window` itself, so the
 * rule can be tested: this module reads `import.meta.env` at load time, which
 * a test cannot vary.
 *
 * Both halves of the URL matter, and each flow uses a different one. The PKCE
 * exchange comes back as `?code=`; the implicit flow and an email confirmation
 * link come back as `#access_token=`; and either turns into `error=` in its
 * own half when the student declines at Google's consent screen. A flow this
 * misses is a token sitting in the address with nothing that will read it.
 */
export function isAuthCallback(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  // A fragment is query syntax once the `#` is off the front.
  const fragment = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

  // A parameter that is present but empty carries nothing to exchange, so an
  // existence check is not enough.
  const carries = (params: URLSearchParams, keys: string[]): boolean =>
    keys.some((key) => Boolean(params.get(key)));

  return (
    carries(query, ['code', 'token_hash', 'error', 'error_description']) ||
    carries(fragment, ['access_token', 'error', 'error_description'])
  );
}

/** The same question, asked of the address actually being visited. */
export function hasAuthCallback(): boolean {
  if (!isSupabaseConfigured) return false;
  try {
    return isAuthCallback(window.location.search, window.location.hash);
  } catch {
    return false;
  }
}

/**
 * What a provider said went wrong, if it said anything.
 *
 * A recovery link that has expired, or a student who declines at Google's
 * consent screen, comes back with an `error` and no token. Nothing downstream
 * would otherwise notice: there is no session to create and no event to emit,
 * so the sign-in form would simply reappear as though the link had never been
 * clicked.
 *
 * `error_description` first because it is the sentence meant for a person;
 * `error` is a code like `access_denied`.
 */
export function authCallbackError(search: string, hash: string): string | null {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

  for (const params of [query, fragment]) {
    const described = params.get('error_description');
    if (described) return described;
    const code = params.get('error');
    if (code) return code;
  }
  return null;
}

/*
 * Captured at module load, which is the only moment it can be.
 *
 * The client strips the token and the error from the address as soon as it has
 * read them, and this module is imported at startup while the client is still
 * a dynamic import that has not been asked for. By the time the sign-in form
 * mounts and wants something to display, the address is clean.
 */
const arrival = ((): string | null => {
  if (!isSupabaseConfigured) return null;
  try {
    return authCallbackError(window.location.search, window.location.hash);
  } catch {
    return null;
  }
})();

/**
 * Why the provider turned this visit away, for the form to explain.
 *
 * It describes how this page was loaded, not a current state, and so answers
 * the same for as long as the page lives. Left that way on purpose: consuming
 * it on the first read would be tidier, but React calls a `useState`
 * initialiser twice under StrictMode, and a message that disappears in
 * development is worse than one that outstays its welcome in a corner case.
 */
export function arrivalError(): string | null {
  return arrival;
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
