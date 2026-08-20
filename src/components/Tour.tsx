import { ArrowLeft, ArrowRight, X } from '@phosphor-icons/react';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useTranslation } from '../i18n/context';
import './Tour.css';

interface TourProps {
  open: boolean;
  onClose: () => void;
}

/** A stop on the tour: the element to point at and the copy to show. */
interface Stop {
  /** CSS selector for the element being described. */
  target: string | null;
  titleKey: string;
  bodyKey: string;
}

const STOPS: Stop[] = [
  { target: null, titleKey: 'welcomeTitle', bodyKey: 'welcomeBody' },
  { target: '.app__palette', titleKey: 'paletteTitle', bodyKey: 'paletteBody' },
  { target: '.app__canvas', titleKey: 'canvasTitle', bodyKey: 'canvasBody' },
  { target: '.app__drawer-tabs', titleKey: 'drawerTitle', bodyKey: 'drawerBody' },
  { target: '.app__robot', titleKey: 'robotTitle', bodyKey: 'robotBody' },
  // Points at the robot's own transport rather than the header button, which
  // is where a student actually drives a run from.
  { target: '.run-panel__controls', titleKey: 'runTitle', bodyKey: 'runBody' },
  { target: '.app__toggles', titleKey: 'panelsTitle', bodyKey: 'panelsBody' },
  { target: null, titleKey: 'endTitle', bodyKey: 'endBody' },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * First-run tour.
 *
 * It highlights a real element per stop by cutting a hole in a full-screen
 * scrim, so the student reads each description against the actual interface
 * rather than a screenshot of it.
 */
export const Tour = memo(function Tour({ open, onClose }: TourProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ width: 340, height: 240 });

  const stop = STOPS[index];

  // Measured in a layout effect so the cutout paints with the card, not a
  // frame later.
  useLayoutEffect(() => {
    if (!open) return;
    if (!stop.target) {
      setRect(null);
      return;
    }
    const element = document.querySelector(stop.target);
    if (!element) {
      setRect(null);
      return;
    }
    const box = element.getBoundingClientRect();
    const pad = 6;
    setRect({
      top: box.top - pad,
      left: box.left - pad,
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    });
  }, [open, stop]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const box = card.getBoundingClientRect();
    setCardSize((current) =>
      Math.abs(current.height - box.height) < 2 && Math.abs(current.width - box.width) < 2
        ? current
        : { width: box.width, height: box.height },
    );
  }, [index, open]);

  // Keep the cutout on the element if the window is resized mid-tour.
  useEffect(() => {
    if (!open) return;
    const onResize = (): void => setIndex((current) => current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, STOPS.length - 1));
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isLast = index === STOPS.length - 1;

  /**
   * Places the card beside the highlight, clamped to the viewport on both
   * axes. The clamp uses the card's measured height — assuming a fixed height
   * pushed it off-screen for the taller stops.
   */
  const cardStyle = ((): React.CSSProperties => {
    if (!rect) return {};
    const { width: cardWidth, height: cardHeight } = cardSize;
    const margin = 16;
    const clampTop = (value: number): number =>
      Math.max(margin, Math.min(value, window.innerHeight - cardHeight - margin));
    const clampLeft = (value: number): number =>
      Math.max(margin, Math.min(value, window.innerWidth - cardWidth - margin));

    const spaceRight = window.innerWidth - (rect.left + rect.width);
    if (spaceRight > cardWidth + margin) {
      return { top: clampTop(rect.top), left: rect.left + rect.width + margin };
    }
    if (rect.left > cardWidth + margin) {
      return { top: clampTop(rect.top), left: rect.left - cardWidth - margin };
    }

    // No room either side: sit below the highlight, or above it if that
    // would overflow the bottom.
    const below = rect.top + rect.height + margin;
    const top = below + cardHeight + margin > window.innerHeight
      ? clampTop(rect.top - cardHeight - margin)
      : clampTop(below);
    return { top, left: clampLeft(rect.left) };
  })();

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={t('tour.welcomeTitle')}>
      <div
        className="tour__scrim"
        /* Shading is the spotlight's job whenever there is one to draw. */
        data-plain={rect ? undefined : true}
        onClick={onClose}
        role="presentation"
      />

      {rect && (
        <div
          className="tour__spotlight"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}

      <div
        ref={cardRef}
        className="tour__card"
        data-centred={rect ? undefined : true}
        style={cardStyle}
      >
        {/* A plain count rather than a row of segments: it says exactly the
            same thing in less ink, and the card is meant to stay out of the
            way of the interface it is describing. */}
        <p className="tour__count">
          {index + 1} / {STOPS.length}
        </p>

        <h2 className="tour__title">{t(`tour.${stop.titleKey}`)}</h2>
        <p className="tour__body">{t(`tour.${stop.bodyKey}`)}</p>

        <div className="tour__actions">
          <button type="button" className="tour__skip" onClick={onClose}>
            {t('tour.skip')}
          </button>

          <div className="tour__nav">
            {index > 0 && (
              <button
                type="button"
                className="tour__button"
                onClick={() => setIndex((i) => i - 1)}
                aria-label={t('tour.back')}
              >
                <ArrowLeft weight="bold" />
              </button>
            )}
            <button
              type="button"
              className="tour__button tour__button--primary"
              onClick={() => (isLast ? onClose() : setIndex((i) => i + 1))}
            >
              {isLast ? t('tour.done') : t('tour.next')}
              {!isLast && <ArrowRight weight="bold" />}
            </button>
          </div>
        </div>

        <button type="button" className="tour__close" onClick={onClose} aria-label={t('actions.close')}>
          <X weight="bold" />
        </button>
      </div>
    </div>
  );
});
