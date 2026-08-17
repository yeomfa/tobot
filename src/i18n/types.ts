export const LANGUAGES = ['es', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'es';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Interpolation values for `{placeholder}` tokens in a message. */
export type MessageVars = Record<string, string | number>;
