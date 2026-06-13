import type { ReactNode } from 'react';

export type Language = 'es' | 'en';

export type TranslationParams = Record<string, string | number | boolean | undefined>;

export type TranslationEntry = string | ((params: TranslationParams) => string);

export type TranslationDictionary = Record<string, TranslationEntry>;

export interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: TranslationParams) => string;
}

export interface I18nProviderProps {
  children: ReactNode;
}
