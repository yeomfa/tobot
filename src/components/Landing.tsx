import {
  ArrowRight,
  ChalkboardTeacher,
  ChatCircleText,
  Check,
  Code,
  GraduationCap,
  Lightning,
  Sparkle,
  Student,
  TreeStructure,
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

import { APP_VERSION, MAKER } from '../brand';
import { useTranslation } from '../i18n/context';
import { ROUTES } from '../routes';
import { BrandMark } from './BrandMark';
import { BrowserFrame } from './landing/BrowserFrame';
import { LiveBlocks } from './landing/LiveBlocks';
import { RobotGreeting } from './landing/RobotGreeting';
import { Reveal } from './landing/Reveal';
import './Landing.css';

/**
 * The public page.
 *
 * Its job is to answer "what is this and why would I use it" for a teacher
 * deciding whether to put it in front of a class, and to get a student into
 * the editor without asking for anything first. Trying it is the strongest
 * argument the app has, so the primary action opens the editor rather than a
 * sign-up form: a student who has seen it work is already convinced, and an
 * account only matters once they have work worth keeping.
 */
export function Landing({ onTry }: { onTry: () => void }) {
  const { d } = useTranslation();

  return (
    <div className="landing">
      <header className="landing__nav">
        <span className="landing__brand">
          <BrandMark size={28} />
          <span className="landing__brand-name">Tobot</span>
        </span>

        <nav className="landing__nav-links">
          <Link className="landing__nav-link" to={ROUTES.login}>
            {d.landing.signIn}
          </Link>
          <button type="button" className="landing__cta landing__cta--small" onClick={onTry}>
            {d.landing.tryIt}
          </button>
        </nav>
      </header>

      <main>
        <section className="landing__hero">
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

          {/*
            The tool itself, not a picture of it. These are the editor's own
            blocks, assembling themselves: a screenshot goes stale the moment
            the editor changes, and this cannot, because it is the editor.
          */}
          <div className="landing__stage">
            <div className="landing__shot">
              <BrowserFrame url="tobot.app/app" tilt>
                <LiveBlocks />
              </BrowserFrame>
            </div>
            <div className="landing__host">
              <RobotGreeting mood="speaking" message={d.landing.robotHello} follow />
            </div>
          </div>
          <p className="landing__demo-caption">{d.landing.demoCaption}</p>
        </section>

        <section className="landing__section landing__section--audience landing__section--raised">
          <h2 className="landing__section-title">{d.landing.forTitle}</h2>
          <div className="landing__audience">
            <article className="landing__audience-card">
              <span className="landing__audience-icon">
                <Student weight="duotone" />
              </span>
              <h3>{d.landing.forStudents.title}</h3>
              <p>{d.landing.forStudents.body}</p>
            </article>
            <article className="landing__audience-card">
              <span className="landing__audience-icon">
                <ChalkboardTeacher weight="duotone" />
              </span>
              <h3>{d.landing.forTeachers.title}</h3>
              <p>{d.landing.forTeachers.body}</p>
            </article>
          </div>
        </section>

        {/* How it works, before what it has: someone who does not yet know what
            this is needs the shape of the thing before a list of parts. */}
        <section className="landing__section landing__section--steps">
          <h2 className="landing__section-title">{d.landing.stepsTitle}</h2>
          <p className="landing__section-lead">{d.landing.stepsLead}</p>
          <ol className="landing__steps">
            {(['build', 'compare', 'run'] as const).map((key, index) => (
              <Reveal key={key} delay={index * 90}>
                <li className="landing__step">
                  <span className="landing__step-number">{index + 1}</span>
                  <h3>{d.landing.steps[key].title}</h3>
                  <p>{d.landing.steps[key].body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>

        <section className="landing__section landing__section--raised">
          <h2 className="landing__section-title">{d.landing.featuresTitle}</h2>
          <div className="landing__cards">
            {[
              { icon: Code, key: 'views' },
              { icon: TreeStructure, key: 'diagram' },
              { icon: Lightning, key: 'run' },
              { icon: ChatCircleText, key: 'robot' },
              { icon: GraduationCap, key: 'concepts' },
              { icon: Check, key: 'validation' },
            ].map(({ icon: Icon, key }, index) => (
              <Reveal key={key} delay={index * 60}>
                <article className="landing__card">
                  <span className="landing__card-icon">
                    <Icon weight="duotone" />
                  </span>
                  <h3>{d.landing.features[key as keyof typeof d.landing.features].title}</h3>
                  <p>{d.landing.features[key as keyof typeof d.landing.features].body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/*
          Not a syllabus. Four chips and a "coming soon" told a reader that
          Tobot *is* those four things, putting a ceiling where there is none.
          What it should promise is somewhere to learn, that keeps growing.
        */}
        <section className="landing__section landing__section--learn landing__section--narrow">
          <h2 className="landing__section-title">{d.landing.learnTitle}</h2>
          <p className="landing__section-lead">{d.landing.learnLead}</p>
          <ul className="landing__learn">
            {(['explained', 'sources', 'pace', 'growing'] as const).map((key) => (
              <li className="landing__learn-item" key={key}>
                <Sparkle weight="fill" />
                {d.landing.learn[key]}
              </li>
            ))}
          </ul>
        </section>

        <section className="landing__closing">
          <div className="landing__closing-robot">
            <RobotGreeting mood="done" message={d.landing.robotBye} size="sm" />
          </div>
          <h2>{d.landing.closingTitle}</h2>
          <p>{d.landing.closingBody}</p>
          <button type="button" className="landing__cta landing__cta--large" onClick={onTry}>
            {d.landing.tryItLong}
            <ArrowRight weight="bold" />
          </button>
          <p className="landing__note">{d.landing.noAccount}</p>
        </section>
      </main>

      <footer className="landing__footer">
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
      </footer>
    </div>
  );
}
