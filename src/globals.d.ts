/** Replaced at build time by Vite with the version from package.json. */
declare const __APP_VERSION__: string;

/** The subdirectory the app is served from, e.g. `/tobot/`. */
declare const __BASE_PATH__: string;

/** Vite resolves an imported image to its final URL. */
declare module '*.png' {
  const src: string;
  export default src;
}
