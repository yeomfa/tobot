/** Replaced at build time by Vite with the version from package.json. */
declare const __APP_VERSION__: string;

/** Vite resolves an imported image to its final URL. */
declare module '*.png' {
  const src: string;
  export default src;
}
