import {
  LANGUAGE_STORAGE_KEY,
  createTranslator,
  persistLanguage,
  readStoredLanguage,
  resolveInitialLanguage,
  speechLanguageFor,
} from './index';
import { enTranslations } from './translations.en';
import { esTranslations } from './translations.es';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

export function runI18nInternalTests() {
  const esKeys = Object.keys(esTranslations).sort();
  const enKeys = Object.keys(enTranslations).sort();
  const missingInEnglish = esKeys.filter((key) => !enKeys.includes(key));
  const missingInSpanish = enKeys.filter((key) => !esKeys.includes(key));
  const storage = memoryStorage();
  persistLanguage('en', storage);

  const cases = [
    {
      name: 'translation dictionaries have the same keys',
      ok: missingInEnglish.length === 0 && missingInSpanish.length === 0,
      details: { missingInEnglish, missingInSpanish },
    },
    {
      name: 'default language uses stored value first',
      ok: resolveInitialLanguage({ storedLanguage: 'en', navigatorLanguage: 'es-ES' }) === 'en',
    },
    {
      name: 'default language detects English browser',
      ok: resolveInitialLanguage({ navigatorLanguage: 'en-US' }) === 'en',
    },
    {
      name: 'default language falls back to Spanish',
      ok: resolveInitialLanguage({ navigatorLanguage: 'fr-FR' }) === 'es',
    },
    {
      name: 'language persists in storage',
      ok: readStoredLanguage(storage) === 'en' && storage.getItem(LANGUAGE_STORAGE_KEY) === 'en',
    },
    {
      name: 'translator resolves Spanish and English labels',
      ok: createTranslator('es')('nav.today') === 'Hoy' && createTranslator('en')('nav.today') === 'Today',
    },
    {
      name: 'speech language follows selected language',
      ok: speechLanguageFor('es') === 'es-ES' && speechLanguageFor('en') === 'en-US',
    },
  ];

  return cases;
}
