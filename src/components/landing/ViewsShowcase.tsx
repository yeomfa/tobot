import { useMemo } from 'react';

import { heroAlgorithm } from '../../content/heroDemo';
import { useTranslation } from '../../i18n/context';
import { CodePanel } from '../CodePanel';
import { Flowchart } from '../Flowchart';
import './ViewsShowcase.css';

/**
 * One algorithm, in the four forms Tobot keeps in step.
 *
 * The claim the whole product rests on is that these four never disagree, and
 * the honest way to make it is to render the real thing: two `CodePanel`s and
 * the real `Flowchart`, all fed the same algorithm the robot assembles in the
 * hero. Prose describing the agreement would be a weaker argument than the
 * agreement itself.
 *
 * The quadrants are deliberately unequal — the flowchart is tall, the text
 * views are wide — because four equal boxes would say these are four
 * interchangeable things, and they are not.
 */
export function ViewsShowcase() {
  const { d, language } = useTranslation();
  const algorithm = useMemo(() => heroAlgorithm(language), [language]);

  return (
    <div className="views-showcase">
      <figure className="views-showcase__cell views-showcase__cell--natural">
        <figcaption className="views-showcase__label">{d.landing.showcaseLabels.natural}</figcaption>
        <div className="views-showcase__body">
          <CodePanel
            algorithm={algorithm}
            view="natural"
            activeNodeId={null}
            erroredNodeId={null}
            onSelectNode={() => {}}
            onExport={() => {}}
          />
        </div>
      </figure>

      <figure className="views-showcase__cell views-showcase__cell--code">
        <figcaption className="views-showcase__label">{d.landing.showcaseLabels.code}</figcaption>
        <div className="views-showcase__body">
          <CodePanel
            algorithm={algorithm}
            view="code"
            activeNodeId={null}
            erroredNodeId={null}
            onSelectNode={() => {}}
            onExport={() => {}}
          />
        </div>
      </figure>

      <figure className="views-showcase__cell views-showcase__cell--chart">
        <figcaption className="views-showcase__label">
          {d.landing.showcaseLabels.flowchart}
        </figcaption>
        {/* The flowchart measures its container to fit itself, so this needs a
            height of its own or it collapses to nothing. */}
        <div className="views-showcase__body views-showcase__body--chart">
          <Flowchart
            program={algorithm.body}
            activeNodeId={null}
            erroredNodeId={null}
            onSelectNode={() => {}}
          />
        </div>
      </figure>
    </div>
  );
}
