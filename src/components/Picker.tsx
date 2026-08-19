import { CaretDown, Check } from '@phosphor-icons/react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import './Picker.css';

export interface PickerOption<T extends string> {
  value: T;
  /** What the trigger shows: a glyph, a name. */
  label: string;
  /** Spelled-out meaning, shown beside the glyph in the list. */
  hint?: string;
}

export interface PickerGroup<T extends string> {
  /** Omitted for a single unlabelled run of options. */
  label?: string;
  options: PickerOption<T>[];
  /** Lays the group out as a grid of glyphs rather than a list of rows. */
  dense?: boolean;
}

interface PickerProps<T extends string> {
  value: T;
  groups: PickerGroup<T>[];
  onChange: (value: T) => void;
  label: string;
  /** Styling hook, so an operator reads differently from a variable name. */
  variant?: 'operator' | 'value' | 'reference';
}

/**
 * A dropdown for the inside of a statement block.
 *
 * Native `<select>` was doing two things badly here. Its list is drawn by the
 * operating system, so it ignored the surrounding design entirely; and it can
 * only ever be one flat column, which turned thirteen operators into a list
 * long enough to cover the algorithm behind it.
 *
 * This groups instead: arithmetic apart from comparison, laid out as a grid of
 * glyphs, so the whole set is one glance rather than a scroll. Each option can
 * carry the meaning in words next to the symbol, which is the part a student
 * learning `!=` actually needs.
 */
export function Picker<T extends string>({
  value,
  groups,
  onChange,
  label,
  variant = 'value',
}: PickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [drop, setDrop] = useState<'down' | 'up'>('down');
  const root = useRef<HTMLSpanElement>(null);
  const listId = useId();

  const all = groups.flatMap((group) => group.options);
  const current = all.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        root.current?.querySelector<HTMLButtonElement>('.picker__trigger')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Blocks sit inside a scrolling canvas, so a list near the bottom would open
  // off-screen. Measuring before paint avoids it visibly jumping.
  useLayoutEffect(() => {
    if (!open || !root.current) return;
    const { bottom } = root.current.getBoundingClientRect();
    setDrop(window.innerHeight - bottom < 220 ? 'up' : 'down');
  }, [open]);

  return (
    <span className="picker" ref={root} data-variant={variant}>
      <button
        type="button"
        className="picker__trigger"
        data-open={open || undefined}
        onClick={() => setOpen((isOpen) => !isOpen)}
        title={label}
        aria-label={`${label}: ${current?.hint ?? current?.label ?? ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
      >
        <span className="picker__current">{current?.label ?? '···'}</span>
        <CaretDown className="picker__caret" weight="bold" aria-hidden="true" />
      </button>

      {open && (
        <div className={`picker__list picker__list--${drop}`} id={listId} role="listbox" aria-label={label}>
          {groups.map((group, index) => (
            <div className="picker__group" key={group.label ?? index} data-dense={group.dense || undefined}>
              {group.label && <span className="picker__group-label">{group.label}</span>}
              <div className="picker__options">
                {group.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    className="picker__option"
                    data-selected={option.value === value || undefined}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    title={option.hint}
                  >
                    <span className="picker__option-label">{option.label}</span>
                    {option.hint && !group.dense && (
                      <span className="picker__option-hint">{option.hint}</span>
                    )}
                    {option.value === value && !group.dense && (
                      <Check className="picker__check" weight="bold" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
