import {
  ArrowRight,
  BookOpenText,
  ChartBar,
  Circle,
  GridFour,
  HandWaving,
  Plus,
  PuzzlePiece,
  SealCheck,
  Target,
  Timer,
  UploadSimple,
  UserCheck,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { memo, useEffect, useRef, useState } from 'react';

import { concepts } from '../content/concepts';
import type { ConceptId } from '../content/concepts';
import { algorithmFromChallenge, challenges } from '../content/challenges';
import { algorithmFromExample, examples } from '../content/library';
import type { Algorithm } from '../core/ast/types';
import { useTranslation } from '../i18n/context';
import { createAlgorithmStore } from '../state/storage';
import './Home.css';

interface HomeProps {
  /** Bumped by the shell so the saved list reloads after an edit. */
  revision: number;
  onOpen: (algorithm: Algorithm) => void;
  onCreate: () => void;
  onOpenConcept: (id: ConceptId) => void;
}

const EXAMPLE_ICONS: Record<string, Icon> = {
  greeting: HandWaving,
  average: ChartBar,
  grade: SealCheck,
  adult: UserCheck,
  'times-table': GridFour,
  countdown: Timer,
  guess: Target,
};

/**
 * The landing view: everything a student chooses between before they start
 * writing.
 *
 * Saved work, challenges, examples and the concept library used to be squeezed
 * into the editor's left rail, which made that rail carry two unrelated jobs.
 * Given a screen of their own they can be browsed properly, and the editor is
 * left to do one thing.
 */
export const Home = memo(function Home({
  revision,
  onOpen,
  onCreate,
  onOpenConcept,
}: HomeProps) {
  const { d, language, fill, formatDate } = useTranslation();
  const [saved, setSaved] = useState<Algorithm[]>([]);
  const [importError, setImportError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await createAlgorithmStore().list();
      if (!cancelled) setSaved(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [revision]);

  /** Reads a `.json` exported from the app, validating it before opening. */
  const importFile = async (file: File): Promise<void> => {
    setImportError(false);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !Array.isArray((parsed as Algorithm).body) ||
        typeof (parsed as Algorithm).name !== 'string'
      ) {
        setImportError(true);
        return;
      }
      const now = new Date().toISOString();
      const imported: Algorithm = {
        ...(parsed as Algorithm),
        id: `alg_${Math.random().toString(36).slice(2, 10)}`,
        updatedAt: now,
      };
      await createAlgorithmStore().save(imported);
      onOpen(imported);
    } catch {
      setImportError(true);
    }
  };

  return (
    <div className="home">
      <div className="home__inner">
        <header className="home__hero">
          <h1 className="home__title">{d.home.title}</h1>
          <p className="home__subtitle">{d.home.subtitle}</p>
        </header>

        {/* Start: the two ways in, given the most weight on the page. */}
        <section className="home__section">
          <div className="home__start">
            <button type="button" className="home__start-card" onClick={onCreate}>
              <span className="home__start-icon">
                <Plus weight="bold" />
              </span>
              <span className="home__start-text">
                <span className="home__start-name">{d.actions.newAlgorithm}</span>
                <span className="home__start-hint">{d.home.newHint}</span>
              </span>
              <ArrowRight className="home__start-arrow" weight="bold" aria-hidden="true" />
            </button>

            <button
              type="button"
              className="home__start-card home__start-card--quiet"
              onClick={() => fileInput.current?.click()}
            >
              <span className="home__start-icon">
                <UploadSimple />
              </span>
              <span className="home__start-text">
                <span className="home__start-name">{d.library.import}</span>
                <span className="home__start-hint">{d.library.importHint}</span>
              </span>
            </button>

            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
                event.target.value = '';
              }}
            />
          </div>
          {importError && <p className="home__error">{d.library.importError}</p>}
        </section>

        {saved.length > 0 && (
          <section className="home__section">
            <h2 className="home__section-title">{d.library.saved}</h2>
            <div className="home__grid">
              {saved.map((algorithm) => (
                <button
                  key={algorithm.id}
                  type="button"
                  className="home__card home__card--saved"
                  onClick={() => onOpen(algorithm)}
                >
                  <span className="home__card-name">{algorithm.name}</span>
                  <span className="home__card-meta">
                    {fill(d.library.lastEdited, { date: formatDate(algorithm.updatedAt) })}
                    {' · '}
                    {algorithm.body.length === 1
                      ? d.editor.statementCountOne
                      : fill(d.editor.statementCount, { count: algorithm.body.length })}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="home__section">
          <h2 className="home__section-title">
            <PuzzlePiece weight="duotone" /> {d.library.challenges}
          </h2>
          <p className="home__section-hint">{d.library.challengesHint}</p>
          <div className="home__grid">
            {challenges.map((challenge) => (
              <button
                key={challenge.id}
                type="button"
                className="home__card"
                data-topic={challenge.topic}
                onClick={() => onOpen(algorithmFromChallenge(challenge, language))}
              >
                <span className="home__card-icon" data-level={challenge.level}>
                  {challenge.level}
                </span>
                <span className="home__card-name">{challenge.title[language]}</span>
                <span className="home__card-meta">{challenge.goal[language]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="home__section">
          <h2 className="home__section-title">{d.library.examples}</h2>
          <p className="home__section-hint">{d.library.examplesHint}</p>
          <div className="home__grid">
            {examples.map((example) => {
              const Glyph = EXAMPLE_ICONS[example.id] ?? Circle;
              return (
                <button
                  key={example.id}
                  type="button"
                  className="home__card"
                  data-topic={example.topic}
                  onClick={() => onOpen(algorithmFromExample(example, language))}
                >
                  <span className="home__card-icon">
                    <Glyph weight="duotone" />
                  </span>
                  <span className="home__card-name">{example.title[language]}</span>
                  <span className="home__card-meta">{example.summary[language]}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="home__section">
          <h2 className="home__section-title">
            <BookOpenText weight="duotone" /> {d.concepts.title}
          </h2>
          <p className="home__section-hint">{d.concepts.subtitle}</p>
          <div className="home__grid">
            {concepts.map((concept) => (
              <button
                key={concept.id}
                type="button"
                className="home__card"
                data-topic={concept.category}
                onClick={() => onOpenConcept(concept.id)}
              >
                <span className="home__card-name">{concept.copy[language].title}</span>
                <span className="home__card-meta">{concept.copy[language].summary}</span>
                <span className="home__card-tag">
                  {fill(d.concepts.readingTime, { minutes: concept.readingMinutes })}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
});
