import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phosphor renamed eighteen icons in v2 and kept the old names working as
 * aliases — so a deprecated one compiles, renders, and quietly waits to break
 * on a major upgrade. Nothing in the type system or the linter objects.
 *
 * This is the list from `@phosphor-icons/core`, where each renamed icon
 * carries its former name in an `alias` field. Reproduced rather than fetched
 * so the suite stays offline; it changes about once a major version.
 */
const DEPRECATED: Record<string, string> = {
  Activity: 'Pulse',
  ArchiveBox: 'BoxArrowDown',
  ArchiveTray: 'TrayArrowDown',
  Caduceus: 'Asclepius',
  CircleWavy: 'Seal',
  CircleWavyCheck: 'SealCheck',
  CircleWavyQuestion: 'SealQuestion',
  CircleWavyWarning: 'SealWarning',
  FileDotted: 'FileDashed',
  FileSearch: 'FileMagnifyingGlass',
  FolderDotted: 'FolderDashed',
  FolderNotch: 'Folder',
  FolderNotchMinus: 'FolderMinus',
  FolderNotchOpen: 'FolderOpen',
  FolderNotchPlus: 'FolderPlus',
  FolderSimpleDotted: 'FolderSimpleDashed',
  Lemniscate: 'Infinity',
  TextBolder: 'TextB',
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** Every name imported from the icon package, across the app. */
function importedIcons(): { name: string; file: string }[] {
  const found: { name: string; file: string }[] = [];

  for (const file of sourceFiles('src')) {
    const source = readFileSync(file, 'utf8');
    const imports = source.matchAll(
      /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'@phosphor-icons\/react'/g,
    );

    for (const block of imports) {
      for (const part of block[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0].trim();
        if (/^[A-Z][A-Za-z0-9]*$/.test(name)) found.push({ name, file });
      }
    }
  }

  return found;
}

describe('icon imports', () => {
  it('uses no icon Phosphor has renamed', () => {
    const offenders = importedIcons()
      .filter(({ name }) => name in DEPRECATED)
      .map(({ name, file }) => `${file}: ${name} → ${DEPRECATED[name]}`);

    expect(offenders).toEqual([]);
  });

  it('finds the imports it is meant to be checking', () => {
    // Guards the test itself: a change to how icons are imported could leave
    // the check above passing because it is looking at nothing.
    expect(importedIcons().length).toBeGreaterThan(20);
  });
});
