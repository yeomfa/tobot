import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* The version is read from package.json at build time, so the number shown in
   the app can never drift from the one that was released. */
const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

export default defineConfig({
  /*
   * Served from the root. The app used to live in a repository subdirectory
   * on GitHub Pages, which meant a `base` prefix, a `404.html` to fake
   * routing, and a plugin to bake the prefix into it — three moving parts that
   * between them produced a blank page on reload and an infinite redirect.
   * Vercel routes unknown paths to index.html itself, so all of it is gone.
   */
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react()],
  build: {
    outDir: 'dist',
    // The app is small enough that a source map costs little and makes
    // debugging a deployed build possible.
    sourcemap: true,
  },
});
