import type { RecurrenceType, TaskFormValues } from '../../domain/tasks/task';
import { todayInputValue, toDateInputValue } from '../../shared/date';

export type MissingTaskField = 'title' | 'date' | 'time';

export interface ParsedTaskCommand {
  draft: TaskFormValues;
  transcript: string;
  missing: MissingTaskField[];
  confirmationReasons: string[];
  confidence: 'complete' | 'needs-confirmation';
  summary: string;
  detected: {
    title: string;
    date?: string;
    dateLabel?: string;
    time?: string;
    reminderEnabled: boolean;
    reminderSilent: boolean;
    reminderMinutesBefore: number;
    suggestedTimes?: string[];
  };
}

export interface ParseOptions {
  referenceDate?: Date;
}

interface DateParseResult {
  value?: string;
  label?: string;
  confirmationReason?: string;
}

interface TimeParseResult {
  value?: string;
  label?: string;
  confirmationReason?: string;
  suggestedTimes?: string[];
}

interface ReminderParseResult {
  enabled: boolean;
  silent: boolean;
  minutesBefore: number;
}

interface RecurrenceParseResult {
  type: RecurrenceType;
  interval: number;
  daysOfWeek: number[];
  daysOfMonth: number[];
  label?: string;
}

const MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const WEEKDAYS: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 0,
};

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  treinta: 30,
};

const MONTH_PATTERN = Object.keys(MONTHS).join('|');
const WEEKDAY_PATTERN = Object.keys(WEEKDAYS).join('|');
const NUMBER_TOKEN_PATTERN = ['\\d{1,3}', ...Object.keys(NUMBER_WORDS)].join('|');
const HOUR_TOKEN_PATTERN = ['[01]?\\d', '2[0-3]', ...Object.keys(NUMBER_WORDS)].join('|');
const REMINDER_ACTION_PATTERN =
  '(?:activar\\s+recordatorio|con\\s+recordatorio|recordatorio|con\\s+alarma|alarma|avisame|avisar|recuerdame)';
const REMINDER_AMOUNT_PATTERN = `(${NUMBER_TOKEN_PATTERN})\\s+(minutos?|horas?)\\s+antes`;
const WEEKDAY_LIST_PATTERN = `(?:${WEEKDAY_PATTERN})(?:\\s+y\\s+(?:${WEEKDAY_PATTERN}))*`;
const ES_DETAILED_DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[“”]/g, '"')
    .trim();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function formatHumanDate(date: Date) {
  return ES_DETAILED_DATE_FORMATTER.format(date);
}

function formatTime(hour: number, minute: number) {
  return `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`;
}

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
}

function parseNumberToken(token: string | undefined) {
  if (!token) return undefined;

  const normalized = normalize(token);
  const numeric = Number(normalized);

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  return NUMBER_WORDS[normalized];
}

function nextWeekday(targetDay: number, referenceDate: Date) {
  const today = startOfDay(referenceDate);
  const currentDay = today.getDay();
  const diff = (targetDay - currentDay + 7) % 7 || 7;
  return addDays(today, diff);
}

function findWeekdayMention(normalized: string) {
  for (const [weekday, value] of Object.entries(WEEKDAYS)) {
    const matcher = new RegExp(`\\b(?:el\\s+)?(?:proximo\\s+)?${weekday}\\b`);

    if (matcher.test(normalized)) {
      return { name: weekday, value };
    }
  }

  return undefined;
}

function findNearestWeekdayDay(targetWeekday: number, targetDay: number, referenceDate: Date) {
  const today = startOfDay(referenceDate);

  for (let offset = 0; offset <= 62; offset += 1) {
    const candidate = addDays(today, offset);

    if (candidate.getDate() === targetDay && candidate.getDay() === targetWeekday) {
      return candidate;
    }
  }

  return undefined;
}

function findNextDayOfMonth(day: number, referenceDate: Date) {
  const today = startOfDay(referenceDate);

  for (let monthOffset = 0; monthOffset <= 12; monthOffset += 1) {
    const candidate = new Date(today.getFullYear(), today.getMonth() + monthOffset, day);

    if (candidate.getDate() === day && candidate >= today) {
      return candidate;
    }
  }

  return undefined;
}

