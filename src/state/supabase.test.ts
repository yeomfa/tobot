import { describe, expect, it } from 'vitest';

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
