import './Illustration.css';

/*
 * Every illustration, by name, as the URL of its own file.
 *
 * Files rather than inlined: as data they would ride in the JavaScript of every
 * screen whether shown or not. As files they are fetched when they appear and
 * cached like any image. They are lifted off the Flow originals by
 * scripts/brand/illustrations.py.
 */
const files = import.meta.glob<string>('../assets/illustrations/*.webp', {
  query: '?url',
  import: 'default',
  eager: true,
});

const URLS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace(/\.webp$/, ''), url]),
);

export type IllustrationName =
  | 'banner-saved'
  | 'banner-challenges'
  | 'banner-examples'
  | 'banner-concepts'
  | 'landing-step-build'
  | 'landing-step-understand'
  | 'landing-step-run'
  | 'landing-for-students'
  | 'landing-for-teachers'
  | 'landing-closing'
  | 'spot-library'
  | 'spot-editor'
  | 'spot-console'
  | 'spot-flowchart'
  | 'spot-search';

interface IllustrationProps {
  name: IllustrationName;
  className?: string;
  /** Above the fold, where waiting for the scroll would only delay it. */
  eager?: boolean;
}

/**
 * One of Tobot's illustrations.
 *
 * Decorative everywhere it is used: the words beside it already say what it
 * shows, so it is hidden from assistive technology rather than described twice.
 * The scenes with Tobot are made for navy and look their best on it; the spots
 * are objects in mid tones that read on light and dark alike.
 */
export function Illustration({ name, className, eager = false }: IllustrationProps) {
  const src = URLS[name];
  if (!src) return null;
  return (
    <img
      className={className ? `illustration ${className}` : 'illustration'}
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
