import {
  ArrowRightIcon as ArrowRight,
  BookOpenTextIcon as BookOpenText,
  ChartBarIcon as ChartBar,
  CircleIcon as Circle,
  CopyIcon as Copy,
  DesktopIcon as Desktop,
  DownloadSimpleIcon as DownloadSimple,
  FolderOpenIcon as FolderOpen,
  LightbulbIcon as Lightbulb,
  GridFourIcon as GridFour,
  HandWavingIcon as HandWaving,
  HardDrivesIcon as HardDrives,
  MoonIcon as Moon,
  PencilSimpleIcon as PencilSimple,
  PlusIcon as Plus,
  PuzzlePieceIcon as PuzzlePiece,
  SealCheckIcon as SealCheck,
  SignOutIcon as SignOut,
  SunIcon as Sun,
  TargetIcon as Target,
  TimerIcon as Timer,
  TranslateIcon as Translate,
  TrashIcon as Trash,
  UploadSimpleIcon as UploadSimple,
  UserCircleIcon as UserCircle,
  UserCheckIcon as UserCheck,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { concepts } from '../content/concepts';
import type { ConceptId } from '../content/concepts';
import { algorithmFromChallenge, challenges } from '../content/challenges';
import { algorithmFromExample, examples } from '../content/library';
import type { Algorithm } from '../core/ast/types';
import { languageNames, LANGUAGES } from '../i18n';
import type { Language } from '../i18n';
import { useTranslation } from '../i18n/context';
import { createAlgorithmStore } from '../state/storage';
import { isSupabaseConfigured } from '../state/supabase';
import { SettingsMenu } from './SettingsMenu';
import { APP_VERSION, MAKER } from '../brand';
import { BrandMark } from './BrandMark';
import { Picker } from './Picker';
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
  /** Name of the algorithm open in the editor, for the way back. */
  currentName: string;
  onBackToEditor: () => void;
  /** Their name, falling back to the email's local part. */
  displayName: string | null;
  /** One or two letters for the avatar. */
  initials: string | null;
  /** Signed-in email, or `null` when working on this browser only. */
  email: string | null;
  onSignOut: () => void;
  onSignIn: () => void;
}

type Section = 'mine' | 'challenges' | 'examples' | 'concepts';

const EXAMPLE_ICONS: Record<string, Icon> = {
  greeting: HandWaving,
  average: ChartBar,
  grade: SealCheck,
  adult: UserCheck,
  'times-table': GridFour,
  countdown: Timer,
  guess: Target,
};

const SECTIONS: Array<{ id: Section; icon: Icon }> = [
  { id: 'mine', icon: FolderOpen },
  { id: 'challenges', icon: PuzzlePiece },
  { id: 'examples', icon: Lightbulb },
  { id: 'concepts', icon: BookOpenText },
];

function sectionLabel(d: ReturnType<typeof useTranslation>['d'], id: Section): string {
  if (id === 'mine') return d.library.saved;
  if (id === 'challenges') return d.library.challenges;
  if (id === 'examples') return d.library.examples;
  return d.concepts.title;
}

/** The product mark, matching the editor header and the app icon. */

/**
 * A watermark per section, drawn in the banner's own colour.
 *
 * Each is a plain shape rather than a scene: at this size and opacity a busy
 * illustration turns to noise, while one clear form still says which part of
 * the app you are in.
 */
