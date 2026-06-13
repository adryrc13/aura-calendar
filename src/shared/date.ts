import type { Language } from './i18n';

const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  es: 'es-ES',
  en: 'en-US',
};

export const ES_DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export const ES_MONTH_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
});

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayInputValue() {
  return toDateInputValue(new Date());
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(date.getMonth() + months);
  return next;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function parseInputDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function dateLocale(language: Language) {
  return LOCALE_BY_LANGUAGE[language];
}

export function formatShortDate(value: string, language: Language = 'es') {
  const locale = dateLocale(language);
  const options: Intl.DateTimeFormatOptions =
    language === 'en'
      ? { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }
      : { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' };

  return new Intl.DateTimeFormat(locale, options).format(parseInputDate(value));
}

export function formatMonthTitle(date: Date, language: Language = 'es') {
  return new Intl.DateTimeFormat(dateLocale(language), {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatWeekdayShort(date: Date, language: Language = 'es') {
  return new Intl.DateTimeFormat(dateLocale(language), { weekday: 'short' }).format(date);
}