function parseExplicitMonthDate(normalized: string, referenceDate: Date): DateParseResult | undefined {
  const matcher = new RegExp(
    `\\b(?:el\\s+)?(?:dia\\s+)?([1-9]|[12]\\d|3[01])\\s*(?:de\\s+)?(${MONTH_PATTERN})(?:\\s+de\\s+(\\d{4}))?\\b`,
  );
  const match = normalized.match(matcher);

  if (!match) return undefined;

  const day = Number(match[1]);
  const monthName = match[2];
  const month = MONTHS[monthName];
  const explicitYear = match[3] ? Number(match[3]) : undefined;
  const currentYear = referenceDate.getFullYear();
  let year = explicitYear ?? currentYear;

  if (!isValidDateParts(year, month, day)) {
    return {
      confirmationReason: `La fecha ${day} de ${monthName} no existe. Confirmala manualmente.`,
      label: `${day} de ${monthName}${explicitYear ? ` de ${explicitYear}` : ''}`,
    };
  }

  let date = new Date(year, month, day);
  const today = startOfDay(referenceDate);

  if (!explicitYear && date < today) {
    year += 1;

    if (!isValidDateParts(year, month, day)) {
      return {
        confirmationReason: `La fecha ${day} de ${monthName} no existe. Confirmala manualmente.`,
        label: `${day} de ${monthName}`,
      };
    }

    date = new Date(year, month, day);
  }

  const weekday = findWeekdayMention(normalized);
  const value = toDateInputValue(date);
  const label = formatHumanDate(date);

  if (weekday && date.getDay() !== weekday.value) {
    return {
      value,
      label,
      confirmationReason: `Hay conflicto: ${weekday.name} no coincide con ${label}. Confirmá la fecha antes de guardar.`,
    };
  }

  return { value, label };
}

function parseRelativeDate(normalized: string, referenceDate: Date): DateParseResult | undefined {
  const today = startOfDay(referenceDate);

  if (/\bpasado\s+manana\b/.test(normalized)) {
    const date = addDays(today, 2);
    return { value: toDateInputValue(date), label: formatHumanDate(date) };
  }

  if (/\bmanana\b/.test(normalized)) {
    const date = addDays(today, 1);
    return { value: toDateInputValue(date), label: formatHumanDate(date) };
  }

  if (/\bhoy\b/.test(normalized)) {
    return { value: toDateInputValue(today), label: formatHumanDate(today) };
  }

  const relativeMatcher = new RegExp(`\\bdentro\\s+de\\s+(${NUMBER_TOKEN_PATTERN})\\s+(dias?|semanas?)\\b`);
  const relativeMatch = normalized.match(relativeMatcher);

  if (relativeMatch) {
    const amount = parseNumberToken(relativeMatch[1]) ?? 0;
    const unit = relativeMatch[2];
    const date = addDays(today, unit.startsWith('semana') ? amount * 7 : amount);
    return { value: toDateInputValue(date), label: formatHumanDate(date) };
  }

  return undefined;
}

function parseWeekdayDayDate(normalized: string, referenceDate: Date): DateParseResult | undefined {
  const matcher = new RegExp(`\\b(?:el\\s+)?(?:proximo\\s+)?(${WEEKDAY_PATTERN})\\s+([1-9]|[12]\\d|3[01])\\b`);
  const match = normalized.match(matcher);

  if (!match) return undefined;

  const weekdayName = match[1];
  const targetDay = Number(match[2]);
  const targetWeekday = WEEKDAYS[weekdayName];
  const date = findNearestWeekdayDay(targetWeekday, targetDay, referenceDate);

  if (date) {
    return { value: toDateInputValue(date), label: formatHumanDate(date) };
  }

  const fallback = nextWeekday(targetWeekday, referenceDate);

  return {
    value: toDateInputValue(fallback),
    label: formatHumanDate(fallback),
    confirmationReason: `No encontré un ${weekdayName} día ${targetDay} cercano. Confirmá la fecha antes de guardar.`,
  };
}

