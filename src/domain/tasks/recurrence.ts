import type { RecurrenceType, Task } from './task';
import { parseInputDate, toDateInputValue } from '../../shared/date';

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

export function recurrenceLabel(task: Pick<Task, 'recurrenceType' | 'recurrenceInterval' | 'recurrenceDaysOfWeek' | 'recurrenceDaysOfMonth'>) {
  const type = task.recurrenceType ?? 'none';

  if (type === 'none') return 'Sin repetición';
  if (type === 'daily') return 'Diaria';
  if (type === 'weekly') return 'Semanal';
  if (type === 'monthly') return 'Mensual';
  if (type === 'yearly') return 'Anual';
  if (type === 'alternate-days') return 'Día sí, día no';
  if (type === 'custom-days') return `Cada ${task.recurrenceInterval || 1} días`;
  if (type === 'custom-weeks') return `Cada ${task.recurrenceInterval || 1} semanas`;
  if (type === 'weekdays') return `Semanal: ${formatWeekdays(task.recurrenceDaysOfWeek ?? [])}`;
  if (type === 'month-days') return `Mensual: día ${(task.recurrenceDaysOfMonth ?? []).join(' y ')}`;

  return 'Repetición';
}

function formatWeekdays(days: number[]) {
  const labels: Record<number, string> = {
    0: 'domingo',
    1: 'lunes',
    2: 'martes',
    3: 'miércoles',
    4: 'jueves',
    5: 'viernes',
    6: 'sábado',
  };

  return days.map((day) => labels[day]).filter(Boolean).join(' y ') || 'día inicial';
}
