import type { Language } from '../../shared/i18n';
import { parseEnglishTaskCommand } from './englishTaskParser';
import { parseSpanishTaskCommand, type ParseOptions } from './spanishTaskParser';

export function parseTaskCommand(input: string, language: Language, options?: ParseOptions) {
  return language === 'en' ? parseEnglishTaskCommand(input, options) : parseSpanishTaskCommand(input, options);
}