function parseWeekdayDate(normalized: string, referenceDate: Date): DateParseResult | undefined {
  const weekday = findWeekdayMention(normalized);

  if (!weekday) return undefined;

  const date = nextWeekday(weekday.value, referenceDate);
  return { value: toDateInputValue(date), label: formatHumanDate(date) };
}

function parseDayOnlyDate(normalized: string, referenceDate: Date): DateParseResult | undefined {
  const match = normalized.match(/\b(?:el\s+)?dias?\s+([1-9]|[12]\d|3[01])\b/);

  if (!match) return undefined;

  const day = Number(match[1]);
  const date = findNextDayOfMonth(day, referenceDate);

  if (!date) {
    return { confirmationReason: `No pude ubicar el día ${day} en un mes válido cercano. Confirmá la fecha manualmente.` };
  }

  return { value: toDateInputValue(date), label: formatHumanDate(date) };
}

function parseDate(normalized: string, referenceDate: Date): DateParseResult {
  return (
    parseExplicitMonthDate(normalized, referenceDate) ??
    parseRelativeDate(normalized, referenceDate) ??
    parseWeekdayDayDate(normalized, referenceDate) ??
    parseWeekdayDate(normalized, referenceDate) ??
    parseDayOnlyDate(normalized, referenceDate) ??
    {}
  );
}

function parseTime(normalized: string, allowBareTime = false): TimeParseResult {
  const prefix = allowBareTime ? '(?:a\\s+las?\\s+|hora\\s+)?' : '(?:a\\s+las?|hora)\\s+';
  const matcher = new RegExp(
    `\\b${prefix}(${HOUR_TOKEN_PATTERN})(?::([0-5]\\d))?(?:\\s+(y\\s+media|y\\s+cuarto|menos\\s+cuarto))?(?:\\s+(?:de\\s+la\\s+)?(manana|tarde|noche))?\\b`,
  );
  const match = normalized.match(matcher);

  if (!match) return {};

  const rawHour = match[1];
  const spokenHour = parseNumberToken(rawHour);

  if (spokenHour === undefined || spokenHour > 23) return {};

  const dayPart = match[4];
  const modifier = match[3];
  const hasLeadingZero = /^0\d$/.test(rawHour);
  let hour = spokenHour;
  let minute = match[2] ? Number(match[2]) : 0;

  if (modifier === 'y media') {
    minute = 30;
  }

  if (modifier === 'y cuarto') {
    minute = 15;
  }

  if (modifier === 'menos cuarto') {
    hour = hour === 0 ? 23 : hour - 1;
    minute = 45;
  }

  if (dayPart === 'manana' && hour === 12) {
    hour = 0;
  }

  if ((dayPart === 'tarde' || dayPart === 'noche') && hour < 12) {
    hour += 12;
  }

  const value = formatTime(hour, minute);
  const isAmbiguousSix = !dayPart && !hasLeadingZero && spokenHour === 6;

  if (!isAmbiguousSix) {
    return { value, label: value };
  }

  const eveningHour = hour < 12 ? hour + 12 : hour;
  const suggestedTimes = [value, formatTime(eveningHour, minute)];

  return {
    value,
    label: value,
    suggestedTimes,
    confirmationReason: `La hora es ambigua. Elegí ${suggestedTimes.join(' o ')} antes de guardar.`,
  };
}

function parseReminderMinutes(value: string) {
  const normalized = normalize(value);
  const withActionMatcher = new RegExp(`\\b${REMINDER_ACTION_PATTERN}\\s+${REMINDER_AMOUNT_PATTERN}\\b`);
  const bareAmountMatcher = new RegExp(`\\b${REMINDER_AMOUNT_PATTERN}\\b`);
  const match = normalized.match(withActionMatcher) ?? normalized.match(bareAmountMatcher);

  if (!match) return undefined;

  const amount = parseNumberToken(match[1]);
  const unit = match[2];

  if (amount === undefined) return undefined;

  return unit.startsWith('hora') ? amount * 60 : amount;
}

