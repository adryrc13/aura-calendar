import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { enTranslations } from './translations.en';
import { esTranslations } from './translations.es';
import type { I18nContextValue, I18nProviderProps, Language, TranslationDictionary, TranslationParams } from './types';

export type { I18nContextValue, Language, TranslationDictionary, TranslationEntry, TranslationParams } from './types';

export const LANGUAGE_STORAGE_KEY = 'aura-calendar.language';

const dictionaries: Record<Language, TranslationDictionary> = {
  es: esTranslations,
  en: enTranslations,
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function isSupportedLanguage(value: unknown): value is Language {
  return value === 'es' || value === 'en';
}

export function languageFromNavigator(navigatorLanguage?: string | null): Language {
  if (navigatorLanguage?.toLowerCase().startsWith('en')) {
    return 'en';
  }

  return 'es';
}

export function resolveInitialLanguage(input: { storedLanguage?: string | null; navigatorLanguage?: string | null } = {}): Language {
  if (isSupportedLanguage(input.storedLanguage)) {
    return input.storedLanguage;
  }

  return languageFromNavigator(input.navigatorLanguage);
}

export function readStoredLanguage(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): Language | undefined {
  try {
    const stored = storage?.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

export function persistLanguage(language: Language, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()) {
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // localStorage puede fallar en modo privado; la app sigue viva con el estado en memoria.
  }
}

export function createTranslator(language: Language) {
  return (key: string, params: TranslationParams = {}) => {
    const entry = dictionaries[language][key] ?? dictionaries.es[key];

    if (typeof entry === 'function') {
      return entry(params);
    }

    return entry ?? key;
  };
}

export function t(key: string, params?: TranslationParams) {
  return createTranslator(resolveInitialLanguage({
    storedLanguage: readStoredLanguage(),
    navigatorLanguage: typeof navigator !== 'undefined' ? navigator.language : undefined,
  }))(key, params);
}

export function speechLanguageFor(language: Language) {
  return language === 'en' ? 'en-US' : 'es-ES';
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(() =>
    resolveInitialLanguage({
      storedLanguage: readStoredLanguage(),
      navigatorLanguage: typeof navigator !== 'undefined' ? navigator.language : undefined,
    }),
  );

  const translator = useMemo(() => createTranslator(language), [language]);

  function setLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage);
    persistLanguage(nextLanguage);
  }

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: translator,
    }),
    [language, translator],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider.');
  }

  return context;
}

function safeStorage() {
  return typeof localStorage !== 'undefined' ? localStorage : undefined;
}
