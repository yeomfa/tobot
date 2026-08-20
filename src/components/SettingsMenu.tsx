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
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  /*
   * Positioned in viewport coordinates rather than against the trigger.
   *
   * The landing page's main column clips its overflow — it has banner art that
   * has to stay inside — and an absolutely positioned list is clipped by that
   * whatever its z-index, which no amount of opening upwards can fix. Fixed
   * positioning takes the list out of that box entirely.
   *
   * Measured before paint so it never appears in the wrong place first.
   */
  useLayoutEffect(() => {
    if (!open || !root.current) return;

    const measure = (): void => {
      const trigger = root.current?.getBoundingClientRect();
      if (!trigger) return;

      const width = 168;
      const height = options.length * 34 + 8;
      const gap = 8;
      const margin = 8;

      // Below the trigger when it fits, above it when it does not.
      const below = trigger.bottom + gap;
      const top =
        below + height + margin <= window.innerHeight ? below : trigger.top - gap - height;

      // Right-aligned with the trigger, kept inside the viewport either way.
      const right = trigger.right - width;
      const left = Math.max(margin, Math.min(right, window.innerWidth - width - margin));

      setAt({ top: Math.max(margin, top), left });
    };

    measure();
    // A scroll or resize would leave the list stranded where it was drawn.
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, options.length]);

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
        <div
          className="settings-menu__list"
          style={at ? { top: at.top, left: at.left } : undefined}
          role="menu"
          aria-label={label}
        >
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
