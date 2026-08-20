import { Check } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import './SettingsMenu.css';

export interface MenuOption<T extends string> {
  value: T;
  label: string;
  icon?: Icon;
}

interface SettingsMenuProps<T extends string> {
  value: T;
  options: MenuOption<T>[];
  onChange: (value: T) => void;
  /** Icon shown on the trigger, reflecting the current value. */
  trigger: Icon;
  label: string;
}

/**
 * A small dropdown that can actually be styled.
 *
 * A native `<select>` renders its list with the operating system's own
 * chrome, which no amount of CSS reaches — so a two-item settings menu looked
 * out of place next to everything around it.
 */
export function SettingsMenu<T extends string>({
  value,
  options,
  onChange,
  trigger: Trigger,
  label,
}: SettingsMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [drop, setDrop] = useState<'down' | 'up'>('down');
  const root = useRef<HTMLDivElement>(null);

  /*
   * These menus sit at the bottom of the landing page's rail, where a list
   * opening downwards runs off the screen. Measuring before paint keeps it
   * from visibly jumping into place.
   */
  useLayoutEffect(() => {
    if (!open || !root.current) return;
    const { bottom } = root.current.getBoundingClientRect();
    setDrop(window.innerHeight - bottom < 200 ? 'up' : 'down');
  }, [open]);

  // Close on an outside click or Escape, the two things a menu must always do.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="settings-menu" ref={root}>
      <button
        type="button"
        className="settings-menu__trigger"
        data-open={open || undefined}
        onClick={() => setOpen((current) => !current)}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Trigger />
      </button>

      {open && (
        <div className={`settings-menu__list settings-menu__list--${drop}`} role="menu" aria-label={label}>
          {options.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={option.value === value}
                className="settings-menu__item"
                data-selected={option.value === value || undefined}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {OptionIcon && <OptionIcon className="settings-menu__item-icon" />}
                <span className="settings-menu__item-label">{option.label}</span>
                {option.value === value && (
                  <Check className="settings-menu__check" weight="bold" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
