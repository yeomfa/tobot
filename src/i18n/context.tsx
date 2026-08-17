import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { dictionaries, interpolate, translate } from './index';
import type { Dictionary, Language, MessageVars } from './index';

interface I18nValue {
  language: Language;
  /** Full dictionary, for reading nested copy with type safety. */
  d: Dictionary;
  /** Dot-path lookup with `{placeholder}` interpolation. */
  t: (path: string, vars?: MessageVars) => string;
  /** Interpolates an already-resolved template string. */
  fill: (template: string, vars?: MessageVars) => string;
  formatDate: (iso: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

interface I18nProviderProps {
  language: Language;
  children: ReactNode;
}

export function I18nProvider({ language, children }: I18nProviderProps) {
  const value = useMemo<I18nValue>(() => {
    const dictionary = dictionaries[language];
    return {
      language,
      d: dictionary,
      t: (path, vars) => translate(dictionary, path, vars),
      fill: (template, vars) => interpolate(template, vars),
      formatDate: (iso: string) => {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-GB', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }).format(date);
      },
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useTranslation must be used inside I18nProvider');
  return value;
}

/** Convenience for the very common "just give me the dictionary" case. */
export function useDictionary(): Dictionary {
  return useTranslation().d;
}

export function useLanguage(): Language {
  return useTranslation().language;
}

export const noopFormat = (value: string): string => value;

export function usePlural(): (count: number, one: string, many: string) => string {
  const { fill } = useTranslation();
  return useCallback(
    (count, one, many) => (count === 1 ? one : fill(many, { count })),
    [fill],
  );
}
