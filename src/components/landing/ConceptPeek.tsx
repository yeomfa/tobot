import { ArrowRightIcon as ArrowRight } from '@phosphor-icons/react';

import { concepts } from '../../content/concepts';
import { statementIcon } from '../statementMeta';
import type { Statement } from '../../core/ast/types';
import { useTranslation } from '../../i18n/context';
import './ConceptPeek.css';

/**
 * What Tobot explains, drawn as a box the topics come out of.
 *
 * The shelf this replaces was an honest list and read as an inventory. The box
 * says something the list could not: that these are not five separate features
 * but the contents of one thing, and that more can come out of it. The dashed
 * card at the end of the fan is the same promise the copy makes, in the shape
 * of the drawing.
 *
 * Reading times are gone. On a page whose job is to get someone into the
 * editor, "3 min" invites them to budget for studying rather than to look
 * inside; the number belongs in the app, next to the reading itself.
 *
 * The shelf is also the extensible part of the page. It reads from `concepts`
 * today, but a topic, a course or a whole track is the same shape — a name and
 * a colour — so when those exist this takes a list rather than importing one.
 */
export function ConceptPeek({ onTry }: { onTry: () => void }) {
  const { d, language, fill } = useTranslation();

  const publishers = [
    ...new Set(concepts.flatMap((concept) => concept.references.map((r) => r.publisher))),
  ];

  return (
    <div className="concept-peek">
      <div className="concept-peek__scene">
        <span className="concept-peek__label" aria-hidden="true">
          {d.landing.boxLabel}
        </span>
        {/*
          The box is the frame around everything, not a picture beside it: the
          topics sit *in* it and the last ones break out over its top edge.
          Three attempts at drawing a container next to the cards all read as a
          bin with rubbish beside it — because a box you are looking at is not
          a box things are coming out of. Being inside the frame is what makes
          the claim.
        */}

        <ul className="concept-peek__fan">
          {concepts.map((concept, index) => {
            // The icon of the first statement the concept teaches, so a topic
            // is recognisable by the same mark it carries in the palette.
            const Icon = statementIcon[concept.statements[0] as Statement['kind']];

            return (
              <li
                className="concept-peek__card"
                data-category={concept.category}
                style={{ '--i': index } as React.CSSProperties}
                key={concept.id}
              >
                {Icon && <Icon weight="duotone" />}
                {concept.copy[language].title}
              </li>
            );
          })}

          {/*
            Open-ended on purpose. Naming five topics and stopping would say
            Tobot is those five, and what belongs on this shelf is not fixed to
            concepts either — topics, courses and whatever the platform grows
            into all sit here.
          */}
          <li
            className="concept-peek__card concept-peek__card--more"
            style={{ '--i': concepts.length } as React.CSSProperties}
          >
            {d.landing.andMore}
          </li>
        </ul>
      </div>

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
