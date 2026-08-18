import { ArrowSquareOut, Warning, X } from '@phosphor-icons/react';
import { memo, useEffect, useRef } from 'react';

import { concepts, conceptsById } from '../content/concepts';
import type { ConceptId } from '../content/concepts';
import { useTranslation } from '../i18n/context';
import './ConceptDrawer.css';

interface ConceptDrawerProps {
  /** Concept to show; `null` keeps the drawer closed. */
  conceptId: ConceptId | null;
  onClose: () => void;
  onNavigate: (id: ConceptId) => void;
}

/**
 * Renders the `` `code` `` spans that appear in the concept prose. The content
 * is plain text rather than markup, so the backticks have to be turned into
 * real elements here — otherwise they show up literally in the article.
 */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
          <code key={index}>{part.slice(1, -1)}</code>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * Concepts live in a slide-over panel rather than a pane in the layout.
 *
 * A single topic needs roughly 675px of vertical room to read comfortably —
 * far more than any docked pane can spare without starving the editor. The
 * drawer borrows full height only while it is open, and returns it on close.
 */
export const ConceptDrawer = memo(function ConceptDrawer({
  conceptId,
  onClose,
  onNavigate,
}: ConceptDrawerProps) {
  const { d, language, fill } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Escape closes, matching every other dismissible surface in the app.
  useEffect(() => {
    if (!conceptId) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [conceptId, onClose]);

  // Move focus into the panel so keyboard and screen-reader users land there.
  useEffect(() => {
    if (conceptId) panelRef.current?.focus();
  }, [conceptId]);

  // Switching topics should start at the top, not mid-article.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [conceptId]);

  const concept = conceptId ? conceptsById.get(conceptId) : null;
  const copy = concept?.copy[language];

  return (
    <>
      <div
        className="drawer-scrim"
        data-open={conceptId !== null || undefined}
        onClick={onClose}
        role="presentation"
      />

      <aside
        ref={panelRef}
        className="drawer"
        data-open={conceptId !== null || undefined}
        data-category={concept?.category}
        role="dialog"
        aria-modal="false"
        aria-label={d.concepts.title}
        aria-hidden={conceptId === null}
        tabIndex={-1}
      >
        {concept && copy && (
          <>
            <header className="drawer__header">
              <div className="drawer__heading">
                <span className="drawer__eyebrow">{d.concepts.title}</span>
                <h2 className="drawer__title">{copy.title}</h2>
                <span className="drawer__time">
                  {fill(d.concepts.readingTime, { minutes: concept.readingMinutes })}
                </span>
              </div>
              <button
                type="button"
                className="drawer__close"
                onClick={onClose}
                aria-label={d.actions.close}
              >
                <X weight="bold" />
              </button>
            </header>

            {/* Topic switcher, so a student can browse without leaving. */}
            <nav className="drawer__nav" aria-label={d.concepts.title}>
              {concepts.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="drawer__nav-item"
                  data-category={entry.category}
                  data-current={entry.id === concept.id || undefined}
                  onClick={() => onNavigate(entry.id)}
                >
                  {entry.copy[language].title}
                </button>
              ))}
            </nav>

            <div className="drawer__scroll" ref={scrollRef}>
              <p className="drawer__summary">{copy.summary}</p>

              <div className="drawer__key-idea">
                <span className="drawer__key-label">{d.concepts.keyIdea}</span>
                <p>
                  <RichText text={copy.keyIdea} />
                </p>
              </div>

              {copy.body.map((paragraph, index) => (
                <p key={index} className="drawer__paragraph">
                  <RichText text={paragraph} />
                </p>
              ))}

              <h3 className="drawer__section">{d.concepts.commonMistakes}</h3>
              <ul className="drawer__mistakes">
                {copy.mistakes.map((mistake, index) => (
                  <li key={index}>
                    <Warning className="drawer__mistake-icon" weight="fill" aria-hidden="true" />
                    <RichText text={mistake} />
                  </li>
                ))}
              </ul>

              <h3 className="drawer__section">
                {d.concepts.references}
                <span className="drawer__section-hint">{d.concepts.referencesHint}</span>
              </h3>
              <ul className="drawer__references">
                {concept.references.map((reference) => (
                  <li key={reference.url}>
                    <a href={reference.url} target="_blank" rel="noreferrer noopener">
                      <span className="drawer__ref-label">{reference.label}</span>
                      <span className="drawer__ref-meta">
                        {reference.publisher}
                        <span className="drawer__ref-lang">{reference.language}</span>
                        <ArrowSquareOut className="drawer__ref-arrow" aria-hidden="true" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </aside>
    </>
  );
});