function parseReminder(normalized: string, guidedAlarm?: string, guidedReminder?: string): ReminderParseResult {
  const alarmText = guidedAlarm ? normalize(guidedAlarm) : '';
  const reminderText = guidedReminder ? normalize(guidedReminder) : '';
  const fullText = [normalized, alarmText, reminderText].filter(Boolean).join(' ');
  const minutes = parseReminderMinutes(fullText);
  const explicitNoAlarm = /\bsin\s+alarma\b/.test(normalized) || /\b(no|ninguna)\b/.test(alarmText);
  const silent = /\bsin\s+sonido\b/.test(fullText) || /\balarma\s+silenciosa\b/.test(fullText) || /\bsilencios[ao]\b/.test(alarmText);
  const explicitEnabled =
    new RegExp(`\\b${REMINDER_ACTION_PATTERN}\\b`).test(fullText) ||
    /\bcon\s+(alarma|recordatorio)\b/.test(normalized) ||
    /\brecuerdame\b/.test(normalized) ||
    /\bavisame\b/.test(normalized) ||
    /\bavisar\b/.test(normalized) ||
    /\b(si|sí|con|alarma|recordatorio)\b/.test(alarmText) ||
    silent ||
    minutes !== undefined;

  if (explicitNoAlarm) {
    return { enabled: false, silent: false, minutesBefore: 10 };
  }

  return {
    enabled: explicitEnabled,
    silent,
    minutesBefore: explicitEnabled ? minutes ?? 0 : 10,
  };
}

function parseRecurrence(normalized: string): RecurrenceParseResult {
  const weekdays = extractWeekdays(normalized);
  const monthDays = extractMonthDays(normalized);
  const customDays = new RegExp(`\\bcada\\s+(${NUMBER_TOKEN_PATTERN})\\s+dias?\\b`).exec(normalized);
  const customWeeks = new RegExp(`\\bcada\\s+(${NUMBER_TOKEN_PATTERN})\\s+semanas?\\b`).exec(normalized);

  if (/\bdia\s+si\s+dia\s+no\b/.test(normalized)) {
    return { type: 'alternate-days', interval: 2, daysOfWeek: [], daysOfMonth: [], label: 'día sí, día no' };
  }

  if (customDays) {
    const interval = parseNumberToken(customDays[1]) ?? 1;
    return { type: 'custom-days', interval, daysOfWeek: [], daysOfMonth: [], label: `cada ${interval} días` };
  }

  if (customWeeks) {
    const interval = parseNumberToken(customWeeks[1]) ?? 1;
    return { type: 'custom-weeks', interval, daysOfWeek: weekdays, daysOfMonth: [], label: `cada ${interval} semanas` };
  }

  if (/\banual\b/.test(normalized)) {
    return { type: 'yearly', interval: 1, daysOfWeek: [], daysOfMonth: [], label: 'anual' };
  }

  if (/\bmensual\b/.test(normalized) || /\bde\s+cada\s+mes\b/.test(normalized) || monthDays.length > 1) {
    return {
      type: monthDays.length ? 'month-days' : 'monthly',
      interval: 1,
      daysOfWeek: [],
      daysOfMonth: monthDays,
      label: monthDays.length ? `mensual día ${monthDays.join(' y ')}` : 'mensual',
    };
  }

  if (/\btodos?\s+los?\s+dias\b/.test(normalized)) {
    return { type: 'daily', interval: 1, daysOfWeek: [], daysOfMonth: [], label: 'diaria' };
  }

  if (/\bsemanal\b/.test(normalized) || new RegExp(`\\btodos?\\s+los?\\s+${WEEKDAY_LIST_PATTERN}\\b`).test(normalized)) {
    return {
      type: weekdays.length ? 'weekdays' : 'weekly',
      interval: 1,
      daysOfWeek: weekdays,
      daysOfMonth: [],
      label: weekdays.length ? `semanal ${formatWeekdayList(weekdays)}` : 'semanal',
    };
  }

  if (weekdays.length > 1) {
    return {
      type: 'weekdays',
      interval: 1,
      daysOfWeek: weekdays,
      daysOfMonth: [],
      label: `semanal ${formatWeekdayList(weekdays)}`,
    };
  }

  return { type: 'none', interval: 1, daysOfWeek: [], daysOfMonth: [] };
}

