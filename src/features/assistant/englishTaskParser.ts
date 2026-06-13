import type { RecurrenceType, TaskFormValues } from '../../domain/tasks/task';
import { toDateInputValue } from '../../shared/date';
import type { MissingTaskField, ParsedTaskCommand, ParseOptions } from './spanishTaskParser';

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
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
};

const MONTH_PATTERN = Object.keys(MONTHS).join('|');
const WEEKDAY_PATTERN = Object.keys(WEEKDAYS).join('|');
const NUMBER_TOKEN_PATTERN = ['\\d{1,3}', ...Object.keys(NUMBER_WORDS)].join('|');
const WEEKDAY_LIST_PATTERN = `(?:${WEEKDAY_PATTERN})(?:\\s+(?:and|,)\\s+(?:${WEEKDAY_PATTERN}))*`;
const REMINDER_AMOUNT_PATTERN = `(${NUMBER_TOKEN_PATTERN})\\s+(minutes?|hours?)\\s+before`;
const REMINDER_ACTION_PATTERN = '(?:with\\s+alarm|with\\s+reminder|remind\\s+me|notify\\s+me|alarm|reminder)';
const EN_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
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
  return EN_DATE_FORMATTER.format(date);
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

  const normalized = normalize(token).replace(/(?:st|nd|rd|th)$/g, '');
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

function findWeekdayMention(normalized: string) {
  for (const [weekday, value] of Object.entries(WEEKDAYS)) {
    const matcher = new RegExp(`\\b(?:next\\s+)?${weekday}\\b`);

    if (matcher.test(normalized)) {
      return { name: weekday, value };
    }
  }

  return undefined;
}

function parseExplicitMonthDate(normalized: string, referenceDate: Date): DateParseResult | undefined {
  const monthFirst = new RegExp(`\\b(${MONTH_PATTERN})\\s+([1-9]|[12]\\d|3[01])(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`);
  const dayFirst = new RegExp(`\\b([1-9]|[12]\\d|3[01])(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4}))?\\b`);
  const match = normalized.match(monthFirst) ?? normalized.match(dayFirst);

  if (!match) return undefined;

  const monthName = MONTHS[match[1]] !== undefined ? match[1] : match[2];
  const day = Number(MONTHS[match[1]] !== undefined ? match[2] : match[1]);
  const explicitYear = match[3] ? Number(match[3]) : undefined;
  const month = MONTHS[monthName];
  let year = explicitYear ?? referenceDate.getFullYear();

  if (!isValidDateParts(year, month, day)) {
    return {
      confirmationReason: `The date ${monthName} ${day} does not exist. Confirm it manually.`,
      label: `${monthName} ${day}${explicitYear ? ` ${explicitYear}` : ''}`,
    };
  }

  let date = new Date(year, month, day);
  const today = startOfDay(referenceDate);

  if (!explicitYear && date < today) {
    year += 1;
    date = new Date(year, month, day);
  }

  return { value: toDateInputValue(date), label: formatHumanDate(date) };
}

function parseRelativeDate(normalized: string, referenceDate: Date): DateParseResult | undefined {
  const today = startOfDay(referenceDate);

  if (/\bthe\s+day\s+after\s+tomorrow\b/.test(normalized)) {
    const date = addDays(today, 2);
    return { value: toDateInputValue(date), label: formatHumanDate(date) };
  }

  if (/\btomorrow\b/.test(normalized)) {
    const date = addDays(today, 1);
    return { value: toDateInputValue(date), label: formatHumanDate(date) };
  }

  if (/\btoday\b/.test(normalized)) {
    return { value: toDateInputValue(today), label: formatHumanDate(today) };
  }

  return undefined;
}

function parseWeekdayDate(normalized: string, referenceDate: Date): DateParseResult | undefined {
  const weekday = findWeekdayMention(normalized);

  if (!weekday) return undefined;

  const date = nextWeekday(weekday.value, referenceDate);
  return { value: toDateInputValue(date), label: formatHumanDate(date) };
}

function parseRecurringMonthDayDate(normalized: string, referenceDate: Date): DateParseResult | undefined {
  const monthDays = extractMonthDays(normalized);

  if (!monthDays.length) return undefined;

  const nextDate = monthDays.map((day) => findNextDayOfMonth(day, referenceDate)).find(Boolean);

  return nextDate ? { value: toDateInputValue(nextDate), label: formatHumanDate(nextDate) } : undefined;
}

