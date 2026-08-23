import { ArrowRight, Clock } from '@phosphor-icons/react';

import { concepts } from '../../content/concepts';
import { useTranslation } from '../../i18n/context';
import './ConceptPeek.css';

/**
 * What Tobot explains, as a shelf rather than a reader.
 *
 * The shelf is the extensible part of the page. It reads from `concepts`
 * today, but nothing about the layout is specific to them: a topic, a course
 * or a whole track is the same shape — a name, a length, a colour. When those
 * arrive, this takes a list rather than importing one, and the section keeps
 * its place and its heading.
 *
 * The version this replaces opened a concept in place, with its summary, its
 * key idea and its citations — which was true, complete, and the wrong thing
 * to put on a landing page. Nobody arrives here to read about variables; they
 * arrive to decide whether to open the tool. Two paragraphs of documentation
 * one section before the final call to action asks them to start studying
 * instead.
 *
 * So the shelf: five titles, their reading times, and the publishers behind
 * them. It proves the material exists and is properly sourced in about three
 * seconds, and the reading itself waits until they are inside — which is also
 * where the app can track what they have read.
 */
export function ConceptPeek({ onTry }: { onTry: () => void }) {
  const { d, language, fill } = useTranslation();

  // Every publisher cited across the concepts, named once.
  const publishers = [
    ...new Set(concepts.flatMap((concept) => concept.references.map((r) => r.publisher))),
  ];

  return (
    <div className="concept-peek">
      <ul className="concept-peek__shelf">
        {concepts.map((concept) => (
          <li className="concept-peek__item" data-category={concept.category} key={concept.id}>
            <span className="concept-peek__name">{concept.copy[language].title}</span>
            <span className="concept-peek__time">
              <Clock weight="bold" />
              {fill(d.landing.readingTime, { minutes: concept.readingMinutes })}
            </span>
          </li>
        ))}

        {/*
          Open-ended on purpose. Naming five topics and stopping would say
          Tobot is those five, and what goes here is not fixed to concepts
          either — topics, courses and whatever the platform grows into all
          belong on this shelf. "And more" rather than "more on the way",
          which promises a schedule nobody has committed to.
        */}
        <li className="concept-peek__item concept-peek__item--more">{d.landing.andMore}</li>
      </ul>

      <p className="concept-peek__sources">
        {fill(d.landing.sourcedFrom, { publishers: publishers.join(' · ') })}
      </p>

      <button type="button" className="landing__cta" onClick={onTry}>
        {d.landing.exploreConcepts}
        <ArrowRight weight="bold" />
      </button>
    </div>
  );
}