function extractWeekdays(normalized: string) {
  const days = Object.entries(WEEKDAYS)
    .filter(([weekday]) => new RegExp(`\\b${weekday}\\b`).test(normalized))
    .map(([, value]) => value);

  return Array.from(new Set(days)).sort((a, b) => a - b);
}

function extractMonthDays(normalized: string) {
  const monthDayMatches = Array.from(
    normalized.matchAll(/\b(?:dias?|dia)\s+([1-9]|[12]\d|3[01])(?:\s+y\s+([1-9]|[12]\d|3[01]))?(?:\s+de\s+cada\s+mes)?\b/g),
  );
  const monthlyMatches = Array.from(normalized.matchAll(/\bmensual\s+(?:el\s+)?dia\s+([1-9]|[12]\d|3[01])\b/g));
  const days = [...monthDayMatches.flatMap((match) => [match[1], match[2]]), ...monthlyMatches.map((match) => match[1])]
    .filter(Boolean)
    .map(Number)
    .filter((day) => day >= 1 && day <= 31);

  return Array.from(new Set(days)).sort((a, b) => a - b);
}

function formatWeekdayList(days: number[]) {
  const labels: Record<number, string> = {
    0: 'domingo',
    1: 'lunes',
    2: 'martes',
    3: 'miércoles',
    4: 'jueves',
    5: 'viernes',
    6: 'sábado',
  };

  return days.map((day) => labels[day]).filter(Boolean).join(' y ');
}

type GuidedFieldName = 'tarea' | 'fecha' | 'hora' | 'alarma' | 'recordatorio';

function extractGuidedFields(input: string) {
  const matches = Array.from(input.matchAll(/\b(tarea|fecha|hora|alarma|recordatorio)\b\s*:?\s*/giu));

  if (matches.length < 2) return undefined;

  const fields: Partial<Record<GuidedFieldName, string>> = {};

  matches.forEach((match, index) => {
    const label = normalize(match[1]) as GuidedFieldName;
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? input.length;
    const value = input.slice(start, end).replace(/^[\s,.;:]+|[\s,.;:]+$/g, '').trim();

    fields[label] = value;
  });

  return fields.tarea ? fields : undefined;
}

