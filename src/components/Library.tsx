import { memo, useEffect, useState } from 'react';

import type { Algorithm } from '../core/ast/types';
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

  return (
    <div className="library">
      <div className="library__section">
        <div className="library__section-head">
          <h3 className="library__section-title">{d.library.saved}</h3>
          <button
            type="button"
            className="library__new"
            onClick={onCreate}
            title={d.actions.newAlgorithm}
          >
            <span aria-hidden="true">+</span> {d.actions.newAlgorithm}
          </button>
        </div>

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
                    ⧉
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
                        ×
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
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
 * A drawn mark per example rather than an emoji: these sit beside the
 * statement icons all day, so they follow the same line-art language and take
 * the topic colour from CSS.
 */
function ExampleIcon({ id }: { id: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (id) {
    case 'greeting':
      // Speech bubble with a waving hand.
      return (
        <svg {...common}>
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H10l-4 3.5V15h-.5A1.5 1.5 0 0 1 4 13.5z" />
          <path d="M9.5 9.5h.01M14.5 9.5h.01" />
        </svg>
      );
    case 'average':
      // Two bars and their midpoint.
      return (
        <svg {...common}>
          <path d="M5 19V9M12 19V5M19 19v-7" />
          <path d="M3 15h18" strokeDasharray="2 2.5" />
        </svg>
      );
    case 'grade':
      // A checkmark inside a rosette.
      return (
        <svg {...common}>
          <circle cx="12" cy="9.5" r="5.5" />
          <path d="M9.8 9.6l1.7 1.7 3-3.4" />
          <path d="M8.6 14.4L7 21l5-2.4L17 21l-1.6-6.6" />
        </svg>
      );
    case 'adult':
      // A person beside a threshold line.
      return (
        <svg {...common}>
          <circle cx="9.5" cy="7" r="2.8" />
          <path d="M4.5 19v-1.5a5 5 0 0 1 10 0V19" />
          <path d="M18.5 4.5v15" strokeDasharray="2 2.5" />
        </svg>
      );
    case 'times-table':
      // A grid, as in a multiplication table.
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
          <path d="M3.5 9.5h17M3.5 15h17M9.5 3.5v17M15 3.5v17" />
        </svg>
      );
    case 'countdown':
      // A clock winding down.
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="7.5" />
          <path d="M12 9v4l2.5 1.8" />
          <path d="M9.5 2.5h5" />
        </svg>
      );
    case 'guess':
      // A question mark in a target.
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.8 9.6a2.3 2.3 0 1 1 3 2.2v1.4" />
          <path d="M12.8 16.2h.01" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

export type { Example };
