import { memo, useState } from 'react';

import { concepts } from '../content/concepts';
import type { ConceptId } from '../content/concepts';
import { useTranslation } from '../i18n/context';
import './Concepts.css';

interface ConceptsProps {
  /** Concept to open, set when a student clicks "?" on a block. */
  selected: ConceptId | null;
  onSelect: (id: ConceptId | null) => void;
}

export const Concepts = memo(function Concepts({ selected, onSelect }: ConceptsProps) {
  const { d, language, fill } = useTranslation();
  const [expanded, setExpanded] = useState<ConceptId | null>(selected);

  // The prop wins when it changes, so clicking "?" always opens that topic.
  const openId = selected ?? expanded;

  const toggle = (id: ConceptId): void => {
    const next = openId === id ? null : id;
    setExpanded(next);
    onSelect(next);
  };

  return (
    <div className="concepts">
      <header className="concepts__header">
        <h2 className="concepts__title">{d.concepts.title}</h2>
        <p className="concepts__subtitle">{d.concepts.subtitle}</p>
      </header>

      <div className="concepts__list">
        {concepts.map((concept) => {
          const copy = concept.copy[language];
          const isOpen = openId === concept.id;

          return (
            <article
              key={concept.id}
              className="concept"
              data-category={concept.category}
              data-open={isOpen || undefined}
            >
              <button
                type="button"
                className="concept__head"
                onClick={() => toggle(concept.id)}
                aria-expanded={isOpen}
              >
                <span className="concept__head-text">
                  <span className="concept__name">{copy.title}</span>
                  <span className="concept__summary">{copy.summary}</span>
                </span>
                <span className="concept__meta">
                  <span className="concept__time">
                    {fill(d.concepts.readingTime, { minutes: concept.readingMinutes })}
                  </span>
                  <span className="concept__chevron" aria-hidden="true">
                    ›
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="concept__body">
                  <p className="concept__key-idea">
                    <span className="concept__key-label">{d.concepts.keyIdea}</span>
                    {copy.keyIdea}
                  </p>

                  {copy.body.map((paragraph, index) => (
                    <p key={index} className="concept__paragraph">
                      {paragraph}
                    </p>
                  ))}

                  <h4 className="concept__section-title">{d.concepts.commonMistakes}</h4>
                  <ul className="concept__mistakes">
                    {copy.mistakes.map((mistake, index) => (
                      <li key={index}>{mistake}</li>
                    ))}
                  </ul>

                  <h4 className="concept__section-title">
                    {d.concepts.references}
                    <span className="concept__section-hint">{d.concepts.referencesHint}</span>
                  </h4>
                  <ul className="concept__references">
                    {concept.references.map((reference) => (
                      <li key={reference.url}>
                        <a href={reference.url} target="_blank" rel="noreferrer noopener">
                          <span className="concept__ref-label">{reference.label}</span>
                          <span className="concept__ref-publisher">
                            {reference.publisher}
                            <span className="concept__ref-lang">{reference.language}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
});
