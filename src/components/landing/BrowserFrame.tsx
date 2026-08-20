import './BrowserFrame.css';

interface BrowserFrameProps {
  /** Shown in the fake address bar. */
  url?: string;
  /** Tilts the frame slightly, as a product shot rather than a screenshot. */
  tilt?: boolean;
  children: React.ReactNode;
}

/**
 * A browser window around a product shot.
 *
 * The landing page's job is to show the tool, and a bare screenshot floating on
 * a page reads as a diagram of the tool rather than the thing itself. The
 * chrome says "this is software you can open", which is exactly the claim the
 * page is making.
 *
 * Decorative throughout: the dots and the address are `aria-hidden`, so a
 * screen reader hears only whatever is being framed.
 */
export function BrowserFrame({ url = 'tobot.app', tilt = false, children }: BrowserFrameProps) {
  return (
    <div className="browser-frame" data-tilt={tilt || undefined}>
      <div className="browser-frame__bar" aria-hidden="true">
        <span className="browser-frame__dots">
          <i />
          <i />
          <i />
        </span>
        <span className="browser-frame__url">{url}</span>
      </div>
      <div className="browser-frame__body">{children}</div>
    </div>
  );
}
