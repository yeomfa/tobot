import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SECTION,
  isLibrarySection,
  LIBRARY_SECTIONS,
  ROUTES,
  sectionPath,
} from './routes';

describe('routes', () => {
  it('builds a section path under the library', () => {
    expect(sectionPath('challenges')).toBe('/library/challenges');
    expect(sectionPath('algorithms')).toBe('/library/algorithms');
  });

  it('recognises every section it lists', () => {
    for (const section of LIBRARY_SECTIONS) {
      expect(isLibrarySection(section)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    // Translated guesses are the realistic case: someone types the Spanish.
    for (const guess of ['retos', 'ejemplos', 'mine', '', undefined]) {
      expect(isLibrarySection(guess)).toBe(false);
    }
  });

  it('has a default that is a real section', () => {
    expect(isLibrarySection(DEFAULT_SECTION)).toBe(true);
  });

  it('keeps every path in English', () => {
    /*
      The interface is translated and the source is not, a URL being source.
      This catches a section added with a Spanish id, which would otherwise
      only show up as an odd-looking address nobody notices.
    */
    const paths = [...Object.values(ROUTES), ...LIBRARY_SECTIONS.map(sectionPath)];
    for (const path of paths) {
      expect(path).toMatch(/^[a-z/:-]+$/);
    }
  });
});
