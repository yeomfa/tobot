import { describe, expect, it } from 'vitest';

/**
 * Phosphor deprecated every short icon name.
 *
 * `SealCheck` and `SealCheckIcon` are the same component, but the first
 * carries `@deprecated Use SealCheckIcon` in its declaration — all 1512 icons
 * are shipped this way. The short names still compile and still render, so
 * nothing objects when one arrives: not the type checker, not the linter, not
 * a review. They break on a major upgrade instead, which is the worst possible
 * time to find out.
 *
 * The sources are read through Vite's glob rather than `node:fs`, so this runs
 * under the same browser-facing tsconfig as the app.
 */
const SOURCES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Every name imported from the icon package, with the file it came from. */
function importedIcons(): { name: string; file: string }[] {
  const found: { name: string; file: string }[] = [];

  for (const [file, source] of Object.entries(SOURCES)) {
    if (!source.includes('@phosphor-icons/react')) continue;

    const imports = source.matchAll(
      /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'@phosphor-icons\/react'/g,
    );

    for (const block of imports) {
      for (const part of block[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0].trim();
        // `Icon` itself is the shared type, not an icon.
        if (name && name !== 'Icon' && /^[A-Z][A-Za-z0-9]*$/.test(name)) {
          found.push({ name, file });
        }
      }
    }
  }

  return found;
}

describe('icon imports', () => {
  it('uses the suffixed names Phosphor recommends', () => {
    const offenders = importedIcons()
      .filter(({ name }) => !name.endsWith('Icon'))
      .map(({ name, file }) => `${file}: ${name} → ${name}Icon`);

    expect(offenders).toEqual([]);
  });

  it('finds the imports it is meant to be checking', () => {
    // Guards the test itself: a change to how icons are imported could leave
    // the check above passing because it is looking at nothing.
    expect(importedIcons().length).toBeGreaterThan(20);
  });
});
