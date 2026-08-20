import {
  ArrowRight,
  ArrowsSplit,
  ChalkboardTeacher,
  ChatCircleText,
  Check,
  Code,
  Function as FunctionIcon,
  GraduationCap,
  Lightning,
  Repeat,
  Student,
  Tag,
  TreeStructure,
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

import { APP_VERSION, MAKER } from '../brand';
import { useTranslation } from '../i18n/context';
import { ROUTES } from '../routes';
import shotDark from '../assets/editor-dark.png';
import shotLight from '../assets/editor-light.png';
import { BrandMark } from './BrandMark';
import { BrowserFrame } from './landing/BrowserFrame';
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
            The tool itself, not a drawing of it. A landing page for something
            visual that never shows it is asking to be taken on trust; this is
            the actual editor, captured from the running app, so the claim and
            the evidence are the same picture.
          */}
          <div className="landing__shot">
            <BrowserFrame url="tobot.app/app" tilt>
              <picture>
                <source srcSet={shotDark} media="(prefers-color-scheme: dark)" />
                <img src={shotLight} alt={d.landing.shotAlt} width={1440} height={620} />
              </picture>
            </BrowserFrame>
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

        <section className="landing__section landing__section--topics landing__section--narrow">
          <h2 className="landing__section-title">{d.landing.topicsTitle}</h2>
          <p className="landing__section-lead">{d.landing.topicsLead}</p>
          <ul className="landing__topics">
            {[
              { icon: Tag, label: d.palette.groups.variables },
              { icon: ChatCircleText, label: d.palette.groups.io },
              { icon: ArrowsSplit, label: d.palette.groups.conditionals },
              { icon: Repeat, label: d.palette.groups.loops },
            ].map(({ icon: Icon, label }) => (
              <li className="landing__topic" key={label}>
                <Icon weight="bold" />
                {label}
              </li>
            ))}
            <li className="landing__topic landing__topic--soon">
              <FunctionIcon weight="bold" />
              {d.landing.soon}
            </li>
          </ul>
        </section>

        <section className="landing__closing">
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