function SectionArt({ section }: { section: Section }) {
  if (section === 'mine') {
    return (
      <svg className="home__art" viewBox="0 0 120 110" aria-hidden="true">
        <line x1="60" y1="18" x2="60" y2="26" strokeWidth="3" strokeLinecap="round" />
        <circle cx="60" cy="14" r="5" className="home__art-dot" />
        <rect x="22" y="26" width="76" height="58" rx="18" strokeWidth="3" />
        <rect x="34" y="38" width="52" height="34" rx="13" className="home__art-fill" />
        <circle cx="49" cy="55" r="5.5" className="home__art-eye" />
        <circle cx="71" cy="55" r="5.5" className="home__art-eye" />
        <rect x="12" y="46" width="8" height="18" rx="4" strokeWidth="3" />
        <rect x="100" y="46" width="8" height="18" rx="4" strokeWidth="3" />
      </svg>
    );
  }

  if (section === 'challenges') {
    // Interlocking pieces: something to complete.
    return (
      <svg className="home__art" viewBox="0 0 120 110" aria-hidden="true">
        <path
          d="M20 26h30v10a8 8 0 0 0 16 0V26h30v30h-10a8 8 0 0 1 0 16h10v30H66V82a8 8 0 0 0-16 0v20H20V26z"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="86" cy="42" r="4" className="home__art-dot" />
      </svg>
    );
  }

  if (section === 'examples') {
    // A lamp: the worked answer.
    return (
      <svg className="home__art" viewBox="0 0 120 110" aria-hidden="true">
        <path
          d="M60 16a28 28 0 0 0-16 51v9h32v-9a28 28 0 0 0-16-51z"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M48 84h24M52 94h16" strokeWidth="3" strokeLinecap="round" />
        <circle cx="60" cy="46" r="9" className="home__art-dot" />
      </svg>
    );
  }

  // An open book: the reference material.
  return (
    <svg className="home__art" viewBox="0 0 120 110" aria-hidden="true">
      <path
        d="M60 32c-8-7-20-10-32-9v56c12-1 24 2 32 9 8-7 20-10 32-9V23c-12-1-24 2-32 9z"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line x1="60" y1="32" x2="60" y2="88" strokeWidth="3" />
      <circle cx="60" cy="24" r="4" className="home__art-dot" />
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
  currentName,
  onBackToEditor,
  email,
  displayName,
  initials,
  onSignOut,
  onSignIn,
}: HomeProps) {
  const { d, fill, formatDate } = useTranslation();

  /*
    Challenge filters. `'all'` rather than `null` because the Picker holds a
    string, and "no filter" is a real option in the list rather than an absence.
  */
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');

  /*
    The options come from the challenges themselves, so the lists grow with the
    content and never offer a filter that returns nothing. This is the part
    that has to survive the set getting much bigger: a hard-coded list of
    topics would need editing every time one is added, and would keep
    advertising difficulties nothing sits at.
  */
  const availableLevels = useMemo(
    () => [...new Set(challenges.map((challenge) => challenge.level))].sort((a, b) => a - b),
    [],
  );

  const availableTopics = useMemo(
    () => [...new Set(challenges.map((challenge) => challenge.topic))],
    [],
  );

  const visibleChallenges = useMemo(
    () =>
      challenges.filter(
        (challenge) =>
          (levelFilter === 'all' || String(challenge.level) === levelFilter) &&
          (topicFilter === 'all' || challenge.topic === topicFilter),
      ),
    [levelFilter, topicFilter],
  );
  const [saved, setSaved] = useState<Algorithm[]>([]);
  const [importError, setImportError] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  /** Which section the rail is showing; the page holds one at a time. */
  const [section, setSection] = useState<Section>('mine');
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

  /**
   * Three states, not two: signed in, signed out with accounts available, and
   * accounts not set up at all. The third still needs to say something, or the
   * rail looks broken to anyone who expects a sign-in button.
   */
  const accountState: 'in' | 'out' | 'off' = !isSupabaseConfigured
    ? 'off'
    : email
      ? 'in'
      : 'out';

  const bannerTitle =
    section === 'mine'
      ? d.banners.mineTitle
      : section === 'challenges'
        ? d.banners.challengesTitle
        : section === 'examples'
          ? d.banners.examplesTitle
          : d.banners.conceptsTitle;

  const bannerBody =
    section === 'mine'
      ? d.banners.mineBody
      : section === 'challenges'
        ? d.banners.challengesBody
        : section === 'examples'
          ? d.banners.examplesBody
          : d.banners.conceptsBody;

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
      <div className="home__body">
        <nav className="home__rail" aria-label={d.home.sections}>
          <div className="home__rail-brand">
            <BrandMark size={30} className="home__mark" />
            <span>{d.app.name}</span>
          </div>

          <div className="home__rail-list">
            {SECTIONS.map((entry) => {
              const Glyph = entry.icon;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="home__rail-item"
                  data-selected={section === entry.id || undefined}
                  onClick={() => setSection(entry.id)}
                >
                  <Glyph weight={section === entry.id ? 'fill' : 'regular'} />
                  <span>{sectionLabel(d, entry.id)}</span>
                  {entry.id === 'mine' && saved.length > 0 && (
                    <span className="home__rail-count">{saved.length}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* The settings that belong to both screens, and the way back. */}
          <div className="home__rail-footer">
            {/*
              Always present, whatever the state. Hiding it when Supabase was
              unconfigured meant a student had no way to tell whether they were
              signed in, signed out, or working locally: the panel simply was
              not there.
            */}
            <div className="home__account" data-state={accountState}>
              {accountState === 'in' && (
                <>
                  <span className="home__account-avatar" aria-hidden="true">
                    {initials ?? '?'}
                  </span>
                  <span className="home__account-text">
                    {/* The name identifies the person; the email is kept as
                        the quieter second line, since it answers "which
                        account is this?" rather than "who am I?". */}
                    <span className="home__account-who" title={email ?? ''}>
                      {displayName ?? email}
                    </span>
                    {displayName && email && (
                      <span className="home__account-mail">{email}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="home__account-action"
                    onClick={onSignOut}
                    title={d.auth.signOut}
                    aria-label={d.auth.signOut}
                  >
                    <SignOut />
                  </button>
                </>
              )}

              {accountState === 'out' && (
                <button type="button" className="home__account-cta" onClick={onSignIn}>
                  <UserCircle weight="duotone" />
                  <span className="home__account-text">
                    <span className="home__account-label">{d.auth.signedOut}</span>
                    <span className="home__account-who">{d.auth.signInPrompt}</span>
                  </span>
                </button>
              )}

              {accountState === 'off' && (
                <span className="home__account-offline" title={d.auth.notConfiguredHint}>
                  <HardDrives weight="duotone" />
                  <span className="home__account-text">
                    <span className="home__account-label">{d.auth.localMode}</span>
                    <span className="home__account-who">{d.auth.notConfigured}</span>
                  </span>
                </span>
              )}
            </div>

            <button
              type="button"
              className="home__rail-back"
              onClick={onBackToEditor}
              title={`${d.home.backToEditor}: ${currentName}`}
            >
              <PencilSimple />
              <span>{d.home.backToEditor}</span>
            </button>

            <div className="home__rail-settings">
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
            </div>

            {/* Who made it and which version this is: the two things a student
                needs when reporting that something is wrong. */}
            <p className="home__credit">
              <a href={MAKER.url} target="_blank" rel="noreferrer noopener">
                By {MAKER.name}
              </a>
              <span className="home__version">v{APP_VERSION}</span>
            </p>
          </div>
        </nav>

        <div className="home__main">
          {/* One banner per section, so the page always says what you are
              looking at rather than repeating a single greeting. */}
          <header className="home__banner" data-section={section}>
            <div className="home__banner-copy">
              <h1 className="home__title">{bannerTitle}</h1>
              <p className="home__subtitle">{bannerBody}</p>
            </div>
            <SectionArt section={section} />
          </header>

          <div className="home__content">
            {section === 'mine' && (
              <>
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

                {saved.length === 0 ? (
                  <p className="home__empty">{d.library.empty}</p>
                ) : (
                  <div className="home__grid">
                    {saved.map((algorithm) => (
                      <div key={algorithm.id} className="home__card home__card--saved">
                        <button
                          type="button"
                          className="home__card-open"
                          onClick={() => onOpen(algorithm)}
                          /* The card clamps the name to two lines, so a very
                             long one is still readable here without opening
                             the algorithm to find out which it is. */
                          title={algorithm.name}
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
                )}
              </>
            )}

            {section === 'challenges' && (
              <>
                {/*
                  Two dropdowns rather than a row of chips. Chips showed every
                  option at once, which was fine for four topics and will not
                  be for fifteen — and offering all five difficulties when only
                  three have challenges made the filter advertise emptiness.

                  Both lists are built from what actually exists, so they grow
                  with the content and never offer a choice that returns
                  nothing.
                */}
                <div className="home__filters">
                  <Picker
                    value={levelFilter}
                    onChange={setLevelFilter}
                    label={d.library.levelLabel}
                    variant="filter"
                    groups={[
                      {
                        options: [
                          { value: 'all' as const, label: d.library.filterAll },
                          ...availableLevels.map((level) => ({
                            value: String(level),
                            label: d.library[`level${level}` as const],
                            hint: fill(d.library.levelHint, { level }),
                          })),
                        ],
                      },
                    ]}
                  />

                  <Picker
                    value={topicFilter}
                    onChange={setTopicFilter}
                    label={d.library.topicLabel}
                    variant="filter"
                    groups={[
                      {
                        options: [
                          { value: 'all' as const, label: d.library.filterAllTopics },
                          ...availableTopics.map((topic) => ({
                            value: topic,
                            label: d.palette.groups[topic],
                          })),
                        ],
                      },
                    ]}
                  />

                  {(levelFilter !== 'all' || topicFilter !== 'all') && (
                    <button
                      type="button"
                      className="home__filter-reset"
                      onClick={() => {
                        setLevelFilter('all');
                        setTopicFilter('all');
                      }}
                    >
                      {d.library.filterClear}
                    </button>
                  )}
                </div>

                <div className="home__grid">
                  {visibleChallenges.map((challenge) => (
                    <button
                      key={challenge.id}
                      type="button"
                      className="home__card home__card--tall"
                      data-topic={challenge.topic}
                      onClick={() => onOpen(algorithmFromChallenge(challenge, language))}
                    >
                      {/*
                        Difficulty as filled dots rather than a bare digit. The
                        number alone read as a position — two level-1
                        challenges both showed "1" and looked like a numbering
                        mistake — and a digit in a circle is exactly how a list
                        index is usually drawn.
                      */}
                      <span
                        className="home__card-level"
                        data-level={challenge.level}
                        title={fill(d.library.levelHint, { level: challenge.level })}
                      >
                        <span className="home__card-dots" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                        </span>
                        {d.library[`level${challenge.level}` as const]}
                      </span>
                      <span className="home__card-name">{challenge.title[language]}</span>
                      <span className="home__card-meta">{challenge.goal[language]}</span>
                    </button>
                  ))}
                </div>
                {visibleChallenges.length === 0 && (
                  <p className="home__filter-empty">
                    {d.library.filterEmpty}{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setLevelFilter('all');
                        setTopicFilter('all');
                      }}
                    >
                      {d.library.filterClear}
                    </button>
                  </p>
                )}
              </>
            )}

            {section === 'examples' && (
              <>
                <div className="home__grid">
                  {examples.map((example) => {
                    const Glyph = EXAMPLE_ICONS[example.id] ?? Circle;
                    return (
                      <button
                        key={example.id}
                        type="button"
                        className="home__card home__card--tall"
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
              </>
            )}

            {section === 'concepts' && (
              <>
                <div className="home__grid">
                  {concepts.map((concept) => (
                    <button
                      key={concept.id}
                      type="button"
                      className="home__card home__card--tall"
                      data-topic={concept.category}
                      onClick={() => onOpenConcept(concept.id)}
                    >
                      <span className="home__card-icon">
                        <BookOpenText weight="duotone" />
                      </span>
                      <span className="home__card-name">{concept.copy[language].title}</span>
                      <span className="home__card-meta">{concept.copy[language].summary}</span>
                      <span className="home__card-tag">
                        {fill(d.concepts.readingTime, { minutes: concept.readingMinutes })}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
