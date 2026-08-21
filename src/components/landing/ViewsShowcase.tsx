import { useCallback, useMemo, useState } from 'react';

import { showcaseDemo } from '../../content/landingDemo';
import { useTranslation } from '../../i18n/context';
import { DemoPlayer } from './DemoPlayer';
import { MiniFlow } from './MiniFlow';
import { RobotGreeting } from './RobotGreeting';
import './ViewsShowcase.css';

/**
 * One algorithm, in the forms Tobot keeps in step.
 *
 * Everything here is drawn for the page. The editor's real `Flowchart` lays
 * out the whole program at whatever size that takes, which for this algorithm
 * is a tall column of eleven nodes — right for a canvas you can pan around,
 * unreadable in a panel beside a paragraph. `MiniFlow` shows four nodes big
 * enough to look at, in the shapes and colours the app uses.
 *
 * The two views advance together, so a visitor watching the blocks can see
 * which part of the diagram they are in.
 */
export function ViewsShowcase() {
  const { d, language } = useTranslation();
  const demo = useMemo(() => showcaseDemo(language), [language]);
  const [says, setSays] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const onStep = useCallback((message: string | null, index: number) => {
    setSays(message);
    setStep(index);
  }, []);

  /* The five block steps map onto the diagram's four nodes: the loop and the
     statement inside it are one node there, because a diagram shows the shape
     of a program rather than every line of it. */
  const flowStep = [0, 1, 1, 2, 3][step] ?? null;

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
            size="md"
            peek="bottom"
          />
        </div>
      </div>

      <div className="views-showcase__cell views-showcase__cell--chart">
        <span className="views-showcase__label">{d.landing.showcaseLabels.flowchart}</span>
        <div className="views-showcase__chart">
          <MiniFlow activeStep={flowStep} />
        </div>
      </div>
    </div>
  );
}
