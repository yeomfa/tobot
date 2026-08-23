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