function cleanupTitle(value: string) {
  const trimmed = value
    .replace(/[“”]/g, '')
    .replace(/^[\s,.;:]+|[\s,.;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!trimmed) return '';

  return `${trimmed.charAt(0).toLocaleUpperCase('es-ES')}${trimmed.slice(1)}`;
}

const REMINDER_TITLE_PATTERNS = [
  new RegExp(`\\b${REMINDER_ACTION_PATTERN}\\s+${REMINDER_AMOUNT_PATTERN}(?:\\s+de\\s+)?`, 'g'),
  new RegExp(`\\b${REMINDER_AMOUNT_PATTERN}\\b`, 'g'),
  /\balarma\s+silenciosa\b/g,
  /\bsin\s+sonido\b/g,
  /\bsin\s+alarma\b/g,
  /\bactivar\s+recordatorio\b/g,
  /\bcon\s+recordatorio\b/g,
  /\bcon\s+alarma\b/g,
  /\brecordatorio\b/g,
  /\balarma\b/g,
  /\bavisame\b/g,
  /\bavisar\b/g,
  /\brecuerdame\b/g,
];

const RECURRENCE_TITLE_PATTERNS = [
  /\bdia\s+si\s+dia\s+no\b/g,
  new RegExp(`\\btodos?\\s+los?\\s+${WEEKDAY_LIST_PATTERN}\\b`, 'g'),
  new RegExp(`\\blos?\\s+(?:${WEEKDAY_PATTERN})\\b`, 'g'),
  new RegExp(`\\b(?:${WEEKDAY_PATTERN})(?:\\s+y\\s+(?:${WEEKDAY_PATTERN}))+\\b`, 'g'),
  new RegExp(`\\bcada\\s+(?:${NUMBER_TOKEN_PATTERN})\\s+dias?\\b`, 'g'),
  new RegExp(`\\bcada\\s+(?:${NUMBER_TOKEN_PATTERN})\\s+semanas?\\b`, 'g'),
  /\btodos?\s+los?\s+dias?\s+([1-9]|[12]\d|3[01])(?:\s+y\s+([1-9]|[12]\d|3[01]))?\s+de\s+cada\s+mes\b/g,
  /\b(?:dias?|dia)\s+([1-9]|[12]\d|3[01])(?:\s+y\s+([1-9]|[12]\d|3[01]))?\s+de\s+cada\s+mes\b/g,
  /\btodos?\s+los?\s+dias?\b/g,
  /\bmensual\s+(?:el\s+)?dia\s+([1-9]|[12]\d|3[01])\b/g,
  /\bsemanal\b/g,
  /\bmensual\b/g,
  /\banual\b/g,
];

function removeNormalizedMatches(original: string, patterns: RegExp[]) {
  return patterns.reduce((current, pattern) => {
    const normalized = normalize(current);
    const matches = Array.from(normalized.matchAll(pattern));

    return matches
      .reverse()
      .reduce((result, match) => {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        return `${result.slice(0, start)} ${result.slice(end)}`;
      }, current);
  }, original);
}

function removeCommandPhrases(original: string) {
  return cleanupTitle(
    removeNormalizedMatches(original, [...REMINDER_TITLE_PATTERNS, ...RECURRENCE_TITLE_PATTERNS])
      .replace(/\bav[ií]same\s+(?:\d{1,3}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+(?:minutos?|horas?)\s+antes\s+de\s*/gi, ' ')
      .replace(/\brecu[eé]rdame\s+(?:\d{1,3}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+(?:minutos?|horas?)\s+antes\s+de\s*/gi, ' ')
      .replace(/\bav[ií]same\s+(?:\d{1,3}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+(?:minutos?|horas?)\s+antes\b/gi, ' ')
      .replace(/\brecu[eé]rdame\s+(?:\d{1,3}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+(?:minutos?|horas?)\s+antes\b/gi, ' ')
      .replace(/\bav[ií]same\s*/gi, ' ')
      .replace(/\brecu[eé]rdame\s*/gi, ' ')
      .replace(/\b(?:el\s+)?(?:d[ií]a\s+)?([1-9]|[12]\d|3[01])\s*(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+\d{4})?\b/gi, ' ')
      .replace(/\bpasado\s+ma[nñ]ana\b/gi, ' ')
      .replace(/\bma[nñ]ana\b/gi, ' ')
      .replace(/\bhoy\b/gi, ' ')
      .replace(/\bdentro\s+de\s+(?:\d{1,3}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+(?:d[ií]as?|semanas?)\b/gi, ' ')
      .replace(/\b(?:el\s+)?(?:pr[oó]ximo\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+([1-9]|[12]\d|3[01])\b/gi, ' ')
      .replace(/\b(?:el\s+)?(?:pr[oó]ximo\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/gi, ' ')
      .replace(/\b(?:el\s+)?d[ií]as?\s+([1-9]|[12]\d|3[01])\b/gi, ' ')
      .replace(/\ba\s+las?\s+(?:[01]?\d|2[0-3]|una?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintid[oó]s|veintitr[eé]s)(?::[0-5]\d)?(?:\s+(?:y\s+media|y\s+cuarto|menos\s+cuarto))?(?:\s+(?:de\s+la\s+)?(?:ma[nñ]ana|tarde|noche))?\b/gi, ' ')
      .replace(/\bcon\s+(?:alarma|recordatorio)\b/gi, ' ')
      .replace(/\bsin\s+alarma\b/gi, ' ')
      .replace(/\bsin\s+sonido\b/gi, ' ')
      .replace(/\balarma\s+silenciosa\b/gi, ' ')
      .replace(/\s+(?:,|\.)\s+/g, ' '),
  );
}

function createSummary(
  title: string,
  dateLabel: string | undefined,
  time: string | undefined,
  reminder: ReminderParseResult,
  recurrence: RecurrenceParseResult,
) {
  const pieces = [title || 'Título pendiente', dateLabel ?? 'fecha pendiente', time ?? 'hora pendiente'];
  const alarm = reminder.enabled ? 'alarma activada' : 'sin alarma';
  const sound = reminder.enabled ? (reminder.silent ? 'sonido silencioso' : 'sonido activado') : 'sonido no aplica';
  const minutes = reminder.enabled ? `${reminder.minutesBefore} min antes` : undefined;
  const recurrenceLabel = recurrence.type !== 'none' ? `, repetición ${recurrence.label ?? recurrence.type}` : '';

  return `Detectado: ${pieces.join(' — ')} — ${alarm}, ${sound}${minutes ? `, ${minutes}` : ''}${recurrenceLabel}.`;
}

export function parseSpanishTaskCommand(input: string, options: ParseOptions = {}): ParsedTaskCommand {
  const transcript = input.trim();
  const referenceDate = options.referenceDate ?? new Date();
  const guidedFields = extractGuidedFields(transcript);
  const normalized = normalize(transcript);
  const dateSource = normalize(guidedFields?.fecha ?? transcript);
  const timeSource = normalize(guidedFields?.hora ?? transcript);
  const title = cleanupTitle(guidedFields?.tarea ?? '') || removeCommandPhrases(transcript);
  const date = parseDate(dateSource, referenceDate);
  const time = parseTime(timeSource, Boolean(guidedFields?.hora));
  const reminder = parseReminder(normalized, guidedFields?.alarma, guidedFields?.recordatorio);
  const recurrence = parseRecurrence(normalized);
  const referenceDateValue = toDateInputValue(startOfDay(referenceDate));
  const nextReferenceDateValue = toDateInputValue(addDays(startOfDay(referenceDate), 1));
  const recurrenceDate = date.value ?? (recurrence.type !== 'none' ? nextReferenceDateValue : undefined);
  const recurrenceDateLabel = date.label ?? (recurrence.type !== 'none' ? formatHumanDate(referenceDate) : undefined);

  const confirmationReasons = [date.confirmationReason, time.confirmationReason].filter(Boolean) as string[];
  const missing: MissingTaskField[] = [];

  if (!title) {
    missing.push('title');
    confirmationReasons.push('Falta confirmar el título.');
  }

  if (!recurrenceDate) {
    missing.push('date');
    confirmationReasons.push('Falta confirmar la fecha.');
  }

  if (!time.value) {
    missing.push('time');
    confirmationReasons.push('Falta confirmar la hora.');
  }

  const draft: TaskFormValues = {
    title,
    description: transcript ? `Creada desde asistente: "${transcript}"` : '',
    date: recurrenceDate ?? referenceDateValue,
    time: time.value ?? '09:00',
    color: 'violet',
    textColor: '#ffffff',
    completed: false,
    reminderEnabled: reminder.enabled,
    reminderMinutesBefore: reminder.minutesBefore,
    reminderSilent: reminder.silent,
    recurrenceType: recurrence.type,
    recurrenceInterval: recurrence.interval,
    recurrenceDaysOfWeek: recurrence.daysOfWeek,
    recurrenceDaysOfMonth: recurrence.daysOfMonth,
    exceptionDates: [],
    modifiedOccurrences: {},
  };

  return {
    draft,
    transcript,
    missing,
    confirmationReasons,
    confidence: missing.length || confirmationReasons.length ? 'needs-confirmation' : 'complete',
    summary: createSummary(title, recurrenceDateLabel, time.value, reminder, recurrence),
    detected: {
      title,
      date: date.value,
      dateLabel: date.label,
      time: time.value,
      reminderEnabled: reminder.enabled,
      reminderSilent: reminder.silent,
      reminderMinutesBefore: reminder.minutesBefore,
      suggestedTimes: time.suggestedTimes,
    },
  };
}
