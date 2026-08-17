import { memo } from 'react';

import type { Algorithm, Statement } from '../core/ast/types';
import { useTranslation } from '../i18n/context';
import { Library } from './Library';
import { Palette } from './Palette';
import './Sidebar.css';

export type SidebarView = 'statements' | 'library';

interface SidebarProps {
  view: SidebarView;
  onViewChange: (view: SidebarView) => void;
  onAdd: (statement: Statement) => void;
  /** Bumped by the shell so the saved list refreshes after an edit. */
  revision: number;
  currentId: string;
  onOpen: (algorithm: Algorithm) => void;
  onCreate: () => void;
}

/**
 * The left rail holds the two things a student switches between while working:
 * the statements they build with, and the algorithms they own.
 *
 * Both are navigation, so they share one rail with a segmented switch rather
 * than one being a modal over the other.
 */
export const Sidebar = memo(function Sidebar({
  view,
  onViewChange,
  onAdd,
  revision,
  currentId,
  onOpen,
  onCreate,
}: SidebarProps) {
  const { d } = useTranslation();

  return (
    <div className="sidebar">
      <div className="sidebar__switch" role="tablist">
        <button
          type="button"
          role="tab"
          className="sidebar__switch-button"
          data-selected={view === 'statements' || undefined}
          aria-selected={view === 'statements'}
          onClick={() => onViewChange('statements')}
        >
          {d.palette.title}
        </button>
        <button
          type="button"
          role="tab"
          className="sidebar__switch-button"
          data-selected={view === 'library' || undefined}
          aria-selected={view === 'library'}
          onClick={() => onViewChange('library')}
        >
          {d.library.title}
        </button>
      </div>

      <div className="sidebar__body">
        {view === 'statements' ? (
          <Palette onAdd={onAdd} />
        ) : (
          <Library
            revision={revision}
            currentId={currentId}
            onOpen={onOpen}
            onCreate={onCreate}
          />
        )}
      </div>
    </div>
  );
});
