import { describe, expect, it } from 'vitest';

import { isAuthCallback } from './supabase';

/**
 * The same rule `supabase.ts` applies to `VITE_SUPABASE_GOOGLE`.
 *
 * Kept as a function rather than imported because the module reads
 * `import.meta.env` at load time, which a test cannot vary per case.
 */
function enabled(raw: string | undefined): boolean {
  return String(raw ?? '').trim().toLowerCase() === 'true';
}

/**
 * This flag is typed by hand into a GitHub repository variable, where an exact
 * match against 'true' turns `TRUE` into a hidden button and no error — which
 * is how it shipped to production reading false.
 */
describe('the Google sign-in flag', () => {
  it('accepts what people actually type', () => {
    expect(enabled('true')).toBe(true);
    expect(enabled('TRUE')).toBe(true);
    expect(enabled('True')).toBe(true);
    expect(enabled(' true ')).toBe(true);
  });

  it('stays off for anything that is not true', () => {
    expect(enabled('false')).toBe(false);
    expect(enabled('FALSE')).toBe(false);
    expect(enabled('')).toBe(false);
    expect(enabled(undefined)).toBe(false);
    expect(enabled('yes')).toBe(false);
    expect(enabled('1')).toBe(false);
  });
});

/**
 * How a sign-up response is read.
 *
 * Supabase answers a re-registration with success rather than an error, and
 * hands back a user whose `identities` array is empty — deliberately, so the
 * form cannot be used to discover who already has an account. Reading only
 * `error` therefore told someone to check an inbox no message was going to
 * reach.
 */
type SignUpResult = {
  user: { identities?: unknown[] } | null;
  session: unknown | null;
};

function outcome(data: SignUpResult): 'exists' | 'confirm' | 'signedIn' {
  if (data.user && data.user.identities?.length === 0) return 'exists';
  return data.session ? 'signedIn' : 'confirm';
}

describe('reading a sign-up response', () => {
  it('recognises an address that is already registered', () => {
    expect(outcome({ user: { identities: [] }, session: null })).toBe('exists');
  });

  it('asks a genuinely new account to confirm its email', () => {
    expect(outcome({ user: { identities: [{}] }, session: null })).toBe('confirm');
  });

  it('goes straight in when the project has confirmation switched off', () => {
    expect(outcome({ user: { identities: [{}] }, session: {} })).toBe('signedIn');
  });

  it('does not mistake a missing identities field for an existing account', () => {
    // An older API shape, or a provider that omits it: unknown is not the
    // same as empty, and guessing wrong locks a real student out.
    expect(outcome({ user: {}, session: null })).toBe('confirm');
  });
});

/**
 * Spotting a provider sending someone back.
 *
 * Imported rather than restated, unlike the flag above: the rule is a pure
 * function of two strings precisely so a test can reach it without the module
 * having to read `import.meta.env` for anything it needs.
 *
 * What made this worth having its own rule: the hook that restores a session
 * used to check localStorage alone, and a student returning from Google has
 * their session in the address instead. Nothing created a client to read it,
 * the guarded route bounced them to `/login`, and the token was thrown away
 * with the URL that carried it.
 */
describe('spotting an auth provider sending someone back', () => {
  it('recognises the code the PKCE flow returns', () => {
    expect(isAuthCallback('?code=9f2c1a', '')).toBe(true);
  });

  it('recognises the token the implicit flow and confirmation links leave in the fragment', () => {
    expect(isAuthCallback('', '#access_token=abc&refresh_token=def&token_type=bearer')).toBe(true);
  });

  it('recognises the hash of an email confirmation link', () => {
    expect(isAuthCallback('?token_hash=pkce_abc&type=signup', '')).toBe(true);
  });

  // Declining at Google's consent screen comes back with no token at all, and
  // it still has to be read: the client is what turns it into a message.
  it('recognises a refusal in either half of the address', () => {
    expect(isAuthCallback('?error=access_denied', '')).toBe(true);
    expect(isAuthCallback('', '#error=access_denied&error_description=denied')).toBe(true);
  });

  it('reads a fragment whether or not the hash came with it', () => {
    expect(isAuthCallback('', 'access_token=abc')).toBe(true);
  });

  it('leaves an ordinary address alone', () => {
    expect(isAuthCallback('', '')).toBe(false);
    expect(isAuthCallback('?section=challenges', '#top')).toBe(false);
  });

  // Present but empty is not a callback: there is nothing to exchange, and
  // treating it as one downloads an auth client for no reason.
  it('ignores a parameter that carries nothing', () => {
    expect(isAuthCallback('?code=', '')).toBe(false);
    expect(isAuthCallback('', '#access_token=')).toBe(false);
  });
});

