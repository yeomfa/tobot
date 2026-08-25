/**
 * Every address the app answers to, in one place.
 *
 * In English, like the rest of the source: the interface is translated, the
 * code is not, and a URL is code. Written out rather than assembled from
 * fragments so that searching for a path finds it, and so a rename is one
 * edit. They are real paths, served from the root: the host rewrites unknown
 * ones to `index.html`, which is `vercel.json`'s job rather than anything
 * here.
 */
export const ROUTES = {
  /** The public page: what Tobot is, for someone who has never seen it. */
  landing: '/',
  /** Signing in and registering. */
  login: '/login',
  /** The student's saved work, examples and concepts. */
  library: '/library',
  /** The editor itself. */
  editor: '/app',
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
