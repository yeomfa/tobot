import { readFileSync } from 'node:fs';
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
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  build: {
    outDir: 'dist',
    // The app is small enough that a source map costs little and makes
    // debugging a deployed build possible.
    sourcemap: true,
  },
});
