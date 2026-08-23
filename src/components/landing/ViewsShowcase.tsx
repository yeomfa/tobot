import { useCallback, useMemo, useState } from 'react';

import { showcaseDemo } from '../../content/landingDemo';
import { useTranslation } from '../../i18n/context';
import { DemoPlayer } from './DemoPlayer';
import './ViewsShowcase.css';

/**
 * The same algorithm as blocks and as code, side by side.
 *
 * The pairing is the product's whole claim, and these two are the halves that
 * carry it: one is what a student assembles, the other is what they are
 * learning to read. The diagram was here too and has gone — four nodes was
 * either a caricature of the real thing or, at full size, a column too tall to
 * read beside a paragraph. It has a section of its own to earn later.
 *
 * Both halves highlight together, so the line a visitor is looking at in one
 * is lit in the other. That correspondence is the argument; everything else is
 * decoration around it.
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

  const activeBlock = demo.steps[step]?.activeId ?? null;

  return (
    <div className="views-showcase">
      <div className="views-showcase__panel">
        <span className="views-showcase__label">{d.landing.showcaseLabels.blocks}</span>
        <DemoPlayer demo={demo} pace={1900} onStep={onStep} />
      </div>

      <div className="views-showcase__panel views-showcase__panel--code">
        <span className="views-showcase__label">{d.landing.showcaseLabels.code}</span>
        <div className="views-showcase__code-body">
        <pre className="views-showcase__code">
          <code>
            {demo.code?.map((line, index) => (
              <span
                className="views-showcase__line"
                key={index}
                data-on={line.blockId === activeBlock || undefined}
                data-indent={line.indent || undefined}
              >
                {line.tokens.map((token, position) => (
                  <span className="views-showcase__tok" data-kind={token.kind} key={position}>
                    {token.text}
                  </span>
                ))}
              </span>
            ))}
          </code>
        </pre>
        </div>

        {says && <p className="views-showcase__says">{says}</p>}
      </div>
    </div>
  );
}
