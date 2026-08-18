import {
  ChartBar,
  Circle,
  Copy,
  GridFour,
  HandWaving,
  Plus,
  PuzzlePiece,
  UploadSimple,
  SealCheck,
  Target,
  Timer,
  Trash,
  UserCheck,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { memo, useEffect, useRef, useState } from 'react';

import type { Algorithm } from '../core/ast/types';
import { algorithmFromChallenge, challenges } from '../content/challenges';
import { algorithmFromExample, examples } from '../content/library';
import type { Example } from '../content/library';
import { useTranslation } from '../i18n/context';
import { createAlgorithmStore } from '../state/storage';
import './Library.css';

interface LibraryProps {
  /** Bumped by the shell whenever the algorithm changes, to refresh the list. */
  revision: number;
  currentId: string;
  onOpen: (algorithm: Algorithm) => void;
  onCreate: () => void;
}

/**
 * Saved work and worked examples, living in the left sidebar beside the
 * palette rather than in a modal.
 *
 * Choosing what to work on is navigation, not an interruption: it belongs in
 * the same rail as the other persistent choices, and it needs the "new
 * algorithm" action right where the list is.
 */
export const Library = memo(function Library({
  revision,
  currentId,
  onOpen,
  onCreate,
}: LibraryProps) {
  const { d, language, fill, formatDate } = useTranslation();
  const [saved, setSaved] = useState<Algorithm[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [importError, setImportError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // The list is stale as soon as an edit is saved, so it reloads on every
  // revision bump as well as on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await createAlgorithmStore().list();
      if (!cancelled) setSaved(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [revision, currentId]);

  const remove = async (id: string): Promise<void> => {
    await createAlgorithmStore().remove(id);
    setSaved((current) => current.filter((algorithm) => algorithm.id !== id));
    setConfirming(null);
  };

  const duplicate = async (algorithm: Algorithm): Promise<void> => {
    const now = new Date().toISOString();
    const copy: Algorithm = {
      ...algorithm,
      id: `alg_${Math.random().toString(36).slice(2, 10)}`,
      name: `${algorithm.name} (${d.library.duplicateSuffix})`,
      createdAt: now,
      updatedAt: now,
    };
    await createAlgorithmStore().save(copy);
    onOpen(copy);
  };

  /**
   * Reads a `.json` exported from the app. The file is validated before it is
   * opened, so a wrong file gives a message rather than a broken editor.
   */
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
      // A fresh id keeps an import from overwriting an algorithm already saved
      // under the same id.
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
    <div className="library">
      <div className="library__section">
        <div className="library__section-head">
          <h3 className="library__section-title">{d.library.saved}</h3>
          <div className="library__head-actions">
            <button
              type="button"
              className="library__icon-action"
              onClick={() => fileInput.current?.click()}
              title={d.library.importHint}
              aria-label={d.library.import}
            >
              <UploadSimple />
            </button>
            <button
              type="button"
              className="library__new"
              onClick={onCreate}
              title={d.actions.newAlgorithm}
            >
              <Plus weight="bold" /> {d.actions.newAlgorithm}
            </button>
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
            // Reset so choosing the same file twice still fires a change.
            event.target.value = '';
          }}
        />

        {importError && <p className="library__error">{d.library.importError}</p>}

        {saved.length === 0 ? (
          <p className="library__empty">{d.library.empty}</p>
        ) : (
          <ul className="library__list">
            {saved.map((algorithm) => (
              <li
                key={algorithm.id}
                className="library__row"
                data-current={algorithm.id === currentId || undefined}
              >
                <button
                  type="button"
                  className="library__row-main"
                  onClick={() => onOpen(algorithm)}
                  title={algorithm.name}
                >
                  <span className="library__row-name">{algorithm.name}</span>
                  <span className="library__row-meta">
                    {fill(d.library.lastEdited, { date: formatDate(algorithm.updatedAt) })}
                    {' · '}
                    {algorithm.body.length === 1
                      ? d.editor.statementCountOne
                      : fill(d.editor.statementCount, { count: algorithm.body.length })}
                  </span>
                </button>

                <div className="library__row-actions">
                  <button
                    type="button"
                    className="library__row-action"
                    onClick={() => void duplicate(algorithm)}
                    title={d.actions.duplicate}
                    aria-label={d.actions.duplicate}
                  >
                    <Copy />
                  </button>
                  {/* The open algorithm cannot be deleted from under itself. */}
                  {algorithm.id !== currentId &&
                    (confirming === algorithm.id ? (
                      <button
                        type="button"
                        className="library__row-action library__row-action--confirm"
                        onClick={() => void remove(algorithm.id)}
                      >
                        {d.actions.confirm}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="library__row-action library__row-action--danger"
                        onClick={() => setConfirming(algorithm.id)}
                        title={d.actions.delete}
                        aria-label={d.actions.delete}
                      >
                        <Trash />
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="library__section">
        <h3 className="library__section-title">
          <PuzzlePiece weight="duotone" /> {d.library.challenges}
        </h3>
        <p className="library__section-hint">{d.library.challengesHint}</p>

        <ul className="library__cards">
          {challenges.map((challenge) => (
            <li key={challenge.id}>
              <button
                type="button"
                className="library__card library__card--challenge"
                data-topic={challenge.topic}
                onClick={() => onOpen(algorithmFromChallenge(challenge, language))}
                title={`${challenge.title[language]} — ${challenge.goal[language]}`}
              >
                <span className="library__card-icon" aria-hidden="true">
                  <span className="library__level" data-level={challenge.level}>
                    {challenge.level}
                  </span>
                </span>
                <span className="library__card-text">
                  <span className="library__card-name">{challenge.title[language]}</span>
                  <span className="library__card-summary">{challenge.goal[language]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="library__section">
        <h3 className="library__section-title">{d.library.examples}</h3>
        <p className="library__section-hint">{d.library.examplesHint}</p>

        <ul className="library__cards">
          {examples.map((example) => (
            <li key={example.id}>
              <button
                type="button"
                className="library__card"
                data-topic={example.topic}
                onClick={() => onOpen(algorithmFromExample(example, language))}
                /* Names and summaries clamp in a narrow rail, so the full
                   text stays reachable on hover. */
                title={`${example.title[language]} — ${example.summary[language]}`}
              >
                <span className="library__card-icon" aria-hidden="true">
                  <ExampleIcon id={example.id} />
                </span>
                <span className="library__card-text">
                  <span className="library__card-name">{example.title[language]}</span>
                  <span className="library__card-summary">{example.summary[language]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});

/**
 * One Phosphor icon per example, imported individually so only these ship.
 * Each is literal about the problem the example solves, which makes the card
 * scannable before the title is read.
 */
const EXAMPLE_ICONS: Record<string, Icon> = {
  greeting: HandWaving,
  average: ChartBar,
  grade: SealCheck,
  adult: UserCheck,
  'times-table': GridFour,
  countdown: Timer,
  guess: Target,
};

function ExampleIcon({ id }: { id: string }) {
  const Glyph = EXAMPLE_ICONS[id] ?? Circle;
  return <Glyph weight="duotone" />;
}

export type { Example };