function parseDate(normalized: string, referenceDate: Date): DateParseResult {
  return (
    parseExplicitMonthDate(normalized, referenceDate) ??
    parseRelativeDate(normalized, referenceDate) ??
    parseRecurringMonthDayDate(normalized, referenceDate) ??
    parseWeekdayDate(normalized, referenceDate) ??
    {}
  );
}

function parseTime(normalized: string, allowBareTime = false): TimeParseResult {
  const prefix = allowBareTime ? '(?:at\\s+|time\\s*)?' : 'at\\s+';
  const numericMatcher = new RegExp(`\\b${prefix}([01]?\\d|2[0-3])(?::([0-5]\\d))?\\s*(am|pm)?\\b`);
  const numericMatch = normalized.match(numericMatcher);

  if (numericMatch) {
    let hour = Number(numericMatch[1]);
    const minute = numericMatch[2] ? Number(numericMatch[2]) : 0;
    const meridiem = numericMatch[3];

    if (meridiem === 'am' && hour === 12) hour = 0;
    if (meridiem === 'pm' && hour < 12) hour += 12;

    const value = formatTime(hour, minute);
    return { value, label: value };
  }

  const phraseMatcher = new RegExp(`\\b${prefix}(half\\s+past|quarter\\s+past|quarter\\s+to)\\s+(${NUMBER_TOKEN_PATTERN})\\b`);
  const phraseMatch = normalized.match(phraseMatcher);

  if (!phraseMatch) return {};

  const hourToken = parseNumberToken(phraseMatch[2]);
  if (hourToken === undefined || hourToken < 1 || hourToken > 12) return {};

  let hour = hourToken;
  let minute = 0;

  if (phraseMatch[1] === 'half past') minute = 30;
  if (phraseMatch[1] === 'quarter past') minute = 15;
  if (phraseMatch[1] === 'quarter to') {
    hour = hour === 1 ? 12 : hour - 1;
    minute = 45;
  }

  const value = formatTime(hour, minute);
  const eveningHour = hour < 12 ? hour + 12 : hour;

  return {
    value,
    label: value,
    suggestedTimes: [value, formatTime(eveningHour, minute)],
    confirmationReason: `The time is ambiguous. Choose ${value} or ${formatTime(eveningHour, minute)} before saving.`,
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

  return unit.startsWith('hour') ? amount * 60 : amount;
}

function parseReminder(normalized: string, guidedAlarm?: string, guidedReminder?: string): ReminderParseResult {
  const alarmText = guidedAlarm ? normalize(guidedAlarm) : '';
  const reminderText = guidedReminder ? normalize(guidedReminder) : '';
  const fullText = [normalized, alarmText, reminderText].filter(Boolean).join(' ');
  const minutes = parseReminderMinutes(fullText);
  const explicitNoAlarm = /\b(no\s+alarm|without\s+alarm)\b/.test(fullText) || /\b(no|none)\b/.test(alarmText);
  const silent = /\b(silent\s+alarm|without\s+sound|no\s+sound)\b/.test(fullText);
  const explicitEnabled =
    new RegExp(`\\b${REMINDER_ACTION_PATTERN}\\b`).test(fullText) ||
    /\b(yes|with|alarm|reminder)\b/.test(alarmText) ||
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
  const customDays = new RegExp(`\\bevery\\s+(${NUMBER_TOKEN_PATTERN})\\s+days?\\b`).exec(normalized);
  const customWeeks = new RegExp(`\\bevery\\s+(${NUMBER_TOKEN_PATTERN})\\s+weeks?\\b`).exec(normalized);

  if (/\bevery\s+other\s+day\b/.test(normalized)) {
    return { type: 'alternate-days', interval: 2, daysOfWeek: [], daysOfMonth: [], label: 'every other day' };
  }

  if (customDays) {
    const interval = parseNumberToken(customDays[1]) ?? 1;
    return { type: 'custom-days', interval, daysOfWeek: [], daysOfMonth: [], label: `every ${interval} days` };
  }

  if (customWeeks) {
    const interval = parseNumberToken(customWeeks[1]) ?? 1;
    return { type: 'custom-weeks', interval, daysOfWeek: weekdays, daysOfMonth: [], label: `every ${interval} weeks` };
  }

  if (monthDays.length) {
    return {
      type: 'month-days',
      interval: 1,
      daysOfWeek: [],
      daysOfMonth: monthDays,
      label: `monthly day ${monthDays.join(' and ')}`,
    };
  }

  if (/\bevery\s+day\b/.test(normalized) || /\bdaily\b/.test(normalized)) {
    return { type: 'daily', interval: 1, daysOfWeek: [], daysOfMonth: [], label: 'daily' };
  }

  if (/\byearly\b/.test(normalized)) {
    return { type: 'yearly', interval: 1, daysOfWeek: [], daysOfMonth: [], label: 'yearly' };
  }

  if (/\bmonthly\b/.test(normalized)) {
    return { type: 'monthly', interval: 1, daysOfWeek: [], daysOfMonth: [], label: 'monthly' };
  }

  if (/\bweekly\b/.test(normalized)) {
    return { type: weekdays.length ? 'weekdays' : 'weekly', interval: 1, daysOfWeek: weekdays, daysOfMonth: [], label: 'weekly' };
  }

  if (new RegExp(`\\bevery\\s+${WEEKDAY_LIST_PATTERN}\\b`).test(normalized) || weekdays.length > 1) {
    return {
      type: 'weekdays',
      interval: 1,
      daysOfWeek: weekdays,
      daysOfMonth: [],
      label: `weekly ${formatWeekdayList(weekdays)}`,
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
  const everyMonthMatches = Array.from(
    normalized.matchAll(/\bon\s+the\s+([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?(?:\s+and\s+([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?)?\s+of\s+every\s+month\b/g),
  );
  const days = everyMonthMatches
    .flatMap((match) => [match[1], match[2]])
    .filter(Boolean)
    .map(Number)
    .filter((day) => day >= 1 && day <= 31);

  return Array.from(new Set(days)).sort((a, b) => a - b);
}

function formatWeekdayList(days: number[]) {
  const labels: Record<number, string> = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  };

  return days.map((day) => labels[day]).filter(Boolean).join(' and ');
}

type GuidedFieldName = 'task' | 'date' | 'time' | 'alarm' | 'reminder';

function extractGuidedFields(input: string) {
  const matches = Array.from(input.matchAll(/\b(task|date|time|alarm|reminder)\b\s*:?\s*/giu));

  if (matches.length < 2) return undefined;

  const fields: Partial<Record<GuidedFieldName, string>> = {};

  matches.forEach((match, index) => {
    const label = normalize(match[1]) as GuidedFieldName;
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? input.length;
    const value = input.slice(start, end).replace(/^[\s,.;:]+|[\s,.;:]+$/g, '').trim();

    fields[label] = value;
  });

  return fields.task ? fields : undefined;
}

function cleanupTitle(value: string) {
  const trimmed = value
    .replace(/[“”]/g, '')
    .replace(/^[\s,.;:]+|[\s,.;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!trimmed) return '';

  return `${trimmed.charAt(0).toLocaleUpperCase('en-US')}${trimmed.slice(1)}`;
}

const REMINDER_TITLE_PATTERNS = [
  new RegExp(`\\b${REMINDER_ACTION_PATTERN}\\s+${REMINDER_AMOUNT_PATTERN}\\b`, 'g'),
  new RegExp(`\\b${REMINDER_AMOUNT_PATTERN}\\b`, 'g'),
  /\bsilent\s+alarm\b/g,
  /\bwithout\s+sound\b/g,
  /\bno\s+sound\b/g,
  /\bno\s+alarm\b/g,
  /\bwith\s+alarm\b/g,
  /\bwith\s+reminder\b/g,
  /\bremind\s+me\b/g,
  /\bnotify\s+me\b/g,
  /\balarm\b/g,
  /\breminder\b/g,
];

const RECURRENCE_TITLE_PATTERNS = [
  /\bevery\s+other\s+day\b/g,
  new RegExp(`\\bevery\\s+${WEEKDAY_LIST_PATTERN}\\b`, 'g'),
  new RegExp(`\\b(?:${WEEKDAY_PATTERN})(?:\\s+(?:and|,)\\s+(?:${WEEKDAY_PATTERN}))+\\b`, 'g'),
  new RegExp(`\\bevery\\s+(?:${NUMBER_TOKEN_PATTERN})\\s+days?\\b`, 'g'),
  new RegExp(`\\bevery\\s+(?:${NUMBER_TOKEN_PATTERN})\\s+weeks?\\b`, 'g'),
  /\bon\s+the\s+([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?(?:\s+and\s+([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?)?\s+of\s+every\s+month\b/g,
  /\bevery\s+day\b/g,
  /\bdaily\b/g,
  /\bweekly\b/g,
  /\bmonthly\b/g,
  /\byearly\b/g,
];

function removeNormalizedMatches(original: string, patterns: RegExp[]) {
  return patterns.reduce((current, pattern) => {
    const normalized = normalize(current);
    const matches = Array.from(normalized.matchAll(pattern));

    return matches.reverse().reduce((result, match) => {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      return `${result.slice(0, start)} ${result.slice(end)}`;
    }, current);
  }, original);
}

function removeCommandPhrases(original: string) {
  return cleanupTitle(
    removeNormalizedMatches(original, [...REMINDER_TITLE_PATTERNS, ...RECURRENCE_TITLE_PATTERNS])
      .replace(/\b(?:the\s+day\s+after\s+tomorrow|tomorrow|today)\b/gi, ' ')
      .replace(/\b(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, ' ')
      .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi, ' ')
      .replace(/\b([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?\b/gi, ' ')
      .replace(/\bat\s+([01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:am|pm)?\b/gi, ' ')
      .replace(/\bat\s+(?:half\s+past|quarter\s+past|quarter\s+to)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi, ' ')
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
  const pieces = [title || 'Title pending', dateLabel ?? 'date pending', time ?? 'time pending'];
  const alarm = reminder.enabled ? 'alarm enabled' : 'no alarm';
  const sound = reminder.enabled ? (reminder.silent ? 'silent sound' : 'sound on') : 'sound not applicable';
  const minutes = reminder.enabled ? `${reminder.minutesBefore} min before` : undefined;
  const recurrenceLabel = recurrence.type !== 'none' ? `, repeat ${recurrence.label ?? recurrence.type}` : '';

  return `Detected: ${pieces.join(' — ')} — ${alarm}, ${sound}${minutes ? `, ${minutes}` : ''}${recurrenceLabel}.`;
}

export function parseEnglishTaskCommand(input: string, options: ParseOptions = {}): ParsedTaskCommand {
  const transcript = input.trim();
  const referenceDate = options.referenceDate ?? new Date();
  const guidedFields = extractGuidedFields(transcript);
  const normalized = normalize(transcript);
  const dateSource = normalize(guidedFields?.date ?? transcript);
  const timeSource = normalize(guidedFields?.time ?? transcript);
  const title = cleanupTitle(guidedFields?.task ?? '') || removeCommandPhrases(transcript);
  const date = parseDate(dateSource, referenceDate);
  const time = parseTime(timeSource, Boolean(guidedFields?.time));
  const reminder = parseReminder(normalized, guidedFields?.alarm, guidedFields?.reminder);
  const recurrence = parseRecurrence(normalized);
  const referenceDateValue = toDateInputValue(startOfDay(referenceDate));
  const nextReferenceDateValue = toDateInputValue(addDays(startOfDay(referenceDate), 1));
  const recurrenceDate = date.value ?? (recurrence.type !== 'none' ? nextReferenceDateValue : undefined);
  const recurrenceDateLabel = date.label ?? (recurrence.type !== 'none' ? formatHumanDate(referenceDate) : undefined);
  const confirmationReasons = [date.confirmationReason, time.confirmationReason].filter(Boolean) as string[];
  const missing: MissingTaskField[] = [];

  if (!title) {
    missing.push('title');
    confirmationReasons.push('Confirm the title.');
  }

  if (!recurrenceDate) {
    missing.push('date');
    confirmationReasons.push('Confirm the date.');
  }

  if (!time.value) {
    missing.push('time');
    confirmationReasons.push('Confirm the time.');
  }

  const draft: TaskFormValues = {
    title,
    description: transcript ? `Created from assistant: "${transcript}"` : '',
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
