import { memo, useEffect, useState } from 'react';

import type { Algorithm } from '../core/ast/types';
import { algorithmFromExample, examples } from '../content/library';
import { useTranslation } from '../i18n/context';
import { createAlgorithmStore } from '../state/storage';
import './LibraryDrawer.css';

interface LibraryDrawerProps {
  open: boolean;
  /** Currently edited algorithm, marked in the list and never deletable. */
  currentId: string;
  onClose: () => void;
  onOpen: (algorithm: Algorithm) => void;
}

/**
 * Saved work and worked examples in one slide-over.
 *
 * Storage already supported many algorithms; this is the surface that makes
 * them reachable. Examples build a fresh copy with new ids on open, so a
 * student can experiment without ever damaging the original.
 */
export const LibraryDrawer = memo(function LibraryDrawer({
  open,
  currentId,
  onClose,
  onOpen,
}: LibraryDrawerProps) {
  const { d, language, fill, formatDate } = useTranslation();
  const [saved, setSaved] = useState<Algorithm[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);

  // Reload each time it opens: the list is stale as soon as an edit is saved.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const list = await createAlgorithmStore().list();
      if (!cancelled) setSaved(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

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
    onClose();
  };

  return (
    <>
      <div
        className="drawer-scrim"
        data-open={open || undefined}
        onClick={onClose}
        role="presentation"
      />

      <aside
        className="library"
        data-open={open || undefined}
        role="dialog"
        aria-label={d.library.title}
        aria-hidden={!open}
      >
        <header className="library__header">
          <h2 className="library__title">{d.library.title}</h2>
          <button
            type="button"
            className="library__close"
            onClick={onClose}
            aria-label={d.actions.close}
          >
            ×
          </button>
        </header>

        <div className="library__scroll">
          <section className="library__section">
            <h3 className="library__section-title">{d.library.saved}</h3>
            {saved.length === 0 ? (
              <p className="library__empty">{d.library.empty}</p>
            ) : (
              <ul className="library__list">
                {saved.map((algorithm) => (
                  <li key={algorithm.id} className="library__row" data-current={algorithm.id === currentId || undefined}>
                    <button
                      type="button"
                      className="library__row-main"
                      onClick={() => {
                        onOpen(algorithm);
                        onClose();
                      }}
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
          </section>

          <section className="library__section">
            <h3 className="library__section-title">
              {d.library.examples}
              <span className="library__section-hint">{d.library.examplesHint}</span>
            </h3>
            <ul className="library__list">
              {examples.map((example) => (
                <li key={example.id} className="library__row" data-topic={example.topic}>
                  <button
                    type="button"
                    className="library__row-main"
                    onClick={() => {
                      onOpen(algorithmFromExample(example, language));
                      onClose();
                    }}
                  >
                    <span className="library__row-name">
                      <span className="library__topic-dot" aria-hidden="true" />
                      {example.title[language]}
                    </span>
                    <span className="library__row-meta">{example.summary[language]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </>
  );
});
