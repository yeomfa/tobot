import {
  ArrowRight,
  BookOpenText,
  ChartBar,
  Circle,
  Compass,
  Copy,
  Desktop,
  DownloadSimple,
  GridFour,
  HandWaving,
  Moon,
  PencilSimple,
  Plus,
  PuzzlePiece,
  SealCheck,
  Sun,
  Target,
  Timer,
  Translate,
  Trash,
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
import { languageNames, LANGUAGES } from '../i18n';
import type { Language } from '../i18n';
import { useTranslation } from '../i18n/context';
import { createAlgorithmStore } from '../state/storage';
import { SettingsMenu } from './SettingsMenu';
import './Home.css';

interface HomeProps {
  /** Bumped by the shell so the saved list reloads after an edit. */
  revision: number;
  language: Language;
  theme: 'light' | 'dark' | 'system';
  onLanguageChange: (language: Language) => void;
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  onOpen: (algorithm: Algorithm) => void;
  onCreate: () => void;
  onOpenConcept: (id: ConceptId) => void;
  onShowTour: () => void;
  /** Name of the algorithm open in the editor, for the way back. */
  currentName: string;
  onBackToEditor: () => void;
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

/** The product mark, matching the editor header and the app icon. */
function BrandMark() {
  return (
    <svg className="home__mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5" y="9" width="22" height="17" rx="6" />
      <line x1="16" y1="4" x2="16" y2="9" />
      <circle cx="16" cy="3" r="2.2" className="home__mark-dot" />
      <circle cx="12" cy="17" r="2.4" className="home__mark-eye" />
      <circle cx="20" cy="17" r="2.4" className="home__mark-eye" />
    </svg>
  );
}

/** A large watermark of the robot, giving the banner its character. */
function RobotMark() {
  return (
    <svg className="home__robot" viewBox="0 0 120 110" aria-hidden="true">
      <line x1="60" y1="18" x2="60" y2="26" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="14" r="5" className="home__robot-dot" />
      <rect x="22" y="26" width="76" height="58" rx="18" strokeWidth="3" />
      <rect x="34" y="38" width="52" height="34" rx="13" className="home__robot-visor" />
      <circle cx="49" cy="55" r="5.5" className="home__robot-eye" />
      <circle cx="71" cy="55" r="5.5" className="home__robot-eye" />
      <rect x="12" y="46" width="8" height="18" rx="4" strokeWidth="3" />
      <rect x="100" y="46" width="8" height="18" rx="4" strokeWidth="3" />
    </svg>
  );
}

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
  language,
  theme,
  onLanguageChange,
  onThemeChange,
  onOpen,
  onCreate,
  onOpenConcept,
  onShowTour,
  currentName,
  onBackToEditor,
}: HomeProps) {
  const { d, fill, formatDate } = useTranslation();
  const [saved, setSaved] = useState<Algorithm[]>([]);
  const [importError, setImportError] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
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

  const reload = async (): Promise<void> => {
    setSaved(await createAlgorithmStore().list());
  };

  const duplicate = async (algorithm: Algorithm): Promise<void> => {
    const now = new Date().toISOString();
    await createAlgorithmStore().save({
      ...algorithm,
      id: `alg_${Math.random().toString(36).slice(2, 10)}`,
      name: `${algorithm.name} (${d.library.duplicateSuffix})`,
      createdAt: now,
      updatedAt: now,
    });
    await reload();
  };

  /** Downloads the algorithm as the same JSON the import above accepts. */
  const exportOne = (algorithm: Algorithm): void => {
    const blob = new Blob([JSON.stringify(algorithm, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${algorithm.name.trim().toLowerCase().replace(/\s+/g, '-') || 'algoritmo'}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const remove = async (id: string): Promise<void> => {
    await createAlgorithmStore().remove(id);
    setConfirming(null);
    await reload();
  };

  return (
    <div className="home">
      <div className="home__inner">
        <header className="home__banner">
          <div className="home__banner-bar">
            <span className="home__banner-brand">
              <BrandMark />
              {d.app.name}
            </span>

            <span className="home__banner-actions">
              {/* The editor keeps whatever was open, so this is a way back to
                  it rather than a way to open something. */}
              <button
                type="button"
                className="home__banner-back"
                onClick={onBackToEditor}
                title={`${d.home.backToEditor}: ${currentName}`}
              >
                <PencilSimple />
                <span>{d.home.backToEditor}</span>
              </button>

              <button
                type="button"
                className="home__banner-button"
                onClick={onShowTour}
                title={d.tour.replay}
                aria-label={d.tour.replay}
              >
                <Compass />
              </button>
              <SettingsMenu
                value={language}
                options={LANGUAGES.map((code) => ({ value: code, label: languageNames[code] }))}
                onChange={onLanguageChange}
                trigger={Translate}
                label={d.settings.language}
              />
              <SettingsMenu
                value={theme}
                options={[
                  { value: 'system' as const, label: d.settings.themeSystem, icon: Desktop },
                  { value: 'light' as const, label: d.settings.themeLight, icon: Sun },
                  { value: 'dark' as const, label: d.settings.themeDark, icon: Moon },
                ]}
                onChange={onThemeChange}
                trigger={theme === 'dark' ? Moon : theme === 'light' ? Sun : Desktop}
                label={d.settings.theme}
              />
            </span>
          </div>

          <div className="home__banner-copy">
            <h1 className="home__title">{d.home.title}</h1>
            <p className="home__subtitle">{d.home.subtitle}</p>
          </div>

          <RobotMark />
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
                <div key={algorithm.id} className="home__card home__card--saved">
                  <button
                    type="button"
                    className="home__card-open"
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

                  <div className="home__card-actions">
                    <button
                      type="button"
                      className="home__card-action"
                      onClick={() => void duplicate(algorithm)}
                      title={d.actions.duplicate}
                      aria-label={d.actions.duplicate}
                    >
                      <Copy />
                    </button>
                    <button
                      type="button"
                      className="home__card-action"
                      onClick={() => exportOne(algorithm)}
                      title={d.actions.export}
                      aria-label={d.actions.export}
                    >
                      <DownloadSimple />
                    </button>
                    {confirming === algorithm.id ? (
                      <button
                        type="button"
                        className="home__card-action home__card-action--confirm"
                        onClick={() => void remove(algorithm.id)}
                      >
                        {d.actions.confirm}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="home__card-action home__card-action--danger"
                        onClick={() => setConfirming(algorithm.id)}
                        title={d.actions.delete}
                        aria-label={d.actions.delete}
                      >
                        <Trash />
                      </button>
                    )}
                  </div>
                </div>
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
