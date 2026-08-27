/**
 * Every address the app answers to, in one place.
 *
 * In English, like the rest of the source: the interface is translated, the
 * code is not, and a URL is code.
 *
 * The library used to be a single `/library` route with its four sections held
 * in React state, which meant the address never changed. Reloading on the
 * challenges list returned you to saved work, and there was no link to send
 * anyone — the section existed on screen but not in the URL, which is the one
 * place a section has to exist to be shareable.
 *
 * They are real paths, served from the root: the host rewrites unknown ones to
 * `index.html`, which is `vercel.json`'s job rather than anything here.
 */

/** The library's sections, in the order the rail lists them. */
export const LIBRARY_SECTIONS = ['algorithms', 'challenges', 'examples', 'concepts'] as const;

export type LibrarySection = (typeof LIBRARY_SECTIONS)[number];

/** Where the library sends someone who arrives without naming a section. */
export const DEFAULT_SECTION: LibrarySection = 'algorithms';

export const ROUTES = {
  /** The public page: what Tobot is, for someone who has never seen it. */
  landing: '/',
  /** Signing in and registering. */
  login: '/login',
  /** The library, which redirects to its default section. */
  library: '/library',
  /** The editor itself. */
  editor: '/app',
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * The address of one library section.
 *
 * Built here rather than written at each call site so that adding a section is
 * one edit to `LIBRARY_SECTIONS`, and so no component has to know that the
 * sections live under `/library` at all.
 */
export function sectionPath(section: LibrarySection): string {
  return `${ROUTES.library}/${section}`;
}

/** Whether a URL fragment names a section, for validating what a user typed. */
export function isLibrarySection(value: string | undefined): value is LibrarySection {
  return LIBRARY_SECTIONS.includes(value as LibrarySection);
}
