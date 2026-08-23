import { ArrowUpRight, BookOpen, Clock } from '@phosphor-icons/react';
import { useState } from 'react';

import { concepts } from '../../content/concepts';
import { useTranslation } from '../../i18n/context';
import './ConceptPeek.css';

/**
 * The real concepts, opened one at a time.
 *
 * The section this replaces made four claims about learning — "explained in
 * plain words", "links to trustworthy sources" — which is a promise anyone can
 * write. The material behind those claims already exists in
 * `content/concepts.ts`: five topics with a summary, a key idea, a reading
 * time and citations of MDN and MIT Press. Showing it *is* the argument, and
 * it costs nothing to keep true, because it is the same content the app opens
 * in its concept drawer.
 */
export function ConceptPeek() {
  const { d, language, fill } = useTranslation();
  const [openId, setOpenId] = useState(concepts[0]?.id ?? '');

  return (
    <div className="concept-peek">
      {/* The titles, as a column of tabs: one row per concept, so the list of
          what Tobot teaches is readable at a glance. */}
      <div className="concept-peek__list" role="tablist" aria-label={d.landing.learnTitle}>
        {concepts.map((concept) => {
          const copy = concept.copy[language];
          const open = concept.id === openId;

          return (
            <button
              type="button"
              role="tab"
              aria-selected={open}
              className="concept-peek__tab"
              data-category={concept.category}
              data-open={open || undefined}
              key={concept.id}
              onClick={() => setOpenId(concept.id)}
            >
              <span className="concept-peek__tab-title">{copy.title}</span>
              <span className="concept-peek__tab-time">
                <Clock weight="bold" />
                {fill(d.landing.readingTime, { minutes: concept.readingMinutes })}
              </span>
            </button>
          );
        })}
      </div>

      {/* The one that is open, with its own colour. */}
      {concepts
        .filter((concept) => concept.id === openId)
        .map((concept) => {
          const copy = concept.copy[language];
          /*
            One entry per publisher, in the reader's language where there is a
            choice. Most concepts cite MDN twice — once per language — and
            listing both produced two identical-looking links side by side.
          */
          const references = [...concept.references]
            .sort((a, b) => (a.language === language ? -1 : b.language === language ? 1 : 0))
            .filter(
              (reference, index, all) =>
                all.findIndex((other) => other.publisher === reference.publisher) === index,
            );

          return (
            <article className="concept-peek__panel" data-category={concept.category} key={concept.id}>
              <h3 className="concept-peek__title">{copy.title}</h3>
              <p className="concept-peek__summary">{copy.summary}</p>

              <p className="concept-peek__key">
                <BookOpen weight="duotone" />
                {copy.keyIdea}
              </p>

              <div className="concept-peek__sources">
                <span className="concept-peek__sources-label">{d.landing.sourcesLabel}</span>
                <ul>
                  {references.slice(0, 2).map((reference) => (
                    <li key={reference.url}>
                      <a href={reference.url} target="_blank" rel="noreferrer noopener">
                        {reference.publisher}
                        <ArrowUpRight weight="bold" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
    </div>
  );
}
