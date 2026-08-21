import { useCallback, useMemo, useState } from 'react';

import { showcaseDemo } from '../../content/landingDemo';
import { heroAlgorithm } from '../../content/heroDemo';
import { useTranslation } from '../../i18n/context';
import { Flowchart } from '../Flowchart';
import { DemoPlayer } from './DemoPlayer';
import { RobotGreeting } from './RobotGreeting';
import './ViewsShowcase.css';

/**
 * One algorithm, in the forms Tobot keeps in step.
 *
 * The blocks and the running commentary are the landing's own, so they
 * translate and can be sized for reading at a distance. The flowchart is the
 * editor's real one: a diagram has no words to translate beyond the labels it
 * builds itself, and drawing a fake one would be inventing a picture of a
 * feature rather than showing it.
 */
export function ViewsShowcase() {
  const { d, language } = useTranslation();
  const demo = useMemo(() => showcaseDemo(language), [language]);
  const algorithm = useMemo(() => heroAlgorithm(language), [language]);
  const [says, setSays] = useState<string | null>(null);

  const onStep = useCallback((message: string | null) => setSays(message), []);

  return (
    <div className="views-showcase">
      <div className="views-showcase__cell">
        <span className="views-showcase__label">{d.landing.showcaseLabels.natural}</span>
        <div className="views-showcase__blocks">
          <DemoPlayer demo={demo} pace={1900} onStep={onStep} />
        </div>

        <div className="views-showcase__narrator">
          {/* Leaning in from the bottom edge rather than standing beside the
              blocks, where a whole robot would be a second thing to read. */}
          <RobotGreeting
            mood={says ? 'speaking' : 'thinking'}
            message={says}
            size="sm"
            peek="bottom"
          />
        </div>
      </div>

      <div className="views-showcase__cell views-showcase__cell--chart">
        <span className="views-showcase__label">{d.landing.showcaseLabels.flowchart}</span>
        {/* The flowchart measures its container to fit itself, so this needs a
            height of its own or it collapses to nothing. */}
        <div className="views-showcase__chart">
          <Flowchart
            program={algorithm.body}
            activeNodeId={null}
            erroredNodeId={null}
            onSelectNode={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
