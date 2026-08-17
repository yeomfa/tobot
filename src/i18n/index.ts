import { en } from './en';
import { es } from './es';
import type { Dictionary } from './es';
import type { Language, MessageVars } from './types';

export const dictionaries: Record<Language, Dictionary> = { es, en };

export { DEFAULT_LANGUAGE, LANGUAGES, isLanguage } from './types';
export type { Language, MessageVars } from './types';
export type { Dictionary } from './es';

/** Human-readable language names, each shown in its own language. */
export const languageNames: Record<Language, string> = {
  es: 'Español',
  en: 'English',
};

/** Replaces `{token}` placeholders with the supplied values. */
export function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/**
 * Dot-path accessor over a dictionary, e.g. `t('actions.run')`. Paths are
 * checked at runtime only; the typed `useTranslation` hook exposes the raw
 * dictionary too, which is the preferred way to read deeply nested copy.
 */
export function translate(dictionary: Dictionary, path: string, vars?: MessageVars): string {
  const value = path
    .split('.')
    .reduce<unknown>(
      (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
      dictionary,
    );

  if (typeof value !== 'string') {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${path}`);
    return path;
  }
  return interpolate(value, vars);
}
