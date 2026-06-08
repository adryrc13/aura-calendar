import type { TaskFormValues } from '../../domain/tasks/task';
import { todayInputValue, toDateInputValue } from '../../shared/date';

export interface ParsedTaskCommand {
  draft: TaskFormValues;
  transcript: string;
  missing: Array<'title' | 'date' | 'time'>;
  confidence: 'complete' | 'needs-confirmation';
}

const WEEKDAYS: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
  domingo: 0,
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function nextWeekday(targetDay: number) {
  const today = new Date();
  const currentDay = today.getDay();
  const diff = (targetDay - currentDay + 7) % 7 || 7;
  return addDays(today, diff);
}

function parseDate(normalized: string) {
  if (/\bpasado\s+manana\b/.test(normalized)) {
    return toDateInputValue(addDays(new Date(), 2));
  }

  if (/\bmanana\b/.test(normalized)) {
    return toDateInputValue(addDays(new Date(), 1));
  }

  if (/\bhoy\b/.test(normalized)) {
    return todayInputValue();
  }

  const explicitDay = normalized.match(/\b(?:el\s+)?dia\s+([1-9]|[12]\d|3[01])\b/);
  if (explicitDay) {
    const today = new Date();
    const day = Number(explicitDay[1]);
    return toDateInputValue(new Date(today.getFullYear(), today.getMonth(), day));
  }

  const weekday = Object.keys(WEEKDAYS).find((day) => new RegExp(`\\b(?:el\\s+)?${day}\\b`).test(normalized));
  if (weekday) {
    return toDateInputValue(nextWeekday(WEEKDAYS[weekday]));
  }

  return undefined;
}

function parseTime(normalized: string) {
  const match = normalized.match(/\ba\s+las\s+([01]?\d|2[0-3])(?::([0-5]\d))?(?:\s+de\s+la\s+(manana|tarde|noche))?\b/);

  if (!match) {
    return undefined;
  }

  let hour = Number(match[1]);
  const minute = match[2] ?? '00';
  const dayPart = match[3];

  if ((dayPart === 'tarde' || dayPart === 'noche') && hour < 12) {
    hour += 12;
  }

  if (dayPart === 'manana' && hour === 12) {
    hour = 0;
  }

  return `${`${hour}`.padStart(2, '0')}:${minute}`;
}

function getReminderMinutes(normalized: string) {
  const explicitMinutes = normalized.match(/\bavisame\s+(\d{1,3})\s+minutos?\s+antes\b/);
  if (explicitMinutes) {
    return Number(explicitMinutes[1]);
  }

  return undefined;
}

function removeCommandPhrases(original: string) {
  return original
    .replace(/\brecu[eé]rdame\s*/gi, '')
    .replace(/\bav[ií]same\s+\d{1,3}\s+minutos?\s+antes\s+de\s*/gi, '')
    .replace(/\bav[ií]same\s*/gi, '')
    .replace(/\bpasado\s+ma[nñ]ana\b/gi, '')
    .replace(/\bma[nñ]ana\b/gi, '')
    .replace(/\bhoy\b/gi, '')
    .replace(/\b(?:el\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/gi, '')
    .replace(/\b(?:el\s+)?d[ií]a\s+([1-9]|[12]\d|3[01])\b/gi, '')
    .replace(/\ba\s+las\s+([01]?\d|2[0-3])(?::([0-5]\d))?(?:\s+de\s+la\s+(ma[nñ]ana|tarde|noche))?\b/gi, '')
    .replace(/\bcon\s+alarma\b/gi, '')
    .replace(/\bsin\s+sonido\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSpanishTaskCommand(input: string): ParsedTaskCommand {
  const transcript = input.trim();
  const normalized = normalize(transcript);

  const date = parseDate(normalized);
  const time = parseTime(normalized);
  const reminderMinutes = getReminderMinutes(normalized);
  const reminderEnabled =
    /\bcon\s+alarma\b/.test(normalized) || /\brecuerdame\b/.test(normalized) || /\bavisame\b/.test(normalized);
  const reminderSilent = /\bsin\s+sonido\b/.test(normalized);
  const title = removeCommandPhrases(transcript);

  const draft: TaskFormValues = {
    title,
    description: transcript ? `Creada desde asistente: "${transcript}"` : '',
    date: date ?? todayInputValue(),
    time: time ?? '09:00',
    color: 'violet',
    textColor: '#ffffff',
    completed: false,
    reminderEnabled: reminderEnabled || reminderSilent || reminderMinutes !== undefined,
    reminderMinutesBefore: reminderMinutes ?? 10,
    reminderSilent,
  };

  const missing: ParsedTaskCommand['missing'] = [];
  if (!title) missing.push('title');
  if (!date) missing.push('date');
  if (!time) missing.push('time');

  return {
    draft,
    transcript,
    missing,
    confidence: missing.length ? 'needs-confirmation' : 'complete',
  };
}
