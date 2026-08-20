/**
 * Every address the app answers to, in one place.
 *
 * Written out rather than assembled from fragments so that searching for a
 * path finds it, and so a rename is one edit. The router mounts these under a
 * hash — GitHub Pages has no server to rewrite unknown paths back to
 * `index.html` — but nothing else in the app needs to know that.
 */
export const ROUTES = {
  /** The public page: what Tobot is, for someone who has never seen it. */
  landing: '/',
  /** Signing in and registering. */
  login: '/entrar',
  /** The student's saved work, examples and concepts. */
  library: '/mis-algoritmos',
  /** The editor itself. */
  editor: '/app',
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
