import { useCallback, useMemo, useState } from 'react';

import { heroDemo } from '../../content/landingDemo';
import { useTranslation } from '../../i18n/context';
import { BrowserFrame } from './BrowserFrame';
import { DemoPlayer } from './DemoPlayer';
import { RobotGreeting } from './RobotGreeting';
import './HeroStage.css';

/**
 * The hero's demonstration.
 *
 * Two blocks, not seven. The hero has one job — show what a block is, and that
 * the robot runs it — and a seven-statement program spends most of its length
 * on parts nobody reads before scrolling. Two blocks also leave room to draw
 * them large enough to read from across a desk, which is what a hero is for.
 *
 * The blocks are the landing's own, not the editor's. That is deliberate: the
 * editor's blocks read their variable names from a real syntax tree, so an
 * English visitor met English keywords wrapped around Spanish names, and the
 * only ways out were to translate the tree or to teach the editor about a
 * marketing page. Both add weight to the app so a page can look right.
 */
export function HeroStage() {
  const { d, language } = useTranslation();
  const demo = useMemo(() => heroDemo(language), [language]);
  const [says, setSays] = useState<string | null>(null);

  const onStep = useCallback((message: string | null) => setSays(message), []);

  return (
    <div className="hero-stage">
      <BrowserFrame url="tobot.app/app" tilt>
        <div className="hero-stage__canvas">
          <DemoPlayer demo={demo} pace={2200} onStep={onStep} />
        </div>
      </BrowserFrame>

      <div className="hero-stage__robot">
        <RobotGreeting
          mood={says ? 'speaking' : 'idle'}
          message={says ?? d.landing.robotHello}
          follow
          size="lg"
        />
      </div>
    </div>
  );
}
