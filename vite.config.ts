import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages serves a project site from `/<repo>/`, so assets must be
 * requested with that prefix. The workflow passes the repository name in as
 * `BASE_PATH`; local dev and user/organisation pages keep the root.
 */
const base = process.env.BASE_PATH ?? '/';

/* The version is read from package.json at build time, so the number shown in
   the app can never drift from the one that was released. */
const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BASE_PATH__: JSON.stringify(base),
  },
  plugins: [
    react(),
    {
      // 404.html is served verbatim by GitHub Pages, so the base path has to
      // be baked into it at build time rather than read from a module.
      name: 'tobot-404-base',
      // Takes the directory this build is actually writing to. Hard-coding
      // `dist` meant any build with a different `outDir` shipped the
      // placeholder unreplaced, and 404.html then redirected to itself
      // forever — a blank page and a URL growing without limit.
      closeBundle: {
        sequential: true,
        handler(this: { environment?: { config?: { build?: { outDir?: string } } } }) {
          const outDir = this.environment?.config?.build?.outDir ?? 'dist';
          const file = resolve(outDir, '404.html');
          try {
            writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BASE_PATH__', base));
          } catch {
            /* No 404.html in this build; nothing to rewrite. */
          }
        },
      },
    },
  ],
  build: {
    outDir: 'dist',
    // The app is small enough that a source map costs little and makes
    // debugging a deployed build possible.
    sourcemap: true,
  },
});
