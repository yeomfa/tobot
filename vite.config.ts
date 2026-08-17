import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages serves a project site from `/<repo>/`, so assets must be
 * requested with that prefix. The workflow passes the repository name in as
 * `BASE_PATH`; local dev and user/organisation pages keep the root.
 */
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    // The app is small enough that a source map costs little and makes
    // debugging a deployed build possible.
    sourcemap: true,
  },
});
