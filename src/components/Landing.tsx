import {
  ArrowRight,
  BookOpenText,
  ChalkboardTeacher,
  ChatCircleText,
  Check,
  Clock,
  Code,
  GraduationCap,
  Lightning,
  LinkSimple,
  Student,
  Translate,
  TreeStructure,
  TrendUp,
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

import { APP_VERSION, MAKER } from '../brand';
import { LANGUAGES, languageNames } from '../i18n';
import type { Language } from '../i18n';
import { useTranslation } from '../i18n/context';
import { ROUTES } from '../routes';
import { BrandMark } from './BrandMark';
import { SettingsMenu } from './SettingsMenu';
import { Blobs, Chips, DashRule } from './landing/Decor';
import { HeroStage } from './landing/HeroStage';
import { Reveal } from './landing/Reveal';
import { Starfield } from './landing/Starfield';
import { RobotGreeting } from './landing/RobotGreeting';
import { ViewsShowcase } from './landing/ViewsShowcase';
import './Landing.css';

/** The six things inside, each in the hue of the part of the editor it names. */
const FEATURES = [
  { key: 'views', icon: Code, hue: 'variable', wide: true },
  { key: 'diagram', icon: TreeStructure, hue: 'io', wide: false },
  { key: 'run', icon: Lightning, hue: 'conditional', wide: true },
  { key: 'robot', icon: ChatCircleText, hue: 'accent', wide: false },
  { key: 'concepts', icon: GraduationCap, hue: 'loop', wide: false },
  { key: 'validation', icon: Check, hue: 'success', wide: false },
] as const;

/** The four promises about learning, each in a hue of its own. */
const LEARN = [
  { key: 'explained', icon: BookOpenText, hue: 'io' },
  { key: 'sources', icon: LinkSimple, hue: 'variable' },
  { key: 'pace', icon: Clock, hue: 'conditional' },
  { key: 'growing', icon: TrendUp, hue: 'loop' },
] as const;

interface LandingProps {
  onTry: () => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
}

/**
 * The public page.
 *
 * It answers "what is this, and why would I use it" for a teacher deciding
 * whether to put it in front of a class, and gets a student into the editor
 * without asking for anything first — trying it is the strongest argument the
 * app has, so the primary action opens the editor rather than a sign-up form.
 *
 * The page is built out of the editor's own components: the hero runs the real
 * interpreter over real blocks, and the showcase renders the real code panels
 * and the real flowchart. A screenshot of a tool that changes weekly starts
 * lying the week after it is taken; this cannot, because it is the tool.
 *
 * No two neighbouring sections share a ground, an alignment and a content
 * shape. Five identical centred grids was the previous arrangement, and it
 * read as a list of features rather than as an argument.
 */
export function Landing({ onTry, language, onLanguageChange }: LandingProps) {
  const { d } = useTranslation();

  return (
    <div className="landing">
      <header className="landing__nav">
        <div className="landing__inner landing__nav-inner">
          <span className="landing__brand">
            <BrandMark size={28} />
            <span className="landing__brand-name">Tobot</span>
          </span>

          <nav className="landing__nav-links">
            {/* Without this a visitor who reads English lands on a Spanish
                page with no way out — the editor has the switch, but they
                would have to get there first to find it. */}
            <SettingsMenu
              value={language}
              options={LANGUAGES.map((code) => ({ value: code, label: languageNames[code] }))}
              onChange={onLanguageChange}
              trigger={Translate}
              label={d.settings.language}
            />
            <Link className="landing__nav-link" to={ROUTES.login}>
              {d.landing.signIn}
            </Link>
            <button type="button" className="landing__cta landing__cta--small" onClick={onTry}>
              {d.landing.tryIt}
            </button>
          </nav>
        </div>
      </header>

      <main>
        {/* 1 — Hero: left-aligned and asymmetric. Centring this was what set
            the centred tone for every section that followed. */}
        <section className="landing__hero">
          <Blobs />
          <Chips />

          <div className="landing__inner landing__hero-inner">
            <div className="landing__hero-copy">
              <p className="landing__eyebrow">{d.landing.eyebrow}</p>
              <h1 className="landing__title">{d.landing.title}</h1>
              <p className="landing__lead">{d.landing.lead}</p>

              <div className="landing__actions">
                <button type="button" className="landing__cta" onClick={onTry}>
                  {d.landing.tryIt}
                  <ArrowRight weight="bold" />
                </button>
                <Link className="landing__ghost" to={ROUTES.login}>
                  {d.landing.signIn}
                </Link>
              </div>

              <p className="landing__note">{d.landing.noAccount}</p>
            </div>

            <div className="landing__hero-stage">
              <HeroStage />
              <p className="landing__caption">{d.landing.demoCaption}</p>
            </div>
          </div>
        </section>

        {/* 2 — A short dark band. No cards, no icons, no grid: four words and
            the connectors between them. */}
        <section className="landing__band landing__band--dark landing__proof">
          <Starfield count={70} seed={7} />
          <div className="landing__inner">
            <p className="landing__proof-title">{d.landing.sameTitle}</p>
            <p className="landing__proof-row">
              {(['natural', 'pseudocode', 'code', 'chart'] as const).map((key, index) => (
                <span className="landing__proof-item" key={key}>
                  {index > 0 && <DashRule />}
                  <span className="landing__proof-word" data-view={key}>
                    {d.landing.views[key]}
                  </span>
                </span>
              ))}
            </p>
          </div>
        </section>

        {/* 3 — How it works: a vertical list beside a robot that stays with
            the reader, rather than three cards in a row. */}
        <section className="landing__band landing__how">
          <div className="landing__inner landing__how-inner">
            <div>
              <h2 className="landing__headline">{d.landing.stepsTitle}</h2>
              <p className="landing__lead">{d.landing.stepsLead}</p>

              <ol className="landing__steps">
                {(['build', 'compare', 'run'] as const).map((key, index) => (
                  <Reveal key={key} delay={index * 70}>
                    <li className="landing__step">
                      <span className="landing__step-number">{index + 1}</span>
                      <div>
                        <h3>{d.landing.steps[key].title}</h3>
                        <p>{d.landing.steps[key].body}</p>
                      </div>
                    </li>
                  </Reveal>
                ))}
              </ol>
            </div>

            {/* Decorative: what it says is already in the steps beside it. */}
            <div className="landing__guide" aria-hidden="true">
              <RobotGreeting
                mood="thinking"
                message={d.landing.robotGuide}
                size="md"
                peek="bottom"
              />
            </div>
          </div>
        </section>

        {/* 4 — One big object instead of many small ones. */}
        <section className="landing__band landing__band--raised landing__views">
          <div className="landing__inner">
            <h2 className="landing__headline">{d.landing.showcaseTitle}</h2>
            <p className="landing__lead">{d.landing.showcaseBody}</p>
            <ViewsShowcase />
          </div>
        </section>

        {/* 5 — Two cards, staggered, with mirrored corners: anything but two
            identical rectangles. */}
        <section className="landing__band landing__audience">
          <div className="landing__inner landing__audience-inner">
            <h2 className="landing__headline">{d.landing.forTitle}</h2>

            <article
              className="landing__audience-card"
              style={{ '--card-hue': 'var(--hue-io)' } as React.CSSProperties}
            >
              <span className="landing__audience-icon" data-hue="io">
                <Student weight="duotone" />
              </span>
              <h3>{d.landing.forStudents.title}</h3>
              <p>{d.landing.forStudents.body}</p>
            </article>

            <article
              className="landing__audience-card landing__audience-card--offset"
              style={{ '--card-hue': 'var(--hue-loop)' } as React.CSSProperties}
            >
              <span className="landing__audience-icon" data-hue="loop">
                <ChalkboardTeacher weight="duotone" />
              </span>
              <h3>{d.landing.forTeachers.title}</h3>
              <p>{d.landing.forTeachers.body}</p>
            </article>
          </div>
        </section>

        {/* 6 — Six cards in two shapes, each in the hue of the thing it
            describes. This is where the palette gets taught. */}
        <section className="landing__band landing__band--raised landing__features">
          <div className="landing__inner">
            <h2 className="landing__headline">{d.landing.featuresTitle}</h2>
            <div className="landing__cards">
              {FEATURES.map(({ key, icon: Icon, hue, wide }) => (
                <article className="landing__card" key={key} data-wide={wide || undefined}>
                  <span className="landing__card-icon" data-hue={hue}>
                    <Icon weight="duotone" />
                  </span>
                  <div>
                    <h3>{d.landing.features[key].title}</h3>
                    <p>{d.landing.features[key].body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 7 — Learning, then the close. Centring is earned here: it is the
            only centred section left. */}
        <section className="landing__band landing__learn">
          <div className="landing__inner landing__inner--narrow">
            <h2 className="landing__headline">{d.landing.learnTitle}</h2>
            <p className="landing__lead">{d.landing.learnLead}</p>
            <ul className="landing__learn-list">
              {LEARN.map(({ key, icon: Icon, hue }) => (
                <li className="landing__learn-item" key={key} data-hue={hue}>
                  <span className="landing__learn-icon">
                    <Icon weight="duotone" />
                  </span>
                  {d.landing.learn[key]}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing__band landing__band--dark landing__closing">
          <Starfield count={110} seed={23} dawn />
          <div className="landing__inner landing__inner--narrow">
            <div className="landing__closing-robot" aria-hidden="true">
              <RobotGreeting mood="done" message={d.landing.robotBye} size="md" />
            </div>
            <h2 className="landing__headline">{d.landing.closingTitle}</h2>
            <p className="landing__lead">{d.landing.closingBody}</p>
            <button type="button" className="landing__cta landing__cta--large" onClick={onTry}>
              {d.landing.tryItLong}
              <ArrowRight weight="bold" />
            </button>
            <p className="landing__note">{d.landing.noAccount}</p>
          </div>
        </section>
      </main>

      <footer className="landing__footer">
        <div className="landing__inner landing__footer-inner">
          <span className="landing__footer-brand">
            <BrandMark size={20} />
            Tobot
            <span className="landing__version">v{APP_VERSION}</span>
          </span>
          <span className="landing__maker">
            By{' '}
            <a href={MAKER.url} target="_blank" rel="noreferrer noopener">
              {MAKER.name}
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
