/**
 * Who made this and which version it is.
 *
 * The version comes from `package.json` through Vite's `define`, so the number
 * on screen is the number that was built and cannot drift from the release.
 */
export const APP_VERSION = __APP_VERSION__;

/** The studio behind Tobot, credited on the landing page and in the app. */
export const MAKER = {
  name: 'mocta',
  url: 'https://mocta.co',
} as const;
