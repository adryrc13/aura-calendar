import type { RecurrenceType, Task } from './task';
import { parseInputDate, toDateInputValue } from '../../shared/date';
import { createTranslator, type Language, type TranslationParams } from '../../shared/i18n';

export interface OccurrenceRange {
  start: string;
  end: string;
}

const DAY_MS = 86_400_000;

export function isRecurringTask(task: Pick<Task, 'recurrenceType'>) {
  return task.recurrenceType !== undefined && task.recurrenceType !== 'none';
}

export function isVirtualOccurrence(task: Task) {
  return Boolean(task.isVirtualOccurrence && task.sourceTaskId && task.occurrenceDate);
}

export function buildRecurrenceRule(draft: Partial<Task>) {
  const type = draft.recurrenceType ?? 'none';

  if (type === 'none') return undefined;

  const parts = [`type=${type}`, `interval=${Math.max(1, Number(draft.recurrenceInterval || 1))}`];

  if (draft.recurrenceDaysOfWeek?.length) {
    parts.push(`weekdays=${[...draft.recurrenceDaysOfWeek].sort((a, b) => a - b).join(',')}`);
  }

  if (draft.recurrenceDaysOfMonth?.length) {
    parts.push(`monthdays=${[...draft.recurrenceDaysOfMonth].sort((a, b) => a - b).join(',')}`);
  }

  if (draft.recurrenceEndDate) {
    parts.push(`until=${draft.recurrenceEndDate}`);
  }

  if (draft.recurrenceCount) {
    parts.push(`count=${draft.recurrenceCount}`);
  }

  return parts.join(';');
}

export function expandTasksInRange(tasks: Task[], range: OccurrenceRange) {
  return tasks
    .flatMap((task) => expandTaskOccurrences(task, range))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

export function expandTaskOccurrences(task: Task, range: OccurrenceRange): Task[] {
  const recurrenceType = task.recurrenceType ?? 'none';

  if (recurrenceType === 'none') {
    return task.date >= range.start && task.date <= range.end ? [task] : [];
  }

  const anchor = parseInputDate(task.date);
  const rangeStart = parseInputDate(range.start);
  const rangeEnd = parseInputDate(range.end);
  const recurrenceEnd = task.recurrenceEndDate ? parseInputDate(task.recurrenceEndDate) : undefined;
  const lastDate = recurrenceEnd && recurrenceEnd < rangeEnd ? recurrenceEnd : rangeEnd;
  const occurrences: Task[] = [];
  let matchedCount = 0;

  for (let cursor = new Date(anchor); cursor <= lastDate; cursor.setDate(cursor.getDate() + 1)) {
    const value = toDateInputValue(cursor);

    if (!matchesRecurrence(task, cursor, anchor)) continue;

    const isException = (task.exceptionDates ?? []).includes(value);
    const override = task.modifiedOccurrences?.[value];

    if (!isException && !override?.deleted) {
      matchedCount += 1;
    }

    if (task.recurrenceCount && matchedCount > task.recurrenceCount) break;
    if (cursor < rangeStart || isException || override?.deleted) continue;

    occurrences.push({
      ...task,
      ...override,
      id: `${task.id}__${value}`,
      date: value,
      parentTaskId: task.id,
      sourceTaskId: task.id,
      occurrenceDate: value,
      isVirtualOccurrence: true,
      recurrenceType,
      recurrenceInterval: task.recurrenceInterval ?? 1,
      recurrenceDaysOfWeek: task.recurrenceDaysOfWeek ?? [],
      recurrenceDaysOfMonth: task.recurrenceDaysOfMonth ?? [],
      exceptionDates: task.exceptionDates ?? [],
      modifiedOccurrences: task.modifiedOccurrences ?? {},
    });
  }

  return occurrences;
}

function matchesRecurrence(task: Task, candidate: Date, anchor: Date) {
  if (candidate < anchor) return false;

  const type = task.recurrenceType ?? 'none';
  const interval = Math.max(1, task.recurrenceInterval || 1);
  const diffDays = daysBetween(anchor, candidate);
  const weekdays = task.recurrenceDaysOfWeek ?? [];
  const monthDays = task.recurrenceDaysOfMonth ?? [];

  switch (type) {
    case 'daily':
      return diffDays % interval === 0;
    case 'alternate-days':
      return diffDays % 2 === 0;
    case 'custom-days':
      return diffDays % interval === 0;
    case 'weekly':
    case 'custom-weeks':
    case 'weekdays': {
      const days = weekdays.length ? weekdays : [anchor.getDay()];
      return days.includes(candidate.getDay()) && weeksBetween(anchor, candidate) % interval === 0;
    }
    case 'monthly':
    case 'month-days': {
      const days = monthDays.length ? monthDays : [anchor.getDate()];
      return days.includes(candidate.getDate()) && monthsBetween(anchor, candidate) % interval === 0;
    }
    case 'yearly':
      return (
        candidate.getMonth() === anchor.getMonth() &&
        candidate.getDate() === anchor.getDate() &&
        (candidate.getFullYear() - anchor.getFullYear()) % interval === 0
      );
    default:
      return false;
  }
}

function daysBetween(start: Date, end: Date) {
  return Math.round((stripTime(end).getTime() - stripTime(start).getTime()) / DAY_MS);
}

function weeksBetween(start: Date, end: Date) {
  return Math.floor(daysBetween(startOfWeek(start), end) / 7);
}

function monthsBetween(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
}

function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const stripped = stripTime(date);
  stripped.setDate(stripped.getDate() - ((stripped.getDay() + 6) % 7));
  return stripped;
}

type Translate = (key: string, params?: TranslationParams) => string;

export function recurrenceLabel(
  task: Pick<Task, 'recurrenceType' | 'recurrenceInterval' | 'recurrenceDaysOfWeek' | 'recurrenceDaysOfMonth'>,
  translate: Translate = createTranslator('es'),
  language: Language = 'es',
) {
  const type = task.recurrenceType ?? 'none';

  if (type === 'custom-days') return translate('recurrence.label.custom-days', { count: task.recurrenceInterval || 1 });
  if (type === 'custom-weeks') return translate('recurrence.label.custom-weeks', { count: task.recurrenceInterval || 1 });
  if (type === 'weekdays') {
    return translate('recurrence.label.weekdays', { days: formatWeekdays(task.recurrenceDaysOfWeek ?? [], translate, language) });
  }
  if (type === 'month-days') {
    return translate('recurrence.label.month-days', { days: formatList((task.recurrenceDaysOfMonth ?? []).map(String), language) });
  }
  if (type !== 'none') return translate(`recurrence.label.${type}`);

  return translate('recurrence.label.none');
}

function formatWeekdays(days: number[], translate: Translate, language: Language) {
  const labels = days.map((day) => translate(`weekday.${day}`)).filter(Boolean);

  return formatList(labels, language) || translate('recurrence.label.initialDay');
}

function formatList(items: string[], language: Language) {
  if (!items.length) return '';
  if (items.length === 1) return items[0];

  const separator = language === 'en' ? ' and ' : ' y ';
  return `${items.slice(0, -1).join(', ')}${separator}${items[items.length - 1]}`;
}
